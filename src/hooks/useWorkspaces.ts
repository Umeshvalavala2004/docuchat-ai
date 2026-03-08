import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const ACTIVE_WS_KEY = "active_workspace_id";

export function useWorkspaces(userId: string | null) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_WS_KEY)
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load workspaces:", error);
      setLoading(false);
      return;
    }

    setWorkspaces(data as Workspace[]);

    // Auto-select: saved > default > first
    const saved = localStorage.getItem(ACTIVE_WS_KEY);
    const match = data.find((w: any) => w.id === saved);
    if (match) {
      setActiveWorkspaceId(match.id);
    } else {
      const def = data.find((w: any) => w.is_default) || data[0];
      if (def) {
        setActiveWorkspaceId(def.id);
        localStorage.setItem(ACTIVE_WS_KEY, def.id);
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(ACTIVE_WS_KEY, id);
  }, []);

  const createWorkspace = useCallback(async (name: string, icon = "folder", color = "#6366f1") => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ user_id: userId, name, icon, color, is_default: false })
      .select()
      .single();
    if (error) { console.error(error); return null; }
    const ws = data as Workspace;
    setWorkspaces((prev) => [...prev, ws]);
    return ws;
  }, [userId]);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("workspaces").update({ name }).eq("id", id);
    if (!error) setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    if (ws?.is_default) return; // can't delete default
    const { error } = await supabase.from("workspaces").delete().eq("id", id);
    if (!error) {
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      if (activeWorkspaceId === id) {
        const def = workspaces.find((w) => w.is_default);
        if (def) switchWorkspace(def.id);
      }
    }
  }, [workspaces, activeWorkspaceId, switchWorkspace]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    reload: load,
  };
}
