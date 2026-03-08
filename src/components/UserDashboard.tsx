import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText, MessageSquare, Sparkles, TrendingUp, Clock,
  BarChart3, Activity, Zap, ArrowUpRight, ArrowDownRight,
  FileType, Star, Upload, Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface UserDashboardProps {
  userId: string;
  userName?: string | null;
}

interface DashboardStats {
  totalDocuments: number;
  totalQuestions: number;
  totalChats: number;
  totalHighlights: number;
  favoriteTools: number;
  docsThisWeek: number;
  questionsToday: number;
}

interface WeeklyData {
  day: string;
  documents: number;
  questions: number;
}

interface DocTypeData {
  name: string;
  value: number;
  color: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function UserDashboard({ userId, userName }: UserDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0, totalQuestions: 0, totalChats: 0,
    totalHighlights: 0, favoriteTools: 0, docsThisWeek: 0, questionsToday: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeData[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    setLoading(true);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      { count: docCount },
      { data: docs },
      { count: chatCount },
      { count: highlightCount },
      { count: favToolCount },
      { data: usageData },
      { data: recentDocsData },
    ] = await Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("documents").select("created_at, file_type").eq("user_id", userId),
      supabase.from("chat_sessions").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("highlights").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("favorite_tools").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("daily_usage").select("usage_date, questions_asked").eq("user_id", userId).gte("usage_date", weekAgo.toISOString().split("T")[0]).order("usage_date"),
      supabase.from("documents").select("id, name, file_type, file_size, created_at, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    ]);

    // Calculate weekly data
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekly: WeeklyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const dayDocs = (docs || []).filter(doc => doc.created_at.startsWith(dateStr)).length;
      const dayUsage = (usageData || []).find(u => u.usage_date === dateStr);
      weekly.push({
        day: days[d.getDay()],
        documents: dayDocs,
        questions: dayUsage?.questions_asked || 0,
      });
    }

    // Doc type breakdown
    const typeMap: Record<string, number> = {};
    (docs || []).forEach(doc => {
      const ext = doc.file_type?.split("/").pop() || "other";
      const label = ext === "pdf" ? "PDF" : ext === "vnd.openxmlformats-officedocument.wordprocessingml.document" ? "DOCX" : ext === "plain" ? "TXT" : ext.toUpperCase();
      typeMap[label] = (typeMap[label] || 0) + 1;
    });
    const docTypeData = Object.entries(typeMap).map(([name, value], i) => ({
      name, value, color: COLORS[i % COLORS.length],
    }));

    const docsThisWeek = (docs || []).filter(doc => new Date(doc.created_at) >= weekAgo).length;
    const todayStr = now.toISOString().split("T")[0];
    const todayUsage = (usageData || []).find(u => u.usage_date === todayStr);
    const totalQuestions = (usageData || []).reduce((sum, u) => sum + u.questions_asked, 0);

    setStats({
      totalDocuments: docCount || 0,
      totalQuestions,
      totalChats: chatCount || 0,
      totalHighlights: highlightCount || 0,
      favoriteTools: favToolCount || 0,
      docsThisWeek,
      questionsToday: todayUsage?.questions_asked || 0,
    });
    setWeeklyData(weekly);
    setDocTypes(docTypeData);
    setRecentDocs(recentDocsData || []);
    setLoading(false);
  };

  const statCards = [
    {
      label: "Documents",
      value: stats.totalDocuments,
      icon: FileText,
      trend: stats.docsThisWeek > 0 ? `+${stats.docsThisWeek} this week` : "No new this week",
      trendUp: stats.docsThisWeek > 0,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "gradient-primary",
    },
    {
      label: "Questions Asked",
      value: stats.totalQuestions,
      icon: MessageSquare,
      trend: `${stats.questionsToday} today`,
      trendUp: stats.questionsToday > 0,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500",
    },
    {
      label: "Chat Sessions",
      value: stats.totalChats,
      icon: Brain,
      trend: "AI conversations",
      trendUp: true,
      gradient: "from-violet-500/20 to-violet-500/5",
      iconBg: "bg-violet-500",
    },
    {
      label: "Highlights",
      value: stats.totalHighlights,
      icon: Star,
      trend: "Saved excerpts",
      trendUp: true,
      gradient: "from-amber-500/20 to-amber-500/5",
      iconBg: "bg-amber-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Activity className="h-8 w-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome back{userName ? `, ${userName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's an overview of your activity and usage.</p>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-2xl p-5 hover:shadow-float transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center shadow-sm`}>
                  <card.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-medium ${card.trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {card.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {card.trend}
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 glass-card rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Weekly Activity</h3>
                <p className="text-[10px] text-muted-foreground">Documents & questions over the past 7 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="gradDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradQuestions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 8px 32px -8px hsl(var(--primary) / 0.1)",
                  }}
                />
                <Area type="monotone" dataKey="documents" stroke="hsl(var(--primary))" fill="url(#gradDocs)" strokeWidth={2} name="Documents" />
                <Area type="monotone" dataKey="questions" stroke="hsl(var(--chart-2))" fill="url(#gradQuestions)" strokeWidth={2} name="Questions" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Document Types Pie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Document Types</h3>
                <p className="text-[10px] text-muted-foreground">Breakdown by file type</p>
              </div>
            </div>
            {docTypes.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={docTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {docTypes.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {docTypes.map((dt) => (
                    <div key={dt.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: dt.color }} />
                      <span className="text-[10px] text-muted-foreground font-medium">{dt.name} ({dt.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                No documents yet
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Recent Documents</h3>
              <p className="text-[10px] text-muted-foreground">Your latest uploads</p>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {recentDocs.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No documents uploaded yet. Upload your first document to get started!</p>
            ) : (
              recentDocs.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()} • {(doc.file_size / 1024).toFixed(0)} KB
                      {doc.status !== "ready" && <span className="ml-1 text-primary font-medium">• {doc.status}</span>}
                    </p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${doc.status === "ready" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
