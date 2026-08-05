import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import {
  useAccountRecoveryAdmin,
  type RecoveryDecision,
  type RecoveryRequest,
} from "@/hooks/useAccountRecoveryAdmin";

const PAGE_SIZE = 10;

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-500", icon: Clock },
    more_info: { label: "Needs info", className: "bg-blue-500/15 text-blue-500", icon: HelpCircle },
    approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-500", icon: Check },
    rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive", icon: X },
  };
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 border-0 ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
};

const decisionCopy: Record<RecoveryDecision, { title: string; cta: string; hint: string }> = {
  approved: {
    title: "Approve account recovery",
    cta: "Approve request",
    hint: "Confirm you have verified this person's identity. They will be notified.",
  },
  rejected: {
    title: "Reject account recovery",
    cta: "Reject request",
    hint: "Explain why the identity could not be verified. This is shared with the user.",
  },
  more_info: {
    title: "Request more information",
    cta: "Send request",
    hint: "Tell the user exactly what else you need from them.",
  },
};

export const AdminAccountRecovery = () => {
  const { requests, counts, loading, working, review, removeMfa } = useAccountRecoveryAdmin();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [decisionFor, setDecisionFor] = useState<RecoveryRequest | null>(null);
  const [decision, setDecision] = useState<RecoveryDecision>("approved");
  const [notes, setNotes] = useState("");

  const [mfaFor, setMfaFor] = useState<RecoveryRequest | null>(null);
  const [mfaReason, setMfaReason] = useState("");
  const [mfaConfirm, setMfaConfirm] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((r) => {
      const matchesTab =
        tab === "all"
          ? true
          : tab === "pending"
            ? r.status === "pending" || r.status === "more_info"
            : r.status === tab;
      const matchesTerm =
        !term ||
        r.username.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term);
      return matchesTab && matchesTerm;
    });
  }, [requests, tab, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const openDecision = (request: RecoveryRequest, next: RecoveryDecision) => {
    setDecisionFor(request);
    setDecision(next);
    setNotes("");
  };

  const submitDecision = async () => {
    if (!decisionFor) return;
    const ok = await review(decisionFor.id, decision, notes);
    if (ok) setDecisionFor(null);
  };

  const submitMfaRemoval = async () => {
    if (!mfaFor?.user_id) return;
    const ok = await removeMfa(mfaFor.id, mfaFor.user_id, mfaReason);
    if (ok) {
      setMfaFor(null);
      setMfaReason("");
      setMfaConfirm("");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Account Recovery</h1>
        <p className="text-muted-foreground">
          Review identity verification requests and handle two-factor removal.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: counts.pending, icon: Clock, tone: "text-amber-500" },
          { label: "Needs info", value: counts.moreInfo, icon: HelpCircle, tone: "text-blue-500" },
          { label: "Approved", value: counts.approved, icon: Check, tone: "text-emerald-500" },
          { label: "Rejected", value: counts.rejected, icon: X, tone: "text-destructive" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Icon className={`h-7 w-7 ${tone}`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Review queue</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search username, email or ID"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setPage(0);
            }}
          >
            <TabsList>
              <TabsTrigger value="pending">Open</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Nothing to review here.</p>
              ) : (
                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-3">User</TableHead>
                        <TableHead className="py-3">Explanation</TableHead>
                        <TableHead className="py-3">Status</TableHead>
                        <TableHead className="py-3">Submitted</TableHead>
                        <TableHead className="py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="py-4 align-top">
                            <p className="font-medium">@{r.username}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                            {r.mfa_removed_at && (
                              <Badge variant="outline" className="mt-1 gap-1 border-0 bg-destructive/15 text-destructive">
                                <ShieldOff className="h-3 w-3" />
                                2FA removed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-4 align-top max-w-sm">
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {r.explanation}
                            </p>
                            {r.attachments?.length > 0 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {r.attachments.length} attachment(s)
                              </p>
                            )}
                            {r.admin_notes && (
                              <p className="mt-1 text-xs italic text-muted-foreground">
                                Note: {r.admin_notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="py-4 align-top">{statusBadge(r.status)}</TableCell>
                          <TableCell className="py-4 align-top text-sm text-muted-foreground">
                            {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" onClick={() => openDecision(r, "approved")}>
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDecision(r, "more_info")}
                              >
                                More info
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDecision(r, "rejected")}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!r.user_id}
                                onClick={() => {
                                  setMfaFor(r);
                                  setMfaReason("");
                                  setMfaConfirm("");
                                }}
                              >
                                <ShieldOff className="mr-1 h-3.5 w-3.5" />
                                Remove 2FA
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} request{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decision dialog */}
      <Dialog open={!!decisionFor} onOpenChange={(o) => !o && setDecisionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decisionCopy[decision].title}</DialogTitle>
            <DialogDescription>{decisionCopy[decision].hint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Request from <span className="font-medium text-foreground">@{decisionFor?.username}</span>
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason / notes (required, shared with the user)"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={working || notes.trim().length < 3}>
              {decisionCopy[decision].cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA removal dialog */}
      <Dialog open={!!mfaFor} onOpenChange={(o) => !o && setMfaFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove two-factor authentication
            </DialogTitle>
            <DialogDescription>
              This deletes every authenticator on @{mfaFor?.username}'s account. Only do this after
              you have verified their identity. The action is logged and the user is notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={mfaReason}
              onChange={(e) => setMfaReason(e.target.value)}
              placeholder="Reason (required) — how was identity verified?"
              rows={3}
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold">REMOVE 2FA</span> to confirm.
              </p>
              <Input
                value={mfaConfirm}
                onChange={(e) => setMfaConfirm(e.target.value)}
                placeholder="REMOVE 2FA"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaFor(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={working || mfaReason.trim().length < 5 || mfaConfirm !== "REMOVE 2FA"}
              onClick={submitMfaRemoval}
            >
              Remove 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccountRecovery;
