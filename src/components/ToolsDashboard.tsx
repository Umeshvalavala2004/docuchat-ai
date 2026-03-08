import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCompare, FileText, Code2, Braces, PenLine, Sparkles,
  Regex, Search, Star, StarOff, ArrowLeft, Plus, ExternalLink,
  Clock, X, Check, Wrench, BookOpen, FlaskConical, Cpu, Settings2,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tool definition ──────────────────────────────────────────────

export interface ExternalTool {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: React.ComponentType<any>;
  color: string;
  category: string;
  isCustom?: boolean;
}

const CATEGORIES = ["All", "Document Tools", "Developer Tools", "AI Tools", "Utilities"];

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  "Document Tools": FileText,
  "Developer Tools": Code2,
  "Research Tools": FlaskConical,
  "AI Tools": Sparkles,
  "Utilities": Settings2,
};

export const DEFAULT_TOOLS: ExternalTool[] = [
  {
    id: "diffchecker-pdf",
    label: "Document Compare",
    description: "Compare Word & PDF documents side by side",
    url: "https://www.diffchecker.com/word-pdf-compare/",
    icon: GitCompare,
    color: "text-orange-500",
    category: "Document Tools",
  },
  {
    id: "diffchecker-text",
    label: "Text Difference Checker",
    description: "Find and highlight differences between two texts",
    url: "https://www.diffchecker.com/",
    icon: FileText,
    color: "text-blue-500",
    category: "Document Tools",
  },
  {
    id: "json-formatter",
    label: "JSON Formatter",
    description: "Format, validate, and beautify JSON data",
    url: "https://jsonformatter.org/",
    icon: Braces,
    color: "text-emerald-500",
    category: "Developer Tools",
  },
  {
    id: "stackedit",
    label: "Markdown Editor",
    description: "Write and preview Markdown documents in real-time",
    url: "https://stackedit.io/",
    icon: PenLine,
    color: "text-violet-500",
    category: "Document Tools",
  },
  {
    id: "beautifier",
    label: "Code Beautifier",
    description: "Beautify and format HTML, CSS, and JavaScript code",
    url: "https://beautifier.io/",
    icon: Code2,
    color: "text-cyan-500",
    category: "Developer Tools",
  },
  {
    id: "flowgpt",
    label: "AI Prompt Generator",
    description: "Discover and create powerful AI prompts",
    url: "https://flowgpt.com/",
    icon: Sparkles,
    color: "text-amber-500",
    category: "AI Tools",
  },
  {
    id: "regex101",
    label: "Regex Tester",
    description: "Build, test, and debug regular expressions",
    url: "https://regex101.com/",
    icon: Regex,
    color: "text-pink-500",
    category: "Developer Tools",
  },
];

// ── Main Dashboard ───────────────────────────────────────────────

interface ToolsDashboardProps {
  userId: string;
  onBack: () => void;
}

