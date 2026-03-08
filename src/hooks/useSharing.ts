import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SharePermission = "viewer" | "editor";

export interface ShareRecord {
  id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: SharePermission;
  created_at: string;
}

export interface SharedWithMeDoc {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  page_count: number | null;
  permission: SharePermission;
  owner_email: string | null;
}

export interface SharedWithMeChat {
  id: string;
  title: string;
  document_id: string | null;
  permission: SharePermission;
  owner_email: string | null;
}

export function useDocumentShares(documentId: string | null) {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const { data } = await supabase
      .from("document_shares")
      .select("id, shared_with_email, shared_with_user_id, permission, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });
    if (data) setShares(data as ShareRecord[]);
    setLoading(false);
  }, [documentId]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const addShare = async (email: string, permission: SharePermission, ownerId: string) => {
    const { error } = await supabase.from("document_shares").insert({
      document_id: documentId!,
      owner_id: ownerId,
      shared_with_email: email.toLowerCase().trim(),
      permission,
    });
    if (error) {
      if (error.code === "23505") toast.error("Already shared with this user");
      else toast.error("Failed to share");
      return false;
    }
    toast.success(`Shared with ${email}`);
    await loadShares();
    return true;
  };

  const removeShare = async (shareId: string) => {
    const { error } = await supabase.from("document_shares").delete().eq("id", shareId);
    if (error) { toast.error("Failed to remove"); return; }
    toast.success("Access removed");
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  const updatePermission = async (shareId: string, permission: SharePermission) => {
    const { error } = await supabase
      .from("document_shares")
      .update({ permission })
      .eq("id", shareId);
    if (error) { toast.error("Failed to update"); return; }
    setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, permission } : s));
  };

  return { shares, loading, addShare, removeShare, updatePermission, reload: loadShares };
}

export function useChatSessionShares(sessionId: string | null) {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const { data } = await supabase
      .from("chat_session_shares")
      .select("id, shared_with_email, shared_with_user_id, permission, created_at")
      .eq("chat_session_id", sessionId)
      .order("created_at", { ascending: false });
    if (data) setShares(data as ShareRecord[]);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const addShare = async (email: string, permission: SharePermission, ownerId: string) => {
    const { error } = await supabase.from("chat_session_shares").insert({
      chat_session_id: sessionId!,
      owner_id: ownerId,
      shared_with_email: email.toLowerCase().trim(),
      permission,
    });
    if (error) {
      if (error.code === "23505") toast.error("Already shared with this user");
      else toast.error("Failed to share");
      return false;
    }
    toast.success(`Shared with ${email}`);
    await loadShares();
    return true;
  };

  const removeShare = async (shareId: string) => {
    const { error } = await supabase.from("chat_session_shares").delete().eq("id", shareId);
    if (error) { toast.error("Failed to remove"); return; }
    toast.success("Access removed");
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  return { shares, loading, addShare, removeShare, reload: loadShares };
}

export function useSharedWithMe(userId: string | null) {
  const [sharedDocs, setSharedDocs] = useState<SharedWithMeDoc[]>([]);
  const [sharedChats, setSharedChats] = useState<SharedWithMeChat[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    // Get shared documents
    const { data: docShares } = await supabase
      .from("document_shares")
      .select("permission, owner_id, document_id")
      .eq("shared_with_user_id", userId);

    if (docShares && docShares.length > 0) {
      const docIds = docShares.map((s: any) => s.document_id);
      const ownerIds = [...new Set(docShares.map((s: any) => s.owner_id))];

      const [{ data: docs }, { data: owners }] = await Promise.all([
        supabase.from("documents").select("id, name, file_type, file_size, page_count").in("id", docIds),
        supabase.from("profiles").select("id, email").in("id", ownerIds),
      ]);

      if (docs) {
        const ownerMap = new Map((owners || []).map((o: any) => [o.id, o.email]));
        setSharedDocs(docs.map((doc: any) => {
          const share = docShares.find((s: any) => s.document_id === doc.id);
          return {
            ...doc,
            permission: share?.permission || "viewer",
            owner_email: ownerMap.get(share?.owner_id) || null,
          };
        }));
      }
    } else {
      setSharedDocs([]);
    }

    // Get shared chats
    const { data: chatShares } = await supabase
      .from("chat_session_shares")
      .select("permission, owner_id, chat_session_id")
      .eq("shared_with_user_id", userId);

    if (chatShares && chatShares.length > 0) {
      const chatIds = chatShares.map((s: any) => s.chat_session_id);
      const ownerIds = [...new Set(chatShares.map((s: any) => s.owner_id))];

      const [{ data: chats }, { data: owners }] = await Promise.all([
        supabase.from("chat_sessions").select("id, title, document_id").in("id", chatIds),
        supabase.from("profiles").select("id, email").in("id", ownerIds),
      ]);

      if (chats) {
        const ownerMap = new Map((owners || []).map((o: any) => [o.id, o.email]));
        setSharedChats(chats.map((chat: any) => {
          const share = chatShares.find((s: any) => s.chat_session_id === chat.id);
          return {
            ...chat,
            permission: share?.permission || "viewer",
            owner_email: ownerMap.get(share?.owner_id) || null,
          };
        }));
      }
    } else {
      setSharedChats([]);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { sharedDocs, sharedChats, loading, reload: load };
}
