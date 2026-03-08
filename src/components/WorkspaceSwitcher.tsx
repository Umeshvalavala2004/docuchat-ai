import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown, Plus, Pencil, Trash2, Check, X,
  Home, FolderOpen, BookOpen, Briefcase, FlaskConical, FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Workspace } from "@/hooks/useWorkspaces";

const ICONS: Record<string, React.ElementType> = {
  home: Home,
  folder: FolderOpen,
  book: BookOpen,
  briefcase: Briefcase,
  research: FlaskConical,
  file: FileText,
};

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => Promise<Workspace | null>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  collapsed?: boolean;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  collapsed,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const IconComponent = ICONS[activeWorkspace?.icon || "folder"] || FolderOpen;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await onCreate(newName.trim());
    if (ws) {
      onSwitch(ws.id);
      toast.success(`Workspace "${ws.name}" created`);
    }
    setNewName("");
    setCreating(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await onRename(id, editName.trim());
    setEditingId(null);
    toast.success("Workspace renamed");
  };

  if (collapsed) {
    return (
      <div
        className="mx-auto w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ backgroundColor: activeWorkspace?.color || "#6366f1" }}
        title={activeWorkspace?.name || "Workspace"}
      >
        <IconComponent className="h-4 w-4 text-white" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/50 transition-colors text-left group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: activeWorkspace?.color || "#6366f1" }}
          >
            <IconComponent className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {activeWorkspace?.name || "Workspace"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[240px]">
        {workspaces.map((ws) => {
          const WsIcon = ICONS[ws.icon || "folder"] || FolderOpen;

          if (editingId === ws.id) {
            return (
              <div key={ws.id} className="flex items-center gap-1 px-2 py-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleRename(ws.id)}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(ws.id)}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          }

          return (
            <DropdownMenuItem
              key={ws.id}
              className={`gap-2.5 cursor-pointer group/item ${
                ws.id === activeWorkspace?.id ? "bg-accent font-semibold" : ""
              }`}
              onClick={() => onSwitch(ws.id)}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: ws.color || "#6366f1" }}
              >
                <WsIcon className="h-3 w-3 text-white" />
              </div>
              <span className="flex-1 truncate text-sm">{ws.name}</span>
              {!ws.is_default && (
                <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    className="p-1 rounded hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(ws.id);
                      setEditName(ws.name);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-destructive/20 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(ws.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {creating ? (
          <div className="flex items-center gap-1 px-2 py-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Workspace name..."
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreate}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCreating(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <DropdownMenuItem
            className="gap-2 cursor-pointer text-primary"
            onClick={(e) => {
              e.preventDefault();
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">New Workspace</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
