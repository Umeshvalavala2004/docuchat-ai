import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Cloud, Monitor, Download, Check, Loader2, Cpu, AlertCircle, RefreshCw, Copy, Key, Eye, EyeOff, Trash2, ShieldCheck, ShieldX, Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { ModelConfig } from "@/hooks/useModelPreference";
import { useApiKeys, type ApiKeyStatus } from "@/hooks/useApiKeys";

interface ModelOption {
  id: string;
  name: string;
  type: "cloud" | "local";
  description: string;
  parameterSize?: string;
  available?: boolean;
  pulling?: boolean;
  provider?: "gemini" | "openai" | "platform";
}

const CLOUD_MODELS: ModelOption[] = [
  { id: "gemini-3-flash", name: "Gemini 3 Flash", type: "cloud", description: "Fast & capable. Default model for balanced speed and quality.", available: true, provider: "platform" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", type: "cloud", description: "Good multimodal + reasoning, lower cost than Pro.", available: true, provider: "platform" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", type: "cloud", description: "Top-tier reasoning & large context. Best for complex tasks.", available: true, provider: "platform" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", type: "cloud", description: "Fastest & cheapest. Great for simple tasks.", available: true, provider: "platform" },
  { id: "gpt-5", name: "GPT-5", type: "cloud", description: "Powerful reasoning, multimodal. Best for accuracy & nuance.", available: true, provider: "platform" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", type: "cloud", description: "Strong performance at lower cost. Good all-rounder.", available: true, provider: "platform" },
  { id: "gpt-5-nano", name: "GPT-5 Nano", type: "cloud", description: "Speed & cost optimized. Great for high-volume tasks.", available: true, provider: "platform" },
  { id: "byok-gemini-pro", name: "Gemini Pro (Your Key)", type: "cloud", description: "Use your own Gemini API key. No platform limits.", provider: "gemini" },
  { id: "byok-gemini-flash", name: "Gemini Flash (Your Key)", type: "cloud", description: "Fast Gemini model with your own API key.", provider: "gemini" },
  { id: "byok-gpt-4o", name: "GPT-4o (Your Key)", type: "cloud", description: "Use your own OpenAI API key. Full GPT-4o access.", provider: "openai" },
  { id: "byok-gpt-4o-mini", name: "GPT-4o Mini (Your Key)", type: "cloud", description: "Cost-effective OpenAI model with your key.", provider: "openai" },
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
  userId?: string;
}

export default function ModelSettings({ currentModel, onModelChange, isAdmin, userId }: ModelSettingsProps) {
  const [search, setSearch] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline" | "cors_error">("checking");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(currentModel.ollama_endpoint || "http://localhost:11434");
  const [activeTab, setActiveTab] = useState<"models" | "api-keys">("models");
  const [lastError, setLastError] = useState<string | null>(null);

  const { keys, loading: keysLoading, saveKey, validateKey, deleteKey, hasValidKey } = useApiKeys(userId || null);

  const checkOllama = useCallback(async () => {
    setOllamaStatus("checking");
    setLastError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${ollamaEndpoint}/api/tags`, {
        signal: controller.signal,
        mode: "cors",
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const modelNames = (data.models || []).map((m: any) => m.name);
        setLocalModels(modelNames);
        setOllamaStatus("online");
        if (modelNames.length > 0) {
          toast.success(`Ollama connected! Found ${modelNames.length} model(s).`);
        }
      } else {
        setOllamaStatus("offline");
        setLastError(`Server returned status ${resp.status}`);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setOllamaStatus("offline");
        setLastError("Connection timed out");
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError") || err.name === "TypeError") {
        // This typically means CORS block or server not running
        setOllamaStatus("cors_error");
        setLastError("Cannot reach Ollama — either not running or CORS is blocking the request.");
      } else {
        setOllamaStatus("offline");
        setLastError(err.message || "Unknown error");
      }
    }
  }, [ollamaEndpoint]);

  useEffect(() => { checkOllama(); }, [checkOllama]);

  const handlePullModel = async (modelId: string) => {
    if (ollamaStatus !== "online") {
      toast.error("Ollama must be connected first.");
      return;
    }
    setPullingModel(modelId);
    toast.info(`Pulling ${modelId}... This may take a while.`);
    try {
      const resp = await fetch(`${ollamaEndpoint}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId }),
      });
      if (!resp.ok) throw new Error("Pull failed");
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
              if (parsed.status === "success") toast.success(`${modelId} downloaded successfully!`);
            }
          } catch { /* partial */ }
        }
      }
      await checkOllama();
    } catch {
      toast.error(`Failed to pull ${modelId}. Make sure Ollama is running.`);
    }
    setPullingModel(null);
  };

  const handleSelectModel = (option: ModelOption) => {
    if (option.type === "local" && ollamaStatus !== "online") {
      toast.error("Ollama is not connected. Fix the connection first to use local models.");
      return;
    }
    if (option.type === "local" && !localModels.some((m) => m.startsWith(option.id.split(":")[0]))) {
      handlePullModel(option.id);
      return;
    }
    if (option.provider === "gemini" && !hasValidKey("gemini")) {
      toast.error("Please add a valid Gemini API key first.");
      setActiveTab("api-keys");
      return;
    }
    if (option.provider === "openai" && !hasValidKey("openai")) {
      toast.error("Please add a valid OpenAI API key first.");
      setActiveTab("api-keys");
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
      model_id: option.provider === "platform" ? (gatewayModelMap[option.id] || option.id) : option.id,
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

  const platformModels = filtered.filter((m) => m.type === "cloud" && m.provider === "platform");
  const byokModels = filtered.filter((m) => m.type === "cloud" && (m.provider === "gemini" || m.provider === "openai"));
  const localFiltered = filtered.filter((m) => m.type === "local");

  const isSelected = (option: ModelOption) => {
    if (option.provider === "platform") {
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
    <div className="space-y-4">
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

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-accent/50 border border-border">
        <button
          onClick={() => setActiveTab("models")}
          className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === "models" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Cpu className="h-3.5 w-3.5 inline mr-1.5" />Models
        </button>
        <button
          onClick={() => setActiveTab("api-keys")}
          className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${activeTab === "api-keys" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Key className="h-3.5 w-3.5 inline mr-1.5" />API Keys
          {keys.length > 0 && (
            <Badge variant="outline" className="ml-1.5 text-[10px] h-4 px-1">{keys.length}</Badge>
          )}
        </button>
      </div>

      {activeTab === "api-keys" ? (
        <ApiKeysPanel keys={keys} loading={keysLoading} onSave={saveKey} onValidate={validateKey} onDelete={deleteKey} />
      ) : (
        <>
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

          {/* Ollama connection status */}
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Ollama Server</span>
              <div className={`h-2 w-2 rounded-full ${
                ollamaStatus === "online" ? "bg-success" :
                ollamaStatus === "checking" ? "bg-warning animate-pulse" :
                "bg-destructive"
              }`} />
              <span className="text-[11px] text-muted-foreground">
                {ollamaStatus === "online" ? `Online (${localModels.length} models)` :
                 ollamaStatus === "checking" ? "Checking..." :
                 ollamaStatus === "cors_error" ? "Connection blocked" :
                 "Offline"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                className="h-7 text-[11px] w-48 rounded-lg"
                placeholder="http://localhost:11434"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={checkOllama} disabled={ollamaStatus === "checking"}>
                <RefreshCw className={`h-3 w-3 ${ollamaStatus === "checking" ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {/* Platform cloud models */}
              {platformModels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Platform Models</span>
                    <Badge variant="outline" className="text-[10px] h-4 border-primary/20 text-primary">Included</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {platformModels.map((m) => (
                      <ModelCard key={m.id} model={m} selected={isSelected(m)} onSelect={() => handleSelectModel(m)} />
                    ))}
                  </div>
                </div>
              )}

              {/* BYOK models */}
              {byokModels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Bring Your Own Key</span>
                    <Badge variant="outline" className="text-[10px] h-4 border-warning/20 text-warning">BYOK</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {byokModels.map((m) => (
                      <ModelCard
                        key={m.id}
                        model={m}
                        selected={isSelected(m)}
                        hasKey={m.provider ? hasValidKey(m.provider) : false}
                        onSelect={() => handleSelectModel(m)}
                      />
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

                  {/* Ollama troubleshooting panel */}
                  {(ollamaStatus === "offline" || ollamaStatus === "cors_error") && (
                    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {ollamaStatus === "cors_error" ? "Cannot connect to Ollama" : "Ollama is not running"}
                          </p>
                          {lastError && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{lastError}</p>
                          )}
                        </div>
                      </div>

                      {/* Step 1: Start Ollama */}
                      <div className="rounded-lg bg-background border border-border p-3 space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Terminal className="h-3 w-3" /> Step 1: Start Ollama
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-accent/50 px-3 py-2 rounded-lg text-foreground select-all">ollama serve</code>
                          <Button variant="outline" size="sm" className="h-8 text-[11px] rounded-lg shrink-0 gap-1" onClick={() => { navigator.clipboard.writeText("ollama serve"); toast.success("Command copied!"); }}>
                            <Copy className="h-3 w-3" />Copy
                          </Button>
                        </div>
                      </div>

                      {/* Step 2: Enable CORS (if cors_error) */}
                      {ollamaStatus === "cors_error" && (
                        <div className="rounded-lg bg-background border border-border p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Terminal className="h-3 w-3" /> Step 2: Enable browser access (CORS)
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Set this environment variable before starting Ollama to allow browser connections:
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs font-mono bg-accent/50 px-3 py-2 rounded-lg text-foreground select-all">OLLAMA_ORIGINS=* ollama serve</code>
                              <Button variant="outline" size="sm" className="h-8 text-[11px] rounded-lg shrink-0 gap-1" onClick={() => { navigator.clipboard.writeText("OLLAMA_ORIGINS=* ollama serve"); toast.success("Command copied!"); }}>
                                <Copy className="h-3 w-3" />Copy
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">
                              On Windows: <code className="bg-accent/50 px-1 rounded text-foreground">set OLLAMA_ORIGINS=*</code> then <code className="bg-accent/50 px-1 rounded text-foreground">ollama serve</code>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-[11px] rounded-lg gap-1.5" onClick={checkOllama}>
                          <RefreshCw className="h-3 w-3" />Retry Connection
                        </Button>
                        <a href="https://ollama.ai" target="_blank" rel="noopener">
                          <Button variant="ghost" size="sm" className="h-8 text-[11px] rounded-lg gap-1.5 text-primary">
                            <Download className="h-3 w-3" />Install Ollama
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Online: show detected models */}
                  {ollamaStatus === "online" && localModels.length > 0 && (
                    <div className="rounded-xl border border-success/20 bg-success/5 p-3 mb-3">
                      <p className="text-[11px] font-semibold text-foreground mb-1.5">
                        <Check className="h-3 w-3 inline mr-1 text-success" />
                        Detected {localModels.length} installed model(s):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {localModels.map((m) => (
                          <Badge key={m} variant="outline" className="text-[10px] border-success/30 text-success bg-success/5">
                            {m}
                          </Badge>
                        ))}
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
                <div className="text-center py-8 text-muted-foreground text-xs">No models found matching "{search}"</div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

/* ───── API Keys Panel ───── */

function ApiKeysPanel({
  keys, loading, onSave, onValidate, onDelete,
}: {
  keys: ApiKeyStatus[];
  loading: boolean;
  onSave: (provider: string, key: string) => Promise<any>;
  onValidate: (provider: string) => Promise<any>;
  onDelete: (provider: string) => Promise<any>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Key className="h-4 w-4 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Bring Your Own API Key</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect your own AI provider keys for unlimited access. Keys are encrypted and stored securely on the server.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <ApiKeyInput provider="gemini" label="Google Gemini" placeholder="AIzaSy..." status={keys.find((k) => k.provider === "gemini")} loading={loading} onSave={onSave} onValidate={onValidate} onDelete={onDelete} />
          <ApiKeyInput provider="openai" label="OpenAI" placeholder="sk-..." status={keys.find((k) => k.provider === "openai")} loading={loading} onSave={onSave} onValidate={onValidate} onDelete={onDelete} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-accent/30 p-3">
        <p className="text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 inline mr-1 text-success" />
          Your API keys are encrypted server-side and never exposed in frontend code.
        </p>
      </div>
    </div>
  );
}

function ApiKeyInput({
  provider, label, placeholder, status, loading,
  onSave, onValidate, onDelete,
}: {
  provider: string; label: string; placeholder: string; status?: ApiKeyStatus; loading: boolean;
  onSave: (provider: string, key: string) => Promise<any>;
  onValidate: (provider: string) => Promise<any>;
  onDelete: (provider: string) => Promise<any>;
}) {
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleSave = async () => {
    if (!keyValue.trim()) return;
    setSaving(true);
    try {
      const result = await onSave(provider, keyValue.trim());
      if (result?.valid) { toast.success(`${label} API key saved and validated!`); setKeyValue(""); }
      else toast.error(`${label} key saved but validation failed: ${result?.error || "Invalid key"}`);
    } catch { toast.error(`Failed to save ${label} key`); }
    setSaving(false);
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await onValidate(provider);
      if (result?.valid) toast.success(`${label} key is valid!`);
      else toast.error(`${label} key validation failed: ${result?.error || "Invalid"}`);
    } catch { toast.error("Validation failed"); }
    setValidating(false);
  };

  const handleDelete = async () => {
    try { await onDelete(provider); toast.success(`${label} key removed`); }
    catch { toast.error("Failed to remove key"); }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {status && (
            <Badge variant="outline" className={`text-[10px] h-4 gap-0.5 ${status.is_valid ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}>
              {status.is_valid ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldX className="h-2.5 w-2.5" />}
              {status.is_valid ? "Valid" : "Invalid"}
            </Badge>
          )}
        </div>
        {status && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleValidate} disabled={validating}>
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input type={showKey ? "text" : "password"} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder={status ? "••••••••••••• (saved)" : placeholder} className="h-8 text-xs rounded-lg pr-8" />
          <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button size="sm" className="h-8 text-[11px] rounded-lg" onClick={handleSave} disabled={!keyValue.trim() || saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Key className="h-3 w-3 mr-1" />}
          {status ? "Update" : "Save"}
        </Button>
      </div>
      {status?.last_validated_at && (
        <p className="text-[10px] text-muted-foreground">Last validated: {new Date(status.last_validated_at).toLocaleString()}</p>
      )}
    </div>
  );
}

/* ───── Model Card ───── */

function ModelCard({
  model, selected, installed, pulling, ollamaOnline, hasKey, onSelect, onPull,
}: {
  model: ModelOption; selected: boolean; installed?: boolean; pulling?: boolean; ollamaOnline?: boolean; hasKey?: boolean; onSelect: () => void; onPull?: () => void;
}) {
  const isByok = model.provider === "gemini" || model.provider === "openai";

  return (
    <motion.button
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => {
        if (model.type === "local" && !installed && ollamaOnline) onPull?.();
        else onSelect();
      }}
      className={`flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-all ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-accent/30"
      }`}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
        selected ? "gradient-primary" : isByok ? "bg-warning/10" : "bg-accent"
      }`}>
        {isByok ? <Key className={`h-4 w-4 ${selected ? "text-primary-foreground" : "text-warning"}`} />
         : model.type === "cloud" ? <Cloud className={`h-4 w-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />
         : <Monitor className={`h-4 w-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{model.name}</span>
          {model.parameterSize && <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">{model.parameterSize}</span>}
          {isByok && hasKey !== undefined && (
            <Badge variant="outline" className={`text-[10px] h-4 ${hasKey ? "border-success/30 text-success" : "border-muted-foreground/30 text-muted-foreground"}`}>
              {hasKey ? "Key ✓" : "No Key"}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{model.description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {model.type === "local" && pulling && (
          <Badge variant="outline" className="border-warning/30 text-warning text-[10px] gap-1"><Loader2 className="h-3 w-3 animate-spin" />Pulling</Badge>
        )}
        {model.type === "local" && !pulling && installed && (
          <Badge variant="outline" className="border-success/30 text-success text-[10px] gap-1"><Check className="h-3 w-3" />Installed</Badge>
        )}
        {model.type === "local" && !pulling && !installed && ollamaOnline && (
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] gap-1"><Download className="h-3 w-3" />Pull</Badge>
        )}
        {selected && (
          <div className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center"><Check className="h-3 w-3 text-primary-foreground" /></div>
        )}
      </div>
    </motion.button>
  );
}
