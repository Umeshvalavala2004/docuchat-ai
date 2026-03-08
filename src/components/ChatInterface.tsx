import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, FileText, Sparkles, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { streamChat, type ChatMessage, type Source, saveMessage, createChatSession } from "@/lib/api";

interface ChatInterfaceProps {
  documentId: string;
  documentName: string;
  userId: string;
  chatSessionId?: string;
  initialMessages?: ChatMessage[];
  onChatSessionCreated?: (id: string) => void;
}

export default function ChatInterface({
  documentId,
  documentName,
  userId,
  chatSessionId,
  initialMessages,
  onChatSessionCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [sessionId, setSessionId] = useState(chatSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { role: "user", content: userMessage };
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

    if (currentSessionId) {
      saveMessage(currentSessionId, "user", userMessage);
    }

    let assistantContent = "";
    let sources: Source[] = [];

    await streamChat({
      message: userMessage,
      documentId,
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
          return [...prev, { role: "assistant", content: assistantContent, sources }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        if (currentSessionId) {
          saveMessage(currentSessionId, "assistant", assistantContent, sources);
        }
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant" ? { ...m, sources } : m
          )
        );
      },
      onError: (error) => {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${error}` },
        ]);
      },
    });
  };

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
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 p-5 mb-5 shadow-inner"
            >
              <Sparkles className="h-10 w-10 text-primary" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground">
              Chat with {documentName}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Ask any question about your document. I'll find the answer and cite the exact source.
            </p>
            <div className="mt-6 grid gap-2 w-full max-w-md">
              {["What is this document about?", "Summarize the key points", "What are the main findings?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30 transition-all text-left"
                >
                  <span className="text-primary/60 mr-2">→</span>
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
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
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
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

                  {/* Sources */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-border/30 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sources
                      </p>
                      <div className="grid gap-1.5">
                        {msg.sources.slice(0, 4).map((src, j) => (
                          <button
                            key={j}
                            onClick={() => setActiveSources([src])}
                            className="flex items-start gap-2 rounded-lg bg-background/80 border border-border/30 p-2 text-left text-xs hover:bg-background hover:border-primary/30 transition-all"
                          >
                            <FileText className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            <span className="line-clamp-2 text-muted-foreground">
                              {src.content}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-sm">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex gap-1.5 items-center bg-muted/80 rounded-2xl px-4 py-3 border border-border/50">
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft" />
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-gradient-to-t from-background to-background/80 p-4">
        <div className="mx-auto max-w-3xl">
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
            <Button
              size="icon"
              onClick={send}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 shrink-0 rounded-xl shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
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