export default function ToolsDashboard({ userId, onBack }: ToolsDashboardProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [customTools, setCustomTools] = useState<ExternalTool[]>([]);
  const [activeTool, setActiveTool] = useState<ExternalTool | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customCategory, setCustomCategory] = useState("Utilities");

  useEffect(() => {
    loadFavorites();
    loadRecent();
    loadCustomTools();
  }, [userId]);

  const loadFavorites = async () => {
    const { data } = await supabase.from("favorite_tools" as any).select("tool_id").eq("user_id", userId);
    if (data) setFavorites(new Set((data as any[]).map((d: any) => d.tool_id)));
  };

  const loadRecent = async () => {
    const { data } = await supabase
      .from("recent_tools" as any)
      .select("tool_id")
      .eq("user_id", userId)
      .order("used_at", { ascending: false })
      .limit(6);
    if (data) setRecentIds((data as any[]).map((d: any) => d.tool_id));
  };

  const loadCustomTools = async () => {
    const { data } = await supabase.from("custom_tools" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) {
      setCustomTools(
        (data as any[]).map((d: any) => ({
          id: `custom-${d.id}`,
          label: d.name,
          description: d.url,
          url: d.url,
          icon: Globe,
          color: "text-primary",
          category: d.category,
          isCustom: true,
        }))
      );
    }
  };

  const allTools = [...DEFAULT_TOOLS, ...customTools];

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

  const trackRecent = async (toolId: string) => {
    await supabase.from("recent_tools" as any).upsert(
      { user_id: userId, tool_id: toolId, used_at: new Date().toISOString() } as any,
      { onConflict: "user_id,tool_id" }
    );
    setRecentIds((prev) => [toolId, ...prev.filter((id) => id !== toolId)].slice(0, 6));
  };

  const openTool = (tool: ExternalTool) => {
    trackRecent(tool.id);
    setActiveTool(tool);
  };

  const handleAddCustom = async () => {
    if (!customName.trim() || !customUrl.trim()) { toast.error("Name and URL are required"); return; }
    let url = customUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { toast.error("Invalid URL"); return; }

    await supabase.from("custom_tools" as any).insert({
      user_id: userId,
      name: customName.trim(),
      url,
      category: customCategory,
    } as any);
    setCustomName("");
    setCustomUrl("");
    setAddingCustom(false);
    loadCustomTools();
    toast.success("Custom tool added!");
  };

  const handleDeleteCustom = async (tool: ExternalTool, e: React.MouseEvent) => {
    e.stopPropagation();
    const dbId = tool.id.replace("custom-", "");
    await supabase.from("custom_tools" as any).delete().eq("id", dbId);
    setCustomTools((prev) => prev.filter((t) => t.id !== tool.id));
    toast.success("Custom tool deleted");
  };

  const filtered = allTools.filter((t) => {
    const matchesSearch =
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const favTools = filtered.filter((t) => favorites.has(t.id));
  const recentTools = recentIds.map((id) => allTools.find((t) => t.id === id)).filter(Boolean) as ExternalTool[];
  const otherTools = filtered.filter((t) => !favorites.has(t.id));

  // ── Active tool view (iframe workspace) ────────────────────────
  if (activeTool) {
    return <IframeWorkspace tool={activeTool} onBack={() => setActiveTool(null)} />;
  }

  // ── Dashboard view ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Tools Hub</h1>
            <p className="text-xs text-muted-foreground">{allTools.length} productivity tools</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={() => setAddingCustom(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Tool
        </Button>
      </div>

      {/* Search + filter */}
      <div className="px-6 py-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools..." className="pl-10 h-10 rounded-xl" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add custom tool form */}
      <AnimatePresence>
        {addingCustom && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-6">
            <div className="rounded-2xl border border-border bg-card p-4 mb-3 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Add Custom Tool</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Tool name" className="h-9 rounded-xl text-sm" maxLength={100} />
                <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://example.com" className="h-9 rounded-xl text-sm" maxLength={500} />
                <Select value={customCategory} onValueChange={setCustomCategory}>
                  <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCustom} className="h-8 rounded-xl gradient-primary border-0 text-xs">Add Tool</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingCustom(false)} className="h-8 rounded-xl text-xs">Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="flex-1">
        <div className="px-6 pb-6 space-y-6">
          {/* Recently Used */}
          {recentTools.length > 0 && categoryFilter === "All" && !search && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Recently Used
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {recentTools.slice(0, 4).map((tool) => (
                  <ToolCard key={`recent-${tool.id}`} tool={tool} isFav={favorites.has(tool.id)} onToggleFav={toggleFavorite} onClick={() => openTool(tool)} onDelete={tool.isCustom ? handleDeleteCustom : undefined} />
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          {favTools.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" /> Favorites
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {favTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} isFav onToggleFav={toggleFavorite} onClick={() => openTool(tool)} onDelete={tool.isCustom ? handleDeleteCustom : undefined} />
                ))}
              </div>
            </div>
          )}

          {/* All Tools */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {favTools.length > 0 || recentTools.length > 0 ? "All Tools" : "Tools"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {otherTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} isFav={false} onToggleFav={toggleFavorite} onClick={() => openTool(tool)} onDelete={tool.isCustom ? handleDeleteCustom : undefined} />
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

// ── Tool Card ────────────────────────────────────────────────────

function ToolCard({
  tool,
  isFav,
  onToggleFav,
  onClick,
  onDelete,
}: {
  tool: ExternalTool;
  isFav: boolean;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
  onDelete?: (tool: ExternalTool, e: React.MouseEvent) => void;
}) {
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
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={(e) => onToggleFav(tool.id, e)} className="p-1 rounded-lg hover:bg-accent">
            {isFav ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
          </button>
          {onDelete && (
            <button onClick={(e) => onDelete(tool, e)} className="p-1 rounded-lg hover:bg-destructive/10">
              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{tool.label}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>
      </div>
      <div className="flex items-center justify-between w-full mt-auto">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 border-0">{tool.category}</Badge>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.button>
  );
}

// ── Iframe Workspace ─────────────────────────────────────────────

function IframeWorkspace({ tool, onBack }: { tool: ExternalTool; onBack: () => void }) {
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleIframeError = useCallback(() => {
    setIframeBlocked(true);
    setLoading(false);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Some sites block iframes — if we can't detect via onError,
  // we set a timeout fallback
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  const openExternal = () => {
    window.open(tool.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center bg-accent ${tool.color}`}>
          <tool.icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">{tool.label}</h2>
          <p className="text-[10px] text-muted-foreground truncate">{tool.url}</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 h-8" onClick={openExternal}>
          <ExternalLink className="h-3 w-3" /> Open in Tab
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-background">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center bg-accent ${tool.color}`}>
                <tool.icon className="h-6 w-6 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Loading {tool.label}...</p>
            </div>
          </div>
        )}

        {iframeBlocked ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center bg-accent ${tool.color}`}>
              <tool.icon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{tool.label}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              This tool doesn't allow embedding. It has been opened in a new browser tab for you.
            </p>
            <Button onClick={openExternal} className="rounded-xl gradient-primary border-0 gap-2">
              <ExternalLink className="h-4 w-4" /> Open {tool.label}
            </Button>
          </div>
        ) : (
          <iframe
            src={tool.url}
            className="w-full h-full border-0"
            title={tool.label}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}
