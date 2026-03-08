import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XOR decrypt matching manage-api-keys function
function decryptKey(encrypted: string, secret: string): string {
  const decoded = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const secretBytes = new TextEncoder().encode(secret);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ secretBytes[i % secretBytes.length];
  }
  return new TextDecoder().decode(result);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { message, documentId, documentIds, chatSessionId, history, modelId, responseStyle } = await req.json();
    if (!message) throw new Error("message is required");

    const docIds: string[] = documentIds || (documentId ? [documentId] : []);
    if (docIds.length === 0) throw new Error("At least one documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine if this is a BYOK model request
    const isByok = modelId?.startsWith("byok-");
    let byokApiKey: string | null = null;
    let byokProvider: string | null = null;
    let actualModelId = modelId || "google/gemini-3-flash-preview";
    let apiEndpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiAuthHeader = `Bearer ${LOVABLE_API_KEY}`;

    if (isByok) {
      // Get user ID from auth
      const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
      const userId = claimsData.claims.sub as string;

      // Determine provider and actual model from BYOK model ID
      if (modelId === "byok-gemini-pro") {
        byokProvider = "gemini";
        actualModelId = "gemini-1.5-pro";
      } else if (modelId === "byok-gemini-flash") {
        byokProvider = "gemini";
        actualModelId = "gemini-1.5-flash";
      } else if (modelId === "byok-gpt-4o") {
        byokProvider = "openai";
        actualModelId = "gpt-4o";
      } else if (modelId === "byok-gpt-4o-mini") {
        byokProvider = "openai";
        actualModelId = "gpt-4o-mini";
      }

      if (byokProvider) {
        // Fetch user's encrypted API key
        const { data: keyData } = await supabase
          .from("user_api_keys")
          .select("encrypted_key, is_valid")
          .eq("user_id", userId)
          .eq("provider", byokProvider)
          .maybeSingle();

        if (!keyData || !keyData.is_valid) {
          throw new Error(`No valid ${byokProvider} API key found. Please add your API key in Settings.`);
        }

        byokApiKey = decryptKey(keyData.encrypted_key, supabaseServiceKey);

        if (byokProvider === "openai") {
          apiEndpoint = "https://api.openai.com/v1/chat/completions";
          apiAuthHeader = `Bearer ${byokApiKey}`;
        } else if (byokProvider === "gemini") {
          apiEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
          apiAuthHeader = `Bearer ${byokApiKey}`;
        }
      }
    }

    const startTime = Date.now();

    // --- Step 1: Retrieve top 8 candidate chunks per doc ---
    let allCandidates: any[] = [];

    for (const dId of docIds) {
      const { data: hybridResults, error: hybridError } = await supabase.rpc("hybrid_search", {
        query_embedding: null as any,
        query_text: message,
        match_document_id: dId,
        match_count: 8,
        semantic_weight: 0.7,
        keyword_weight: 0.3,
      });

      if (!hybridError && hybridResults && hybridResults.length > 0) {
        allCandidates.push(...hybridResults.map((c: any) => ({
          id: c.id, content: c.content, chunk_index: c.chunk_index, page_number: c.page_number,
          similarity: c.similarity || 0, keyword_rank: c.keyword_rank || 0,
          combined_score: c.combined_score || 0, document_id: dId, search_method: "hybrid",
        })));
      } else {
        const searchWords = message.toLowerCase().split(/\s+/)
          .filter((w: string) => w.length > 2)
          .filter((w: string) => !['the','and','for','are','but','not','you','all','can','has','was','one','our','out','with','this','that','from','have','what','how','who','when','where','which','does','will','about'].includes(w));

        let chunks: any[] = [];
        if (searchWords.length > 0) {
          const { data } = await supabase.from("document_chunks").select("id, content, chunk_index, page_number")
            .eq("document_id", dId).textSearch("content", searchWords.join(' & '), { type: "plain" }).limit(8);
          if (data) chunks = data;
        }
        if (chunks.length < 4 && searchWords.length > 0) {
          for (const word of searchWords.slice(0, 3)) {
            const { data } = await supabase.from("document_chunks").select("id, content, chunk_index, page_number")
              .eq("document_id", dId).ilike("content", `%${word}%`).limit(4);
            if (data) {
              const ids = new Set(chunks.map((c: any) => c.id));
              for (const c of data) if (!ids.has(c.id)) { chunks.push(c); ids.add(c.id); }
            }
          }
        }
        if (chunks.length === 0) {
          const { data } = await supabase.from("document_chunks").select("id, content, chunk_index, page_number")
            .eq("document_id", dId).order("chunk_index", { ascending: true }).limit(8);
          if (data) chunks = data;
        }
        allCandidates.push(...chunks.map((c: any) => ({
          ...c, document_id: dId, similarity: 0, keyword_rank: 0, combined_score: 0.5, search_method: "keyword_fallback",
        })));
      }
    }

    if (allCandidates.length === 0) {
      throw new Error("No document content found. The document may still be processing.");
    }

    allCandidates = allCandidates.slice(0, 16);
    const totalCandidates = allCandidates.length;

    // --- Step 2: Reranking (use platform key for reranking always) ---
    let rerankedChunks: any[] = allCandidates;

    if (allCandidates.length > 5) {
      const rerankPrompt = `You are a relevance scoring system. Given a question and document chunks, rate each chunk's relevance on a scale of 0.0 to 1.0.

Question: "${message}"

Chunks:
${allCandidates.map((c: any, i: number) => `[${i}] ${c.content.slice(0, 400)}`).join("\n\n")}

Return ONLY a JSON array of objects with "index" and "score" fields, sorted by score descending.`;

      try {
        const rerankResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: rerankPrompt }], temperature: 0 }),
        });

        if (rerankResp.ok) {
          const rerankData = await rerankResp.json();
          const rawContent = rerankData.choices?.[0]?.message?.content || "";
          const jsonMatch = rawContent.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const scores: { index: number; score: number }[] = JSON.parse(jsonMatch[0]);
            for (const s of scores) {
              if (s.index >= 0 && s.index < allCandidates.length) allCandidates[s.index].rerank_score = s.score;
            }
            rerankedChunks = [...allCandidates].filter((c) => c.rerank_score !== undefined).sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0));
            const scoredIds = new Set(rerankedChunks.map((c) => c.id));
            for (const c of allCandidates) if (!scoredIds.has(c.id)) rerankedChunks.push(c);
          }
        }
      } catch (e) {
        console.error("Reranking failed:", e);
      }
    }

    // --- Step 3: Select top 5 ---
    const topChunks = rerankedChunks.slice(0, 5);
    const scores = topChunks.map((c) => c.rerank_score ?? c.combined_score ?? c.similarity ?? 0.5);
    const topScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const retrievalTimeMs = Date.now() - startTime;

    let docNames: Record<string, string> = {};
    if (docIds.length > 1) {
      const { data: docs } = await supabase.from("documents").select("id, name").in("id", docIds);
      if (docs) for (const d of docs) docNames[d.id] = d.name;
    }

    const context = topChunks.map((c: any, i: number) => {
      const docLabel = docNames[c.document_id] ? ` from "${docNames[c.document_id]}"` : "";
      const score = (c.rerank_score ?? c.combined_score ?? 0.5).toFixed(2);
      return `[Source ${i + 1}]${docLabel} (chunk ${c.chunk_index}, relevance: ${score})\n${c.content}`;
    }).join("\n\n---\n\n");

    const sources = topChunks.map((c: any) => ({
      id: c.id, content: c.content.slice(0, 300), chunk_index: c.chunk_index,
      page_number: c.page_number, document_id: c.document_id, score: c.rerank_score ?? c.combined_score ?? 0.5,
    }));

    const retrievalMetrics = {
      totalCandidates, selectedChunks: topChunks.length,
      topScore: Math.round(topScore * 100) / 100, avgScore: Math.round(avgScore * 100) / 100,
      retrievalTimeMs,
      searchMethods: topChunks.reduce((acc: Record<string, number>, c: any) => { acc[c.search_method] = (acc[c.search_method] || 0) + 1; return acc; }, {}),
      reranked: topChunks.some((c: any) => c.rerank_score !== undefined),
    };

    const multiDocNote = docIds.length > 1 ? "You are chatting across multiple documents. Indicate which document each answer comes from." : "";
    const styleInstructions: Record<string, string> = {
      Concise: "Be extremely concise and brief. Use short sentences and bullet points. Avoid unnecessary detail.",
      Detailed: "Be thorough and well-structured. Provide comprehensive explanations with examples where helpful.",
      Academic: "Use formal academic language. Include precise terminology, structured arguments, and scholarly tone. Cite sources methodically.",
    };
    const styleNote = styleInstructions[responseStyle || "Detailed"] || styleInstructions.Detailed;
    const systemPrompt = `You are a document Q&A assistant. Answer questions STRICTLY based on the provided document context.
${multiDocNote}
RESPONSE STYLE: ${styleNote}

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

    // Stream response from appropriate LLM
    const llmResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: { Authorization: apiAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ model: actualModelId, messages, stream: true }),
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
      if (llmResponse.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid API key. Please update your API key in Settings." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await llmResponse.text();
      throw new Error(`LLM error ${llmResponse.status}: ${errText}`);
    }

    const encoder = new TextEncoder();
    const reader = llmResponse.body!.getReader();

    const stream = new ReadableStream({
      async start(controller) {
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
