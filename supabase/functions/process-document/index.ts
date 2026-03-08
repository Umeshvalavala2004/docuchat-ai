import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractTextFromPDFWithUnpdf(bytes: Uint8Array): Promise<{ text: string; quality: "good" | "poor" }> {
  try {
    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(doc, { mergePages: true });
    const hasGoodText = text.length > 500 && (text.match(/[a-zA-Z]/g) || []).length > 100;
    return { text, quality: hasGoodText ? "good" : "poor" };
  } catch (e) {
    console.error("unpdf extraction failed:", e);
    return { text: "", quality: "poor" };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractTextWithVisionAPI(pdfBytes: Uint8Array, apiKey: string): Promise<string> {
  console.log("Falling back to Vision API for scanned PDF...");
  const base64Pdf = arrayBufferToBase64(pdfBytes.buffer);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ALL text from this PDF document. Return only the extracted text content, preserving paragraphs and structure. Do not add any commentary." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Vision API error:", err);
    throw new Error("Vision API extraction failed");
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\S\n]+$/gm, '')
    .trim();
}

function chunkText(text: string, chunkSize = 500, overlap = 100): { content: string; index: number }[] {
  const words = text.split(/\s+/);
  const chunks: { content: string; index: number }[] = [];
  let i = 0;
  let chunkIndex = 0;
  const seen = new Set<string>();

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 10) {
      // Deduplicate: skip chunks that are >90% similar to previous
      const fingerprint = chunk.slice(0, 200);
      if (!seen.has(fingerprint)) {
        chunks.push({ content: chunk, index: chunkIndex });
        chunkIndex++;
        seen.add(fingerprint);
      }
    }
    i += chunkSize - overlap;
  }

  return chunks;
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
      const result = await extractTextFromPDFWithUnpdf(bytes);
      if (result.quality === "good") {
        fullText = result.text;
      } else {
        console.log("Native PDF extraction yielded poor results, trying Vision API...");
        fullText = await extractTextWithVisionAPI(bytes, LOVABLE_API_KEY);
      }
    } else {
      fullText = await fileData.text();
    }

    if (!fullText || fullText.trim().length < 10) {
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Could not extract text from document. The PDF may be empty or corrupted.");
    }

    // Clean text
    fullText = cleanText(fullText);
    console.log(`Extracted ${fullText.length} characters from document`);

    // Update to indexing status
    await supabase.from("documents").update({ status: "indexing" }).eq("id", documentId);

    // Chunk the text
    const chunks = chunkText(fullText, 500, 100);
    console.log(`Created ${chunks.length} chunks from document`);

    // Insert chunks
    const chunkRecords = chunks.map((chunk) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.index,
      page_number: null,
      metadata: { word_count: chunk.content.split(/\s+/).length },
    }));

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
            { role: "system", content: "Summarize this document in 2-3 sentences. Be concise and informative." },
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
      chunk_count: chunkRecords.length,
    }).eq("id", documentId);

    return new Response(JSON.stringify({
      success: true,
      chunks: chunkRecords.length,
      summary,
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
