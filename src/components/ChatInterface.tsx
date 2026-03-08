import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Send, Loader2, FileText, Sparkles, Bot, User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Download, ChevronDown, ChevronUp, List, Cloud, Monitor, Timer, Hash, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { streamChat, streamChatLocal, type ChatMessage, type Source, type RetrievalMetrics, saveMessage, createChatSession, getSuggestedQuestions, getKeyPoints, submitFeedback, exportChatAsText } from "@/lib/api";
import { toast } from "sonner";
import RagDebugPanel from "@/components/RagDebugPanel";
import { Badge } from "@/components/ui/badge";
import type { ModelConfig } from "@/hooks/useModelPreference";
import { useDailyUsage } from "@/hooks/useDailyUsage";
import { Progress } from "@/components/ui/progress";
import DocumentMentionDropdown, { parseMentions, type MentionableDocument } from "@/components/DocumentMentionDropdown";
import ShareDialog from "@/components/ShareDialog";
import { useDocumentShares, useChatSessionShares } from "@/hooks/useSharing";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ChatInterfaceProps {
  documentId: string;
  documentIds?: string[];
  documentName: string;
  userId: string;
  chatSessionId?: string;
  initialMessages?: ChatMessage[];
  onChatSessionCreated?: (id: string) => void;
  onCitationClick?: (pageNumber: number | null, text?: string) => void;
  injectedPrompt?: string;
  onInjectedPromptConsumed?: () => void;
  modelConfig?: ModelConfig;
  workspaceId?: string | null;
  onDocumentDeleted?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Copy">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FeedbackButtons({ messageId, userId, initialFeedback }: { messageId?: string; userId: string; initialFeedback?: "up" | "down" | null }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(initialFeedback || null);
  if (!messageId) return null;
  const handleFeedback = async (rating: "up" | "down") => {
    const newRating = feedback === rating ? null : rating;
    setFeedback(newRating);
    if (newRating) {
      await submitFeedback(messageId, userId, newRating);
      toast.success(newRating === "up" ? "Thanks for the feedback!" : "We'll try to improve");
    }
  };
  return (
    <div className="inline-flex items-center gap-0.5">
      <button onClick={() => handleFeedback("up")} className={`p-1.5 rounded-lg transition-colors ${feedback === "up" ? "text-success bg-success/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`} title="Good answer"><ThumbsUp className="h-3 w-3" /></button>
      <button onClick={() => handleFeedback("down")} className={`p-1.5 rounded-lg transition-colors ${feedback === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`} title="Bad answer"><ThumbsDown className="h-3 w-3" /></button>
    </div>
  );
}

