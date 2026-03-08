import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold px-1">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card shadow-xl"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <ScrollArea className="max-h-[300px]">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center">
                    <Bell className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  <div className="p-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) onMarkAsRead(n.id);
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                          n.read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[9px] text-muted-foreground/60 mt-1">
                              {new Date(n.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
