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
  Pencil,
  Check,
  X,
  Search,
  Database,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { getUserDocuments, getChatSessions, deleteDocument, deleteChatSession, renameDocument, formatFileSize } from "@/lib/api";
import { toast } from "sonner";
import UserProfile from "@/components/UserProfile";
import DarkModeToggle from "@/components/DarkModeToggle";
import type { User } from "@supabase/supabase-js";

interface SidebarProps {
  user: User;
  selectedDocId: string | null;
  onSelectDocument: (docId: string, docName: string) => void;
  onSelectChatSession: (sessionId: string, docId: string, docName: string) => void;
  onStartMultiDocChat: (docIds: string[], docNames: string[]) => void;
  onNewUpload: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

type Tab = "documents" | "history";

const statusConfig: Record<string, { icon: React.ReactNode; label: string; progress: number }> = {
  pending: { icon: <Clock className="h-3 w-3 text-warning" />, label: "Uploading", progress: 15 },
  processing: { icon: <Loader2 className="h-3 w-3 text-primary animate-spin" />, label: "Processing", progress: 45 },
  indexing: { icon: <Database className="h-3 w-3 text-primary animate-pulse-soft" />, label: "Indexing", progress: 75 },
  ready: { icon: <CheckCircle2 className="h-3 w-3 text-success" />, label: "Ready", progress: 100 },
  error: { icon: <AlertCircle className="h-3 w-3 text-destructive" />, label: "Error", progress: 0 },
};

// Skeleton loader
function DocSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-muted/50 p-3 animate-pulse-soft">
          <div className="h-3 w-3/4 rounded bg-muted mb-2" />
          <div className="h-2 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({
  user,
  selectedDocId,
  onSelectDocument,
  onSelectChatSession,
  onStartMultiDocChat,
  onNewUpload,
  onSignOut,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("documents");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

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
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Chat deleted");
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  const handleRename = async (docId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameDocument(docId, renameValue.trim());
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, name: renameValue.trim() } : d))
      );
      toast.success("Document renamed");
    } catch {
      toast.error("Failed to rename");
    }
    setRenamingId(null);
  };

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSessions = chatSessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.documents?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 pl-8 text-xs rounded-lg bg-accent/50 border-0 focus-visible:ring-1"
          />
        </div>
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
          {documents.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {documents.length}
            </span>
          )}
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
          {chatSessions.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {chatSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* Multi-select toggle */}
      {tab === "documents" && documents.filter(d => d.status === "ready").length > 1 && (
        <div className="px-3 pb-1">
          <button
            onClick={() => {
              setMultiSelectMode(!multiSelectMode);
              setSelectedDocIds(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors w-full justify-center ${
              multiSelectMode
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Layers className="h-3 w-3" />
            {multiSelectMode ? "Cancel multi-select" : "Select multiple"}
          </button>
        </div>
      )}

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
                <DocSkeleton />
              ) : filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-4 text-center">
                  <div className="rounded-xl bg-muted p-3 mb-3">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "No matching documents" : "No documents yet. Upload one to get started."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {filteredDocs.map((doc) => {
                    const status = statusConfig[doc.status] || statusConfig.pending;
                    return (
                      <motion.div
                        key={doc.id}
                        layout
                        className={`group rounded-xl transition-all ${
                          multiSelectMode && selectedDocIds.has(doc.id)
                            ? "bg-primary/10 ring-1 ring-primary/20"
                            : selectedDocId === doc.id && !multiSelectMode
                            ? "bg-primary/10 ring-1 ring-primary/20"
                            : doc.status === "ready"
                            ? "hover:bg-accent"
                            : "opacity-70"
                        }`}
                      >
                        <button
                          onClick={() => {
                            if (multiSelectMode && doc.status === "ready") {
                              setSelectedDocIds(prev => {
                                const next = new Set(prev);
                                if (next.has(doc.id)) next.delete(doc.id);
                                else next.add(doc.id);
                                return next;
                              });
                            } else if (doc.status === "ready") {
                              onSelectDocument(doc.id, doc.name);
                            }
                          }}
                          className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm"
                          disabled={doc.status !== "ready"}
                        >
                          {multiSelectMode && doc.status === "ready" && (
                            <Checkbox
                              checked={selectedDocIds.has(doc.id)}
                              className="mt-0.5 shrink-0 pointer-events-none"
                              tabIndex={-1}
                            />
                          )}
                          {status.icon}
                          <div className="flex-1 min-w-0">
                            {renamingId === doc.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename(doc.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  className="h-6 text-xs px-1 border-primary"
                                  autoFocus
                                />
                                <button onClick={() => handleRename(doc.id)}>
                                  <Check className="h-3 w-3 text-success" />
                                </button>
                                <button onClick={() => setRenamingId(null)}>
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                            ) : (
                              <span className="truncate text-xs font-medium text-foreground block">
                                {doc.name}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">
                                {formatFileSize(doc.file_size)}
                              </span>
                              {doc.chunk_count > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  • {doc.chunk_count} chunks
                                </span>
                              )}
                              {doc.page_count > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  • {doc.page_count} pages
                                </span>
                              )}
                              {doc.status !== "ready" && (
                                <span className="text-[10px] text-primary font-medium">
                                  • {status.label}
                                </span>
                              )}
                            </div>
                            {doc.summary && doc.status === "ready" && (
                              <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-1">
                                {doc.summary}
                              </p>
                            )}
                            {(doc.status === "pending" || doc.status === "processing" || doc.status === "indexing") && (
                              <Progress value={status.progress} className="h-1 mt-1.5" />
                            )}
                          </div>
                        </button>
                        {doc.status === "ready" && renamingId !== doc.id && (
                          <div className="flex items-center gap-0.5 px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(doc.id);
                                setRenameValue(doc.name);
                              }}
                              className="p-1 rounded hover:bg-accent"
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(doc.id, e)}
                              className="p-1 rounded hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
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
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-4 text-center">
                  <div className="rounded-xl bg-muted p-3 mb-3">
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "No matching chats" : "No chat history yet. Start a conversation!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {filteredSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      layout
                      className="group flex items-center rounded-xl hover:bg-accent transition-all"
                    >
                      <button
                        onClick={() => {
                          const docName = session.documents?.name || "Document";
                          onSelectChatSession(session.id, session.document_id, docName);
                        }}
                        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
                      >
                        <MessageSquare className="h-3 w-3 shrink-0 text-primary/70" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                          <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                            {session.documents?.name || "Unknown document"} • {new Date(session.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 mr-2 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Multi-doc chat bar */}
      {multiSelectMode && selectedDocIds.size >= 2 && (
        <div className="border-t border-border px-3 py-2">
          <Button
            onClick={() => {
              const ids = Array.from(selectedDocIds);
              const names = ids.map(id => documents.find(d => d.id === id)?.name || "Document");
              onStartMultiDocChat(ids, names);
              setMultiSelectMode(false);
              setSelectedDocIds(new Set());
            }}
            className="w-full gap-2 rounded-xl h-9 text-xs"
            size="sm"
          >
            <Layers className="h-3.5 w-3.5" />
            Chat with {selectedDocIds.size} documents
          </Button>
        </div>
      )}

      {/* User Profile Footer */}
      <div className="border-t border-border p-3">
        <UserProfile user={user} onSignOut={onSignOut} />
      </div>
    </motion.div>
  );
}
