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

    const { message, documentId, documentIds, chatSessionId, history, modelId } = await req.json();
    if (!message) throw new Error("message is required");

    const docIds: string[] = documentIds || (documentId ? [documentId] : []);
    if (docIds.length === 0) throw new Error("At least one documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startTime = Date.now();

    // --- Step 1: Retrieve top 8 candidate chunks per doc using hybrid search ---
    let allCandidates: any[] = [];

    for (const dId of docIds) {
      // Try hybrid_search RPC (dense + BM25)
      const { data: hybridResults, error: hybridError } = await supabase.rpc("hybrid_search", {
        query_embedding: null as any, // Will fall back to keyword if no embedding
        query_text: message,
        match_document_id: dId,
        match_count: 8,
        semantic_weight: 0.7,
        keyword_weight: 0.3,
      });

      if (!hybridError && hybridResults && hybridResults.length > 0) {
        allCandidates.push(...hybridResults.map((c: any) => ({
          id: c.id,
          content: c.content,
          chunk_index: c.chunk_index,
          page_number: c.page_number,
          similarity: c.similarity || 0,
          keyword_rank: c.keyword_rank || 0,
          combined_score: c.combined_score || 0,
          document_id: dId,
          search_method: "hybrid",
        })));
      } else {
        // Fallback: keyword search if hybrid fails (e.g. no embeddings)
        const searchWords = message
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .filter((w: string) => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'was', 'one', 'our', 'out', 'with', 'this', 'that', 'from', 'have', 'what', 'how', 'who', 'when', 'where', 'which', 'does', 'will', 'about'].includes(w));

        let chunks: any[] = [];

        if (searchWords.length > 0) {
          const searchQuery = searchWords.join(' & ');
          const { data } = await supabase
            .from("document_chunks")
            .select("id, content, chunk_index, page_number")
            .eq("document_id", dId)
            .textSearch("content", searchQuery, { type: "plain" })
            .limit(8);
          if (data) chunks = data;
        }

        if (chunks.length < 4 && searchWords.length > 0) {
          for (const word of searchWords.slice(0, 3)) {
            const { data } = await supabase
              .from("document_chunks")
              .select("id, content, chunk_index, page_number")
              .eq("document_id", dId)
              .ilike("content", `%${word}%`)
              .limit(4);
            if (data) {
              const ids = new Set(chunks.map((c: any) => c.id));
              for (const c of data) if (!ids.has(c.id)) { chunks.push(c); ids.add(c.id); }
            }
          }
        }

        if (chunks.length === 0) {
          const { data } = await supabase
            .from("document_chunks")
            .select("id, content, chunk_index, page_number")
            .eq("document_id", dId)
            .order("chunk_index", { ascending: true })
            .limit(8);
          if (data) chunks = data;
        }

        allCandidates.push(...chunks.map((c: any) => ({
          ...c,
          document_id: dId,
          similarity: 0,
          keyword_rank: 0,
          combined_score: 0.5,
          search_method: "keyword_fallback",
        })));
      }
    }

    if (allCandidates.length === 0) {
      throw new Error("No document content found. The document may still be processing.");
    }

    // Cap candidates at 16 across all docs
    allCandidates = allCandidates.slice(0, 16);
    const totalCandidates = allCandidates.length;

    // --- Step 2: Cross-encoder reranking via LLM ---
    let rerankedChunks: any[] = allCandidates;

    if (allCandidates.length > 5) {
      const rerankPrompt = `You are a relevance scoring system. Given a question and document chunks, rate each chunk's relevance to the question on a scale of 0.0 to 1.0.

Question: "${message}"

Chunks:
${allCandidates.map((c: any, i: number) => `[${i}] ${c.content.slice(0, 400)}`).join("\n\n")}

Return ONLY a JSON array of objects with "index" and "score" fields, sorted by score descending. Example: [{"index":0,"score":0.95},{"index":2,"score":0.8}]`;

      try {
        const rerankResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: rerankPrompt }],
            temperature: 0,
          }),
        });

        if (rerankResp.ok) {
          const rerankData = await rerankResp.json();
          const rawContent = rerankData.choices?.[0]?.message?.content || "";
          // Extract JSON array from response
          const jsonMatch = rawContent.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const scores: { index: number; score: number }[] = JSON.parse(jsonMatch[0]);
            // Apply reranked scores
            for (const s of scores) {
              if (s.index >= 0 && s.index < allCandidates.length) {
                allCandidates[s.index].rerank_score = s.score;
              }
            }
            // Sort by rerank score
            rerankedChunks = [...allCandidates]
              .filter((c) => c.rerank_score !== undefined)
              .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0));

            // Add any unscored chunks at the end
            const scoredIds = new Set(rerankedChunks.map((c) => c.id));
            for (const c of allCandidates) {
              if (!scoredIds.has(c.id)) rerankedChunks.push(c);
            }
          }
        }
      } catch (e) {
        console.error("Reranking failed, using original order:", e);
      }
    }

    // --- Step 3: Select top 5 chunks after reranking ---
    const topChunks = rerankedChunks.slice(0, 5);

    // Calculate retrieval metrics
    const scores = topChunks.map((c) => c.rerank_score ?? c.combined_score ?? c.similarity ?? 0.5);
    const topScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const retrievalTimeMs = Date.now() - startTime;

    // Get document names for multi-doc context
    let docNames: Record<string, string> = {};
    if (docIds.length > 1) {
      const { data: docs } = await supabase.from("documents").select("id, name").in("id", docIds);
      if (docs) for (const d of docs) docNames[d.id] = d.name;
    }

    const context = topChunks
      .map((c: any, i: number) => {
        const docLabel = docNames[c.document_id] ? ` from "${docNames[c.document_id]}"` : "";
        const score = (c.rerank_score ?? c.combined_score ?? 0.5).toFixed(2);
        return `[Source ${i + 1}]${docLabel} (chunk ${c.chunk_index}, relevance: ${score})\n${c.content}`;
      })
      .join("\n\n---\n\n");

    const sources = topChunks.map((c: any) => ({
      id: c.id,
      content: c.content.slice(0, 300),
      chunk_index: c.chunk_index,
      page_number: c.page_number,
      document_id: c.document_id,
      score: c.rerank_score ?? c.combined_score ?? 0.5,
    }));

    const retrievalMetrics = {
      totalCandidates,
      selectedChunks: topChunks.length,
      topScore: Math.round(topScore * 100) / 100,
      avgScore: Math.round(avgScore * 100) / 100,
      retrievalTimeMs,
      searchMethods: topChunks.reduce((acc: Record<string, number>, c: any) => {
        acc[c.search_method] = (acc[c.search_method] || 0) + 1;
        return acc;
      }, {}),
      reranked: topChunks.some((c: any) => c.rerank_score !== undefined),
    };

    // Build messages with history
    const multiDocNote = docIds.length > 1 ? "You are chatting across multiple documents. Indicate which document each answer comes from." : "";
    const systemPrompt = `You are a document Q&A assistant. Answer questions STRICTLY based on the provided document context.
${multiDocNote}
CRITICAL RULES:
1. ONLY use information from the provided context below. Do NOT use any prior knowledge.
2. If the answer is NOT found in the context, respond: "I couldn't find this information in the provided document sections. Try rephrasing your question or asking about a different topic covered in the document."
3. Always cite which source numbers you used (e.g., [Source 1], [Source 3]).
4. Be precise, helpful, and well-structured. Use markdown formatting.
5. If only partial information is available, state what you found and note what's missing.

DOCUMENT CONTEXT:
${context}`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) messages.push({ role: h.role, content: h.content });
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
        model: modelId || "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!llmResponse.ok) {
      if (llmResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (llmResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await llmResponse.text();
      throw new Error(`LLM error ${llmResponse.status}: ${errText}`);
    }

    const encoder = new TextEncoder();
    const reader = llmResponse.body!.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        // Send sources + metrics as first SSE event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources, retrievalMetrics })}\n\n`));

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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
