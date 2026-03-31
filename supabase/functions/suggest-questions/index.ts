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

function mapGeminiModel() {
  return "gemini-1.5-flash";
}

async function fetchAiWithFallback(body: Record<string, unknown>, lovableApiKey: string | null, geminiApiKey: string | null) {
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
          body: { ...body, model: mapGeminiModel() },
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { documentId, type } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? null;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const geminiApiKey = await getUserGeminiApiKey(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);

    // Get first chunks for context
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })
      .limit(5);

    if (!chunks || chunks.length === 0) {
      throw new Error("No document content found");
    }

    const content = chunks.map((c: any) => c.content).join("\n\n");

    let systemPrompt = "";
    if (type === "questions") {
      systemPrompt = `Based on this document content, generate exactly 4 smart questions a user might ask. Return ONLY a JSON array of strings, no other text. Example: ["Question 1?", "Question 2?", "Question 3?", "Question 4?"]`;
    } else if (type === "keypoints") {
      systemPrompt = `Based on this document content, extract 5-7 key points. Return ONLY a JSON array of strings, no other text. Example: ["Point 1", "Point 2", "Point 3"]`;
    } else {
      throw new Error("Invalid type. Use 'questions' or 'keypoints'");
    }

    const { response, error } = await fetchAiWithFallback({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content.slice(0, 4000) },
      ],
    }, LOVABLE_API_KEY, geminiApiKey);

    if (!response) {
      console.error(`AI fallback failed: ${error?.status} ${error?.text}`);
      // Return empty items gracefully so the UI doesn't break
      return new Response(JSON.stringify({ items: [], error: `Upstream ${error?.status || 500}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response
    let items: string[] = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        items = JSON.parse(match[0]);
      }
    } catch {
      items = [];
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
