import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "free_user" | "pro_user" | "admin";

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole>("free_user");
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .single();
      if (data?.role) {
        setRole(data.role as UserRole);
      }
    } catch {
      // Default to free_user
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const isAdmin = role === "admin";
  const isPro = role === "pro_user";
  const isFree = role === "free_user";

  return { role, isAdmin, isPro, isFree, loading, refetch: fetchRole };
}
