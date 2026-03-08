import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  AlignLeft,
  Bot,
  PenLine,
  Layers,
  Presentation,
  Search,
  Loader2,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type ToolTab = "summary" | "ai_detector" | "ai_writer" | "flashcards" | "slides" | "research";

const TOOL_META: Record<ToolTab, { label: string; icon: React.ReactNode; color: string }> = {
  summary: { label: "Summary", icon: <AlignLeft className="h-5 w-5" />, color: "text-blue-500" },
  ai_detector: { label: "AI Detector", icon: <Bot className="h-5 w-5" />, color: "text-orange-500" },
  ai_writer: { label: "AI Writer", icon: <PenLine className="h-5 w-5" />, color: "text-emerald-500" },
  flashcards: { label: "Flashcards", icon: <Layers className="h-5 w-5" />, color: "text-purple-500" },
  slides: { label: "Slides", icon: <Presentation className="h-5 w-5" />, color: "text-pink-500" },
  research: { label: "Research", icon: <Search className="h-5 w-5" />, color: "text-cyan-500" },
};

interface ToolResultsProps {
  toolType: ToolTab;
  documentId?: string;
  text?: string;
  documentName?: string;
  onBack: () => void;
}

export default function ToolResults({ toolType, documentId, text, documentName, onBack }: ToolResultsProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef("");
  const meta = TOOL_META[toolType];

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setContent("");
      contentRef.current = "";

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tool-process`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ toolType, documentId, text }),
          }
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `Error ${resp.status}`);
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                contentRef.current += delta;
                setContent(contentRef.current);
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to process");
        setContent(`**Error:** ${err.message || "Failed to process the content."}`);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [toolType, documentId, text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${toolType}-${documentName || "result"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={`h-8 w-8 rounded-lg bg-accent flex items-center justify-center ${meta.color}`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
          {documentName && (
            <p className="text-xs text-muted-foreground truncate">{documentName}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} disabled={!content}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} disabled={!content}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto">
          {loading && !content && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processing with AI...</p>
            </div>
          )}
          {content && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          {loading && content && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Generating...</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
