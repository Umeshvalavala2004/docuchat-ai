
-- Add reference_tag to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reference_tag text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Create index for quick lookup by reference_tag
CREATE INDEX IF NOT EXISTS idx_documents_reference_tag ON public.documents(user_id, reference_tag) WHERE reference_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_favorites ON public.documents(user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_documents_pinned ON public.documents(user_id) WHERE is_pinned = true;
