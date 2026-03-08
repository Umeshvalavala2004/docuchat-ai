import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Hash, Star, Pin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface MentionableDocument {
  id: string;
  name: string;
  reference_tag: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  file_type: string;
}

interface DocumentMentionDropdownProps {
  userId: string;
  query: string; // text after the #
  visible: boolean;
  onSelect: (doc: MentionableDocument) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

function getDocIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-3.5 w-3.5 text-red-500" />;
  if (ext === "docx" || ext === "doc") return <FileText className="h-3.5 w-3.5 text-blue-500" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function DocumentMentionDropdown({
  userId, query, visible, onSelect, onClose,
}: DocumentMentionDropdownProps) {
  const [documents, setDocuments] = useState<MentionableDocument[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, reference_tag, is_favorite, is_pinned, file_type")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("is_pinned", { ascending: false })
        .order("is_favorite", { ascending: false })
        .order("name", { ascending: true });
      if (data) setDocuments(data as MentionableDocument[]);
    };
    load();
  }, [userId, visible]);

  const filtered = useMemo(() => {
    if (!query) return documents;
    const q = query.toLowerCase();
    return documents.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.reference_tag && d.reference_tag.toLowerCase().includes(q))
    );
  }, [documents, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation is handled by parent via onKeyDown
  // We expose selectedIndex and filtered for that

  if (!visible || filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        ref={listRef}
        className="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-float z-50"
      >
        <div className="p-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium px-2 py-1">
            <Hash className="h-3 w-3" />
            Quick Docs — type to filter
          </div>
        </div>
        <div className="p-1">
          {filtered.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {getDocIcon(doc.name)}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-xs">{doc.name}</div>
                {doc.reference_tag && (
                  <span className="text-[10px] text-primary font-mono">#{doc.reference_tag}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                {doc.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Export a hook for parsing mentions from input text
export function parseMentions(
  input: string,
  documents: MentionableDocument[]
): { cleanedInput: string; mentionedDocIds: string[]; mentionedTags: string[] } {
  const mentionRegex = /#(\S+)/g;
  const mentionedTags: string[] = [];
  const mentionedDocIds: string[] = [];

  let match;
  while ((match = mentionRegex.exec(input)) !== null) {
    const tag = match[1].toLowerCase();
    mentionedTags.push(tag);
    
    // Find document by reference_tag or by name match
    const doc = documents.find(
      (d) =>
        d.reference_tag?.toLowerCase() === tag ||
        d.name.toLowerCase().replace(/[^a-z0-9]/g, "_").includes(tag)
    );
    if (doc && !mentionedDocIds.includes(doc.id)) {
      mentionedDocIds.push(doc.id);
    }
  }

  const cleanedInput = input.replace(/#\S+\s*/g, "").trim();

  return { cleanedInput, mentionedDocIds, mentionedTags };
}
