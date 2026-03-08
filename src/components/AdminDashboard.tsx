import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Check, X, Clock, User, ChevronLeft,
  Loader2, CheckCircle2, XCircle, AlertCircle,
  Users, FileText, MessageSquare, Crown, Ban,
  ArrowUpCircle, ArrowDownCircle, BarChart3, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type AdminTab = "overview" | "users" | "requests";

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Stats
  const [stats, setStats] = useState({ totalUsers: 0, freeUsers: 0, proUsers: 0, totalDocs: 0, totalChats: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      // Load requests
      const { data: reqData } = await supabase
        .from("pro_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      setRequests((reqData || []) as ProRequest[]);

      // Load profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Load roles for each user
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Load doc counts
      const { data: docsData } = await supabase
        .from("documents")
        .select("user_id");

      const docCounts: Record<string, number> = {};
      (docsData || []).forEach((d: any) => {
        docCounts[d.user_id] = (docCounts[d.user_id] || 0) + 1;
      });

      const roleMap: Record<string, string> = {};
      (rolesData || []).forEach((r: any) => {
        roleMap[r.user_id] = r.role;
      });

      const enrichedUsers = (profileData || []).map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "free_user",
        doc_count: docCounts[p.id] || 0,
      }));
      setUsers(enrichedUsers);

      // Stats
      const { count: chatCount } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true });

      setStats({
        totalUsers: enrichedUsers.length,
        freeUsers: enrichedUsers.filter((u: any) => u.role === "free_user").length,
        proUsers: enrichedUsers.filter((u: any) => u.role === "pro_user").length,
        totalDocs: docsData?.length || 0,
        totalChats: chatCount || 0,
      });
    } catch (e) {
      console.error("Admin load error:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("approve_pro_request", { _request_id: requestId });
      if (error) throw error;
      toast.success("Pro request approved!");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    }
    setProcessing(null);
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("reject_pro_request", { _request_id: requestId });
      if (error) throw error;
      toast.success("Pro request rejected");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    }
    setProcessing(null);
  };

  const filteredRequests = requests.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const getUserEmail = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    return u?.email || userId.slice(0, 8) + "...";
  };

  const getUserName = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    return u?.name || "Unknown";
  };

  const tabs: { id: AdminTab; label: string; icon: typeof BarChart3; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "requests", label: "Requests", icon: Crown, badge: pendingCount },
  ];

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
          <p className="text-xs text-muted-foreground">Manage users, requests, and platform activity</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
                    { label: "Free Users", value: stats.freeUsers, icon: User, color: "text-muted-foreground" },
                    { label: "Pro Users", value: stats.proUsers, icon: Crown, color: "text-amber-500" },
                    { label: "Documents", value: stats.totalDocs, icon: FileText, color: "text-emerald-500" },
                    { label: "Chat Sessions", value: stats.totalChats, icon: MessageSquare, color: "text-violet-500" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
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
                        }`}>
                          {u.role?.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
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
                          <td className="px-4 py-3">
                            <span className="capitalize text-muted-foreground">{u.provider}</span>
                          </td>
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
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}
                          </td>
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
                {/* Filter */}
                <div className="flex gap-1">
                  {(["pending", "approved", "rejected", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                        filter === f
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {f}
                      {f === "pending" && pendingCount > 0 && (
                        <span className="ml-1 text-primary">({pendingCount})</span>
                      )}
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
                      <motion.div
                        key={req.id}
                        layout
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-foreground">{getUserName(req.user_id)}</p>
                              <p className="text-[10px] text-muted-foreground">{getUserEmail(req.user_id)}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Requested: {new Date(req.requested_at).toLocaleDateString()} at{" "}
                                {new Date(req.requested_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {req.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-3 gap-1"
                                  onClick={() => handleApprove(req.id)}
                                  disabled={processing === req.id}
                                >
                                  {processing === req.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-3 gap-1 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleReject(req.id)}
                                  disabled={processing === req.id}
                                >
                                  <X className="h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${
                                req.status === "approved"
                                  ? "bg-success/10 text-success"
                                  : "bg-destructive/10 text-destructive"
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
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
