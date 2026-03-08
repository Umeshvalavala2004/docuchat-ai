import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import DocumentUpload from "@/components/DocumentUpload";
import PdfViewer from "@/components/PdfViewer";
import AdminDashboard from "@/components/AdminDashboard";
import NotificationBell from "@/components/NotificationBell";
import { FileText, Upload, Layers } from "lucide-react";
import { getChatMessages } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Source, ChatMessage } from "@/lib/api";
import type { TextAction } from "@/components/TextSelectionToolbar";

type View = "upload" | "chat" | "admin";

const Index = () => {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const { role, isAdmin, loading: roleLoading, refetch: refetchRole } = useUserRole(user?.id);
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(user?.id);

  const [view, setView] = useState<View>("upload");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>();
  const [highlightPage, setHighlightPage] = useState<number | null>(null);
  const [highlightText, setHighlightText] = useState<string | null>(null);
  const [injectedPrompt, setInjectedPrompt] = useState<string | undefined>();

  const handleTextAction = useCallback((action: TextAction, text: string, pageNumber: number) => {
    const prompts: Record<TextAction, string> = {
      explain: `Explain the following text from the document (page ${pageNumber}) in simple terms:\n\n"${text}"`,
      summarize: `Summarize the following text from the document (page ${pageNumber}):\n\n"${text}"`,
      rewrite: `Rewrite the following text from the document (page ${pageNumber}) in clearer language:\n\n"${text}"`,
      ask: text,
    };
    setInjectedPrompt(prompts[action]);
  }, []);

  const handleUpgradeClick = async () => {
    try {
      const { error } = await supabase.rpc("request_pro_upgrade");
      if (error) throw error;
      toast.success("Pro upgrade requested! An admin will review your request.");
    } catch (e: any) {
      if (e.message?.includes("already have a pending")) {
        toast.info("You already have a pending Pro request.");
      } else {
        toast.error(e.message || "Failed to request upgrade");
      }
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <FileText className="h-6 w-6 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading DocChat AI...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuth={async (email, password, isSignUp) => {
          return isSignUp ? signUp(email, password) : signIn(email, password);
        }}
      />
    );
  }

  const handleSelectDocument = (docId: string, docName: string) => {
    setSelectedDocId(docId);
    setSelectedDocIds([]);
    setSelectedDocName(docName);
    setView("chat");
    setChatSessionId(undefined);
    setInitialMessages(undefined);
    setHighlightPage(null);
    setHighlightText(null);
  };

  const handleStartMultiDocChat = (docIds: string[], docNames: string[]) => {
    setSelectedDocId(docIds[0]);
    setSelectedDocIds(docIds);
    setSelectedDocName(docNames.join(", "));
    setView("chat");
    setChatSessionId(undefined);
    setInitialMessages(undefined);
    setHighlightPage(null);
    setHighlightText(null);
  };

  const handleSelectChatSession = async (sessionId: string, docId: string, docName: string) => {
    setSelectedDocId(docId);
    setSelectedDocIds([]);
    setSelectedDocName(docName);
    setChatSessionId(sessionId);
    setView("chat");
    setHighlightPage(null);
    setHighlightText(null);
    try {
      const msgs = await getChatMessages(sessionId);
      const formatted: ChatMessage[] = msgs.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: m.sources ? (typeof m.sources === "string" ? JSON.parse(m.sources) : m.sources) : undefined,
        timestamp: m.created_at,
      }));
      setInitialMessages(formatted);
    } catch (e) {
      console.error("Failed to load messages:", e);
      setInitialMessages(undefined);
    }
  };

  const handleDocumentUploaded = (doc: any) => {
    if (doc.status === "ready") {
      handleSelectDocument(doc.id, doc.name);
    }
  };

  const handleCitationClick = (pageNumber: number | null, text?: string) => {
    if (pageNumber) {
      setHighlightPage(pageNumber);
      setHighlightText(text || null);
    }
  };

  const isPdf = selectedDocName?.toLowerCase().endsWith(".pdf");
  const showSplitView = view === "chat" && selectedDocId && isPdf && selectedDocIds.length <= 1;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        user={user}
        selectedDocId={selectedDocId}
        onSelectDocument={handleSelectDocument}
        onSelectChatSession={handleSelectChatSession}
        onStartMultiDocChat={handleStartMultiDocChat}
        onNewUpload={() => {
          setView("upload");
          setSelectedDocId(null);
          setSelectedDocIds([]);
          setChatSessionId(undefined);
          setInitialMessages(undefined);
        }}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={role}
        onUpgradeClick={handleUpgradeClick}
        onAdminClick={() => setView("admin")}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar with notifications */}
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-border bg-card/50 backdrop-blur-sm">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllRead={markAllRead}
          />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {view === "admin" && isAdmin ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1"
              >
                <AdminDashboard onBack={() => setView("upload")} />
              </motion.div>
            ) : view === "upload" || !selectedDocId ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-1 flex-col items-center justify-center p-8"
              >
                <div className="w-full max-w-lg">
                  <div className="mb-8 text-center">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner"
                    >
                      <Upload className="h-9 w-9 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      Upload a document
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                      Upload a PDF, DOCX, or TXT file and start an AI-powered conversation
                    </p>
                  </div>
                  <DocumentUpload
                    userId={user.id}
                    onDocumentUploaded={handleDocumentUploaded}
                  />
                </div>
              </motion.div>
            ) : showSplitView ? (
              <motion.div
                key="split"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 overflow-hidden"
              >
                <div className="flex-1 min-w-0 border-r border-border">
                  <PdfViewer
                    documentId={selectedDocId}
                    fileName={selectedDocName}
                    highlightPage={highlightPage}
                    highlightText={highlightText}
                    inline={true}
                    onTextAction={handleTextAction}
                  />
                </div>
                <div className="flex flex-col w-[45%] min-w-[340px] max-w-[600px]">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 bg-card/50 backdrop-blur-sm">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate flex-1">
                      {selectedDocName}
                    </span>
                  </div>
                  <ChatInterface
                    key={`${selectedDocId}-${chatSessionId}`}
                    documentId={selectedDocId}
                    documentName={selectedDocName}
                    userId={user.id}
                    chatSessionId={chatSessionId}
                    initialMessages={initialMessages}
                    onChatSessionCreated={(id) => setChatSessionId(id)}
                    onCitationClick={handleCitationClick}
                    injectedPrompt={injectedPrompt}
                    onInjectedPromptConsumed={() => setInjectedPrompt(undefined)}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-3 border-b border-border px-5 py-3 bg-card/50 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    {selectedDocIds.length > 1 ? (
                      <Layers className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">
                      {selectedDocIds.length > 1 ? `${selectedDocIds.length} Documents` : selectedDocName}
                    </span>
                    {selectedDocIds.length > 1 && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {selectedDocName}
                      </span>
                    )}
                  </div>
                </div>
                <ChatInterface
                  key={`${selectedDocId}-${selectedDocIds.join(",")}-${chatSessionId}`}
                  documentId={selectedDocId}
                  documentIds={selectedDocIds.length > 1 ? selectedDocIds : undefined}
                  documentName={selectedDocName}
                  userId={user.id}
                  chatSessionId={chatSessionId}
                  initialMessages={initialMessages}
                  onChatSessionCreated={(id) => setChatSessionId(id)}
                  onCitationClick={handleCitationClick}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Index;
