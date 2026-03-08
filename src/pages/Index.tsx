import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import DocumentUpload from "@/components/DocumentUpload";
import PdfViewer from "@/components/PdfViewer";
import { FileText, Upload, Eye, EyeOff, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getChatMessages } from "@/lib/api";
import type { Source, ChatMessage } from "@/lib/api";

type View = "upload" | "chat";

const Index = () => {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const [view, setView] = useState<View>("upload");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <FileText className="h-6 w-6 text-primary-foreground animate-pulse-soft" />
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
    setShowPdfViewer(false);
  };

  const handleStartMultiDocChat = (docIds: string[], docNames: string[]) => {
    setSelectedDocId(docIds[0]);
    setSelectedDocIds(docIds);
    setSelectedDocName(docNames.join(", "));
    setView("chat");
    setChatSessionId(undefined);
    setInitialMessages(undefined);
    setShowPdfViewer(false);
  };

  const handleSelectChatSession = async (sessionId: string, docId: string, docName: string) => {
    setSelectedDocId(docId);
    setSelectedDocName(docName);
    setChatSessionId(sessionId);
    setView("chat");
    setShowPdfViewer(false);

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
          setChatSessionId(undefined);
          setInitialMessages(undefined);
        }}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {view === "upload" || !selectedDocId ? (
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
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                {/* Chat header */}
                <div className="flex items-center gap-3 border-b border-border px-5 py-3 bg-card/50 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate flex-1">
                    {selectedDocName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
                    className="gap-1.5 rounded-lg text-xs h-8"
                  >
                    {showPdfViewer ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide PDF
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        View PDF
                      </>
                    )}
                  </Button>
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PDF Viewer Panel */}
        <AnimatePresence>
          {showPdfViewer && selectedDocId && (
            <PdfViewer
              documentId={selectedDocId}
              fileName={selectedDocName}
              onClose={() => setShowPdfViewer(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
