import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadDocument } from "@/lib/api";
import { toast } from "sonner";

interface DocumentUploadProps {
  userId: string;
  onDocumentUploaded: (doc: any) => void;
}

export default function DocumentUpload({ userId, onDocumentUploaded }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }, [userId]);

  const handleFile = async (file: File) => {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }

    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !["pdf", "txt", "docx"].includes(ext || "")) {
      toast.error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadDocument(file, userId);
      setUploadedFile(file.name);
      onDocumentUploaded(doc);
      toast.success("Document uploaded! Processing will begin shortly.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full"
    >
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">Uploading & processing...</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </motion.div>
          ) : uploadedFile ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm font-medium text-foreground">{uploadedFile}</p>
              <p className="text-xs text-muted-foreground">Drop another file or click to upload</p>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="rounded-xl bg-primary/10 p-3">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drop your document here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, DOCX, or TXT • Max 20MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
