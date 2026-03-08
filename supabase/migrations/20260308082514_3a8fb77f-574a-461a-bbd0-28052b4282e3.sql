
-- Create feedback table for thumbs up/down on messages
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Add chunk_count to documents for display
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- Add index for faster chunk retrieval
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON public.document_chunks USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_messages_session ON public.messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id);
