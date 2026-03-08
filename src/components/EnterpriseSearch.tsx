import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, MessageSquare, Highlighter, BookOpen, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  result_type: string;
  result_id: string;
  title: string;
  snippet: string;
  document_id: string | null;
  document_name: string | null;
  page_number: number | null;
  relevance: number;
}

interface EnterpriseSearchProps {
  userId: string;
  onSelectDocument: (docId: string, docName: string) => void;
  onClose: () => void;
}

const resultTypeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: "Document", color: "text-primary" },
  content: { icon: BookOpen, label: "Content", color: "text-success" },
  highlight: { icon: Highlighter, label: "Highlight", color: "text-warning" },
  chat: { icon: MessageSquare, label: "Chat", color: "text-violet-500" },
};

export default function EnterpriseSearch({ userId, onSelectDocument, onClose }: EnterpriseSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.rpc("enterprise_search", {
        _user_id: userId,
        _query: query.trim(),
        _limit: 30,
      });
      if (error) throw error;
      setResults((data as SearchResult[]) || []);
    } catch (e) {
      console.error("Search error:", e);
      setResults([]);
    }
    setLoading(false);
  }, [query, userId]);

  const filteredResults = filter === "all" ? results : results.filter((r) => r.result_type === filter);

  const resultTypes = ["all", ...new Set(results.map((r) => r.result_type))];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
          <Search className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Enterprise Search</h1>
          <p className="text-xs text-muted-foreground">Search across all documents, chats, and highlights</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-4">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search documents, content, chats, highlights..."
              className="pl-10 h-11 rounded-xl bg-card border-border focus-visible:ring-primary/40"
              autoFocus
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} className="h-11 px-6 rounded-xl gradient-primary border-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {results.length > 0 && (
        <div className="flex gap-1 px-6 pb-3">
          {resultTypes.map((type) => {
            const config = type === "all" ? null : resultTypeConfig[type];
            const count = type === "all" ? results.length : results.filter((r) => r.result_type === type).length;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  filter === type ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {config && <config.icon className={`h-3 w-3 ${filter === type ? "" : config.color}`} />}
                {type === "all" ? "All" : config?.label || type}
                <span className={`text-[10px] ${filter === type ? "opacity-80" : "opacity-60"}`}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1 px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : searched && filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try different keywords or broader terms</p>
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {filteredResults.map((result, i) => {
              const config = resultTypeConfig[result.result_type] || resultTypeConfig.document;
              return (
                <motion.button
                  key={`${result.result_id}-${i}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => result.document_id && result.document_name && onSelectDocument(result.document_id, result.document_name)}
                  className="flex items-start gap-3 w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-elegant transition-all"
                >
                  <div className={`mt-0.5 h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0`}>
                    <config.icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground truncate">{result.title}</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-accent ${config.color} capitalize`}>
                        {config.label}
                      </span>
                      {result.page_number && (
                        <span className="text-[10px] text-muted-foreground">p.{result.page_number}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{result.snippet}</p>
                    {result.document_name && result.result_type !== "document" && (
                      <p className="text-[10px] text-primary/60 mt-1 flex items-center gap-1">
                        <FileText className="h-2.5 w-2.5" />{result.document_name}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-muted-foreground">{(result.relevance * 100).toFixed(0)}%</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}
