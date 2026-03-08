import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Full-text keyword search on document chunks
    const searchQuery = message.split(/\s+/).filter((w: string) => w.length > 2).join(' & ');
    
    let chunks: any[] = [];

    // Try full-text search first
    if (searchQuery) {
      const { data, error } = await supabase
        .from("document_chunks")
        .select("id, content, chunk_index, page_number")
        .eq("document_id", documentId)
        .textSearch("content", searchQuery, { type: "plain" })
        .limit(8);

      if (!error && data && data.length > 0) {
        chunks = data;
      }
    }

    // Fallback: if no keyword matches, get first chunks as context
    if (chunks.length === 0) {
      const { data, error } = await supabase
        .from("document_chunks")
        .select("id, content, chunk_index, page_number")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true })
        .limit(8);

      if (!error && data) {
        chunks = data;
      }
    }

    if (chunks.length === 0) {
      throw new Error("No document content found. The document may still be processing.");
    }

    const context = chunks
      .map((c: any, i: number) => `[Source ${i + 1}] (chunk ${c.chunk_index})\n${c.content}`)
      .join("\n\n---\n\n");

    const sources = chunks.map((c: any) => ({
      id: c.id,
      content: c.content.slice(0, 200),
      chunk_index: c.chunk_index,
      page_number: c.page_number,
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

    // Stream with sources injected at the start
    const encoder = new TextEncoder();
    const reader = llmResponse.body!.getReader();

    const stream = new ReadableStream({
      async start(controller) {
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
