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

    const { message, documentId, documentIds, chatSessionId, history } = await req.json();
    if (!message) throw new Error("message is required");

    // Support multi-document: use documentIds array or fall back to single documentId
    const docIds: string[] = documentIds || (documentId ? [documentId] : []);
    if (docIds.length === 0) throw new Error("At least one documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract keywords for search
    const searchWords = message
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .filter((w: string) => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'was', 'one', 'our', 'out', 'with', 'this', 'that', 'from', 'have', 'what', 'how', 'who', 'when', 'where', 'which', 'does', 'will', 'about'].includes(w));

    let allChunks: any[] = [];

    // Search across all selected documents
    for (const dId of docIds) {
      let chunks: any[] = [];

      // Strategy 1: Full-text search
      if (searchWords.length > 0) {
        const searchQuery = searchWords.join(' & ');
        const { data, error } = await supabase
          .from("document_chunks")
          .select("id, content, chunk_index, page_number, document_id")
          .eq("document_id", dId)
          .textSearch("content", searchQuery, { type: "plain" })
          .limit(6);

        if (!error && data && data.length > 0) {
          chunks = data.map((c: any) => ({ ...c, search_method: "keyword" }));
        }
      }

      // Strategy 2: Individual word matching (broader search)
      if (chunks.length < 4 && searchWords.length > 0) {
        for (const word of searchWords.slice(0, 3)) {
          const { data } = await supabase
            .from("document_chunks")
            .select("id, content, chunk_index, page_number, document_id")
            .eq("document_id", dId)
            .ilike("content", `%${word}%`)
            .limit(3);

          if (data) {
            const existingIds = new Set(chunks.map((c: any) => c.id));
            for (const c of data) {
              if (!existingIds.has(c.id)) {
                chunks.push({ ...c, search_method: "partial" });
                existingIds.add(c.id);
              }
            }
          }
        }
      }

      // Strategy 3: Fallback to first chunks
      if (chunks.length === 0) {
        const { data } = await supabase
          .from("document_chunks")
          .select("id, content, chunk_index, page_number, document_id")
          .eq("document_id", dId)
          .order("chunk_index", { ascending: true })
          .limit(6);

        if (data) {
          chunks = data.map((c: any) => ({ ...c, search_method: "fallback" }));
        }
      }

      allChunks = allChunks.concat(chunks);
    }

    if (allChunks.length === 0) {
      throw new Error("No document content found. The document may still be processing.");
    }

    // Limit to top 10 chunks across all docs
    allChunks = allChunks.slice(0, 10);

    // Get document names for multi-doc context
    let docNames: Record<string, string> = {};
    if (docIds.length > 1) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, name")
        .in("id", docIds);
      if (docs) {
        for (const d of docs) docNames[d.id] = d.name;
      }
    }

    const context = allChunks
      .map((c: any, i: number) => {
        const docLabel = docNames[c.document_id] ? ` from "${docNames[c.document_id]}"` : "";
        return `[Source ${i + 1}]${docLabel} (chunk ${c.chunk_index})\n${c.content}`;
      })
      .join("\n\n---\n\n");

    const sources = allChunks.map((c: any, i: number) => ({
      id: c.id,
      content: c.content.slice(0, 300),
      chunk_index: c.chunk_index,
      page_number: c.page_number,
      document_id: c.document_id,
      score: c.search_method === "keyword" ? 0.95 : c.search_method === "partial" ? 0.75 : 0.5,
    }));

    // Build messages with history
    const multiDocNote = docIds.length > 1 ? "You are chatting across multiple documents. Indicate which document each answer comes from." : "";
    const systemPrompt = `You are a document Q&A assistant. Answer questions STRICTLY based on the provided document context. 
${multiDocNote}
If the answer is not found in the context, say "I couldn't find this information in the document."
Always cite which source numbers you used. Be precise, helpful, and well-structured.
Use markdown formatting for readability.

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
