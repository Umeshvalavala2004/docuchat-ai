import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    throw new Error(`Embedding error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { message, documentId, chatSessionId, history } = await req.json();
    if (!message) throw new Error("message is required");
    if (!documentId) throw new Error("documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate embedding for the user's question
    const queryEmbedding = await generateEmbedding(message, LOVABLE_API_KEY);

    // Hybrid search: semantic + keyword
    const { data: chunks, error: searchError } = await supabase.rpc("hybrid_search", {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: message,
      match_document_id: documentId,
      match_count: 8,
      semantic_weight: 0.7,
      keyword_weight: 0.3,
    });

    if (searchError) {
      console.error("Search error:", searchError);
      throw new Error("Failed to search document: " + searchError.message);
    }

    const context = (chunks || [])
      .map((c: any, i: number) => `[Source ${i + 1}] (chunk ${c.chunk_index}, score: ${c.combined_score?.toFixed(3)})\n${c.content}`)
      .join("\n\n---\n\n");

    const sources = (chunks || []).map((c: any) => ({
      id: c.id,
      content: c.content.slice(0, 200),
      chunk_index: c.chunk_index,
      page_number: c.page_number,
      score: c.combined_score,
    }));

    // Build messages with history
    const systemPrompt = `You are a document Q&A assistant. Answer questions STRICTLY based on the provided document context. 
If the answer is not found in the context, say "I couldn't find this information in the document."
Always cite which source numbers you used. Be precise and helpful.

DOCUMENT CONTEXT:
${context}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: "user", content: message });

    // Stream response from LLM
    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!llmResponse.ok) {
      if (llmResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (llmResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await llmResponse.text();
      throw new Error(`LLM error ${llmResponse.status}: ${errText}`);
    }

    // Create a transform stream that injects sources at the end
    const encoder = new TextEncoder();
    const reader = llmResponse.body!.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send sources as a custom SSE event first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
