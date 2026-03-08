
CREATE TABLE public.user_model_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  model_id text NOT NULL DEFAULT 'gemini-3-flash',
  model_name text NOT NULL DEFAULT 'Gemini 3 Flash',
  model_type text NOT NULL DEFAULT 'cloud',
  ollama_endpoint text DEFAULT 'http://localhost:11434',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_model_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own model preferences"
  ON public.user_model_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_model_prefs_updated_at
  BEFORE UPDATE ON public.user_model_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
