import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserDocuments, getChatSessions, getChatMessages, deleteDocument } from "@/lib/api";
import { toast } from "sonner";
import UserProfile from "@/components/UserProfile";
import DarkModeToggle from "@/components/DarkModeToggle";
import type { User } from "@supabase/supabase-js";

interface SidebarProps {
  user: User;
  selectedDocId: string | null;
  onSelectDocument: (docId: string, docName: string) => void;
  onSelectChatSession: (sessionId: string, docId: string, docName: string) => void;
  onNewUpload: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

type Tab = "documents" | "history";

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-warning" />,
  processing: <Loader2 className="h-3 w-3 text-primary animate-spin" />,
  ready: <CheckCircle2 className="h-3 w-3 text-success" />,
  error: <AlertCircle className="h-3 w-3 text-destructive" />,
};

export default function Sidebar({
  user,
  selectedDocId,
  onSelectDocument,
  onSelectChatSession,
  onNewUpload,
  onSignOut,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("documents");

  const loadDocuments = async () => {
    try {
      const docs = await getUserDocuments(user.id);
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const sessions = await getChatSessions(user.id);
      setChatSessions(sessions);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadHistory();
    const interval = setInterval(() => {
      loadDocuments();
      loadHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [user.id]);

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
        <div className="mt-auto">
          <DarkModeToggle />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 300, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-[300px] flex-col border-r border-border bg-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
            <FileText className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground tracking-tight">DocChat AI</span>
            <p className="text-[10px] text-muted-foreground">Intelligent document chat</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DarkModeToggle />
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* New Upload */}
      <div className="px-3 py-3">
        <Button
          onClick={onNewUpload}
          className="w-full justify-start gap-2 rounded-xl h-10 text-sm bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex px-3 gap-1 mb-1">
        <button
          onClick={() => setTab("documents")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            tab === "documents"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <FileText className="h-3 w-3" />
          Documents
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            tab === "history"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <History className="h-3 w-3" />
          History
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-3">
        <AnimatePresence mode="wait">
          {tab === "documents" ? (
            <motion.div
              key="documents"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-4 text-center">
                  <div className="rounded-xl bg-muted p-3 mb-3">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No documents yet. Upload one to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {documents.map((doc) => (
                    <motion.button
                      key={doc.id}
                      onClick={() => doc.status === "ready" && onSelectDocument(doc.id, doc.name)}
                      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                        selectedDocId === doc.id
                          ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                          : doc.status === "ready"
                          ? "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                          : "text-muted-foreground cursor-default opacity-60"
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      {statusIcons[doc.status] || statusIcons.pending}
                      <span className="flex-1 truncate text-xs font-medium">{doc.name}</span>
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
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {chatSessions.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-4 text-center">
                  <div className="rounded-xl bg-muted p-3 mb-3">
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No chat history yet. Start a conversation!
                  </p>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {chatSessions.map((session) => (
                    <motion.button
                      key={session.id}
                      onClick={() => {
                        const docName = session.documents?.name || "Document";
                        onSelectChatSession(session.id, session.document_id, docName);
                      }}
                      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all text-sidebar-foreground hover:bg-accent hover:text-foreground"
                      whileTap={{ scale: 0.98 }}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0 text-primary/70" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{session.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                          {session.documents?.name || "Unknown document"} • {new Date(session.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* User Profile Footer */}
      <div className="border-t border-border p-3">
        <UserProfile user={user} onSignOut={onSignOut} />
      </div>
    </motion.div>
  );
}
