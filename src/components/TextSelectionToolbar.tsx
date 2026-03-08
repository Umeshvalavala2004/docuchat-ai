import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, FileText, PenLine, MessageSquare } from "lucide-react";

export type TextAction = "explain" | "summarize" | "rewrite" | "ask";

interface TextSelectionToolbarProps {
  onAction: (action: TextAction, text: string) => void;
}

const actions = [
  { id: "explain" as TextAction, label: "Explain", icon: Lightbulb, color: "text-amber-500" },
  { id: "summarize" as TextAction, label: "Summarize", icon: FileText, color: "text-primary" },
  { id: "rewrite" as TextAction, label: "Rewrite", icon: PenLine, color: "text-emerald-500" },
  { id: "ask" as TextAction, label: "Ask AI", icon: MessageSquare, color: "text-violet-500" },
];

export default function TextSelectionToolbar({ onAction }: TextSelectionToolbarProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay so selection is finalized
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || "";

        if (text.length > 3) {
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            setPosition({
              x: rect.left + rect.width / 2,
              y: rect.top - 8,
            });
            setSelectedText(text);
          }
        } else {
          setPosition(null);
          setSelectedText("");
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Close toolbar if clicking outside it
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPosition(null);
        setSelectedText("");
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  const handleAction = (action: TextAction) => {
    if (selectedText) {
      onAction(action, selectedText);
      setPosition(null);
      setSelectedText("");
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <AnimatePresence>
      {position && selectedText && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed z-50 flex items-center gap-0.5 rounded-xl border border-border bg-card px-1.5 py-1 shadow-lg backdrop-blur-sm"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={action.label}
            >
              <action.icon className={`h-3.5 w-3.5 ${action.color}`} />
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
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
