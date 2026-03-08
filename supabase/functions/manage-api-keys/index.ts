import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XOR-based obfuscation with a server-side secret
function encryptKey(key: string): string {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback";
  const encoded = new TextEncoder().encode(key);
  const secretBytes = new TextEncoder().encode(secret);
  const result = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secretBytes[i % secretBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}

function decryptKey(encrypted: string): string {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback";
  const decoded = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const secretBytes = new TextEncoder().encode(secret);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ secretBytes[i % secretBytes.length];
  }
  return new TextDecoder().decode(result);
}

async function validateApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    if (provider === "gemini") {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) return { valid: true };
      if (resp.status === 401 || resp.status === 403) return { valid: false, error: "Invalid API key" };
      return { valid: false, error: `API returned status ${resp.status}` };
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) return { valid: true };
      if (resp.status === 401) return { valid: false, error: "Invalid API key" };
      return { valid: false, error: `API returned status ${resp.status}` };
    }

    return { valid: false, error: "Unknown provider" };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Validation failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, provider, apiKey } = await req.json();

    // GET: List user's API keys (masked)
    if (action === "list") {
      const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await serviceSupabase
        .from("user_api_keys")
        .select("provider, is_valid, last_validated_at, updated_at")
        .eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ keys: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE: Save and validate an API key
    if (action === "save") {
      if (!provider || !apiKey) throw new Error("provider and apiKey are required");
      if (!["gemini", "openai"].includes(provider)) throw new Error("Invalid provider");

      // Validate the key first
      const validation = await validateApiKey(provider, apiKey);

      const encrypted = encryptKey(apiKey);
      const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      
      const { error } = await serviceSupabase.from("user_api_keys").upsert({
        user_id: userId,
        provider,
        encrypted_key: encrypted,
        is_valid: validation.valid,
        last_validated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        valid: validation.valid, 
        error: validation.error 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VALIDATE: Re-validate an existing key
    if (action === "validate") {
      if (!provider) throw new Error("provider is required");

      const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await serviceSupabase
        .from("user_api_keys")
        .select("encrypted_key")
        .eq("user_id", userId)
        .eq("provider", provider)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No API key found for this provider");

      const decrypted = decryptKey(data.encrypted_key);
      const validation = await validateApiKey(provider, decrypted);

      await serviceSupabase.from("user_api_keys").update({
        is_valid: validation.valid,
        last_validated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("provider", provider);

      return new Response(JSON.stringify({ valid: validation.valid, error: validation.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: Remove an API key
    if (action === "delete") {
      if (!provider) throw new Error("provider is required");
      const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await serviceSupabase
        .from("user_api_keys")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET_DECRYPTED: Internal use - get decrypted key for chat function
    if (action === "get_decrypted") {
      if (!provider) throw new Error("provider is required");
      const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await serviceSupabase
        .from("user_api_keys")
        .select("encrypted_key, is_valid")
        .eq("user_id", userId)
        .eq("provider", provider)
        .maybeSingle();

      if (error) throw error;
      if (!data) return new Response(JSON.stringify({ key: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      return new Response(JSON.stringify({ key: decryptKey(data.encrypted_key), valid: data.is_valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
