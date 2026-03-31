import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decryptKey(encrypted: string, secret: string): string {
  const decoded = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const secretBytes = new TextEncoder().encode(secret);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ secretBytes[i % secretBytes.length];
  }
  return new TextDecoder().decode(result);
}

async function getUserGeminiApiKey(
  authHeader: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseServiceKey: string,
) {
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return null;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await serviceClient
      .from("user_api_keys")
      .select("encrypted_key, is_valid")
      .eq("user_id", claimsData.claims.sub as string)
      .eq("provider", "gemini")
      .maybeSingle();

    if (!data?.encrypted_key || data.is_valid === false) return null;
    return decryptKey(data.encrypted_key, supabaseServiceKey);
  } catch (error) {
    console.error("Failed to load Gemini API key:", error);
    return null;
  }
}

function mapGeminiModel(toolType: string) {
  return toolType === "research" ? "gemini-1.5-pro" : "gemini-1.5-flash";
}

async function fetchAiStreamWithFallback(
  toolType: string,
  body: Record<string, unknown>,
  lovableApiKey: string | null,
  geminiApiKey: string | null,
) {
  const attempts = [
    lovableApiKey
      ? {
          label: "lovable",
          url: "https://ai.gateway.lovable.dev/v1/chat/completions",
          auth: `Bearer ${lovableApiKey}`,
          body,
        }
      : null,
    geminiApiKey
      ? {
          label: "gemini",
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          auth: `Bearer ${geminiApiKey}`,
          body: { ...body, model: mapGeminiModel(toolType) },
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; url: string; auth: string; body: Record<string, unknown> }>;

  let lastError: { status: number; text: string } | null = null;

  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: "POST",
      headers: {
        Authorization: attempt.auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attempt.body),
    });

    if (response.ok) return { response, error: null };

    const text = await response.text();
    console.error(`${attempt.label} AI error ${response.status}: ${text}`);
    lastError = { status: response.status, text };

    const shouldTryFallback = attempt.label === "lovable" && Boolean(geminiApiKey) && response.status === 402;
    if (!shouldTryFallback) break;
  }

  return { response: null, error: lastError };
}

const TOOL_PROMPTS: Record<string, string> = {
  summary: `You are a document summarization expert. Provide a comprehensive, well-structured summary of the document content below. Include:
- A brief overview (2-3 sentences)
- Key points organized by theme
- Important details and findings
- A conclusion
Use markdown formatting with headers, bullet points, and bold text for emphasis.`,

  ai_detector: `You are an AI content detection expert. Analyze the following text and determine the likelihood it was written by AI vs a human. Provide:
- An overall AI probability score (0-100%)
- Analysis of writing patterns (sentence structure, vocabulary diversity, coherence)
- Specific indicators that suggest AI or human authorship
- A detailed breakdown by paragraph if the text is long enough
Use markdown formatting. Be balanced and explain your reasoning.`,

  ai_writer: `You are a professional content writer. Based on the document content provided, create a well-written, polished piece of content. Include:
- A compelling title
- Well-structured paragraphs with clear flow
- Professional tone appropriate for the subject matter
- Key insights and takeaways
Use markdown formatting with proper headers and structure.`,

  flashcards: `You are an educational content creator. Based on the document content below, generate a set of study flashcards. For each flashcard provide:
- **Question**: A clear, focused question
- **Answer**: A concise but complete answer

Generate 10-15 flashcards covering the most important concepts. Format each as:

### Flashcard [number]
**Q:** [question]
**A:** [answer]

---`,

  slides: `You are a presentation designer. Based on the document content below, create a slide deck outline. For each slide provide:
- **Slide Title**: A clear, concise title
- **Key Points**: 3-4 bullet points
- **Speaker Notes**: A brief note on what to say

Generate 8-12 slides that tell a compelling story. Format as:

### Slide [number]: [Title]
**Key Points:**
- Point 1
- Point 2
- Point 3

**Speaker Notes:** [notes]

---`,

  research: `You are a research assistant. Based on the topic or content provided, conduct a thorough analysis. Include:
- **Overview**: Background and context
- **Key Findings**: Main points and evidence
- **Analysis**: Critical evaluation of the information
- **Related Topics**: Areas for further exploration
- **Sources & References**: Suggested areas to look into

Use markdown formatting with clear headers and structured content.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { toolType, text, documentId } = await req.json();
    if (!toolType || !TOOL_PROMPTS[toolType]) throw new Error("Invalid tool type");
    if (!text && !documentId) throw new Error("Either text or documentId is required");

    let contentToProcess = text || "";

    // If documentId provided, fetch document chunks
    if (documentId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? null;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const geminiApiKey = await getUserGeminiApiKey(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);

      const { data: chunks, error } = await supabase
        .from("document_chunks")
        .select("content, chunk_index")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true })
        .limit(30);

      if (error) throw new Error("Failed to fetch document content");
      if (!chunks || chunks.length === 0) throw new Error("No document content found. The document may still be processing.");

      contentToProcess = chunks.map((c: any) => c.content).join("\n\n");
    }

    // Truncate to ~12k tokens worth of text
    if (contentToProcess.length > 48000) {
      contentToProcess = contentToProcess.slice(0, 48000) + "\n\n[Content truncated for processing]";
    }

    const systemPrompt = TOOL_PROMPTS[toolType];
    const userMessage = toolType === "research" && !documentId
      ? `Research the following topic:\n\n${contentToProcess}`
      : `Process the following document content:\n\n${contentToProcess}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? null;
    const geminiApiKey = await getUserGeminiApiKey(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);

    const { response, error } = await fetchAiStreamWithFallback(toolType, {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
    }, LOVABLE_API_KEY, geminiApiKey);

    if (!response) {
      if (error?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error?.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits or save a valid Gemini API key in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (error?.status === 401 || error?.status === 403) {
        return new Response(JSON.stringify({ error: "Invalid Gemini API key. Please update it in Settings." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${error?.status || 500}: ${error?.text || "Unknown error"}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tool-process error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
