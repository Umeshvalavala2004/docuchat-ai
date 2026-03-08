import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, UserPlus, X, Mail, Eye, Edit3, Trash2, Users, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ShareRecord, SharePermission } from "@/hooks/useSharing";

interface ShareDialogProps {
  type: "document" | "chat";
  name: string;
  shares: ShareRecord[];
  loading: boolean;
  onAdd: (email: string, permission: SharePermission) => Promise<boolean>;
  onRemove: (shareId: string) => void;
  onUpdatePermission?: (shareId: string, permission: SharePermission) => void;
  trigger?: React.ReactNode;
}

export default function ShareDialog({
  type, name, shares, loading, onAdd, onRemove, onUpdatePermission, trigger,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("viewer");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!email.trim() || !email.includes("@")) return;
    setAdding(true);
    const ok = await onAdd(email, permission);
    if (ok) setEmail("");
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="p-1 rounded-lg hover:bg-accent" title="Share">
            <Share2 className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Share {type === "document" ? "Document" : "Chat"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate mt-1">{name}</p>
        </DialogHeader>

        {/* Add new share */}
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">
                <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> Viewer</span>
              </SelectItem>
              <SelectItem value="editor">
                <span className="flex items-center gap-1.5"><Edit3 className="h-3 w-3" /> Editor</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={adding || !email.trim()} className="h-9 gradient-primary border-0">
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Current shares */}
        <div className="mt-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            People with access ({shares.length})
          </p>
          <ScrollArea className="max-h-48">
            <AnimatePresence>
              {shares.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Not shared with anyone yet</p>
              ) : (
                shares.map((share) => (
                  <motion.div
                    key={share.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-accent/50 group"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary uppercase">
                        {share.shared_with_email.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{share.shared_with_email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {share.shared_with_user_id ? (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1">Registered</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] py-0 px-1">Pending</Badge>
                        )}
                      </div>
                    </div>
                    {onUpdatePermission ? (
                      <Select
                        value={share.permission}
                        onValueChange={(v) => onUpdatePermission(share.id, v as SharePermission)}
                      >
                        <SelectTrigger className="w-[85px] h-7 text-[10px] border-0 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer"><span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Viewer</span></SelectItem>
                          <SelectItem value="editor"><span className="flex items-center gap-1"><Edit3 className="h-3 w-3" /> Editor</span></SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        {share.permission === "editor" ? <Edit3 className="h-2.5 w-2.5 mr-1" /> : <Eye className="h-2.5 w-2.5 mr-1" />}
                        {share.permission}
                      </Badge>
                    )}
                    <button
                      onClick={() => onRemove(share.id)}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
