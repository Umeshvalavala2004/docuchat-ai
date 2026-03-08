import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText, X, Maximize2, Minimize2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Search, RotateCw, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentId: string;
  fileName: string;
  onClose?: () => void;
  highlightPage?: number | null;
  highlightText?: string | null;
  inline?: boolean;
}

export default function PdfViewer({
  documentId,
  fileName,
  onClose,
  highlightPage,
  highlightText,
  inline = false,
}: PdfViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [searchText, setSearchText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPdf() {
      setLoading(true);
      const { data: doc } = await supabase
        .from("documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

      if (doc?.file_path) {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        if (data?.signedUrl) setPdfUrl(data.signedUrl);
      }
      setLoading(false);
    }
    loadPdf();
  }, [documentId]);

  // Navigate to highlighted page when citation clicked
  useEffect(() => {
    if (highlightPage && highlightPage > 0) {
      setCurrentPage(highlightPage);
      scrollToPage(highlightPage);
    }
  }, [highlightPage, highlightText]);

  const scrollToPage = useCallback((page: number) => {
    setTimeout(() => {
      const el = pageRefs.current.get(page);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);

  const onDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    let closestPage = 1;
    let closestDist = Infinity;

    pageRefs.current.forEach((el, page) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const dist = Math.abs(rect.top - containerRect.top);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = page;
      }
    });

    setCurrentPage(closestPage);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.4));
  const resetZoom = () => setScale(1.0);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, numPages));
    setCurrentPage(clamped);
    scrollToPage(clamped);
  };

  const containerClass = inline
    ? "flex h-full flex-col bg-card"
    : `flex h-full flex-col border-l border-border bg-card ${expanded ? "w-[60%]" : "w-[50%]"} transition-all duration-300`;

  return (
    <motion.div
      initial={{ opacity: 0, x: inline ? 0 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: inline ? 0 : 30 }}
      transition={{ duration: 0.3 }}
      className={containerClass}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2 bg-card/80 backdrop-blur-sm flex-wrap">
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
          {fileName}
        </span>
        <div className="flex-1" />

        {/* Page nav */}
        {numPages > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums min-w-[60px] text-center">
              {currentPage} / {numPages}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-0.5 border-l border-border pl-1 ml-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button onClick={resetZoom} className="text-[10px] text-muted-foreground hover:text-foreground min-w-[35px] text-center">
            {Math.round(scale * 100)}%
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search toggle */}
        <Button
          variant={showSearch ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>

        {/* Thumbnails toggle */}
        {numPages > 1 && (
          <Button
            variant={showThumbnails ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowThumbnails(!showThumbnails)}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        )}

        {!inline && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in document..."
              className="h-7 pl-7 text-xs bg-accent/50 border-0"
            />
          </div>
        </div>
      )}

      {/* Highlight indicator */}
      {highlightPage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/10">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-primary font-medium">
            Showing source from page {highlightPage}
          </span>
          {highlightText && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              — "{highlightText.slice(0, 50)}..."
            </span>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar */}
        {showThumbnails && pdfUrl && (
          <ScrollArea className="w-[80px] border-r border-border bg-muted/30 p-1">
            <Document file={pdfUrl} loading={null}>
              {Array.from({ length: numPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => goToPage(i + 1)}
                  className={`mb-1 rounded border-2 overflow-hidden transition-all w-full ${
                    currentPage === i + 1 ? "border-primary shadow-sm" : "border-transparent hover:border-primary/30"
                  }`}
                >
                  <Page
                    pageNumber={i + 1}
                    width={68}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  <span className="block text-[8px] text-center text-muted-foreground py-0.5">{i + 1}</span>
                </button>
              ))}
            </Document>
          </ScrollArea>
        )}

        {/* Main PDF */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto bg-muted/20"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex h-full items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              }
              error={
                <div className="flex h-full items-center justify-center p-8">
                  <div className="text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Failed to load PDF</p>
                  </div>
                </div>
              }
            >
              <div className="flex flex-col items-center py-4 gap-3">
                {Array.from({ length: numPages }, (_, i) => (
                  <div
                    key={i + 1}
                    ref={(el) => {
                      if (el) pageRefs.current.set(i + 1, el);
                    }}
                    className={`shadow-sm rounded-sm overflow-hidden transition-all ${
                      highlightPage === i + 1
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                  >
                    <Page
                      pageNumber={i + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="flex items-center justify-center h-[400px] w-[300px] bg-card">
                          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                        </div>
                      }
                    />
                    <div className="text-center py-1 bg-card/80 text-[10px] text-muted-foreground">
                      Page {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            </Document>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center px-6">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Unable to load PDF preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
