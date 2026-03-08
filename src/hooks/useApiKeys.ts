import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApiKeyStatus {
  provider: string;
  is_valid: boolean;
  last_validated_at: string | null;
  updated_at: string;
}

export function useApiKeys(userId: string | null) {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "list" },
      });
      if (error) throw error;
      setKeys(data?.keys || []);
    } catch (e) {
      console.error("Failed to fetch API keys:", e);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const saveKey = useCallback(async (provider: string, apiKey: string) => {
    const { data, error } = await supabase.functions.invoke("manage-api-keys", {
      body: { action: "save", provider, apiKey },
    });
    if (error) throw error;
    await fetchKeys();
    return data;
  }, [fetchKeys]);

  const validateKey = useCallback(async (provider: string) => {
    const { data, error } = await supabase.functions.invoke("manage-api-keys", {
      body: { action: "validate", provider },
    });
    if (error) throw error;
    await fetchKeys();
    return data;
  }, [fetchKeys]);

  const deleteKey = useCallback(async (provider: string) => {
    const { data, error } = await supabase.functions.invoke("manage-api-keys", {
      body: { action: "delete", provider },
    });
    if (error) throw error;
    await fetchKeys();
    return data;
  }, [fetchKeys]);

  const hasValidKey = useCallback((provider: string) => {
    return keys.some((k) => k.provider === provider && k.is_valid);
  }, [keys]);

  return { keys, loading, saveKey, validateKey, deleteKey, hasValidKey, refetch: fetchKeys };
}
