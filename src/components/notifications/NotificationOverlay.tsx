import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
  MessageCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useNotificationOverlay,
  visibleLimit,
  type OverlayToast,
  type ToastKind,
} from "@/contexts/NotificationOverlayContext";

const AUTO_DISMISS_MS = 5000;
const EXIT_MS = 220;

const kindStyles: Record<
  ToastKind,
  { icon: typeof Info; iconClass: string; ring: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-green-500 bg-green-500/10",
    ring: "ring-green-500/20",
  },
  info: {
    icon: Info,
    iconClass: "text-primary bg-primary/10",
    ring: "ring-primary/20",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-500 bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  error: {
    icon: XCircle,
    iconClass: "text-destructive bg-destructive/10",
    ring: "ring-destructive/20",
  },
  trade: {
    icon: ArrowLeftRight,
    iconClass: "text-primary bg-primary/10",
    ring: "ring-primary/20",
  },
  message: {
    icon: MessageCircle,
    iconClass: "text-purple-500 bg-purple-500/10",
    ring: "ring-purple-500/20",
  },
};

const ToastCard = ({
  toast,
  onDismiss,
}: {
  toast: OverlayToast;
  onDismiss: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(AUTO_DISMISS_MS);
  const startedAt = useRef(Date.now());

  const { icon: Icon, iconClass, ring } = kindStyles[toast.kind];

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => onDismiss(toast.id), EXIT_MS);
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (toast.sticky || paused || leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(close, remaining.current);
    return () => {
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - startedAt.current)
      );
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.sticky, paused, leaving]);

  const handleAction = () => {
    if (toast.actionRoute) navigate(toast.actionRoute);
    close();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "pointer-events-auto w-full rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl",
        "shadow-lg ring-1 p-3 transition-all duration-200 ease-out",
        ring,
        entered && !leaving
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-2 scale-[0.98]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            iconClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {toast.message}
            </p>
          )}
          {toast.actionRoute && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs font-medium text-primary hover:text-primary"
              onClick={handleAction}
            >
              {toast.actionLabel || "View"}
            </Button>
          )}
        </div>

        <button
          onClick={close}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const NotificationOverlay = () => {
  const { toasts, dismiss } = useNotificationOverlay();
  const isMobile = useIsMobile();
  const visible = toasts.slice(0, visibleLimit(isMobile));

  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2",
        "left-3 right-3 top-3",
        "sm:left-auto sm:right-4 sm:top-4 sm:w-[360px]"
      )}
    >
      {visible.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
};
