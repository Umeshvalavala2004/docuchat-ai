import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, ChevronDown, ChevronUp, FileText, Search, Zap, Brain, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Source } from "@/lib/api";

interface RagDebugInfo {
  sources: Source[];
  searchMethods?: Record<string, number>;
  totalChunksSearched?: number;
  processingTimeMs?: number;
  modelUsed?: string;
  contextTokens?: number;
}

interface RagDebugPanelProps {
  debugInfo: RagDebugInfo | null;
  onCitationClick?: (pageNumber: number | null, text?: string) => void;
  documentName?: string;
}

export default function RagDebugPanel({ debugInfo, onCitationClick, documentName }: RagDebugPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  if (!debugInfo || debugInfo.sources.length === 0) return null;

  const sortedSources = [...debugInfo.sources].sort((a, b) => b.score - a.score);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Bug className="h-3.5 w-3.5 text-primary" />
        <span>RAG Debug Panel</span>
        <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {debugInfo.sources.length} chunks
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg bg-accent/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Search className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-muted-foreground">Chunks Retrieved</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{debugInfo.sources.length}</p>
                </div>
                <div className="rounded-lg bg-accent/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="h-3 w-3 text-warning" />
                    <span className="text-[10px] font-medium text-muted-foreground">Top Score</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{(sortedSources[0]?.score * 100).toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-accent/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="h-3 w-3 text-success" />
                    <span className="text-[10px] font-medium text-muted-foreground">Model</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{debugInfo.modelUsed || "Gemini Flash"}</p>
                </div>
                <div className="rounded-lg bg-accent/50 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-muted-foreground">Avg Score</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {(sortedSources.reduce((sum, s) => sum + s.score, 0) / sortedSources.length * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Relevance bar chart */}
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chunk Relevance Scores</p>
                <div className="space-y-1.5">
                  {sortedSources.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedChunk(selectedChunk === i ? null : i)}
                      className="flex items-center gap-2 w-full text-left group hover:bg-accent/30 rounded-lg px-1.5 py-1 transition-colors"
                    >
                      <span className="text-[10px] text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                      <div className="flex-1 h-4 bg-accent/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${src.score * 100}%` }}
                          transition={{ delay: i * 0.05, duration: 0.4 }}
                          className={`h-full rounded-full ${
                            src.score >= 0.8 ? "bg-success" : src.score >= 0.6 ? "bg-primary" : "bg-warning"
                          }`}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-foreground w-10 text-right">{(src.score * 100).toFixed(0)}%</span>
                      {src.page_number && (
                        <span className="text-[10px] text-muted-foreground">p.{src.page_number}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expanded chunk detail */}
              <AnimatePresence>
                {selectedChunk !== null && sortedSources[selectedChunk] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-foreground">
                            {documentName || "Document"} — Chunk {sortedSources[selectedChunk].chunk_index + 1}
                          </span>
                        </div>
                        {sortedSources[selectedChunk].page_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-primary hover:text-primary/80"
                            onClick={() => onCitationClick?.(sortedSources[selectedChunk!].page_number, sortedSources[selectedChunk!].content?.slice(0, 80))}
                          >
                            📄 Jump to Page {sortedSources[selectedChunk].page_number}
                          </Button>
                        )}
                      </div>
                      <ScrollArea className="max-h-32">
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {sortedSources[selectedChunk].content}
                        </p>
                      </ScrollArea>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">
                          Score: <span className="text-foreground font-mono">{(sortedSources[selectedChunk].score * 100).toFixed(1)}%</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Chunk Index: <span className="text-foreground font-mono">{sortedSources[selectedChunk].chunk_index}</span>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
