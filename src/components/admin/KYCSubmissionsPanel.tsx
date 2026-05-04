import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bot, CheckCircle, XCircle, Clock, Eye, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { InlineLoader } from "@/components/loaders";

interface Submission {
  id: string;
  user_id: string;
  country_code: string | null;
  id_type: string | null;
  id_number: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  status: string;
  bot_score: number | null;
  bot_checks: any;
  bot_reason: string | null;
  review_notes: string | null;
  created_at: string;
}

const STATUS_CONF: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted" },
  needs_review: { label: "Needs Review", cls: "bg-warning/20 text-warning border-warning/40" },
  auto_approved: { label: "Auto Approved", cls: "bg-primary/20 text-primary border-primary/40" },
  auto_rejected: { label: "Auto Rejected", cls: "bg-destructive/20 text-destructive border-destructive/40" },
  manually_approved: { label: "Approved", cls: "bg-primary/20 text-primary border-primary/40" },
  manually_rejected: { label: "Rejected", cls: "bg-destructive/20 text-destructive border-destructive/40" },
};

const TABS = ["needs_review", "auto_approved", "auto_rejected", "all"] as const;
type Tab = typeof TABS[number];

export const KYCSubmissionsPanel = () => {
  const [tab, setTab] = useState<Tab>("needs_review");
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("kyc_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (tab !== "all") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) toast.error("Failed to load submissions");
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openSubmission = async (s: Submission) => {
    setSelected(s);
    setNotes("");
    const urls: Record<string, string> = {};
    for (const [k, path] of Object.entries({
      front: s.id_front_url,
      back: s.id_back_url,
      selfie: s.selfie_url,
    })) {
      if (path) {
        const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 3600);
        if (data?.signedUrl) urls[k] = data.signedUrl;
      }
    }
    setSignedUrls(urls);
  };

  const decide = async (decision: "manually_approved" | "manually_rejected") => {
    if (!selected) return;
    if (decision === "manually_rejected" && !notes.trim()) {
      toast.error("Provide a rejection reason");
      return;
    }
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).rpc("finalize_kyc_decision", {
      p_submission_id: selected.id,
      p_decision: decision,
      p_reviewer: user?.id ?? null,
      p_notes: notes || null,
    });
    setProcessing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "manually_approved" ? "Approved" : "Rejected");
    setSelected(null);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>KYC Submissions (Bot + Manual Review)</CardTitle>
        </div>
        <CardDescription>
          Auto-verified by the bot. Items in "Needs Review" require manual approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t === "all" ? "All" : STATUS_CONF[t]?.label || t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4 space-y-2">
          {loading ? (
            <InlineLoader />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No submissions.</p>
          ) : (
            items.map((s) => {
              const conf = STATUS_CONF[s.status] || STATUS_CONF.pending;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={conf.cls}>
                        {conf.label}
                      </Badge>
                      <span className="text-sm font-medium truncate">{s.full_name || "Unnamed"}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.country_code} • {s.id_type} • {s.id_number}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Bot score: <span className="font-mono">{Number(s.bot_score ?? 0).toFixed(0)}</span>
                      {s.bot_reason && ` • ${s.bot_reason}`} •{" "}
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openSubmission(s)}>
                    <Eye className="h-4 w-4 mr-1" /> Review
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Submission Review</DialogTitle>
            <DialogDescription>
              Bot score & checks below. Approve or reject the submission.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <b>{selected.full_name}</b></div>
                <div><span className="text-muted-foreground">DOB:</span> <b>{selected.date_of_birth}</b></div>
                <div><span className="text-muted-foreground">Country:</span> <b>{selected.country_code}</b></div>
                <div><span className="text-muted-foreground">ID Type:</span> <b>{selected.id_type}</b></div>
                <div className="col-span-2"><span className="text-muted-foreground">ID Number:</span> <b>{selected.id_number}</b></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["front", "back", "selfie"] as const).map((k) => (
                  <div key={k} className="border border-border rounded-lg p-2">
                    <p className="text-xs uppercase text-muted-foreground mb-1">{k}</p>
                    {signedUrls[k] ? (
                      <a href={signedUrls[k]} target="_blank" rel="noreferrer">
                        <img src={signedUrls[k]} alt={k} className="w-full h-40 object-cover rounded" />
                      </a>
                    ) : (
                      <div className="w-full h-40 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        Not available
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold mb-1">
                  Bot score: {Number(selected.bot_score ?? 0).toFixed(0)} / 100
                  {selected.bot_reason && <span className="text-muted-foreground"> — {selected.bot_reason}</span>}
                </p>
                <pre className="text-xs bg-muted/40 border border-border rounded p-2 overflow-x-auto max-h-64">
                  {JSON.stringify(selected.bot_checks ?? {}, null, 2)}
                </pre>
              </div>

              <Textarea
                placeholder="Notes (required for rejection)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button variant="destructive" disabled={processing} onClick={() => decide("manually_rejected")}>
              <ShieldX className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button disabled={processing} onClick={() => decide("manually_approved")}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
