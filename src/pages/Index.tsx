import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import DocumentUpload from "@/components/DocumentUpload";
import SourcesPanel from "@/components/SourcesPanel";
import { FileText, Upload } from "lucide-react";
import type { Source } from "@/lib/api";
import DarkModeToggle from "@/components/DarkModeToggle";

type View = "upload" | "chat";

const Index = () => {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const [view, setView] = useState<View>("upload");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary animate-pulse-soft" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
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
    setSelectedDocName(docName);
    setView("chat");
    setActiveSources([]);
  };

  const handleDocumentUploaded = (doc: any) => {
    // Auto-select if it's the first document or after processing
    if (doc.status === "ready") {
      handleSelectDocument(doc.id, doc.name);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        userId={user.id}
        selectedDocId={selectedDocId}
        onSelectDocument={handleSelectDocument}
        onNewUpload={() => { setView("upload"); setSelectedDocId(null); }}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
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
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      Upload a document
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Upload a PDF, DOCX, or TXT file and start chatting with it
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
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {selectedDocName}
                  </span>
                  <DarkModeToggle />
                </div>
                <ChatInterface
                  documentId={selectedDocId}
                  documentName={selectedDocName}
                  userId={user.id}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sources Panel */}
        <AnimatePresence>
          {activeSources.length > 0 && (
            <SourcesPanel sources={activeSources} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
