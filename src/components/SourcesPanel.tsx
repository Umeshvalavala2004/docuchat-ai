import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import type { Source } from "@/lib/api";

interface SourcesPanelProps {
  sources: Source[];
}

export default function SourcesPanel({ sources }: SourcesPanelProps) {
  if (sources.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full w-[320px] border-l border-border bg-card overflow-y-auto"
    >
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Sources</h3>
        <p className="text-[11px] text-muted-foreground">Referenced document sections</p>
      </div>
      <div className="p-3 space-y-2">
        {sources.map((source, i) => (
          <div
            key={source.id || i}
            className="rounded-xl border border-border bg-background p-3 text-xs"
          >
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-3 w-3 text-primary" />
              <span className="font-medium text-foreground">
                Chunk {source.chunk_index + 1}
              </span>
              {source.page_number && (
                <span className="text-muted-foreground">
                  • Page {source.page_number}
                </span>
              )}
              <span className="ml-auto text-muted-foreground">
                {(source.score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">{source.content}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
