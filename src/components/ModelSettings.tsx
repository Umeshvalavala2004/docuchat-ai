import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Cloud, Monitor, Download, Check, Loader2, Cpu, Zap, AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { ModelConfig } from "@/hooks/useModelPreference";

interface ModelOption {
  id: string;
  name: string;
  type: "cloud" | "local";
  description: string;
  parameterSize?: string;
  available?: boolean;
  pulling?: boolean;
}

const CLOUD_MODELS: ModelOption[] = [
  { id: "gemini-3-flash", name: "Gemini 3 Flash", type: "cloud", description: "Fast & capable. Default model for balanced speed and quality.", available: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", type: "cloud", description: "Good multimodal + reasoning, lower cost than Pro.", available: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", type: "cloud", description: "Top-tier reasoning & large context. Best for complex tasks.", available: true },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", type: "cloud", description: "Fastest & cheapest. Great for simple tasks.", available: true },
  { id: "gpt-5", name: "GPT-5", type: "cloud", description: "Powerful reasoning, multimodal. Best for accuracy & nuance.", available: true },
  { id: "gpt-5-mini", name: "GPT-5 Mini", type: "cloud", description: "Strong performance at lower cost. Good all-rounder.", available: true },
  { id: "gpt-5-nano", name: "GPT-5 Nano", type: "cloud", description: "Speed & cost optimized. Great for high-volume tasks.", available: true },
];

const POPULAR_LOCAL_MODELS: ModelOption[] = [
  { id: "qwen2.5:latest", name: "Qwen 2.5", type: "local", description: "Strong multilingual model by Alibaba.", parameterSize: "7B" },
  { id: "qwen2.5:14b", name: "Qwen 2.5 14B", type: "local", description: "Larger Qwen model for complex tasks.", parameterSize: "14B" },
  { id: "llama3.2:latest", name: "Llama 3.2", type: "local", description: "Meta's latest open model. Great general-purpose.", parameterSize: "3B" },
  { id: "llama3.1:latest", name: "Llama 3.1", type: "local", description: "Powerful open-source LLM by Meta.", parameterSize: "8B" },
  { id: "mistral:latest", name: "Mistral", type: "local", description: "Efficient European model. Fast inference.", parameterSize: "7B" },
  { id: "mixtral:latest", name: "Mixtral", type: "local", description: "Mixture of experts architecture. High quality.", parameterSize: "47B" },
  { id: "phi3:latest", name: "Phi-3", type: "local", description: "Microsoft's compact but capable model.", parameterSize: "3.8B" },
  { id: "gemma2:latest", name: "Gemma 2", type: "local", description: "Google's lightweight open model.", parameterSize: "9B" },
  { id: "deepseek-r1:latest", name: "DeepSeek R1", type: "local", description: "Strong reasoning model. Competitive with larger models.", parameterSize: "7B" },
  { id: "codellama:latest", name: "Code Llama", type: "local", description: "Specialized for code generation and understanding.", parameterSize: "7B" },
];

interface ModelSettingsProps {
  currentModel: ModelConfig;
  onModelChange: (model: ModelConfig) => void;
  isAdmin?: boolean;
}

