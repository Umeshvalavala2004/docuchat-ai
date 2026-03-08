
-- Create workspaces table
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text DEFAULT 'folder',
  color text DEFAULT '#6366f1',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own workspaces"
  ON public.workspaces FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add workspace_id to documents and chat_sessions
ALTER TABLE public.documents ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.chat_sessions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
