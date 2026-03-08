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

    const { documentId, type } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content.slice(0, 4000) },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      throw new Error(`AI error: ${t}`);
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
