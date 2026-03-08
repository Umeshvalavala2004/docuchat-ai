import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight,
  Loader2, Clock, CheckCircle2, AlertCircle, Pencil, Check, X,
  Search, Database, Layers, FolderPlus, Folder, FolderOpen,
  ChevronDown, PenLine, Shield, Youtube, FlaskConical, Globe,
  GitCompare, Sparkles, Crown, FileType, FileType2, Settings, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getUserDocuments, getChatSessions, deleteDocument, deleteChatSession, renameDocument, formatFileSize } from "@/lib/api";
import { toast } from "sonner";
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
  userRole?: "free_user" | "pro_user" | "admin";
  onUpgradeClick?: () => void;
  onAdminClick?: () => void;
  onSettingsClick?: () => void;
  onSearchClick?: () => void;
  profileName?: string | null;
  profilePicture?: string | null;
  usageInfo?: { questionsAsked: number; maxQuestions: number; isPremium: boolean; remaining: number };
  brandingAppName?: string;
  brandingSubtitle?: string;
  brandingLogoUrl?: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; progress: number }> = {
  pending: { icon: <Clock className="h-3.5 w-3.5 text-warning" />, label: "Uploading", progress: 15 },
  processing: { icon: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />, label: "Processing", progress: 45 },
  indexing: { icon: <Database className="h-3.5 w-3.5 text-primary animate-pulse" />, label: "Indexing", progress: 75 },
  ready: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, label: "Ready", progress: 100 },
  error: { icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" />, label: "Error", progress: 0 },
};

const tools = [
  { id: "ai-writer", label: "AI Writer", icon: PenLine, color: "text-emerald-500" },
  { id: "ai-detector", label: "AI Detector", icon: Shield, color: "text-amber-500" },
  { id: "youtube-chat", label: "YouTube Chat", icon: Youtube, color: "text-red-500" },
  { id: "research", label: "Research Assistant", icon: FlaskConical, color: "text-violet-500" },
  { id: "web-chat", label: "Web Page Chat", icon: Globe, color: "text-sky-500" },
  { id: "doc-compare", label: "Document Compare", icon: GitCompare, color: "text-orange-500" },
];

function getDocIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (ext === "docx" || ext === "doc") return <FileType className="h-4 w-4 text-blue-500" />;
  if (ext === "txt") return <FileType2 className="h-4 w-4 text-muted-foreground" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

