
-- Custom tools table for user-added external tools
CREATE TABLE public.custom_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'Utilities',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own custom tools" ON public.custom_tools
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recently used tools tracking
CREATE TABLE public.recent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_id text NOT NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

ALTER TABLE public.recent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recent tools" ON public.recent_tools
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
