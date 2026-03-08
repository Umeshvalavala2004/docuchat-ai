import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, FileText, Sparkles, Bot, User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Download, ChevronDown, ChevronUp, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { streamChat, type ChatMessage, type Source, saveMessage, createChatSession, getSuggestedQuestions, getKeyPoints, submitFeedback, exportChatAsText } from "@/lib/api";
import { toast } from "sonner";

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
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Copy">
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
      <button
        onClick={() => handleFeedback("up")}
        className={`p-1 rounded-md transition-colors ${feedback === "up" ? "text-success bg-success/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        title="Good answer"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => handleFeedback("down")}
        className={`p-1 rounded-md transition-colors ${feedback === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        title="Bad answer"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function ExpandableSource({ src, index, onNavigate }: { src: Source; index: number; onNavigate?: (page: number | null, text?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col w-full rounded-lg bg-background/80 border border-border/30 p-2 text-left text-xs hover:bg-background hover:border-primary/30 transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left"
      >
        <FileText className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        <span className={`text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>
          {src.content}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>
      <div className="flex items-center gap-2 mt-1 ml-5">
        <span className="text-[10px] text-muted-foreground/70">Chunk {src.chunk_index + 1}</span>
        {src.page_number && (
          <button
            onClick={() => onNavigate?.(src.page_number, src.content?.slice(0, 80))}
            className="text-[10px] text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium"
          >
            📄 Page {src.page_number}
          </button>
        )}
        {src.score > 0 && <span className="text-[10px] text-primary/60">{(src.score * 100).toFixed(0)}% match</span>}
      </div>
    </div>
  );
}

function MessageTimestamp({ time }: { time?: string }) {
  if (!time) return null;
  return (
    <span className="text-[10px] text-muted-foreground/50 tabular-nums">
      {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

// Loading skeleton for initial state
function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center animate-pulse-soft">
      <div className="h-16 w-16 rounded-3xl bg-muted mb-6" />
      <div className="h-6 w-48 rounded-lg bg-muted mb-3" />
      <div className="h-4 w-64 rounded-lg bg-muted mb-8" />
      <div className="space-y-2 w-full max-w-md">
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export default function ChatInterface({
  documentId,
  documentIds,
  documentName,
  userId,
  chatSessionId,
  initialMessages,
  onChatSessionCreated,
  onCitationClick,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [sessionId, setSessionId] = useState(chatSessionId);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load suggested questions + key points for new chats
  useEffect(() => {
    if (messages.length === 0 && documentId) {
      setLoadingQuestions(true);
      Promise.all([
        getSuggestedQuestions(documentId),
        getKeyPoints(documentId),
      ]).then(([q, kp]) => {
        setSuggestedQuestions(q.length > 0 ? q : [
          "What is this document about?",
          "Summarize the key points",
          "What are the main findings?",
        ]);
        setKeyPoints(kp);
      }).finally(() => setLoadingQuestions(false));
    }
  }, [documentId, messages.length]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;
    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { role: "user", content: userMessage.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await createChatSession(userId, documentId, userMessage.slice(0, 50));
        currentSessionId = session.id;
        setSessionId(session.id);
        onChatSessionCreated?.(session.id);
      } catch (e) {
        console.error("Failed to create session:", e);
      }
    }

    let userMsgId: string | null = null;
    if (currentSessionId) {
      userMsgId = await saveMessage(currentSessionId, "user", userMessage);
    }

    let assistantContent = "";
    let sources: Source[] = [];

    await streamChat({
      message: userMessage,
      documentId,
      documentIds,
      chatSessionId: currentSessionId,
      history: messages,
      onSources: (s) => {
        sources = s;
        setActiveSources(s);
      },
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantContent, sources, timestamp: new Date().toISOString() }];
        });
      },
      onDone: async () => {
        setIsLoading(false);
        let assistantMsgId: string | null = null;
        if (currentSessionId) {
          assistantMsgId = await saveMessage(currentSessionId, "assistant", assistantContent, sources);
        }
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant" ? { ...m, sources, id: assistantMsgId || undefined } : m
          )
        );
      },
      onError: (error) => {
        setIsLoading(false);
        toast.error(error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${error}`, timestamp: new Date().toISOString() },
        ]);
      },
    });
  };

  const handleRegenerate = async (messageIndex: number) => {
    let userMsg = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i].content;
        break;
      }
    }
    if (!userMsg) return;
    setMessages((prev) => prev.slice(0, messageIndex));
    await sendMessage(userMsg);
  };

  const send = () => sendMessage(input.trim());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-full flex-col items-center justify-center text-center"
          >
            {loadingQuestions ? (
              <ChatSkeleton />
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 p-6 mb-6 shadow-inner"
                >
                  <Sparkles className="h-12 w-12 text-primary" />
                </motion.div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">
                  Chat with {documentName}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Ask any question about your document. I'll find the answer and cite the exact source.
                </p>

                {/* Key Points */}
                {keyPoints.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6 w-full max-w-md"
                  >
                    <button
                      onClick={() => setShowKeyPoints(!showKeyPoints)}
                      className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors mx-auto mb-2"
                    >
                      <List className="h-3.5 w-3.5" />
                      {showKeyPoints ? "Hide" : "Show"} Key Points
                      {showKeyPoints ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    <AnimatePresence>
                      {showKeyPoints && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2">
                            {keyPoints.map((kp, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="text-primary font-bold mt-0.5">•</span>
                                <span>{kp}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Suggested Questions */}
                <div className="mt-6 grid gap-2 w-full max-w-md">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30 transition-all text-left group"
                    >
                      <span className="text-primary/60 mr-2 group-hover:text-primary transition-colors">→</span>
                      {q}
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
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-sm">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className="max-w-[85%] min-w-0">
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/80 border border-border/50"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Sources - expandable */}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-border/30 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Sources ({msg.sources.length})
                        </p>
                        <div className="grid gap-1.5">
                          {msg.sources.slice(0, 4).map((src, j) => (
                            <ExpandableSource key={j} src={src} index={j} onNavigate={onCitationClick} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message actions row */}
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    <MessageTimestamp time={msg.timestamp} />
                    {msg.role === "assistant" && (
                      <>
                        <CopyButton text={msg.content} />
                        <FeedbackButtons messageId={msg.id} userId={userId} initialFeedback={msg.feedback} />
                        {!isLoading && (
                          <button
                            onClick={() => handleRegenerate(i)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5">
                    <User className="h-4 w-4 text-foreground/70" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-sm">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex gap-1.5 items-center bg-muted/80 rounded-2xl px-4 py-3 border border-border/50">
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft" />
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft [animation-delay:0.4s]" />
                <span className="ml-2 text-xs text-muted-foreground">Thinking...</span>
              </div>
            </motion.div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-gradient-to-t from-background to-background/80 p-4">
        <div className="mx-auto max-w-3xl">
          {/* Export button when messages exist */}
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => exportChatAsText(messages, documentName)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Download className="h-3 w-3" />
                Export Chat
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your document..."
              className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || isLoading} className="h-9 w-9 shrink-0 rounded-xl shadow-sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            Answers are generated from your document content only
          </p>
        </div>
      </div>
    </div>
  );
}
