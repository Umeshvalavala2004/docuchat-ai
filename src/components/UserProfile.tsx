import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface UserProfileProps {
  user: SupabaseUser;
  onSignOut: () => void;
}

export default function UserProfile({ user, onSignOut }: UserProfileProps) {
  const [open, setOpen] = useState(false);
  const initials = (user.email || "U")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs font-bold shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {user.email?.split("@")[0]}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user.email}
          </p>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-border bg-card p-1.5 shadow-lg"
            >
              <div className="px-3 py-2 mb-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {user.email}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
