import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Upload,
  MessageSquare,
  AlignLeft,
  Bot,
  PenLine,
  Layers,
  Presentation,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
} from "lucide-react";
import { uploadDocument } from "@/lib/api";
import { toast } from "sonner";

export type ToolTab = "chat" | "summary" | "ai_detector" | "ai_writer" | "flashcards" | "slides" | "research";

const TABS: { id: ToolTab; labelKey: string; icon: React.ReactNode; subtitle: string; inputPlaceholder: string }[] = [
  { id: "chat", labelKey: "Chat", icon: <MessageSquare className="h-4 w-4" />, subtitle: "Chat with any 📁 file, 🎬 video or 🔗 website", inputPlaceholder: "Ask to start a chat" },
  { id: "summary", labelKey: "Summary", icon: <AlignLeft className="h-4 w-4" />, subtitle: "Summarize any 📁 file, 📝 text or 🔗 website", inputPlaceholder: "Paste text to summarize..." },
  { id: "ai_detector", labelKey: "AI Detector", icon: <Bot className="h-4 w-4" />, subtitle: "Detect AI-generated content in any text", inputPlaceholder: "Paste text to analyze..." },
  { id: "ai_writer", labelKey: "AI Writer", icon: <PenLine className="h-4 w-4" />, subtitle: "Write content from any 📁 file, 📝 text or 🔗 website", inputPlaceholder: "Describe what to write..." },
  { id: "flashcards", labelKey: "Flashcards", icon: <Layers className="h-4 w-4" />, subtitle: "Create flashcards from any 📁 file or 📝 text", inputPlaceholder: "Paste text to create flashcards..." },
  { id: "slides", labelKey: "Slides", icon: <Presentation className="h-4 w-4" />, subtitle: "Create slides from any 📁 file, 📝 text, 🎬 video or 🔗 website", inputPlaceholder: "Paste text or describe topic..." },
  { id: "research", labelKey: "Research", icon: <Search className="h-4 w-4" />, subtitle: "Research any topic with AI-powered insights", inputPlaceholder: "Enter a topic to research..." },
];

interface HomeHeroProps {
  userId: string;
  onDocumentUploaded: (doc: any) => void;
  onToolProcess: (toolType: ToolTab, documentId?: string, text?: string, documentName?: string) => void;
  brandingAppName?: string;
}

export default function HomeHero({ userId, onDocumentUploaded, onToolProcess, brandingAppName }: HomeHeroProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ToolTab>("chat");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentTab = TABS.find((tab) => tab.id === activeTab)!;

  const handleFile = async (file: File) => {
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type) && !["pdf", "txt", "docx"].includes(ext || "")) {
      toast.error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadDocument(file, userId);
      setUploadedFile(file.name);

      if (activeTab === "chat") {
        onDocumentUploaded(doc);
      } else {
        // For other tools, process the document with the selected tool
        toast.success(`Document uploaded! Processing with ${currentTab.labelKey}...`);
        onToolProcess(activeTab, doc.id, undefined, file.name);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }, [userId, activeTab]);

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    if (activeTab === "chat") {
      // For chat, text input doesn't make sense without a document
      toast.info("Please upload a document first to start chatting.");
      return;
    }
    onToolProcess(activeTab, undefined, textInput.trim());
    setTextInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-8 md:py-14">
      {/* Hero heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          <Sparkles className="inline h-7 w-7 md:h-9 md:w-9 text-primary mr-2 -mt-1" />
          <span className="gradient-text">Best-in-class AI tools</span>{" "}
          <span>for</span>
          <br />
          <span>students and researchers</span>
        </h1>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="w-full max-w-4xl rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-elevated p-6 md:p-8"
      >
        {/* Tool tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-4 mb-4 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setUploadedFile(null); }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.labelKey}
            </button>
          ))}
        </div>

        {/* Subtitle */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-center text-lg md:text-xl font-semibold text-foreground mb-6"
          >
            {currentTab.subtitle}
          </motion.p>
        </AnimatePresence>

        {/* Upload area - two panels */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 md:p-10 flex flex-col items-center justify-center text-center transition-all min-h-[180px] ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <AnimatePresence mode="wait">
              {uploading ? (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">Uploading & processing...</p>
                </motion.div>
              ) : uploadedFile ? (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium text-foreground">{uploadedFile}</p>
                  <p className="text-xs text-muted-foreground">Drop another file or click to upload</p>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Drop a file or{" "}
                    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
                      upload <Upload className="h-3.5 w-3.5" />
                    </span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text input zone */}
          <div className="rounded-xl border border-border bg-background p-4 flex flex-col min-h-[180px]">
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentTab.inputPlaceholder}
              className="flex-1 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              rows={4}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] font-medium shadow-sm">CTRL</kbd>
                <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] font-medium shadow-sm">V</kbd>
                <span>to paste text or links</span>
              </div>
              {activeTab !== "chat" && textInput.trim() && (
                <Button
                  size="sm"
                  className="h-8 rounded-lg gap-1.5"
                  onClick={handleTextSubmit}
                >
                  <Send className="h-3.5 w-3.5" />
                  Process
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