function ExpandableSource({ src, index, onNavigate, documentName }: { src: Source; index: number; onNavigate?: (page: number | null, text?: string) => void; documentName?: string }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = src.score >= 0.8 ? "text-success" : src.score >= 0.6 ? "text-primary" : "text-warning";
  return (
    <div className="flex flex-col w-full rounded-xl bg-accent/50 border border-border/30 p-2.5 text-left text-xs hover:bg-accent hover:border-primary/20 transition-all">
      <button onClick={() => setExpanded(!expanded)} className="flex items-start gap-2 w-full text-left">
        <div className="mt-0.5 h-5 w-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-3 w-3 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {documentName && <span className="text-[10px] font-semibold text-foreground block truncate mb-0.5">{documentName}</span>}
          <span className={`text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>{src.content}</span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground mt-1" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground mt-1" />}
      </button>
      <div className="flex items-center gap-2 mt-1.5 ml-7">
        <span className="text-[10px] text-muted-foreground/70">Chunk {src.chunk_index + 1}</span>
        {src.page_number && (
          <button onClick={() => onNavigate?.(src.page_number, src.content?.slice(0, 80))} className="text-[10px] text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium">📄 Page {src.page_number}</button>
        )}
        {src.score > 0 && (
          <span className={`text-[10px] font-medium ${scoreColor}`}>
            {(src.score * 100).toFixed(0)}% relevance
          </span>
        )}
      </div>
    </div>
  );
}

function MessageTimestamp({ time }: { time?: string }) {
  if (!time) return null;
  return <span className="text-[10px] text-muted-foreground/50 tabular-nums">{new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center animate-pulse">
      <div className="h-16 w-16 rounded-3xl bg-accent mb-6" />
      <div className="h-6 w-48 rounded-lg bg-accent mb-3" />
      <div className="h-4 w-64 rounded-lg bg-accent mb-8" />
      <div className="space-y-2 w-full max-w-md">
        <div className="h-12 rounded-xl bg-accent" />
        <div className="h-12 rounded-xl bg-accent" />
        <div className="h-12 rounded-xl bg-accent" />
      </div>
    </div>
  );
}

export default function ChatInterface({
  documentId, documentIds, documentName, userId, chatSessionId,
  initialMessages, onChatSessionCreated, onCitationClick, injectedPrompt, onInjectedPromptConsumed, modelConfig, workspaceId, onDocumentDeleted,
}: ChatInterfaceProps) {
  const { usage, checkAndIncrement } = useDailyUsage(userId);
  const { profile } = useProfile(userId);
  const userInitials = (profile?.name || profile?.email || "U").slice(0, 2).toUpperCase();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [activeMetrics, setActiveMetrics] = useState<RetrievalMetrics | null>(null);
  const [sessionId, setSessionId] = useState(chatSessionId);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [docStatus, setDocStatus] = useState<string>("loading");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention system state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [allDocuments, setAllDocuments] = useState<MentionableDocument[]>([]);
  const [mentionedDocs, setMentionedDocs] = useState<MentionableDocument[]>([]);

  // Sharing hooks
  const docShareHook = useDocumentShares(documentId);
  const chatShareHook = useChatSessionShares(sessionId || null);

  // Load user documents for mention system
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, reference_tag, is_favorite, is_pinned, file_type")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("is_pinned", { ascending: false })
        .order("is_favorite", { ascending: false });
      if (data) setAllDocuments(data as MentionableDocument[]);
    };
    load();
  }, [userId]);

  // Poll document status when not ready
  useEffect(() => {
    if (!documentId) return;
    const checkStatus = async () => {
      const { data } = await supabase.from("documents").select("status").eq("id", documentId).single();
      if (data) setDocStatus(data.status);
    };
    checkStatus();
    if (docStatus === "ready" || docStatus === "error") return;
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [documentId, docStatus]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (injectedPrompt && !isLoading && docStatus === "ready") {
      sendMessage(injectedPrompt);
      onInjectedPromptConsumed?.();
    }
  }, [injectedPrompt, isLoading, docStatus, onInjectedPromptConsumed]);

  useEffect(() => {
    if (messages.length === 0 && documentId && docStatus === "ready") {
      setLoadingQuestions(true);
      Promise.all([getSuggestedQuestions(documentId), getKeyPoints(documentId)])
        .then(([q, kp]) => {
          setSuggestedQuestions(q.length > 0 ? q : ["What is this document about?", "Summarize the key points", "What are the main findings?"]);
          setKeyPoints(kp);
        }).finally(() => setLoadingQuestions(false));
    }
  }, [documentId, messages.length, docStatus]);

  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [tokenCount, setTokenCount] = useState<number | null>(null);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;
    if (docStatus !== "ready") {
      toast.error("Document is still being processed. Please wait until indexing completes.");
      return;
    }

    // Parse #mentions from input
    const { cleanedInput, mentionedDocIds: parsedDocIds } = parseMentions(userMessage, allDocuments);
    const resolvedMentionedDocs = allDocuments.filter((d) => parsedDocIds.includes(d.id));
    setMentionedDocs(resolvedMentionedDocs);
    setShowMentionDropdown(false);

    // Use mentioned docs or fall back to current document
    const effectiveDocId = parsedDocIds.length > 0 ? parsedDocIds[0] : documentId;
    const effectiveDocIds = parsedDocIds.length > 1 ? parsedDocIds : documentIds;
    const effectiveMessage = cleanedInput || userMessage.trim();

    // Check usage limits
    const { allowed } = await checkAndIncrement();
    if (!allowed) {
      toast.error("You have reached your daily limit of 5 questions. Upgrade to Premium for unlimited access.", { duration: 5000 });
      return;
    }

    setInput("");
    setIsLoading(true);
    setResponseTime(null);
    setTokenCount(null);
    const startTime = performance.now();
    const userMsg: ChatMessage = { role: "user", content: userMessage.trim(), timestamp: new Date().toISOString(), mentionedDocs: resolvedMentionedDocs.length > 0 ? resolvedMentionedDocs.map(d => d.reference_tag || d.name) : undefined };
    setMessages((prev) => [...prev, userMsg]);
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await createChatSession(userId, documentId, userMessage.slice(0, 50), workspaceId || undefined);
        currentSessionId = session.id;
        setSessionId(session.id);
        onChatSessionCreated?.(session.id);
      } catch (e) { console.error("Failed to create session:", e); }
    }
    if (currentSessionId) await saveMessage(currentSessionId, "user", userMessage);
    let assistantContent = "";
    let sources: Source[] = [];

    const isLocalModel = modelConfig?.model_type === "local";

    if (isLocalModel && modelConfig) {
      // Local Ollama model
      await streamChatLocal({
        message: userMessage,
        modelId: modelConfig.model_id,
        ollamaEndpoint: modelConfig.ollama_endpoint,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            return [...prev, { role: "assistant", content: assistantContent, timestamp: new Date().toISOString() }];
          });
        },
        onDone: async (metrics) => {
          setIsLoading(false);
          setResponseTime(Math.round(performance.now() - startTime));
          if (metrics.evalCount) setTokenCount(metrics.evalCount);
          if (currentSessionId) await saveMessage(currentSessionId, "assistant", assistantContent);
        },
        onError: (error) => {
          setIsLoading(false);
          toast.error(error);
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error}`, timestamp: new Date().toISOString() }]);
        },
      });
    } else {
      // Cloud model via edge function
      const responseStyle = localStorage.getItem("responseStyle") || "Detailed";
      await streamChat({
        message: effectiveMessage, documentId: effectiveDocId, documentIds: effectiveDocIds, chatSessionId: currentSessionId, history: messages,
        modelId: modelConfig?.model_id, responseStyle,
        onSources: (s) => { sources = s; setActiveSources(s); },
        onMetrics: (m) => { setActiveMetrics(m); },
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            return [...prev, { role: "assistant", content: assistantContent, sources, timestamp: new Date().toISOString() }];
          });
        },
        onDone: async () => {
          setIsLoading(false);
          setResponseTime(Math.round(performance.now() - startTime));
          let assistantMsgId: string | null = null;
          if (currentSessionId) assistantMsgId = await saveMessage(currentSessionId, "assistant", assistantContent, sources);
          setMessages((prev) => prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, sources, id: assistantMsgId || undefined } : m));
        },
        onError: (error) => {
          setIsLoading(false);
          toast.error(error);
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error}`, timestamp: new Date().toISOString() }]);
        },
      });
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    let userMsg = "";
    for (let i = messageIndex - 1; i >= 0; i--) { if (messages[i].role === "user") { userMsg = messages[i].content; break; } }
    if (!userMsg) return;
    setMessages((prev) => prev.slice(0, messageIndex));
    await sendMessage(userMsg);
  };

  const send = () => sendMessage(input.trim());
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="flex h-full flex-col bg-background/50 overflow-hidden">
      {/* Model indicator + Performance bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 border-b border-border/50 bg-card/50 overflow-x-auto scrollbar-none">
        <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${modelConfig?.model_type === "local" ? "border-success/30 text-success" : "border-primary/30 text-primary"}`}>
          {modelConfig?.model_type === "local" ? <Monitor className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
          <span className="hidden sm:inline">{modelConfig?.model_name || "Gemini 3 Flash"} ({modelConfig?.model_type === "local" ? "Local" : "Cloud"})</span>
          <span className="sm:hidden">{modelConfig?.model_type === "local" ? "Local" : "Cloud"}</span>
        </Badge>
        {responseTime !== null && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
            <Timer className="h-3 w-3" />{(responseTime / 1000).toFixed(1)}s
          </span>
        )}
        {tokenCount !== null && (
          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
            {tokenCount} tokens
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <ShareDialog
            type="document"
            name={documentName}
            shares={docShareHook.shares}
            loading={docShareHook.loading}
            onAdd={(email, perm) => docShareHook.addShare(email, perm, userId)}
            onRemove={docShareHook.removeShare}
            onUpdatePermission={docShareHook.updatePermission}
            trigger={
              <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Share2 className="h-3 w-3" /><span className="hidden sm:inline">Share</span>
              </button>
            }
          />
          {sessionId && (
            <ShareDialog
              type="chat"
              name={documentName + " - Chat"}
              shares={chatShareHook.shares}
              loading={chatShareHook.loading}
              onAdd={(email, perm) => chatShareHook.addShare(email, perm, userId)}
              onRemove={chatShareHook.removeShare}
              trigger={
                <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <Share2 className="h-3 w-3" /><span className="hidden sm:inline">Share Chat</span>
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Processing indicator */}
      {docStatus !== "ready" && docStatus !== "error" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 border-b border-border/50 bg-warning/10"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-warning" />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">
                Document is {docStatus === "pending" ? "queued for processing" : docStatus === "processing" ? "being processed" : "being indexed"}…
              </p>
              <p className="text-[10px] text-muted-foreground">Chat will be available once processing completes.</p>
            </div>
            {onDocumentDeleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this stuck document?")) {
                    import("@/lib/api").then(({ deleteDocument }) => {
                      deleteDocument(documentId).then(() => {
                        toast.success("Document deleted.");
                        onDocumentDeleted();
                      }).catch(() => toast.error("Failed to delete document."));
                    });
                  }
                }}
                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Delete</span>
              </Button>
            )}
          </div>
          <Progress value={docStatus === "pending" ? 10 : docStatus === "processing" ? 50 : 80} className="mt-2 h-1.5" />
        </motion.div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center text-center">
            {docStatus !== "ready" && docStatus !== "error" ? (
              <div className="flex flex-col items-center gap-4 opacity-60">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="rounded-3xl bg-muted p-6 mb-2">
                  <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                </motion.div>
                <h3 className="text-xl font-bold text-muted-foreground tracking-tight">Preparing your document…</h3>
                <p className="max-w-sm text-sm text-muted-foreground/70 leading-relaxed">
                  Questions and key points will appear here once indexing is complete.
                </p>
                <div className="mt-4 grid gap-2 w-full max-w-md">
                  {["What is this document about?", "Summarize the key points", "What are the main findings?"].map((q) => (
                    <div key={q} className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm text-muted-foreground/40 text-left cursor-not-allowed select-none">
                      <span className="text-muted-foreground/30 mr-2">→</span>{q}
                    </div>
                  ))}
                </div>
              </div>
            ) : loadingQuestions ? <ChatSkeleton /> : (
              <>
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="rounded-3xl gradient-primary p-6 mb-6 shadow-glow">
                  <Sparkles className="h-12 w-12 text-primary-foreground" />
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{documentName.length > 30 ? documentName.slice(0, 30) + "…" : `Chat with ${documentName}`}</h3>
                <p className="mt-2 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">Ask any question about your document. I'll find the answer and cite the exact source.</p>

                {keyPoints.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 w-full max-w-md">
                    <button onClick={() => setShowKeyPoints(!showKeyPoints)} className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors mx-auto mb-2">
                      <List className="h-3.5 w-3.5" />{showKeyPoints ? "Hide" : "Show"} Key Points
                      {showKeyPoints ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    <AnimatePresence>
                      {showKeyPoints && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2 shadow-elegant">
                            {keyPoints.map((kp, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground"><span className="text-primary font-bold mt-0.5">•</span><span>{kp}</span></div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                <div className="mt-6 grid gap-2 w-full max-w-md">
                  {suggestedQuestions.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)} className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30 transition-all text-left group shadow-sm hover:shadow-elegant">
                      <span className="text-primary/60 mr-2 group-hover:text-primary transition-colors">→</span>{q}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        <div className="mx-auto max-w-3xl space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="mt-1 flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-sm">
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
                  </div>
                )}
                <div className="max-w-[90%] sm:max-w-[85%] min-w-0">
                  {/* Mentioned docs tag above user message */}
                  {msg.role === "user" && msg.mentionedDocs && msg.mentionedDocs.length > 0 && (
                    <div className="flex items-center gap-1 mb-1 justify-end flex-wrap">
                      {msg.mentionedDocs.map((tag, j) => (
                        <Badge key={j} variant="secondary" className="text-[9px] gap-0.5 py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
                          <Hash className="h-2 w-2" />{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${msg.role === "user" ? "gradient-primary text-primary-foreground shadow-sm" : "bg-card border border-border shadow-elegant"}`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert text-foreground break-words"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-border/30 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources ({msg.sources.length})</p>
                        <div className="grid gap-1.5">
                          {msg.sources.slice(0, 4).map((src, j) => <ExpandableSource key={j} src={src} index={j} onNavigate={onCitationClick} documentName={documentName} />)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    <MessageTimestamp time={msg.timestamp} />
                    {msg.role === "assistant" && (
                      <>
                        <CopyButton text={msg.content} />
                        <FeedbackButtons messageId={msg.id} userId={userId} initialFeedback={msg.feedback} />
                        {!isLoading && (
                          <button onClick={() => handleRegenerate(i)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Regenerate">
                            <RefreshCw className="h-3 w-3" />Regenerate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                    className="mt-1 shrink-0"
                  >
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl border border-border shadow-sm cursor-pointer">
                            {profile?.profile_picture ? (
                              <AvatarImage src={profile.profile_picture} alt="You" className="rounded-xl object-cover" />
                            ) : null}
                            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs font-bold">
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="flex flex-col gap-0.5 text-xs">
                          {profile?.name && <span className="font-semibold">{profile.name}</span>}
                          <span className="text-muted-foreground">{profile?.email || "You"}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-sm">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex gap-1.5 items-center bg-card rounded-2xl px-4 py-3 border border-border shadow-elegant">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.6s" }} />
                  ))}
                </div>
                <span className="ml-2 text-xs text-muted-foreground">Thinking...</span>
              </div>
            </motion.div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* RAG Debug Panel */}
      {activeSources.length > 0 && (
        <RagDebugPanel
          debugInfo={{
            sources: activeSources,
            modelUsed: "Gemini 3 Flash",
            totalChunksSearched: activeMetrics?.totalCandidates,
            processingTimeMs: activeMetrics?.retrievalTimeMs,
            searchMethods: activeMetrics?.searchMethods,
            reranked: activeMetrics?.reranked,
          }}
          onCitationClick={onCitationClick}
          documentName={documentName}
        />
      )}

      {/* Usage limit banner */}
      {!usage.isPremium && usage.remaining === 0 && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="mx-auto max-w-3xl flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <Timer className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-destructive">Daily limit reached</p>
              <p className="text-[11px] text-muted-foreground">You've used all 5 free questions today. Upgrade to Premium for unlimited access.</p>
            </div>
          </div>
        </div>
      )}

      {/* Usage indicator for free users */}
      {!usage.isPremium && usage.remaining > 0 && (
        <div className="border-t border-border/50 px-4 py-1.5 bg-card/30">
          <div className="mx-auto max-w-3xl flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{usage.remaining} question{usage.remaining !== 1 ? "s" : ""} remaining today</span>
            <Progress value={(usage.questionsAsked / usage.maxQuestions) * 100} className="h-1 flex-1 max-w-[100px]" />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border glass p-3 sm:p-4">
        <div className="mx-auto max-w-3xl">
          {/* Mentioned docs indicator */}
          {mentionedDocs.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">Context:</span>
              {mentionedDocs.map((doc) => (
                <Badge key={doc.id} variant="secondary" className="text-[10px] gap-1 py-0.5">
                  <Hash className="h-2.5 w-2.5" />
                  {doc.reference_tag || doc.name}
                </Badge>
              ))}
            </div>
          )}
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <button onClick={() => exportChatAsText(messages, documentName)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Download className="h-3 w-3" />Export Chat
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-1.5 sm:gap-2 rounded-2xl border border-border bg-card p-1.5 sm:p-2 shadow-elegant focus-within:border-primary/40 focus-within:shadow-glow transition-all">
            {/* Mention dropdown */}
            <DocumentMentionDropdown
              userId={userId}
              query={mentionQuery}
              visible={showMentionDropdown}
              onSelect={(doc) => {
                const tag = doc.reference_tag || doc.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
                // Replace the current #query with the selected tag
                const hashIndex = input.lastIndexOf("#");
                const before = hashIndex >= 0 ? input.slice(0, hashIndex) : input;
                setInput(`${before}#${tag} `);
                setShowMentionDropdown(false);
                textareaRef.current?.focus();
              }}
              onClose={() => setShowMentionDropdown(false)}
            />
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                // Detect # mention trigger
                const cursorPos = e.target.selectionStart || val.length;
                const textBeforeCursor = val.slice(0, cursorPos);
                const hashMatch = textBeforeCursor.match(/#(\S*)$/);
                if (hashMatch) {
                  setShowMentionDropdown(true);
                  setMentionQuery(hashMatch[1]);
                } else {
                  setShowMentionDropdown(false);
                  setMentionQuery("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && showMentionDropdown) {
                  e.preventDefault();
                  setShowMentionDropdown(false);
                  return;
                }
                handleKeyDown(e);
              }}
              placeholder="Ask a question... Type # to mention a document"
              className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || isLoading || (docStatus !== "ready" && docStatus !== "error")} className="h-9 w-9 shrink-0 rounded-xl gradient-primary border-0 shadow-sm hover:opacity-90">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/50">Type # to mention a document for targeted answers</p>
        </div>
      </div>
    </div>
  );
}
