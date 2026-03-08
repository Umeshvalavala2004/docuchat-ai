import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, User, Palette, MessageSquare, FileText, Shield, Sun, Moon, Monitor, Camera, Save, Loader2, Cpu, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserProfile } from "@/hooks/useProfile";
import ModelSettings from "@/components/ModelSettings";
import type { ModelConfig } from "@/hooks/useModelPreference";
import { useBranding } from "@/hooks/useBranding";

interface SettingsPageProps {
  onBack: () => void;
  userId: string;
  profile: UserProfile | null;
  currentModel?: ModelConfig;
  onModelChange?: (model: ModelConfig) => void;
}

type Tab = "general" | "ai-models" | "chat" | "documents" | "account" | "about";

export default function SettingsPage({ onBack, userId, profile, currentModel, onModelChange }: SettingsPageProps) {
  const [tab, setTab] = useState<Tab>("general");
  const { branding, copyright } = useBranding();
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return "dark";
    if (saved === "light") return "light";
    return "system";
  });

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else if (newTheme === "dark") {
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ name: name.trim() || null }).eq("id", userId);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile?.email || "", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (e: any) {
      toast.error(e.message || "Failed to send reset email");
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "general", label: "General", icon: Palette },
    { id: "ai-models", label: "AI Models", icon: Cpu },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "account", label: "Account", icon: User },
    { id: "about", label: "About", icon: Info },
  ];

  const themeOptions = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    { id: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your experience</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 border-r border-border p-3 space-y-1 hidden md:block">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex md:hidden border-b border-border px-4 py-2 absolute top-[60px] left-0 right-0 bg-background z-10 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 space-y-8">
            {tab === "general" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Theme</h3>
                  <p className="text-xs text-muted-foreground mb-4">Choose how {branding.appName} looks to you</p>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                          theme === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <t.icon className={`h-5 w-5 ${theme === t.id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium ${theme === t.id ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-1">UI Density</h3>
                  <p className="text-xs text-muted-foreground mb-4">Adjust the spacing and size of elements</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Compact", "Default", "Comfortable"].map((d) => (
                      <button
                        key={d}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          d === "Default" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "ai-models" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-sm font-semibold text-foreground mb-1">AI Model Settings</h3>
                <p className="text-xs text-muted-foreground mb-4">Choose which AI model powers your document chat</p>
                {currentModel && onModelChange ? (
                  <ModelSettings currentModel={currentModel} onModelChange={onModelChange} userId={userId} />
                ) : (
                  <p className="text-xs text-muted-foreground">Model settings unavailable.</p>
                )}
              </motion.div>
            )}

            {tab === "chat" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Response Style</h3>
                  <p className="text-xs text-muted-foreground mb-4">How the AI should respond</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Concise", "Detailed", "Academic"].map((s) => (
                      <button
                        key={s}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          s === "Detailed" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "documents" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Document Processing</h3>
                  <p className="text-xs text-muted-foreground mb-4">Configure how documents are processed</p>
                  <div className="space-y-3">
                    {[
                      "Show chunk previews in sources",
                      "Enable text highlighting",
                      "Auto-scroll to citations",
                    ].map((label) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-foreground">{label}</span>
                        <div className="h-5 w-9 rounded-full bg-primary relative cursor-pointer">
                          <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-primary-foreground shadow-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "account" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Profile</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      {profile?.profile_picture ? (
                        <img src={profile.profile_picture} className="h-16 w-16 rounded-2xl object-cover shadow-sm" alt="" />
                      ) : (
                        <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-lg font-bold shadow-sm">
                          {(profile?.name || profile?.email || "U")[0]?.toUpperCase()}
                        </div>
                      )}
                      <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shadow-sm">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{profile?.name || "No name set"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Display Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Email</Label>
                      <Input value={profile?.email || ""} disabled className="h-10 rounded-xl opacity-50" />
                    </div>
                    <Button onClick={handleSaveProfile} disabled={saving} className="rounded-xl gradient-primary border-0 gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Security</h3>
                  <p className="text-xs text-muted-foreground mb-4">Manage your account security</p>
                  <Button variant="outline" onClick={handleChangePassword} className="rounded-xl">
                    <Shield className="h-4 w-4 mr-2" />Change Password
                  </Button>
                </div>

                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
                  <h3 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mb-4">Irreversible actions</p>
                  <Button variant="outline" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
                    Delete Account
                  </Button>
                </div>
              </motion.div>
            )}

            {tab === "about" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-sm">
                      <FileText className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{branding.appName}</h3>
                      <p className="text-xs text-muted-foreground">{branding.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Interface_IQ is an AI-powered document intelligence platform designed to analyze documents, extract insights, and enable conversational interaction with enterprise knowledge.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Platform Details</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Project Name", value: branding.appName },
                      { label: "Version", value: "1.0.0" },
                      { label: "Platform", value: "AI Document Intelligence" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">{copyright}</p>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
