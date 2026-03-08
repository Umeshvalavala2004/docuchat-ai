import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, Plus, Pencil, Trash2, Copy, Check, X, ExternalLink,
  BookOpen, FileText, Wrench, GraduationCap, ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
}

const CATEGORIES = ["Research", "Documentation", "Tools", "Learning Resources"];
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  Research: BookOpen,
  Documentation: FileText,
  Tools: Wrench,
  "Learning Resources": GraduationCap,
};

interface ImportantLinksProps {
  userId: string;
}

export default function ImportantLinks({ userId }: ImportantLinksProps) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Research");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIES));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { loadLinks(); }, [userId]);

  const loadLinks = async () => {
    const { data } = await supabase.from("important_links" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setLinks(data as any);
  };

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) return;
    if (editingId) {
      await supabase.from("important_links" as any).update({ title: title.trim(), url: url.trim(), category } as any).eq("id", editingId);
      toast.success("Link updated");
    } else {
      await supabase.from("important_links" as any).insert({ user_id: userId, title: title.trim(), url: url.trim(), category } as any);
      toast.success("Link added");
    }
    resetForm();
    loadLinks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("important_links" as any).delete().eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast.success("Link deleted");
  };

  const handleCopy = (id: string, linkUrl: string) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link copied!");
  };

  const startEdit = (link: LinkItem) => {
    setEditingId(link.id);
    setTitle(link.title);
    setUrl(link.url);
    setCategory(link.category);
    setAdding(true);
  };

  const resetForm = () => {
    setAdding(false);
    setEditingId(null);
    setTitle("");
    setUrl("");
    setCategory("Research");
  };

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  };

  const groupedLinks = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = links.filter((l) => l.category === cat);
    return acc;
  }, {} as Record<string, LinkItem[]>);

  return (
    <div className="space-y-1">
      {/* Add link form */}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-1">
            <div className="rounded-xl bg-accent/50 p-2.5 space-y-1.5">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Link title" className="h-7 text-xs" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="h-7 text-xs" />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSave} className="h-7 text-xs flex-1 gradient-primary border-0">{editingId ? "Update" : "Add"}</Button>
                <Button size="sm" variant="ghost" onClick={resetForm} className="h-7 text-xs"><X className="h-3 w-3" /></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-primary hover:bg-primary/5 rounded-lg transition-colors">
          <Plus className="h-3 w-3" /> Add Link
        </button>
      )}

      {/* Grouped links */}
      {CATEGORIES.map((cat) => {
        const catLinks = groupedLinks[cat];
        if (catLinks.length === 0) return null;
        const CatIcon = CATEGORY_ICONS[cat] || Link2;
        const isOpen = expandedCats.has(cat);

        return (
          <div key={cat}>
            <button onClick={() => toggleCat(cat)} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              <CatIcon className="h-3 w-3" />
              <span className="flex-1 text-left">{cat}</span>
              <span className="text-[10px] bg-primary/10 text-primary px-1 py-0 rounded-full">{catLinks.length}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  {catLinks.map((link) => (
                    <div key={link.id} className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent/70 transition-all">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs text-foreground truncate hover:text-primary transition-colors" title={link.url}>
                        {link.title}
                      </a>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleCopy(link.id, link.url)} className="p-0.5 rounded hover:bg-accent">
                          {copiedId === link.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                        <button onClick={() => startEdit(link)} className="p-0.5 rounded hover:bg-accent"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                        <button onClick={() => handleDelete(link.id)} className="p-0.5 rounded hover:bg-destructive/10"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {links.length === 0 && !adding && (
        <p className="text-[11px] text-muted-foreground text-center py-3">No saved links yet</p>
      )}
    </div>
  );
}
