import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ShieldCheck,
  ShieldX,
  Bot,
  Download,
  Columns2,
  LayoutGrid,
  Move,
} from "lucide-react";
import { toast } from "sonner";
import { InlineLoader } from "@/components/loaders";
import { formatDistanceToNow } from "date-fns";

type DocKey = "front" | "back" | "selfie";
const DOC_LABEL: Record<DocKey, string> = {
  front: "ID Front",
  back: "ID Back",
  selfie: "Selfie",
};

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

interface ViewState {
  zoom: number;
  rotation: number;
  x: number;
  y: number;
}

const initialView: ViewState = { zoom: 1, rotation: 0, x: 0, y: 0 };

const DocViewer = ({
  url,
  label,
  state,
  setState,
  active,
  onActivate,
}: {
  url: string | null;
  label: string;
  state: ViewState;
  setState: (s: ViewState) => void;
  active: boolean;
  onActivate: () => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setStart({ x: e.clientX - state.x, y: e.clientY - state.y });
    onActivate();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setState({ ...state, x: e.clientX - start.x, y: e.clientY - start.y });
  };
  const onMouseUp = () => setDragging(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const next = Math.min(6, Math.max(0.3, state.zoom + delta));
    setState({ ...state, zoom: next });
  };

  return (
    <div
      className={`relative bg-black/40 border rounded-xl overflow-hidden h-[60vh] select-none ${
        active ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
      onClick={onActivate}
    >
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <Badge variant="outline" className="bg-background/80 backdrop-blur">
          {label}
        </Badge>
        {active && (
          <Badge className="bg-primary text-primary-foreground gap-1">
            <Move className="h-3 w-3" /> active
          </Badge>
        )}
      </div>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            <Button size="icon" variant="secondary" className="h-7 w-7">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            draggable={false}
            className="max-w-none max-h-none transition-transform"
            style={{
              transform: `translate(${state.x}px, ${state.y}px) scale(${state.zoom}) rotate(${state.rotation}deg)`,
              transformOrigin: "center center",
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Not available</p>
        )}
      </div>

      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur rounded-lg p-2">
        <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        <Slider
          value={[state.zoom * 100]}
          min={30}
          max={600}
          step={5}
          onValueChange={(v) => setState({ ...state, zoom: v[0] / 100 })}
          className="flex-1"
        />
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            setState({ ...state, rotation: (state.rotation + 90) % 360 });
          }}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setState(initialView);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
};

const STATUS_CONF: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted" },
  needs_review: { label: "Needs Review", cls: "bg-warning/20 text-warning border-warning/40" },
  auto_approved: { label: "Auto Approved", cls: "bg-primary/20 text-primary border-primary/40" },
  auto_rejected: { label: "Auto Rejected", cls: "bg-destructive/20 text-destructive border-destructive/40" },
  manually_approved: { label: "Approved", cls: "bg-primary/20 text-primary border-primary/40" },
  manually_rejected: { label: "Rejected", cls: "bg-destructive/20 text-destructive border-destructive/40" },
};

export const AdminKYCViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<DocKey, string | null>>({
    front: null,
    back: null,
    selfie: null,
  });
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<"single" | "side" | "grid">("side");
  const [primary, setPrimary] = useState<DocKey>("front");
  const [secondary, setSecondary] = useState<DocKey>("selfie");
  const [active, setActive] = useState<DocKey>("front");
  const [linked, setLinked] = useState(false);
  const [states, setStates] = useState<Record<DocKey, ViewState>>({
    front: { ...initialView },
    back: { ...initialView },
    selfie: { ...initialView },
  });
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("kyc_submissions")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Submission not found");
        navigate("/admin/kyc");
        return;
      }
      setSubmission(data);

      const urls: Record<DocKey, string | null> = { front: null, back: null, selfie: null };
      const map: Record<DocKey, string | null> = {
        front: data.id_front_url,
        back: data.id_back_url,
        selfie: data.selfie_url,
      };
      for (const k of Object.keys(map) as DocKey[]) {
        if (map[k]) {
          const { data: signed } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(map[k] as string, 3600);
          urls[k] = signed?.signedUrl ?? null;
        }
      }
      setSignedUrls(urls);
      setLoading(false);
    })();
  }, [id, navigate]);

  const setStateFor = (k: DocKey, s: ViewState) => {
    if (linked) {
      setStates({ front: s, back: s, selfie: s });
    } else {
      setStates((prev) => ({ ...prev, [k]: s }));
    }
  };

  const decide = async (decision: "manually_approved" | "manually_rejected") => {
    if (!submission) return;
    if (decision === "manually_rejected" && !notes.trim()) {
      toast.error("Provide a rejection reason");
      return;
    }
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).rpc("finalize_kyc_decision", {
      p_submission_id: submission.id,
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
    navigate("/admin/kyc");
  };

  const docKeys = useMemo(() => (["front", "back", "selfie"] as DocKey[]), []);
  const conf = submission ? STATUS_CONF[submission.status] || STATUS_CONF.pending : null;

  if (loading || !submission) {
    return (
      <div className="p-8">
        <InlineLoader />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/kyc")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Document Viewer
              {conf && (
                <Badge variant="outline" className={conf.cls}>
                  {conf.label}
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {submission.full_name} • {submission.country_code} • {submission.id_type} •{" "}
              {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={layout} onValueChange={(v) => setLayout(v as any)}>
            <TabsList>
              <TabsTrigger value="single">
                <Maximize2 className="h-3.5 w-3.5 mr-1" /> Single
              </TabsTrigger>
              <TabsTrigger value="side">
                <Columns2 className="h-3.5 w-3.5 mr-1" /> Side-by-side
              </TabsTrigger>
              <TabsTrigger value="grid">
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Grid
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant={linked ? "default" : "outline"}
            size="sm"
            onClick={() => setLinked((v) => !v)}
            title="Link zoom/pan across panels"
          >
            <Move className="h-3.5 w-3.5 mr-1" /> {linked ? "Linked" : "Link"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          {layout === "single" && (
            <div className="space-y-2">
              <Tabs value={primary} onValueChange={(v) => { setPrimary(v as DocKey); setActive(v as DocKey); }}>
                <TabsList>
                  {docKeys.map((k) => (
                    <TabsTrigger key={k} value={k}>{DOC_LABEL[k]}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <DocViewer
                url={signedUrls[primary]}
                label={DOC_LABEL[primary]}
                state={states[primary]}
                setState={(s) => setStateFor(primary, s)}
                active={active === primary}
                onActivate={() => setActive(primary)}
              />
            </div>
          )}

          {layout === "side" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Left:</span>
                <Tabs value={primary} onValueChange={(v) => setPrimary(v as DocKey)}>
                  <TabsList>{docKeys.map((k) => <TabsTrigger key={k} value={k}>{DOC_LABEL[k]}</TabsTrigger>)}</TabsList>
                </Tabs>
                <span className="text-xs text-muted-foreground ml-3">Right:</span>
                <Tabs value={secondary} onValueChange={(v) => setSecondary(v as DocKey)}>
                  <TabsList>{docKeys.map((k) => <TabsTrigger key={k} value={k}>{DOC_LABEL[k]}</TabsTrigger>)}</TabsList>
                </Tabs>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DocViewer
                  url={signedUrls[primary]}
                  label={DOC_LABEL[primary]}
                  state={states[primary]}
                  setState={(s) => setStateFor(primary, s)}
                  active={active === primary}
                  onActivate={() => setActive(primary)}
                />
                <DocViewer
                  url={signedUrls[secondary]}
                  label={DOC_LABEL[secondary]}
                  state={states[secondary]}
                  setState={(s) => setStateFor(secondary, s)}
                  active={active === secondary}
                  onActivate={() => setActive(secondary)}
                />
              </div>
            </div>
          )}

          {layout === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {docKeys.map((k) => (
                <DocViewer
                  key={k}
                  url={signedUrls[k]}
                  label={DOC_LABEL[k]}
                  state={states[k]}
                  setState={(s) => setStateFor(k, s)}
                  active={active === k}
                  onActivate={() => setActive(k)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> Bot Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score</span>
                <span className="font-mono font-semibold">
                  {Number(submission.bot_score ?? 0).toFixed(0)} / 100
                </span>
              </div>
              {submission.bot_reason && (
                <p className="text-xs text-muted-foreground">{submission.bot_reason}</p>
              )}
              <pre className="text-[10px] bg-muted/40 border border-border rounded p-2 overflow-x-auto max-h-56">
                {JSON.stringify(submission.bot_checks ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-right">{submission.full_name || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">DOB</span>
                <span className="font-medium">{submission.date_of_birth || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{submission.country_code || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">ID Type</span>
                <span className="font-medium">{submission.id_type || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">ID #</span>
                <span className="font-mono text-xs">{submission.id_number || "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="Notes (required for rejection)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={processing}
                  onClick={() => decide("manually_rejected")}
                >
                  <ShieldX className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={processing}
                  onClick={() => decide("manually_approved")}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
              <div className="flex gap-2 pt-1">
                {docKeys.map((k) =>
                  signedUrls[k] ? (
                    <a
                      key={k}
                      href={signedUrls[k] as string}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-3.5 w-3.5 mr-1" /> {DOC_LABEL[k]}
                      </Button>
                    </a>
                  ) : null
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminKYCViewer;
