import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Check, X, Clock, User, ChevronLeft,
  Loader2, CheckCircle2, XCircle, AlertCircle,
  Users, FileText, MessageSquare, Crown, Ban,
  ArrowUpCircle, ArrowDownCircle, BarChart3, Eye,
  TrendingUp, Activity, Search as SearchIcon, Tag,
  Palette, Save, Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart } from "recharts";
import { useBranding } from "@/hooks/useBranding";

interface ProRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  profile_picture: string | null;
  provider: string;
  last_login: string | null;
  created_at: string;
  role?: string;
  doc_count?: number;
}

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = "overview" | "analytics" | "users" | "requests" | "branding";

const CHART_COLORS = [
  "hsl(222, 80%, 55%)",
  "hsl(152, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 55%)",
];

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const { branding, updateBranding, refetch: refetchBranding } = useBranding();
  const [brandForm, setBrandForm] = useState({ appName: "", subtitle: "", copyrightYear: "", copyrightText: "", logoUrl: "" });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandInitialized, setBrandInitialized] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `logo-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;
      setBrandForm((prev) => ({ ...prev, logoUrl: publicUrl }));
      toast.success("Logo uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload logo");
    }
    setLogoUploading(false);
  };

  const [stats, setStats] = useState({
    totalUsers: 0, freeUsers: 0, proUsers: 0, adminUsers: 0,
    totalDocs: 0, totalChats: 0, totalMessages: 0, totalHighlights: 0,
  });
  const [userGrowth, setUserGrowth] = useState<{ date: string; count: number }[]>([]);
  const [docsByType, setDocsByType] = useState<{ name: string; value: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ date: string; chats: number; docs: number }[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: reqData } = await supabase.from("pro_requests").select("*").order("requested_at", { ascending: false });
      setRequests((reqData || []) as ProRequest[]);

      const { data: profileData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
      const { data: docsData } = await supabase.from("documents").select("user_id, file_type, created_at");
      const { count: chatCount } = await supabase.from("chat_sessions").select("id", { count: "exact", head: true });
      const { count: messageCount } = await supabase.from("messages").select("id", { count: "exact", head: true });
      const { count: highlightCount } = await supabase.from("highlights").select("id", { count: "exact", head: true });

      const docCounts: Record<string, number> = {};
      (docsData || []).forEach((d: any) => { docCounts[d.user_id] = (docCounts[d.user_id] || 0) + 1; });

      const roleMap: Record<string, string> = {};
      (rolesData || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      const enrichedUsers = (profileData || []).map((p: any) => ({
        ...p, role: roleMap[p.id] || "free_user", doc_count: docCounts[p.id] || 0,
      }));
      setUsers(enrichedUsers);

      const adminCount = enrichedUsers.filter((u: any) => u.role === "admin").length;
      const proCount = enrichedUsers.filter((u: any) => u.role === "pro_user").length;
      const freeCount = enrichedUsers.filter((u: any) => u.role === "free_user").length;

      setStats({
        totalUsers: enrichedUsers.length, freeUsers: freeCount, proUsers: proCount, adminUsers: adminCount,
        totalDocs: docsData?.length || 0, totalChats: chatCount || 0,
        totalMessages: messageCount || 0, totalHighlights: highlightCount || 0,
      });

      // User growth data (last 7 days)
      const growth: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        growth[d.toLocaleDateString("en", { month: "short", day: "numeric" })] = 0;
      }
      (profileData || []).forEach((p: any) => {
        const d = new Date(p.created_at);
        const key = d.toLocaleDateString("en", { month: "short", day: "numeric" });
        if (growth[key] !== undefined) growth[key]++;
      });
      setUserGrowth(Object.entries(growth).map(([date, count]) => ({ date, count })));

      // Docs by type
      const typeCounts: Record<string, number> = {};
      (docsData || []).forEach((d: any) => {
        const ext = d.file_type?.split("/").pop() || "other";
        typeCounts[ext] = (typeCounts[ext] || 0) + 1;
      });
      setDocsByType(Object.entries(typeCounts).map(([name, value]) => ({ name, value })));

      // Recent activity
      const activityMap: Record<string, { chats: number; docs: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en", { month: "short", day: "numeric" });
        activityMap[key] = { chats: 0, docs: 0 };
      }
      (docsData || []).forEach((d: any) => {
        const key = new Date(d.created_at).toLocaleDateString("en", { month: "short", day: "numeric" });
        if (activityMap[key]) activityMap[key].docs++;
      });
      setRecentActivity(Object.entries(activityMap).map(([date, data]) => ({ date, ...data })));

    } catch (e) {
      console.error("Admin load error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Sync brand form when branding loads
  useEffect(() => {
    if (!brandInitialized && branding.appName) {
      setBrandForm({
        appName: branding.appName,
        subtitle: branding.subtitle,
        copyrightYear: branding.copyrightYear,
        copyrightText: branding.copyrightText,
        logoUrl: branding.logoUrl || "",
      });
      setBrandInitialized(true);
    }
  }, [branding, brandInitialized]);

  const handleSaveBranding = async () => {
    setBrandSaving(true);
    try {
      await updateBranding({
        appName: brandForm.appName,
        subtitle: brandForm.subtitle,
        copyrightYear: brandForm.copyrightYear,
        copyrightText: brandForm.copyrightText,
        logoUrl: brandForm.logoUrl || null,
      });
      toast.success("Branding updated! Changes will appear across the app.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save branding");
    }
    setBrandSaving(false);
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("approve_pro_request", { _request_id: requestId });
      if (error) throw error;
      toast.success("Pro request approved!");
      await loadData();
    } catch (e: any) { toast.error(e.message || "Failed to approve"); }
    setProcessing(null);
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("reject_pro_request", { _request_id: requestId });
      if (error) throw error;
      toast.success("Pro request rejected");
      await loadData();
    } catch (e: any) { toast.error(e.message || "Failed to reject"); }
    setProcessing(null);
  };

  const filteredRequests = requests.filter((r) => filter === "all" ? true : r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const getUserEmail = (userId: string) => users.find((u) => u.id === userId)?.email || userId.slice(0, 8) + "...";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name || "Unknown";

  const tabs: { id: AdminTab; label: string; icon: typeof BarChart3; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "requests", label: "Requests", icon: Crown, badge: pendingCount },
    { id: "branding", label: "Branding", icon: Palette },
  ];

  const roleDistribution = [
    { name: "Free", value: stats.freeUsers },
    { name: "Pro", value: stats.proUsers },
    { name: "Admin", value: stats.adminUsers },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Enterprise management & analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.badge && t.badge > 0 && (
              <span className="ml-1 h-4 min-w-[16px] rounded-full bg-destructive text-[9px] text-destructive-foreground flex items-center justify-center px-1 font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Documents", value: stats.totalDocs, icon: FileText, color: "text-success", bg: "bg-success/10" },
                    { label: "Chat Sessions", value: stats.totalChats, icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-500/10" },
                    { label: "Messages", value: stats.totalMessages, icon: Activity, color: "text-warning", bg: "bg-warning/10" },
                  ].map((s) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
                      <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Quick stats row 2 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Pro Users", value: stats.proUsers, icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10" },
                    { label: "Free Users", value: stats.freeUsers, icon: User, color: "text-muted-foreground", bg: "bg-accent" },
                    { label: "Highlights", value: stats.totalHighlights, icon: Tag, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    { label: "Pending Requests", value: pendingCount, icon: Clock, color: "text-destructive", bg: "bg-destructive/10" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Recent users */}
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Recent Users</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                        {u.profile_picture ? (
                          <img src={u.profile_picture} className="h-8 w-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {(u.name || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{u.name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          u.role === "admin" ? "bg-primary/10 text-primary" :
                          u.role === "pro_user" ? "bg-amber-500/10 text-amber-600" :
                          "bg-accent text-muted-foreground"
                        }`}>{u.role?.replace("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ANALYTICS ── */}
            {tab === "analytics" && (
              <div className="space-y-4">
                {/* Activity chart */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Document Uploads (7 Days)</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={recentActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: "11px",
                          }}
                        />
                        <Area type="monotone" dataKey="docs" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} name="Documents" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Role distribution + User growth */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-4">User Roles</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={roleDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={4}
                          >
                            {roleDistribution.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      {roleDistribution.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <div className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-4">New Users (7 Days)</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userGrowth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                          <RechartsTooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "11px",
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Users" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Document types */}
                {docsByType.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Document Types</h3>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={docsByType} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={60} />
                          <RechartsTooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "11px",
                            }}
                          />
                          <Bar dataKey="value" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} name="Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── USERS ── */}
            {tab === "users" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-accent/30">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Provider</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Documents</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Joined</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Login</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {u.profile_picture ? (
                                <img src={u.profile_picture} className="h-7 w-7 rounded-full object-cover" alt="" />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {(u.name || "?")[0]?.toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-foreground">{u.name || "Unknown"}</p>
                                <p className="text-[10px] text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="capitalize text-muted-foreground">{u.provider}</span></td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium capitalize ${
                              u.role === "admin" ? "bg-primary/10 text-primary" :
                              u.role === "pro_user" ? "bg-amber-500/10 text-amber-600" :
                              "bg-accent text-muted-foreground"
                            }`}>
                              {u.role === "pro_user" && <Crown className="h-2.5 w-2.5" />}
                              {u.role === "admin" && <Shield className="h-2.5 w-2.5" />}
                              {u.role?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.doc_count}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── REQUESTS ── */}
            {tab === "requests" && (
              <div className="space-y-3">
                <div className="flex gap-1">
                  {(["pending", "approved", "rejected", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                        filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {f}{f === "pending" && pendingCount > 0 && <span className="ml-1 text-primary">({pendingCount})</span>}
                    </button>
                  ))}
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No {filter} requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRequests.map((req) => (
                      <motion.div key={req.id} layout className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-foreground">{getUserName(req.user_id)}</p>
                              <p className="text-[10px] text-muted-foreground">{getUserEmail(req.user_id)}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Requested: {new Date(req.requested_at).toLocaleDateString()} at {new Date(req.requested_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {req.status === "pending" ? (
                              <>
                                <Button size="sm" className="h-7 text-xs px-3 gap-1" onClick={() => handleApprove(req.id)} disabled={processing === req.id}>
                                  {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleReject(req.id)} disabled={processing === req.id}>
                                  <X className="h-3 w-3" />Reject
                                </Button>
                              </>
                            ) : (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${
                                req.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                              }`}>
                                {req.status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {req.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── BRANDING ── */}
            {tab === "branding" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-xl">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Branding & Identity</h3>
                    <p className="text-xs text-muted-foreground">Customize how the app appears across all pages</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Application Name</Label>
                      <Input
                        value={brandForm.appName}
                        onChange={(e) => setBrandForm({ ...brandForm, appName: e.target.value })}
                        placeholder="Interface_IQ"
                        className="h-10 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Subtitle</Label>
                      <Input
                        value={brandForm.subtitle}
                        onChange={(e) => setBrandForm({ ...brandForm, subtitle: e.target.value })}
                        placeholder="Powered by Interface_IQ"
                        className="h-10 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Copyright Year</Label>
                        <Input
                          value={brandForm.copyrightYear}
                          onChange={(e) => setBrandForm({ ...brandForm, copyrightYear: e.target.value })}
                          placeholder="2026"
                          className="h-10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Copyright Text</Label>
                        <Input
                          value={brandForm.copyrightText}
                          onChange={(e) => setBrandForm({ ...brandForm, copyrightText: e.target.value })}
                          placeholder="Interface_IQ. All rights reserved."
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Logo Image URL</Label>
                      <Input
                        value={brandForm.logoUrl}
                        onChange={(e) => setBrandForm({ ...brandForm, logoUrl: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="h-10 rounded-xl"
                      />
                      <p className="text-[10px] text-muted-foreground">Leave empty to use the default icon</p>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Preview</h3>
                  <div className="rounded-lg border border-border bg-background p-4 space-y-4">
                    <div className="flex items-center gap-2.5">
                      {brandForm.logoUrl ? (
                        <img src={brandForm.logoUrl} className="h-8 w-8 rounded-xl object-cover" alt="Logo" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-sm">
                          <FileText className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground tracking-tight">{brandForm.appName || "Interface_IQ"}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{brandForm.subtitle || "Powered by Interface_IQ"}</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3 text-center">
                      <p className="text-[10px] text-muted-foreground">© {brandForm.copyrightYear || "2026"} {brandForm.copyrightText || "Interface_IQ. All rights reserved."}</p>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveBranding} disabled={brandSaving} className="rounded-xl gradient-primary border-0 gap-2">
                  {brandSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Branding
                </Button>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