export default function ModelSettings({ currentModel, onModelChange, isAdmin }: ModelSettingsProps) {
  const [search, setSearch] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(currentModel.ollama_endpoint || "http://localhost:11434");

  // Check Ollama status
  const checkOllama = useCallback(async () => {
    setOllamaStatus("checking");
    try {
      const resp = await fetch(`${ollamaEndpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json();
        setLocalModels((data.models || []).map((m: any) => m.name));
        setOllamaStatus("online");
      } else {
        setOllamaStatus("offline");
      }
    } catch {
      setOllamaStatus("offline");
    }
  }, [ollamaEndpoint]);

  useEffect(() => { checkOllama(); }, [checkOllama]);

  const handlePullModel = async (modelId: string) => {
    setPullingModel(modelId);
    toast.info(`Pulling ${modelId}... This may take a while.`);
    try {
      const resp = await fetch(`${ollamaEndpoint}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId }),
      });
      if (!resp.ok) throw new Error("Pull failed");
      // Read the stream until done
      const reader = resp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          try {
            const lines = text.split("\n").filter(Boolean);
            for (const line of lines) {
              const parsed = JSON.parse(line);
              if (parsed.status === "success") {
                toast.success(`${modelId} downloaded successfully!`);
              }
            }
          } catch { /* partial JSON */ }
        }
      }
      await checkOllama();
    } catch (e) {
      toast.error(`Failed to pull ${modelId}. Make sure Ollama is running.`);
    }
    setPullingModel(null);
  };

  const handleSelectModel = (option: ModelOption) => {
    if (option.type === "local" && ollamaStatus !== "online") {
      toast.error("Ollama is not running. Start Ollama first to use local models.");
      return;
    }
    if (option.type === "local" && !localModels.some((m) => m.startsWith(option.id.split(":")[0]))) {
      handlePullModel(option.id);
      return;
    }

    const gatewayModelMap: Record<string, string> = {
      "gemini-3-flash": "google/gemini-3-flash-preview",
      "gemini-2.5-flash": "google/gemini-2.5-flash",
      "gemini-2.5-pro": "google/gemini-2.5-pro",
      "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
      "gpt-5": "openai/gpt-5",
      "gpt-5-mini": "openai/gpt-5-mini",
      "gpt-5-nano": "openai/gpt-5-nano",
    };

    onModelChange({
      model_id: option.type === "cloud" ? (gatewayModelMap[option.id] || option.id) : option.id,
      model_name: option.name,
      model_type: option.type,
      ollama_endpoint: ollamaEndpoint,
    });
    toast.success(`Switched to ${option.name}`);
  };

  const allModels = [...CLOUD_MODELS, ...POPULAR_LOCAL_MODELS];
  const filtered = search
    ? allModels.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : allModels;

  const cloudFiltered = filtered.filter((m) => m.type === "cloud");
  const localFiltered = filtered.filter((m) => m.type === "local");

  const isSelected = (option: ModelOption) => {
    if (option.type === "cloud") {
      const gatewayModelMap: Record<string, string> = {
        "gemini-3-flash": "google/gemini-3-flash-preview",
        "gemini-2.5-flash": "google/gemini-2.5-flash",
        "gemini-2.5-pro": "google/gemini-2.5-pro",
        "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
        "gpt-5": "openai/gpt-5",
        "gpt-5-mini": "openai/gpt-5-mini",
        "gpt-5-nano": "openai/gpt-5-nano",
      };
      return currentModel.model_id === (gatewayModelMap[option.id] || option.id);
    }
    return currentModel.model_id === option.id;
  };

  const isLocalInstalled = (modelId: string) => localModels.some((m) => m.startsWith(modelId.split(":")[0]));

  return (
    <div className="space-y-6">
      {/* Current model */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
            {currentModel.model_type === "cloud" ? <Cloud className="h-5 w-5 text-primary-foreground" /> : <Monitor className="h-5 w-5 text-primary-foreground" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{currentModel.model_name}</p>
            <p className="text-[11px] text-muted-foreground">Currently active model</p>
          </div>
          <Badge variant="outline" className={currentModel.model_type === "cloud" ? "border-primary/30 text-primary" : "border-success/30 text-success"}>
            {currentModel.model_type === "cloud" ? <Cloud className="h-3 w-3 mr-1" /> : <Monitor className="h-3 w-3 mr-1" />}
            {currentModel.model_type === "cloud" ? "Cloud" : "Local"}
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models (e.g. qwen, llama, mistral...)"
          className="pl-10 rounded-xl h-10"
        />
      </div>

      {/* Ollama status */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Ollama Server</span>
          <div className={`h-2 w-2 rounded-full ${ollamaStatus === "online" ? "bg-success" : ollamaStatus === "offline" ? "bg-destructive" : "bg-warning animate-pulse"}`} />
          <span className="text-[11px] text-muted-foreground">
            {ollamaStatus === "online" ? `Online (${localModels.length} models)` : ollamaStatus === "offline" ? "Offline" : "Checking..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={ollamaEndpoint}
            onChange={(e) => setOllamaEndpoint(e.target.value)}
            className="h-7 text-[11px] w-48 rounded-lg"
            placeholder="http://localhost:11434"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={checkOllama}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {/* Cloud models */}
          {cloudFiltered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Cloud Models</span>
              </div>
              <div className="space-y-1.5">
                {cloudFiltered.map((m) => (
                  <ModelCard key={m.id} model={m} selected={isSelected(m)} onSelect={() => handleSelectModel(m)} />
                ))}
              </div>
            </div>
          )}

          {/* Local models */}
          {localFiltered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Local Models (Ollama)</span>
              </div>
              {ollamaStatus === "offline" && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 mb-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Ollama is not running</p>
                    <p className="text-[11px] text-muted-foreground">Start Ollama on your machine to use local models. Install from <a href="https://ollama.ai" target="_blank" rel="noopener" className="text-primary hover:underline">ollama.ai</a></p>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                {localFiltered.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    selected={isSelected(m)}
                    installed={isLocalInstalled(m.id)}
                    pulling={pullingModel === m.id}
                    ollamaOnline={ollamaStatus === "online"}
                    onSelect={() => handleSelectModel(m)}
                    onPull={() => handlePullModel(m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No models found matching "{search}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ModelCard({
  model, selected, installed, pulling, ollamaOnline, onSelect, onPull,
}: {
  model: ModelOption;
  selected: boolean;
  installed?: boolean;
  pulling?: boolean;
  ollamaOnline?: boolean;
  onSelect: () => void;
  onPull?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => {
        if (model.type === "local" && !installed && ollamaOnline) {
          onPull?.();
        } else {
          onSelect();
        }
      }}
      className={`flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:bg-accent/30"
      }`}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
        selected ? "gradient-primary" : "bg-accent"
      }`}>
        {model.type === "cloud" ? (
          <Cloud className={`h-4 w-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />
        ) : (
          <Monitor className={`h-4 w-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{model.name}</span>
          {model.parameterSize && (
            <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">{model.parameterSize}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{model.description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {model.type === "local" && pulling && (
          <Badge variant="outline" className="border-warning/30 text-warning text-[10px] gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />Pulling
          </Badge>
        )}
        {model.type === "local" && !pulling && installed && (
          <Badge variant="outline" className="border-success/30 text-success text-[10px] gap-1">
            <Check className="h-3 w-3" />Installed
          </Badge>
        )}
        {model.type === "local" && !pulling && !installed && ollamaOnline && (
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] gap-1">
            <Download className="h-3 w-3" />Pull
          </Badge>
        )}
        {selected && (
          <div className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
    </motion.button>
  );
}
