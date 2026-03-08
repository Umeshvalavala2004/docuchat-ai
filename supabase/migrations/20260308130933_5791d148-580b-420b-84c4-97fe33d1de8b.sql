
-- Create share permission enum
CREATE TYPE public.share_permission AS ENUM ('viewer', 'editor');

-- Document shares table
CREATE TABLE public.document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  permission share_permission NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, shared_with_email)
);

ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage shares
CREATE POLICY "Owners can manage document shares"
  ON public.document_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared users can view their shares
CREATE POLICY "Users can view shares with them"
  ON public.document_shares FOR SELECT
  USING (auth.uid() = shared_with_user_id);

-- Chat session shares table
CREATE TABLE public.chat_session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  permission share_permission NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_session_id, shared_with_email)
);

ALTER TABLE public.chat_session_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage chat shares
CREATE POLICY "Owners can manage chat shares"
  ON public.chat_session_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared users can view their chat shares
CREATE POLICY "Users can view chat shares with them"
  ON public.chat_session_shares FOR SELECT
  USING (auth.uid() = shared_with_user_id);

-- Allow shared users to view shared documents (add policy to documents table)
CREATE POLICY "Users can view shared documents"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_shares
      WHERE document_shares.document_id = documents.id
        AND document_shares.shared_with_user_id = auth.uid()
    )
  );

-- Allow shared users to view shared chat sessions
CREATE POLICY "Users can view shared chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_session_shares
      WHERE chat_session_shares.chat_session_id = chat_sessions.id
        AND chat_session_shares.shared_with_user_id = auth.uid()
    )
  );

-- Allow shared users to view messages in shared chat sessions
CREATE POLICY "Users can view messages in shared chat sessions"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_session_shares
      JOIN public.chat_sessions ON chat_sessions.id = chat_session_shares.chat_session_id
      WHERE chat_sessions.id = messages.chat_session_id
        AND chat_session_shares.shared_with_user_id = auth.uid()
    )
  );

-- Allow editors to insert messages in shared chat sessions
CREATE POLICY "Editors can insert messages in shared chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_session_shares
      JOIN public.chat_sessions ON chat_sessions.id = chat_session_shares.chat_session_id
      WHERE chat_sessions.id = messages.chat_session_id
        AND chat_session_shares.shared_with_user_id = auth.uid()
        AND chat_session_shares.permission = 'editor'
    )
  );

-- Allow shared users to view document chunks for shared documents
CREATE POLICY "Users can view chunks of shared documents"
  ON public.document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_shares
      WHERE document_shares.document_id = document_chunks.document_id
        AND document_shares.shared_with_user_id = auth.uid()
    )
  );

-- Function to resolve shared_with_user_id from email
CREATE OR REPLACE FUNCTION public.resolve_share_user_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.shared_with_user_id
  FROM public.profiles
  WHERE email = NEW.shared_with_email;
  RETURN NEW;
END;
$$;

CREATE TRIGGER resolve_document_share_user
  BEFORE INSERT OR UPDATE ON public.document_shares
  FOR EACH ROW EXECUTE FUNCTION public.resolve_share_user_ids();

CREATE TRIGGER resolve_chat_share_user
  BEFORE INSERT OR UPDATE ON public.chat_session_shares
  FOR EACH ROW EXECUTE FUNCTION public.resolve_share_user_ids();
