import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PdfViewerProps {
  documentId: string;
  fileName: string;
  onClose: () => void;
}

export default function PdfViewer({ documentId, fileName, onClose }: PdfViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPdf() {
      setLoading(true);
      // First get the file_path from the document record
      const { data: doc } = await supabase
        .from("documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

      if (doc?.file_path) {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    }
    loadPdf();
  }, [documentId]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3 }}
      className={`flex h-full flex-col border-l border-border bg-card ${
        expanded ? "w-[55%]" : "w-[45%]"
      } transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileText className="h-4 w-4 text-primary" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {fileName}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden bg-muted/30">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary animate-pulse-soft" />
              </div>
              <p className="text-xs text-muted-foreground">Loading document...</p>
            </div>
          </div>
        ) : signedUrl ? (
          <iframe src={signedUrl} className="h-full w-full border-0" title={fileName} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Unable to load PDF preview.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
