import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ModelConfig {
  model_id: string;
  model_name: string;
  model_type: "cloud" | "local";
  ollama_endpoint: string;
}

const DEFAULT_MODEL: ModelConfig = {
  model_id: "gemini-3-flash",
  model_name: "Gemini 3 Flash",
  model_type: "cloud",
  ollama_endpoint: "http://localhost:11434",
};

export function useModelPreference(userId: string | null) {
  const [model, setModel] = useState<ModelConfig>(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("user_model_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setModel({
          model_id: data.model_id,
          model_name: data.model_name,
          model_type: data.model_type as "cloud" | "local",
          ollama_endpoint: data.ollama_endpoint || "http://localhost:11434",
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  const updateModel = useCallback(async (newModel: ModelConfig) => {
    setModel(newModel);
    if (!userId) return;
    await supabase.from("user_model_preferences").upsert({
      user_id: userId,
      model_id: newModel.model_id,
      model_name: newModel.model_name,
      model_type: newModel.model_type,
      ollama_endpoint: newModel.ollama_endpoint,
    }, { onConflict: "user_id" });
  }, [userId]);

  return { model, loading, updateModel };
}
