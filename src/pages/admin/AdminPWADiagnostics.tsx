import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConnectivity } from "@/hooks/useConnectivity";
import { Activity, RefreshCw, Wifi, WifiOff, HardDrive, Cpu } from "lucide-react";

type SWInfo = {
  scope?: string;
  scriptURL?: string;
  state?: string;
  hasWaiting: boolean;
  hasInstalling: boolean;
  controllerScriptURL?: string;
};

type CacheInfo = { name: string; entries: number };

const fmt = (ts: number | null) => (ts ? new Date(ts).toLocaleString() : "—");

const AdminPWADiagnostics = () => {
  const conn = useConnectivity();
  const [sw, setSw] = useState<SWInfo | null>(null);
  const [caches, setCaches] = useState<CacheInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiagnostics = async () => {
    setRefreshing(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        setSw({
          scope: reg?.scope,
          scriptURL: reg?.active?.scriptURL,
          state: reg?.active?.state,
          hasWaiting: !!reg?.waiting,
          hasInstalling: !!reg?.installing,
          controllerScriptURL: navigator.serviceWorker.controller?.scriptURL,
        });
      }
      if ("caches" in window) {
        const names = await window.caches.keys();
        const entries = await Promise.all(
          names.map(async (n) => {
            const c = await window.caches.open(n);
            const keys = await c.keys();
            return { name: n, entries: keys.length };
          }),
        );
        setCaches(entries);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  const forceUpdate = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
    if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    await loadDiagnostics();
  };

  const clearAllCaches = async () => {
    if (!("caches" in window)) return;
    const names = await window.caches.keys();
    await Promise.all(names.map((n) => window.caches.delete(n)));
    await loadDiagnostics();
  };

  const unregisterSW = async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    await loadDiagnostics();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> PWA Diagnostics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Service worker, cache, and connectivity status for the installed app.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDiagnostics} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            {conn.online ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            Connectivity
          </h2>
          <Button size="sm" variant="ghost" onClick={() => conn.refresh()} disabled={conn.checking}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${conn.checking ? "animate-spin" : ""}`} />
            Probe
          </Button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Row label="Online (verified)">
            <Badge variant={conn.online ? "default" : "destructive"}>
              {conn.online ? "Online" : "Offline"}
            </Badge>
          </Row>
          <Row label="navigator.onLine">
            <Badge variant="outline">{String(conn.navigatorOnline)}</Badge>
          </Row>
          <Row label="Last check">{fmt(conn.lastCheckAt)}</Row>
          <Row label="Last online event">{fmt(conn.lastOnlineAt)}</Row>
          <Row label="Last offline event">{fmt(conn.lastOfflineAt)}</Row>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4" /> Service Worker
        </h2>
        {sw ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Row label="Active script">
              <code className="text-xs break-all">{sw.scriptURL || "—"}</code>
            </Row>
            <Row label="State">
              <Badge variant="outline">{sw.state || "—"}</Badge>
            </Row>
            <Row label="Scope">
              <code className="text-xs">{sw.scope || "—"}</code>
            </Row>
            <Row label="Controller">
              <code className="text-xs break-all">{sw.controllerScriptURL || "—"}</code>
            </Row>
            <Row label="Update waiting">
              <Badge variant={sw.hasWaiting ? "destructive" : "outline"}>
                {sw.hasWaiting ? "Yes" : "No"}
              </Badge>
            </Row>
            <Row label="Installing">
              <Badge variant="outline">{sw.hasInstalling ? "Yes" : "No"}</Badge>
            </Row>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No service worker registered (likely preview/dev environment).
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          <Button size="sm" variant="outline" onClick={forceUpdate}>
            Check for update
          </Button>
          <Button size="sm" variant="outline" onClick={unregisterSW}>
            Unregister
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Caches
          </h2>
          <Button size="sm" variant="outline" onClick={clearAllCaches}>
            Clear all
          </Button>
        </div>
        {caches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No caches present.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {caches.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40"
              >
                <code className="text-xs break-all">{c.name}</code>
                <Badge variant="outline">{c.entries} entries</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/20">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right">{children}</dd>
  </div>
);

export default AdminPWADiagnostics;
