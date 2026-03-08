import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb, FileText, PenLine, MessageSquare, Copy, MessageCircle,
  Palette, Check,
} from "lucide-react";
import { toast } from "sonner";

export type TextAction = "explain" | "summarize" | "rewrite" | "ask";
export type HighlightColor = "red" | "yellow" | "green" | "blue" | "purple";

const highlightColors: { id: HighlightColor; bg: string; ring: string }[] = [
  { id: "red", bg: "bg-red-400", ring: "ring-red-400" },
  { id: "yellow", bg: "bg-yellow-400", ring: "ring-yellow-400" },
  { id: "green", bg: "bg-green-400", ring: "ring-green-400" },
  { id: "blue", bg: "bg-blue-400", ring: "ring-blue-400" },
  { id: "purple", bg: "bg-purple-400", ring: "ring-purple-400" },
];

interface TextSelectionToolbarProps {
  onAction: (action: TextAction, text: string) => void;
  onHighlight?: (text: string, color: HighlightColor) => void;
  onComment?: (text: string) => void;
}

const aiActions: { id: TextAction; label: string; icon: typeof Lightbulb; color: string }[] = [
  { id: "explain", label: "Explain", icon: Lightbulb, color: "text-amber-500" },
  { id: "summarize", label: "Summarize", icon: FileText, color: "text-primary" },
  { id: "rewrite", label: "Rewrite", icon: PenLine, color: "text-emerald-500" },
  { id: "ask", label: "Ask AI", icon: MessageSquare, color: "text-violet-500" },
];

export default function TextSelectionToolbar({ onAction, onHighlight, onComment }: TextSelectionToolbarProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || "";
        if (text.length > 3) {
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            setPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
            setSelectedText(text);
            setShowColors(false);
          }
        } else {
          setPosition(null);
          setSelectedText("");
          setShowColors(false);
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPosition(null);
        setSelectedText("");
        setShowColors(false);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  const dismiss = () => {
    setPosition(null);
    setSelectedText("");
    setShowColors(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleAction = (action: TextAction) => {
    if (selectedText) {
      onAction(action, selectedText);
      dismiss();
    }
  };

  const handleCopy = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      toast.success("Copied to clipboard");
      dismiss();
    }
  };

  const handleHighlight = (color: HighlightColor) => {
    if (selectedText && onHighlight) {
      onHighlight(selectedText, color);
      dismiss();
    }
  };

  const handleComment = () => {
    if (selectedText && onComment) {
      onComment(selectedText);
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {position && selectedText && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="fixed z-50 rounded-xl border border-border bg-card shadow-xl backdrop-blur-md"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          {/* Main row */}
          <div className="flex items-center gap-0.5 px-1 py-0.5">
            {/* AI actions */}
            {aiActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={action.label}
              >
                <action.icon className={`h-3.5 w-3.5 ${action.color}`} />
                <span className="hidden md:inline">{action.label}</span>
              </button>
            ))}

            {/* Separator */}
            <div className="h-5 w-px bg-border mx-0.5" />

            {/* Highlight toggle */}
            <button
              onClick={() => setShowColors(!showColors)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showColors ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              title="Highlight"
            >
              <Palette className="h-3.5 w-3.5 text-pink-500" />
            </button>

            {/* Comment */}
            {onComment && (
              <button
                onClick={handleComment}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Add comment"
              >
                <MessageCircle className="h-3.5 w-3.5 text-sky-500" />
              </button>
            )}

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Copy text"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Color picker row */}
          <AnimatePresence>
            {showColors && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="flex items-center justify-center gap-2 px-3 py-2">
                  {highlightColors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleHighlight(c.id)}
                      className={`h-5 w-5 rounded-full ${c.bg} hover:ring-2 ${c.ring} ring-offset-1 ring-offset-card transition-all hover:scale-110`}
                      title={c.id}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full w-0 h-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid hsl(var(--border))",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
