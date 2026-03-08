import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModelPreference } from "@/hooks/useModelPreference";
import { useDailyUsage } from "@/hooks/useDailyUsage";
import { useBranding } from "@/hooks/useBranding";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import DocumentUpload from "@/components/DocumentUpload";
import HomeHero from "@/components/HomeHero";
import type { ToolTab } from "@/components/HomeHero";
import ToolResults from "@/components/ToolResults";
import PdfViewer from "@/components/PdfViewer";
import AdminDashboard from "@/components/AdminDashboard";
import SettingsPage from "@/components/SettingsPage";
import EnterpriseSearch from "@/components/EnterpriseSearch";
import ToolsDashboard from "@/components/ToolsDashboard";
import NotificationBell from "@/components/NotificationBell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserDashboard from "@/components/UserDashboard";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { FileText, Upload, Layers, PanelLeftClose, PanelLeftOpen, Settings, MessageSquare, FileUp, Search, Sparkles, LayoutDashboard } from "lucide-react";
import { getChatMessages } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Source, ChatMessage } from "@/lib/api";
import type { TextAction } from "@/components/TextSelectionToolbar";

type View = "upload" | "chat" | "admin" | "settings" | "search" | "tools" | "tool_results" | "dashboard";

const Index = () => {
  const { t } = useTranslation();
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const { role, isAdmin, loading: roleLoading, refetch: refetchRole } = useUserRole(user?.id);
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(user?.id);
  const { profile } = useProfile(user?.id);
  const isMobile = useIsMobile();
  const { model: activeModel, updateModel } = useModelPreference(user?.id || null);
  const { usage } = useDailyUsage(user?.id || null);
  const { branding, copyright } = useBranding();

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
  const [mobilePanel, setMobilePanel] = useState<"pdf" | "chat">("chat");
  const [activeToolType, setActiveToolType] = useState<ToolTab>("chat");
  const [toolText, setToolText] = useState<string | undefined>();
  const [toolDocId, setToolDocId] = useState<string | undefined>();
  const [toolDocName, setToolDocName] = useState<string | undefined>();

  const handleToolProcess = (toolType: ToolTab, documentId?: string, text?: string, documentName?: string) => {
    setActiveToolType(toolType);
    setToolDocId(documentId);
    setToolText(text);
    setToolDocName(documentName);
    setView("tool_results");
  };

  const handleTextAction = useCallback((action: TextAction, text: string, pageNumber: number) => {
    const prompts: Record<TextAction, string> = {
      explain: `Explain the following text from the document (page ${pageNumber}) in simple terms:\n\n"${text}"`,
      summarize: `Summarize the following text from the document (page ${pageNumber}):\n\n"${text}"`,
      rewrite: `Rewrite the following text from the document (page ${pageNumber}) in clearer language:\n\n"${text}"`,
      ask: text,
    };
    setInjectedPrompt(prompts[action]);
    if (isMobile) setMobilePanel("chat");
  }, [isMobile]);

  const handleUpgradeClick = async () => {
    try {
      const { error } = await supabase.rpc("request_pro_upgrade");
      if (error) throw error;
      toast.success(t("pro_upgrade_requested"));
    } catch (e: any) {
      if (e.message?.includes("already have a pending")) {
        toast.info(t("pending_pro_request"));
      } else {
        toast.error(e.message || "Failed to request upgrade");
      }
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <FileText className="h-7 w-7 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-foreground">{branding.appName}</p>
            <p className="text-xs text-muted-foreground">{t("loading_workspace")}</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
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
      if (isMobile) setMobilePanel("pdf");
    }
  };

  const isPdf = selectedDocName?.toLowerCase().endsWith(".pdf");
  const showSplitView = view === "chat" && selectedDocId && isPdf && selectedDocIds.length <= 1;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      {(!isMobile || !sidebarCollapsed) && (
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
          onSettingsClick={() => setView("settings")}
          onSearchClick={() => setView("search")}
          onToolsClick={() => setView("tools")}
          onInsertPrompt={(prompt) => { setInjectedPrompt(prompt); if (view !== "chat") setView("upload"); }}
          profileName={profile?.name}
          profilePicture={profile?.profile_picture}
          usageInfo={usage}
          brandingAppName={branding.appName}
          brandingSubtitle={branding.subtitle}
          brandingLogoUrl={branding.logoUrl}
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 glass-strong z-10">
          {(isMobile && sidebarCollapsed) && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSidebarCollapsed(false)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          {!isMobile && sidebarCollapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSidebarCollapsed(false)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {view === "chat" && selectedDocName && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg gradient-primary flex items-center justify-center">
                  {selectedDocIds.length > 1 ? (
                    <Layers className="h-3 w-3 text-primary-foreground" />
                  ) : (
                    <FileText className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <span className="font-medium text-foreground truncate max-w-[200px]">
                  {selectedDocIds.length > 1 ? `${selectedDocIds.length} ${t("documents")}` : selectedDocName}
                </span>
              </div>
            )}
            {view === "upload" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
                  <FileUp className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="font-medium text-foreground">{t("upload_document")}</span>
              </div>
            )}
            {view === "admin" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="font-medium text-foreground">{t("admin_dashboard")}</span>
              </div>
            )}
            {view === "settings" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="font-medium text-foreground">{t("settings")}</span>
              </div>
            )}
            {view === "search" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
                  <Search className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="font-medium text-foreground">{t("enterprise_search")}</span>
              </div>
            )}
            {view === "tools" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg gradient-primary flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="font-medium text-foreground">{t("ai_tools")}</span>
              </div>
            )}
            {view === "dashboard" && (
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-lg gradient-primary flex items-center justify-center">
                  <LayoutDashboard className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="font-medium text-foreground">Dashboard</span>
              </div>
            )}
          </div>

          {/* Mobile toggle for PDF/Chat */}
          {isMobile && showSplitView && (
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setMobilePanel("pdf")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mobilePanel === "pdf" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMobilePanel("chat")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mobilePanel === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <LanguageSwitcher />

          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${view === "dashboard" ? "bg-primary/10 text-primary" : ""}`} onClick={() => setView("dashboard")} title="Dashboard">
            <LayoutDashboard className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setView("search")} title={t("enterprise_search")}>
            <Search className="h-4 w-4" />
          </Button>

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
              <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <AdminDashboard onBack={() => setView("upload")} />
              </motion.div>
            ) : view === "settings" ? (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <SettingsPage onBack={() => setView("upload")} userId={user.id} profile={profile} currentModel={activeModel} onModelChange={updateModel} />
              </motion.div>
            ) : view === "search" ? (
              <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <EnterpriseSearch
                  userId={user.id}
                  onSelectDocument={(docId, docName) => { handleSelectDocument(docId, docName); }}
                  onClose={() => setView("upload")}
                />
              </motion.div>
            ) : view === "dashboard" ? (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <UserDashboard userId={user.id} userName={profile?.name} />
              </motion.div>
            ) : view === "tools" ? (
              <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                <ToolsDashboard userId={user.id} onBack={() => setView("upload")} />
              </motion.div>
            ) : view === "tool_results" ? (
              <ToolResults
                key={`tool-${activeToolType}-${toolDocId || toolText?.slice(0,20)}`}
                toolType={activeToolType as any}
                documentId={toolDocId}
                text={toolText}
                documentName={toolDocName}
                onBack={() => setView("upload")}
              />
            ) : view === "upload" || !selectedDocId ? (
              <HomeHero
                key="upload"
                userId={user.id}
                onDocumentUploaded={handleDocumentUploaded}
                onToolProcess={handleToolProcess}
                brandingAppName={branding.appName}
              />
            ) : showSplitView ? (
              <motion.div
                key="split"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 overflow-hidden"
              >
                {isMobile ? (
                  mobilePanel === "pdf" ? (
                    <div className="flex-1 min-w-0">
                      <PdfViewer
                        documentId={selectedDocId}
                        fileName={selectedDocName}
                        highlightPage={highlightPage}
                        highlightText={highlightText}
                        inline={true}
                        onTextAction={handleTextAction}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 flex flex-col">
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
                        modelConfig={activeModel}
                      />
                    </div>
                  )
                ) : (
                  <ResizablePanelGroup direction="horizontal" className="flex-1">
                    <ResizablePanel defaultSize={55} minSize={30}>
                      <PdfViewer
                        documentId={selectedDocId}
                        fileName={selectedDocName}
                        highlightPage={highlightPage}
                        highlightText={highlightText}
                        inline={true}
                        onTextAction={handleTextAction}
                      />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={45} minSize={25}>
                      <div className="flex flex-col h-full">
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
                          modelConfig={activeModel}
                        />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
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

        {/* Footer */}
        <div className="border-t border-border px-4 py-1.5 text-center">
          <p className="text-[10px] text-muted-foreground">{copyright}</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
