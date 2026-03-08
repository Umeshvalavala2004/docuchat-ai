import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { streamChat, type ChatMessage, type Source, saveMessage, createChatSession } from "@/lib/api";

interface ChatInterfaceProps {
  documentId: string;
  documentName: string;
  userId: string;
  chatSessionId?: string;
  onChatSessionCreated?: (id: string) => void;
}

export default function ChatInterface({
  documentId,
  documentName,
  userId,
  chatSessionId,
  onChatSessionCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

    // Create chat session if needed
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

    // Save user message
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
        // Save assistant message
        if (currentSessionId) {
          saveMessage(currentSessionId, "assistant", assistantContent, sources);
        }
        // Update sources on final message
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
            <div className="rounded-2xl bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Chat with {documentName}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Ask any question about your document. I'll find the answer and show you exactly where it came from.
            </p>
            <div className="mt-6 grid gap-2">
              {["What is this document about?", "Summarize the key points", "What are the main findings?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mx-auto max-w-3xl space-y-6">
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
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
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
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
                      <div className="grid gap-1.5">
                        {msg.sources.slice(0, 4).map((src, j) => (
                          <button
                            key={j}
                            onClick={() => setActiveSources([src])}
                            className="flex items-start gap-2 rounded-lg bg-background/60 p-2 text-left text-xs hover:bg-background transition-colors"
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
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                    <span className="text-xs font-medium text-foreground">You</span>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse-soft" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse-soft [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse-soft [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
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
              className="h-9 w-9 shrink-0 rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Answers are generated from your document content only
          </p>
        </div>
      </div>
    </div>
  );
}
