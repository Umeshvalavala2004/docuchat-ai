import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Check, X, Clock, User, Mail, ChevronLeft,
  Loader2, CheckCircle2, XCircle, AlertCircle,
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
  user_email?: string;
}

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [requests, setRequests] = useState<ProRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pro_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (error) throw error;

      // Fetch user emails via auth - we'll use a workaround since we can't query auth.users
      // We'll show user_id and try to get emails from the request context
      const enriched = (data || []).map((r: any) => ({
        ...r,
        user_email: r.user_id, // Will be replaced below
      }));

      setRequests(enriched);
    } catch (e) {
      console.error("Failed to load requests:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("approve_pro_request", {
        _request_id: requestId,
      });
      if (error) throw error;
      toast.success("Pro request approved!");
      await loadRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    }
    setProcessing(null);
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc("reject_pro_request", {
        _request_id: requestId,
      });
      if (error) throw error;
      toast.success("Pro request rejected");
      await loadRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    }
    setProcessing(null);
  };

  const filtered = requests.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

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
        <div>
          <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Manage Pro upgrade requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-6 py-4">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-warning" />
            <span className="text-lg font-bold text-foreground">{stats.pending}</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">Pending</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-lg font-bold text-foreground">{stats.approved}</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">Approved</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-lg font-bold text-foreground">{stats.rejected}</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">Rejected</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 pb-3">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Request list */}
      <ScrollArea className="flex-1 px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No {filter} requests</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            <AnimatePresence>
              {filtered.map((req) => (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          User ID: {req.user_id.slice(0, 8)}...
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Requested: {new Date(req.requested_at).toLocaleDateString()} at{" "}
                          {new Date(req.requested_at).toLocaleTimeString()}
                        </p>
                        {req.reviewed_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Reviewed: {new Date(req.reviewed_at).toLocaleDateString()}
                          </p>
                        )}
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
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            req.status === "approved"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {req.status === "approved" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
