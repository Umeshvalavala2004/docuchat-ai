import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple text extraction from PDF binary
function extractTextFromPDF(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes);
  const textBlocks: string[] = [];
  
  // Extract text between BT and ET markers (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Extract text from Tj, TJ, ' and " operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textBlocks.push(tjMatch[1]);
    }
    // TJ array
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        textBlocks.push(strMatch[1]);
      }
    }
  }
  
  // Also try stream-based extraction for compressed PDFs
  if (textBlocks.length < 5) {
    // Fallback: extract any readable text sequences
    const readableRegex = /[\x20-\x7E]{20,}/g;
    let readableMatch;
    while ((readableMatch = readableRegex.exec(text)) !== null) {
      const cleaned = readableMatch[0].replace(/[^\w\s.,;:!?'"()\-\/]/g, ' ').trim();
      if (cleaned.length > 15) {
        textBlocks.push(cleaned);
      }
    }
  }

  return textBlocks.join(' ').replace(/\s+/g, ' ').trim();
}

function chunkText(text: string, chunkSize = 500, overlap = 100): { content: string; index: number }[] {
  const words = text.split(/\s+/);
  const chunks: { content: string; index: number }[] = [];
  let i = 0;
  let chunkIndex = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 10) {
      chunks.push({ content: chunk, index: chunkIndex });
      chunkIndex++;
    }
    i += chunkSize - overlap;
  }

  return chunks;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text.slice(0, 8000),
      model: "text-embedding-3-small",
      dimensions: 768,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");

    // Update status to processing
    await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    // Download file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);
    if (fileError || !fileData) throw new Error("Failed to download file: " + fileError?.message);

    // Extract text based on file type
    let fullText = "";
    const fileType = doc.file_type.toLowerCase();

    if (fileType === "txt" || fileType === "text/plain") {
      fullText = await fileData.text();
    } else if (fileType === "pdf" || fileType === "application/pdf") {
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      fullText = extractTextFromPDF(bytes);
    } else {
      // For docx and others, try as text
      fullText = await fileData.text();
    }

    if (!fullText || fullText.length < 10) {
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Could not extract text from document. The PDF may be scanned/image-based.");
    }

    // Chunk the text (500 words with 100 word overlap)
    const chunks = chunkText(fullText, 500, 100);
    console.log(`Created ${chunks.length} chunks from document`);

    // Generate embeddings and insert chunks
    const chunkRecords = [];
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content, LOVABLE_API_KEY);
        chunkRecords.push({
          document_id: documentId,
          content: chunk.content,
          chunk_index: chunk.index,
          page_number: null,
          embedding: JSON.stringify(embedding),
          metadata: { word_count: chunk.content.split(/\s+/).length },
        });
      } catch (e) {
        console.error(`Failed to embed chunk ${chunk.index}:`, e);
      }
    }

    if (chunkRecords.length === 0) {
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Failed to generate any embeddings");
    }

    // Batch insert chunks
    const batchSize = 50;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("document_chunks").insert(batch);
      if (insertError) {
        console.error("Chunk insert error:", insertError);
        throw new Error("Failed to store chunks: " + insertError.message);
      }
    }

    // Generate summary
    let summary = "";
    try {
      const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Summarize this document in 2-3 sentences." },
            { role: "user", content: fullText.slice(0, 4000) },
          ],
        }),
      });
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.choices?.[0]?.message?.content || "";
      }
    } catch (e) {
      console.error("Summary generation failed:", e);
    }

    // Update document as ready
    await supabase.from("documents").update({
      status: "ready",
      summary,
      page_count: Math.ceil(fullText.length / 3000),
    }).eq("id", documentId);

    return new Response(JSON.stringify({ 
      success: true, 
      chunks: chunkRecords.length,
      summary 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
