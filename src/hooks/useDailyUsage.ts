import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UsageInfo {
  questionsAsked: number;
  maxQuestions: number;
  isPremium: boolean;
  remaining: number;
}

export function useDailyUsage(userId: string | null) {
  const [usage, setUsage] = useState<UsageInfo>({
    questionsAsked: 0,
    maxQuestions: 5,
    isPremium: false,
    remaining: 5,
  });
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_daily_usage", { _user_id: userId });
    if (!error && data && data.length > 0) {
      const row = data[0];
      setUsage({
        questionsAsked: row.questions_asked,
        maxQuestions: row.max_questions,
        isPremium: row.is_premium,
        remaining: row.is_premium ? -1 : Math.max(0, row.max_questions - row.questions_asked),
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const checkAndIncrement = useCallback(async (): Promise<{ allowed: boolean; remaining: number }> => {
    if (!userId) return { allowed: false, remaining: 0 };
    const { data, error } = await supabase.rpc("check_and_increment_usage", { _user_id: userId });
    if (error) {
      console.error("Usage check error:", error);
      return { allowed: false, remaining: 0 };
    }
    const remaining = data as number;
    if (remaining === 0 && !usage.isPremium) {
      // Was blocked
      return { allowed: false, remaining: 0 };
    }
    // Refresh usage state
    await fetchUsage();
    return { allowed: true, remaining: remaining === -1 ? -1 : remaining };
  }, [userId, usage.isPremium, fetchUsage]);

  return { usage, loading, fetchUsage, checkAndIncrement };
}
