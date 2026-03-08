
-- Important Links table
CREATE TABLE public.important_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'Research',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.important_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own links" ON public.important_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quick Questions (saved prompts) table
CREATE TABLE public.quick_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own quick questions" ON public.quick_questions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Favorite tools table
CREATE TABLE public.favorite_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

ALTER TABLE public.favorite_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorite tools" ON public.favorite_tools
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
