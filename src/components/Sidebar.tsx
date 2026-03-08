import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  LogOut,
  ChevronLeft,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserDocuments, getChatSessions, deleteDocument } from "@/lib/api";
import { toast } from "sonner";

interface SidebarProps {
  userId: string;
  selectedDocId: string | null;
  onSelectDocument: (docId: string, docName: string) => void;
  onNewUpload: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-warning" />,
  processing: <Loader2 className="h-3 w-3 text-primary animate-spin" />,
  ready: <CheckCircle2 className="h-3 w-3 text-success" />,
  error: <AlertCircle className="h-3 w-3 text-destructive" />,
};

export default function Sidebar({
  userId,
  selectedDocId,
  onSelectDocument,
  onNewUpload,
  onSignOut,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = async () => {
    try {
      const docs = await getUserDocuments(userId);
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // Poll for status updates
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document deleted");
    } catch (err: any) {
      toast.error("Failed to delete document");
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-col items-center border-r border-border bg-sidebar py-4 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-9 w-9 rounded-xl">
          <FileText className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNewUpload} className="h-9 w-9 rounded-xl">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-[280px] flex-col border-r border-border bg-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">DocChat AI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 rounded-lg">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* New Upload */}
      <div className="px-3 py-3">
        <Button
          onClick={onNewUpload}
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl h-10 text-sm"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Documents List */}
      <div className="px-3 pb-1">
        <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Documents
        </p>
      </div>
      <ScrollArea className="flex-1 px-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No documents yet. Upload one to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <motion.button
                key={doc.id}
                onClick={() => doc.status === "ready" && onSelectDocument(doc.id, doc.name)}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedDocId === doc.id
                    ? "bg-accent text-foreground"
                    : doc.status === "ready"
                    ? "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                    : "text-muted-foreground cursor-default"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {statusIcons[doc.status] || statusIcons.pending}
                <span className="flex-1 truncate text-xs">{doc.name}</span>
                {doc.status === "ready" && (
                  <Trash2
                    className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-destructive"
                    onClick={(e) => handleDelete(doc.id, e)}
                  />
                )}
              </motion.button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </motion.div>
  );
}