interface FolderData {
  id: string;
  name: string;
  docIds: string[];
  open: boolean;
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
  userRole = "free_user",
  onUpgradeClick,
  onAdminClick,
  onSettingsClick,
  onSearchClick,
  profileName,
  profilePicture,
  usageInfo,
  brandingAppName = "Interface_IQ",
  brandingSubtitle = "Powered by Interface_IQ",
  brandingLogoUrl,
}: SidebarProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [chatsOpen, setChatsOpen] = useState(true);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);

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
    } catch { toast.error("Failed to delete document"); }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Chat deleted");
    } catch { toast.error("Failed to delete chat"); }
  };

  const handleRename = async (docId: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await renameDocument(docId, renameValue.trim());
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, name: renameValue.trim() } : d)));
      toast.success("Document renamed");
    } catch { toast.error("Failed to rename"); }
    setRenamingId(null);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) { setCreatingFolder(false); return; }
    setFolders((prev) => [...prev, { id: crypto.randomUUID(), name: newFolderName.trim(), docIds: [], open: true }]);
    setNewFolderName("");
    setCreatingFolder(false);
    toast.success("Folder created");
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    toast.success("Folder deleted");
  };

  const toggleFolderOpen = (folderId: string) => {
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, open: !f.open } : f)));
  };

  const filteredDocs = documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSessions = chatSessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.documents?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initials = (user.email || "U").split("@")[0].slice(0, 2).toUpperCase();

  // Collapsed sidebar
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 56 }}
          className="flex h-full w-14 flex-col items-center border-r border-border bg-card py-3 gap-1.5"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-9 w-9 rounded-xl mb-2">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onNewUpload} className="h-9 w-9 rounded-xl gradient-primary text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>

          <div className="h-px w-6 bg-border my-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Chats</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <Folder className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Folders</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Tools</TooltipContent>
          </Tooltip>

          <div className="mt-auto flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onSettingsClick}>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
            <DarkModeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-primary-foreground text-[10px] font-bold cursor-pointer">
                  {profilePicture ? (
                    <img src={profilePicture} className="h-8 w-8 rounded-full object-cover" alt="" />
                  ) : initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{user.email}</TooltipContent>
            </Tooltip>
          </div>
        </motion.div>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-[280px] flex-col border-r border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-sm">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground tracking-tight">Interface_IQ</span>
            <span className="text-[9px] text-muted-foreground leading-tight">Powered by Interface_IQ</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <DarkModeToggle />
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          onClick={onNewUpload}
          className="w-full justify-center gap-2 rounded-xl h-10 text-sm font-medium gradient-primary hover:opacity-90 shadow-sm border-0"
        >
          <Plus className="h-4 w-4" />
          New Chat
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

      {/* Multi-select toggle */}
      {documents.filter(d => d.status === "ready").length > 1 && (
        <div className="px-3 pb-1">
          <button
            onClick={() => { setMultiSelectMode(!multiSelectMode); setSelectedDocIds(new Set()); }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors w-full justify-center ${
              multiSelectMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Layers className="h-3 w-3" />
            {multiSelectMode ? "Cancel multi-select" : "Select multiple"}
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1 space-y-0.5">
          {/* CHATS */}
          <SectionHeader label="Chats" icon={<MessageSquare className="h-3.5 w-3.5" />} count={filteredDocs.length} open={chatsOpen} onToggle={() => setChatsOpen(!chatsOpen)} />
          <AnimatePresence initial={false}>
            {chatsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                {loading ? (
                  <div className="space-y-1.5 py-1 px-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-xl bg-accent/50 p-3 animate-pulse">
                        <div className="h-3 w-3/4 rounded bg-muted mb-1.5" />
                        <div className="h-2 w-1/2 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-[11px] text-muted-foreground">{searchQuery ? "No matching documents" : "No documents yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 py-0.5 px-1">
                    {filteredDocs.map((doc) => {
                      const status = statusConfig[doc.status] || statusConfig.pending;
                      const isActive = multiSelectMode ? selectedDocIds.has(doc.id) : selectedDocId === doc.id;
                      return (
                        <motion.div key={doc.id} layout className={`group rounded-xl transition-all ${isActive ? "bg-primary/8 ring-1 ring-primary/20" : doc.status === "ready" ? "hover:bg-accent/70" : "opacity-60"}`}>
                          <button
                            onClick={() => {
                              if (multiSelectMode && doc.status === "ready") {
                                setSelectedDocIds(prev => { const next = new Set(prev); if (next.has(doc.id)) next.delete(doc.id); else next.add(doc.id); return next; });
                              } else if (doc.status === "ready") { onSelectDocument(doc.id, doc.name); }
                            }}
                            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm"
                            disabled={doc.status !== "ready"}
                          >
                            {multiSelectMode && doc.status === "ready" ? (
                              <Checkbox checked={selectedDocIds.has(doc.id)} className="shrink-0 pointer-events-none" tabIndex={-1} />
                            ) : (
                              <span className="shrink-0">{getDocIcon(doc.name)}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              {renamingId === doc.id ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(doc.id); if (e.key === "Escape") setRenamingId(null); }} className="h-6 text-xs px-1.5" autoFocus />
                                  <button onClick={() => handleRename(doc.id)}><Check className="h-3 w-3 text-success" /></button>
                                  <button onClick={() => setRenamingId(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
                                </div>
                              ) : (
                                <>
                                  <span className="truncate text-xs font-medium text-foreground block">{doc.name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                                    {doc.page_count > 0 && <span className="text-[10px] text-muted-foreground">• {doc.page_count}p</span>}
                                    {doc.status !== "ready" && <span className="text-[10px] text-primary font-medium">• {status.label}</span>}
                                  </div>
                                </>
                              )}
                              {(doc.status === "pending" || doc.status === "processing" || doc.status === "indexing") && <Progress value={status.progress} className="h-0.5 mt-1" />}
                            </div>
                          </button>
                          {doc.status === "ready" && renamingId !== doc.id && (
                            <div className="flex items-center gap-0.5 px-2.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setRenamingId(doc.id); setRenameValue(doc.name); }} className="p-1 rounded-lg hover:bg-accent" title="Rename"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                              <button onClick={(e) => handleDelete(doc.id, e)} className="p-1 rounded-lg hover:bg-destructive/10" title="Delete"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Recent chat sessions */}
                {filteredSessions.length > 0 && (
                  <div className="px-1 pt-1 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 py-1.5">Recent Chats</p>
                    <div className="space-y-0.5">
                      {filteredSessions.slice(0, 10).map((session) => (
                        <motion.div key={session.id} layout className="group flex items-center rounded-xl hover:bg-accent/70 transition-all">
                          <button onClick={() => { const docName = session.documents?.name || "Document"; onSelectChatSession(session.id, session.document_id, docName); }} className="flex-1 flex items-center gap-2.5 px-2.5 py-2 text-left min-w-0">
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                              <p className="truncate text-[10px] text-muted-foreground mt-0.5">{session.documents?.name || "Unknown"} • {new Date(session.updated_at).toLocaleDateString()}</p>
                            </div>
                          </button>
                          <button onClick={(e) => handleDeleteSession(session.id, e)} className="p-1.5 mr-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* FOLDERS */}
          <SectionHeader label="Folders" icon={<Folder className="h-3.5 w-3.5" />} count={folders.length} open={foldersOpen} onToggle={() => setFoldersOpen(!foldersOpen)}
            action={<button onClick={(e) => { e.stopPropagation(); setCreatingFolder(true); setFoldersOpen(true); }} className="p-0.5 rounded hover:bg-accent transition-colors" title="New Folder"><FolderPlus className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          />
          <AnimatePresence initial={false}>
            {foldersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <div className="space-y-0.5 py-0.5 px-1">
                  {creatingFolder && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                      <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setCreatingFolder(false); }} placeholder="Folder name" className="h-6 text-xs px-1.5 flex-1" autoFocus />
                      <button onClick={handleCreateFolder}><Check className="h-3 w-3 text-success" /></button>
                      <button onClick={() => setCreatingFolder(false)}><X className="h-3 w-3 text-muted-foreground" /></button>
                    </div>
                  )}
                  {folders.length === 0 && !creatingFolder ? (
                    <div className="px-3 py-3 text-center"><p className="text-[11px] text-muted-foreground">No folders yet</p></div>
                  ) : (
                    folders.map((folder) => (
                      <div key={folder.id}>
                        <div className="group flex items-center rounded-xl hover:bg-accent/70 transition-all">
                          <button onClick={() => toggleFolderOpen(folder.id)} className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left">
                            {folder.open ? <FolderOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <span className="text-xs font-medium text-foreground truncate">{folder.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{folder.docIds.length}</span>
                          </button>
                          <button onClick={() => handleDeleteFolder(folder.id)} className="p-1 mr-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                        </div>
                        {folder.open && folder.docIds.length > 0 && (
                          <div className="pl-7 space-y-0.5">
                            {folder.docIds.map((docId) => { const doc = documents.find((d) => d.id === docId); if (!doc) return null; return (
                              <button key={docId} onClick={() => onSelectDocument(doc.id, doc.name)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-foreground hover:bg-accent w-full text-left">{getDocIcon(doc.name)}<span className="truncate">{doc.name}</span></button>
                            ); })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TOOLS */}
          <SectionHeader label="Tools" icon={<Sparkles className="h-3.5 w-3.5" />} open={toolsOpen} onToggle={() => setToolsOpen(!toolsOpen)} />
          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <div className="space-y-0.5 py-0.5 px-1">
                  {tools.map((tool) => (
                    <button key={tool.id} onClick={() => toast.info(`${tool.label} coming soon!`)} className="flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors">
                      <tool.icon className={`h-3.5 w-3.5 ${tool.color}`} />{tool.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Multi-doc chat bar */}
      {multiSelectMode && selectedDocIds.size >= 2 && (
        <div className="border-t border-border px-3 py-2">
          <Button onClick={() => { const ids = Array.from(selectedDocIds); const names = ids.map(id => documents.find(d => d.id === id)?.name || "Document"); onStartMultiDocChat(ids, names); setMultiSelectMode(false); setSelectedDocIds(new Set()); }} className="w-full gap-2 rounded-xl h-9 text-xs gradient-primary border-0" size="sm">
            <Layers className="h-3.5 w-3.5" />Chat with {selectedDocIds.size} documents
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {userRole === "admin" && onAdminClick && (
          <button onClick={onAdminClick} className="flex items-center gap-2 w-full rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
            <Shield className="h-3.5 w-3.5" /><span className="flex-1 text-left">Admin Dashboard</span><ChevronRight className="h-3 w-3" />
          </button>
        )}
        {userRole === "free_user" && (
          <div className="space-y-1.5">
            <button onClick={onUpgradeClick} className="flex items-center gap-2 w-full rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20 transition-colors">
              <Crown className="h-3.5 w-3.5" /><span className="flex-1 text-left">Upgrade to Pro</span><ChevronRight className="h-3 w-3" />
            </button>
            {usageInfo && (
              <div className="rounded-lg bg-accent/50 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Daily questions</span>
                  <span className="text-[10px] font-medium text-foreground">{usageInfo.questionsAsked} / {usageInfo.maxQuestions}</span>
                </div>
                <Progress value={(usageInfo.questionsAsked / usageInfo.maxQuestions) * 100} className="h-1.5" />
              </div>
            )}
          </div>
        )}
        {userRole === "pro_user" && (
          <div className="flex items-center gap-2 w-full rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Crown className="h-3.5 w-3.5" /><span>Pro Plan</span><span className="ml-auto text-[10px] opacity-70">Unlimited</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {profilePicture ? (
            <img src={profilePicture} className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm" alt="" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary text-primary-foreground text-[10px] font-bold shadow-sm">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{profileName || user.email?.split("@")[0]}</p>
            <p className="truncate text-[10px] text-muted-foreground capitalize">{userRole === "admin" ? "Administrator" : userRole === "pro_user" ? "Pro Plan" : "Free Plan"}</p>
          </div>
          <button onClick={onSettingsClick} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Settings"><Settings className="h-3.5 w-3.5" /></button>
          <button onClick={onSignOut} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ label, icon, count, open, onToggle, action }: { label: string; icon: React.ReactNode; count?: number; open: boolean; onToggle: () => void; action?: React.ReactNode; }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-lg">
      {icon}<span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium normal-case">{count}</span>}
      {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
    </button>
  );
}
