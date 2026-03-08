
-- Document tags
CREATE TABLE public.document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4f46e5',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, user_id)
);

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tags" ON public.document_tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Document-tag junction
CREATE TABLE public.document_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, tag_id)
);

ALTER TABLE public.document_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tag assignments for their docs" ON public.document_tag_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents WHERE id = document_tag_assignments.document_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents WHERE id = document_tag_assignments.document_id AND user_id = auth.uid()));

-- Document categories
CREATE TABLE public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT 'folder',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, user_id)
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories" ON public.document_categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add category_id to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL;

-- Document activity logs
CREATE TABLE public.document_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity on their docs" ON public.document_activity_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents WHERE id = document_activity_logs.document_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert activity on their docs" ON public.document_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.document_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enterprise search: create full-text indexes
CREATE INDEX IF NOT EXISTS idx_documents_name_search ON public.documents USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_search ON public.document_chunks USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_highlights_text_search ON public.highlights USING gin(to_tsvector('english', selected_text));

-- Enterprise search function
CREATE OR REPLACE FUNCTION public.enterprise_search(
  _user_id uuid,
  _query text,
  _limit int DEFAULT 20
)
RETURNS TABLE(
  result_type text,
  result_id uuid,
  title text,
  snippet text,
  document_id uuid,
  document_name text,
  page_number int,
  relevance float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  -- Search documents by title
  SELECT 
    'document'::text AS result_type,
    d.id AS result_id,
    d.name AS title,
    COALESCE(d.summary, '')::text AS snippet,
    d.id AS document_id,
    d.name AS document_name,
    NULL::int AS page_number,
    ts_rank(to_tsvector('english', d.name), plainto_tsquery('english', _query))::float AS relevance
  FROM public.documents d
  WHERE d.user_id = _user_id
    AND to_tsvector('english', d.name) @@ plainto_tsquery('english', _query)

  UNION ALL

  -- Search document content
  SELECT 
    'content'::text,
    dc.id,
    d.name,
    LEFT(dc.content, 200),
    d.id,
    d.name,
    dc.page_number,
    ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', _query))::float
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE d.user_id = _user_id
    AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', _query)

  UNION ALL

  -- Search highlights
  SELECT 
    'highlight'::text,
    h.id,
    d.name,
    h.selected_text,
    h.document_id,
    d.name,
    h.page_number,
    ts_rank(to_tsvector('english', h.selected_text), plainto_tsquery('english', _query))::float
  FROM public.highlights h
  JOIN public.documents d ON d.id = h.document_id
  WHERE h.user_id = _user_id
    AND to_tsvector('english', h.selected_text) @@ plainto_tsquery('english', _query)

  UNION ALL

  -- Search chat messages
  SELECT 
    'chat'::text,
    m.id,
    cs.title,
    LEFT(m.content, 200),
    cs.document_id,
    COALESCE(d.name, cs.title),
    NULL::int,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', _query))::float
  FROM public.messages m
  JOIN public.chat_sessions cs ON cs.id = m.chat_session_id
  LEFT JOIN public.documents d ON d.id = cs.document_id
  WHERE cs.user_id = _user_id
    AND to_tsvector('english', m.content) @@ plainto_tsquery('english', _query)

  ORDER BY relevance DESC
  LIMIT _limit;
END;
$$;
