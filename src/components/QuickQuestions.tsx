import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleQuestion, Plus, Trash2, X, Check, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickQuestionsProps {
  userId: string;
  onInsertPrompt: (prompt: string) => void;
}

interface QuickQ {
  id: string;
  prompt: string;
}

const DEFAULT_PROMPTS = [
  "Summarize this document in 5 key points",
  "Explain this paragraph in simple terms",
  "What are the main arguments in this text?",
  "List all action items from this document",
];

export default function QuickQuestions({ userId, onInsertPrompt }: QuickQuestionsProps) {
  const [questions, setQuestions] = useState<QuickQ[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");

  useEffect(() => { loadQuestions(); }, [userId]);

  const loadQuestions = async () => {
    const { data } = await supabase.from("quick_questions" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setQuestions(data as any);
  };

  const handleAdd = async () => {
    if (!newPrompt.trim()) return;
    await supabase.from("quick_questions" as any).insert({ user_id: userId, prompt: newPrompt.trim() } as any);
    setNewPrompt("");
    setAdding(false);
    loadQuestions();
    toast.success("Quick question saved");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("quick_questions" as any).delete().eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    toast.success("Quick question removed");
  };

  const allPrompts = questions.length > 0 ? questions : DEFAULT_PROMPTS.map((p, i) => ({ id: `default-${i}`, prompt: p }));

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-1">
            <div className="flex items-center gap-1 p-1">
              <Input value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }} placeholder="Enter a quick question..." className="h-7 text-xs flex-1" autoFocus />
              <button onClick={handleAdd}><Check className="h-3 w-3 text-success" /></button>
              <button onClick={() => setAdding(false)}><X className="h-3 w-3 text-muted-foreground" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors">
          <Plus className="h-3 w-3" /> Add Prompt
        </button>
      )}

      <div className="space-y-0.5 px-1">
        {allPrompts.map((q) => (
          <div key={q.id} className="group flex items-center gap-1.5 rounded-lg hover:bg-accent/70 transition-all">
            <button
              onClick={() => { onInsertPrompt(q.prompt); toast.success("Prompt inserted into chat"); }}
              className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
            >
              <Zap className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-xs text-foreground truncate">{q.prompt}</span>
            </button>
            {!q.id.startsWith("default-") && (
              <button onClick={() => handleDelete(q.id)} className="p-0.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all">
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
