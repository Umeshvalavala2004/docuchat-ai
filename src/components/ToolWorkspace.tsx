import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolDef } from "@/components/ToolsDashboard";

interface ToolWorkspaceProps {
  tool: ToolDef;
  userId: string;
  onBack: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
  "ai-writer": "You are a professional AI Writer. Help users generate articles, summaries, reports, and emails. Produce polished, well-structured content.",
  "ai-detector": "You are an AI text detector. Analyze text and determine if it was written by AI or a human. Explain your reasoning with confidence scores.",
  "youtube-chat": "You are a YouTube video analyst. When given a YouTube URL or transcript, analyze the content and answer questions about the video.",
  "research": "You are a research assistant. Help users collect information, synthesize findings, and generate structured research summaries with citations.",
  "web-chat": "You are a web page analyst. When given a URL or webpage content, analyze it and answer questions about the content.",
  "doc-compare": "You are a document comparison specialist. Compare texts and highlight differences, similarities, additions, and deletions in a clear format.",
  "pdf-summarizer": "You are a PDF summarizer. Generate structured summaries with key points, main arguments, and conclusions from document content.",
  "key-insights": "You are a key insights extractor. Identify and extract key findings, named entities, statistics, and important information from text.",
  "meeting-notes": "You are a meeting notes generator. Convert rough notes or transcripts into well-structured meeting minutes with action items, decisions, and attendees.",
  "code-assistant": "You are a code assistant. Help users understand, debug, optimize, and refactor code. Provide clear explanations and improved code snippets.",
  "knowledge-graph": "You are a knowledge graph generator. Analyze text and create structured relationship maps showing entities and their connections. Use markdown tables and lists to represent the graph.",
  "mind-map": "You are a mind map generator. Convert content into hierarchical mind map structures using indented lists and clear categorization.",
  "translator": "You are a professional translator. Translate text accurately between languages while preserving meaning, tone, and context. Ask the user which languages to translate between.",
  "citation-gen": "You are a citation generator. Generate properly formatted citations in APA, MLA, IEEE, or other academic formats. Ask for the source details needed.",
};

const TOOL_PLACEHOLDERS: Record<string, string> = {
  "ai-writer": "Describe what you want to write (e.g., 'Write a blog post about AI in healthcare')...",
  "ai-detector": "Paste text to analyze whether it was written by AI or a human...",
  "youtube-chat": "Paste a YouTube URL or transcript and ask a question...",
  "research": "Enter your research topic or question...",
  "web-chat": "Paste a webpage URL or content and ask a question...",
  "doc-compare": "Paste two texts to compare (separate with '---')...",
  "pdf-summarizer": "Paste document text to summarize...",
  "key-insights": "Paste text to extract key insights from...",
  "meeting-notes": "Paste rough meeting notes or transcript...",
  "code-assistant": "Paste code and describe what you need help with...",
  "knowledge-graph": "Paste text to generate a knowledge graph from...",
  "mind-map": "Paste content to convert into a mind map...",
  "translator": "Enter text to translate and specify target language...",
  "citation-gen": "Enter source details (title, author, year, publisher, URL)...",
};

export default function ToolWorkspace({ tool, userId, onBack }: ToolWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const systemPrompt = TOOL_SYSTEM_PROMPTS[tool.id] || "You are a helpful AI assistant.";
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tool-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Rate limit exceeded. Please wait a moment."); setLoading(false); return; }
        if (resp.status === 402) { toast.error("Usage credits exhausted. Please add funds."); setLoading(false); return; }
        throw new Error("Failed to get response");
      }

      // Stream response
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
            }
          } catch {}
        }
      }

      if (!assistantContent) {
        setMessages([...newMessages, { role: "assistant", content: "I couldn't generate a response. Please try again." }]);
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setMessages([...newMessages, { role: "assistant", content: "An error occurred. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center bg-accent ${tool.color}`}>
          <tool.icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{tool.label}</h2>
          <p className="text-[11px] text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center bg-accent mx-auto mb-4 ${tool.color}`}>
                <tool.icon className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{tool.label}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{tool.description}</p>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    <CopyBtn text={msg.content} />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-accent rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={TOOL_PLACEHOLDERS[tool.id] || "Type your message..."}
            className="min-h-[44px] max-h-[120px] rounded-xl resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} className="h-11 w-11 rounded-xl gradient-primary shrink-0" size="icon">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
