import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, Shield, Youtube, FlaskConical, Globe, GitCompare,
  FileText, Lightbulb, ClipboardList, Code2, Network, Brain,
  Languages, BookOpen, Search, Star, StarOff, ArrowLeft, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ToolWorkspace from "@/components/ToolWorkspace";

export interface ToolDef {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: "core" | "new";
}

export const ALL_TOOLS: ToolDef[] = [
  { id: "ai-writer", label: "AI Writer", description: "Generate articles, summaries, reports, and emails", icon: PenLine, color: "text-emerald-500", category: "core" },
  { id: "ai-detector", label: "AI Detector", description: "Detect whether text was written by AI or humans", icon: Shield, color: "text-amber-500", category: "core" },
  { id: "youtube-chat", label: "YouTube Chat", description: "Ask questions about YouTube videos by analyzing transcripts", icon: Youtube, color: "text-red-500", category: "core" },
  { id: "research", label: "Research Assistant", description: "Collect information and generate research summaries", icon: FlaskConical, color: "text-violet-500", category: "core" },
  { id: "web-chat", label: "Web Page Chat", description: "Ask questions about the content of a webpage", icon: Globe, color: "text-sky-500", category: "core" },
  { id: "doc-compare", label: "Document Compare", description: "Compare two documents and highlight differences", icon: GitCompare, color: "text-orange-500", category: "core" },
  { id: "pdf-summarizer", label: "PDF Summarizer", description: "Upload a document and generate a structured summary with key points", icon: FileText, color: "text-blue-500", category: "new" },
  { id: "key-insights", label: "Key Insights Extractor", description: "Extract key findings, entities, and important information from documents", icon: Lightbulb, color: "text-yellow-500", category: "new" },
  { id: "meeting-notes", label: "Meeting Notes Generator", description: "Convert rough notes or transcripts into structured meeting minutes", icon: ClipboardList, color: "text-teal-500", category: "new" },
  { id: "code-assistant", label: "Code Assistant", description: "Paste code and ask AI to explain, optimize, or debug it", icon: Code2, color: "text-cyan-500", category: "new" },
  { id: "knowledge-graph", label: "Knowledge Graph Generator", description: "Create a visual relationship map from document content", icon: Network, color: "text-purple-500", category: "new" },
  { id: "mind-map", label: "Mind Map Generator", description: "Convert document sections into a visual mind map", icon: Brain, color: "text-pink-500", category: "new" },
  { id: "translator", label: "Text Translator", description: "Translate text between multiple languages", icon: Languages, color: "text-indigo-500", category: "new" },
  { id: "citation-gen", label: "Citation Generator", description: "Generate citations in APA, MLA, or IEEE formats", icon: BookOpen, color: "text-rose-500", category: "new" },
];

interface ToolsDashboardProps {
  userId: string;
  onBack: () => void;
}

export default function ToolsDashboard({ userId, onBack }: ToolsDashboardProps) {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);

  useEffect(() => {
    loadFavorites();
  }, [userId]);

  const loadFavorites = async () => {
    const { data } = await supabase.from("favorite_tools" as any).select("tool_id").eq("user_id", userId);
    if (data) setFavorites(new Set((data as any[]).map((d) => d.tool_id)));
  };

  const toggleFavorite = async (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favorites.has(toolId);
    const next = new Set(favorites);
    if (isFav) {
      next.delete(toolId);
      await supabase.from("favorite_tools" as any).delete().eq("user_id", userId).eq("tool_id", toolId);
    } else {
      next.add(toolId);
      await supabase.from("favorite_tools" as any).insert({ user_id: userId, tool_id: toolId } as any);
    }
    setFavorites(next);
    toast.success(isFav ? "Removed from favorites" : "Added to favorites");
  };

  const filtered = ALL_TOOLS.filter(
    (t) =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const favTools = filtered.filter((t) => favorites.has(t.id));
  const otherTools = filtered.filter((t) => !favorites.has(t.id));

  if (activeTool) {
    return <ToolWorkspace tool={activeTool} userId={userId} onBack={() => setActiveTool(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Tools</h1>
            <p className="text-xs text-muted-foreground">{ALL_TOOLS.length} productivity tools</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools..." className="pl-10 h-10 rounded-xl" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 pb-6 space-y-6">
          {/* Favorites */}
          {favTools.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" /> Favorites
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {favTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} isFav onToggleFav={toggleFavorite} onClick={() => setActiveTool(tool)} />
                ))}
              </div>
            </div>
          )}

          {/* All Tools */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {favTools.length > 0 ? "All Tools" : "Tools"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {otherTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} isFav={false} onToggleFav={toggleFavorite} onClick={() => setActiveTool(tool)} />
              ))}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No tools match your search</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ToolCard({ tool, isFav, onToggleFav, onClick }: { tool: ToolDef; isFav: boolean; onToggleFav: (id: string, e: React.MouseEvent) => void; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:shadow-elegant hover:border-primary/20"
    >
      <div className="flex items-center justify-between w-full">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-accent ${tool.color}`}>
          <tool.icon className="h-5 w-5" />
        </div>
        <button
          onClick={(e) => onToggleFav(tool.id, e)}
          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
        >
          {isFav ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{tool.label}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>
      </div>
      {tool.category === "new" && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">New</Badge>
      )}
    </motion.button>
  );
}
