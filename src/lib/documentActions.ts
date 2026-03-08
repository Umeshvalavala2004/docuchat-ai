import { supabase } from "@/integrations/supabase/client";

export async function toggleDocumentFavorite(documentId: string, isFavorite: boolean) {
  const { error } = await supabase
    .from("documents")
    .update({ is_favorite: !isFavorite })
    .eq("id", documentId);
  if (error) throw error;
  return !isFavorite;
}

export async function toggleDocumentPinned(documentId: string, isPinned: boolean) {
  const { error } = await supabase
    .from("documents")
    .update({ is_pinned: !isPinned })
    .eq("id", documentId);
  if (error) throw error;
  return !isPinned;
}

export async function setDocumentReferenceTag(documentId: string, tag: string | null) {
  const cleanTag = tag ? tag.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() : null;
  const { error } = await supabase
    .from("documents")
    .update({ reference_tag: cleanTag })
    .eq("id", documentId);
  if (error) throw error;
  return cleanTag;
}
