import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveNotificationRoute } from "@/lib/notificationRoutes";

export type ToastKind =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "trade"
  | "message";

export interface OverlayToast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  notificationType?: string;
  notificationData?: unknown;
  actionLabel?: string;
  actionRoute?: string;
  /** Sticky toasts stay until dismissed/opened. */
  sticky?: boolean;
  createdAt: number;
}

export interface NotifyOptions {
  id?: string;
  message?: string;
  notificationType?: string;
  notificationData?: unknown;
  actionLabel?: string;
  actionRoute?: string;
  sticky?: boolean;
}

interface NotificationOverlayValue {
  toasts: OverlayToast[];
  push: (kind: ToastKind, title: string, options?: NotifyOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const NotificationOverlayContext =
  createContext<NotificationOverlayValue | null>(null);

/** Visible at once; the rest queue behind them. */
const MAX_VISIBLE_DESKTOP = 4;
const MAX_VISIBLE_MOBILE = 3;

/** Notification types that should stay until the user acts on them. */
const STICKY_TYPES = new Set<string>();

export const NotificationOverlayProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<OverlayToast[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  const push = useCallback(
    (kind: ToastKind, title: string, options: NotifyOptions = {}) => {
      const id =
        options.id ??
        `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Deduplicate by unique id.
      if (seenIds.current.has(id)) return id;
      seenIds.current.add(id);

      const toast: OverlayToast = {
        id,
        kind,
        title,
        message: options.message,
        notificationType: options.notificationType,
        notificationData: options.notificationData,
        actionLabel: options.actionLabel,
        actionRoute: options.actionRoute,
        sticky: options.sticky,
        createdAt: Date.now(),
      };

      setToasts((prev) => [toast, ...prev]);
      return id;
    },
    []
  );

  // Bridge for the imperative `notify.*` helper.
  useEffect(() => {
    registerPush(push);
    return () => registerPush(null);
  }, [push]);

  // Reuse the existing notifications table + realtime infrastructure.
  useEffect(() => {
    if (!user) {
      setToasts([]);
      seenIds.current.clear();
      return;
    }

    const channel = supabase
      .channel(`notification-overlay-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            type: string;
            title: string;
            message: string;
            data: unknown;
          };

          push(mapKind(n.type, n.title, n.message), n.title, {
            id: n.id,
            message: n.message,
            notificationType: n.type,
            notificationData: n.data,
            actionLabel: actionLabelFor(n.type),
            actionRoute: resolveNotificationRoute(n),
            sticky: STICKY_TYPES.has(n.type),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, push]);

  const value = useMemo(
    () => ({ toasts, push, dismiss, clear }),
    [toasts, push, dismiss, clear]
  );

  return (
    <NotificationOverlayContext.Provider value={value}>
      {children}
    </NotificationOverlayContext.Provider>
  );
};

export const useNotificationOverlay = () => {
  const ctx = useContext(NotificationOverlayContext);
  if (!ctx) {
    throw new Error(
      "useNotificationOverlay must be used within NotificationOverlayProvider"
    );
  }
  return ctx;
};

export const visibleLimit = (isMobile: boolean) =>
  isMobile ? MAX_VISIBLE_MOBILE : MAX_VISIBLE_DESKTOP;

const mapKind = (type: string, title = "", message = ""): ToastKind => {
  const text = `${title} ${message}`.toLowerCase();
  if (type === "message") return "message";
  if (type === "trade") {
    if (text.includes("cancel") || text.includes("dispute")) return "warning";
    if (text.includes("complete")) return "success";
    return "trade";
  }
  if (type === "payment") return "success";
  if (type === "kyc") return text.includes("reject") ? "error" : "info";
  if (type === "system") {
    if (text.includes("fail") || text.includes("error")) return "error";
    if (text.includes("security") || text.includes("warn")) return "warning";
  }
  return "info";
};

const actionLabelFor = (type: string): string => {
  switch (type) {
    case "trade":
      return "View Trade";
    case "message":
      return "Open Chat";
    case "payment":
      return "View Wallet";
    case "kyc":
      return "View Status";
    default:
      return "View";
  }
};

/* ------------------------------------------------------------------ */
/* Imperative helper: notify.success(...), notify.trade(...), etc.     */
/* ------------------------------------------------------------------ */

type PushFn = NotificationOverlayValue["push"];
let boundPush: PushFn | null = null;
const registerPush = (fn: PushFn | null) => {
  boundPush = fn;
};

const make =
  (kind: ToastKind) =>
  (title: string, options?: NotifyOptions): string | undefined =>
    boundPush?.(kind, title, options);

export const notify = {
  success: make("success"),
  info: make("info"),
  warning: make("warning"),
  error: make("error"),
  trade: make("trade"),
  message: make("message"),
};
