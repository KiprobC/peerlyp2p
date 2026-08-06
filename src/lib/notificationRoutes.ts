/**
 * Central notification -> destination resolver.
 *
 * Every notification resolves to a real, existing route. If a notification
 * carries an explicit `target_route` in its payload we honour it (after
 * validating it against the known route table); otherwise we derive the
 * destination from the notification type/title/payload.
 */

export interface NotificationLike {
  id: string;
  type: string;
  title?: string | null;
  message?: string | null;
  data?: unknown;
}

const KNOWN_PREFIXES = [
  "/dashboard",
  "/trades",
  "/trade/",
  "/marketplace",
  "/my-offers",
  "/wallet/deposit",
  "/wallet/withdraw",
  "/wallet/history",
  "/profile",
  "/settings",
  "/notifications",
  "/how-it-works",
  "/admin",
  "/moderator",
];

/** Only allow in-app absolute paths that map to a registered route. */
export const isKnownRoute = (route: string): boolean =>
  route.startsWith("/") &&
  !route.startsWith("//") &&
  KNOWN_PREFIXES.some((p) => route === p || route.startsWith(p));

const has = (text: string, ...needles: string[]) =>
  needles.some((n) => text.includes(n));

export const resolveNotificationRoute = (n: NotificationLike): string => {
  const data = (n.data ?? {}) as Record<string, any>;
  const text = `${n.title ?? ""} ${n.message ?? ""}`.toLowerCase();

  // 1a. Admin/staff queue notifications carry an explicit `link`.
  if (typeof data.link === "string" && isKnownRoute(data.link)) return data.link;

  // 1. Explicit payload routing wins (future-proof: target_route/target_id).
  if (typeof data.target_route === "string") {
    const base = data.target_route as string;
    const withId =
      data.target_id && !base.includes(String(data.target_id))
        ? `${base.replace(/\/$/, "")}/${data.target_id}`
        : base;
    if (isKnownRoute(withId)) return withId;
    if (isKnownRoute(base)) return base;
  }

  // 2. Legacy/explicit actions.
  if (data.action === "complete_profile") return "/profile-setup";

  const tradeId = data.trade_id || data.tradeId;
  const txId = data.transaction_id || data.tx_id || data.transfer_id;
  const depositId = data.deposit_id || data.deposit_request_id;
  const withdrawalId = data.withdrawal_id || data.withdrawal_request_id;

  // 3. Deposits / withdrawals.
  if (has(text, "deposit")) {
    if (has(text, "confirm", "credited", "complete", "received", "failed", "rejected", "declined")) {
      const q = new URLSearchParams({ type: "deposit" });
      if (depositId || txId) q.set("tx", String(depositId || txId));
      if (has(text, "failed", "rejected", "declined")) q.set("status", "failed");
      return `/wallet/history?${q.toString()}`;
    }
    return "/wallet/deposit";
  }

  if (has(text, "withdraw", "blockchain transfer")) {
    if (has(text, "sent", "complete", "processed")) {
      const q = new URLSearchParams({ type: "withdrawal" });
      if (withdrawalId || txId) q.set("tx", String(withdrawalId || txId));
      return `/wallet/history?${q.toString()}`;
    }
    if (has(text, "reject", "declin", "cancel", "fail")) {
      const q = new URLSearchParams({ type: "withdrawal", status: "failed" });
      if (withdrawalId || txId) q.set("tx", String(withdrawalId || txId));
      return `/wallet/history?${q.toString()}`;
    }
    return "/wallet/withdraw";
  }

  // 4. Offers.
  if (has(text, "offer")) return "/my-offers";

  // 5. Ratings / reviews.
  if (data.needs_rating === true || has(text, "rating", "review", "feedback")) {
    if (tradeId) return `/trade/${tradeId}`;
    return "/profile";
  }

  // 6. Type-based routing.
  switch (n.type) {
    case "message":
      return tradeId ? `/trade/${tradeId}` : "/trades";
    case "trade":
      if (tradeId) return `/trade/${tradeId}`;
      return "/trades";
    case "payment":
      if (tradeId) return `/trade/${tradeId}`;
      if (txId) return `/wallet/history?tx=${txId}`;
      return "/wallet/history";
    case "kyc":
      if (data.status === "verified" || has(text, "approved", "verified")) return "/profile";
      return "/profile/kyc";
    case "system":
    default:
      if (has(text, "security", "password", "login", "session", "device", "passkey", "2fa"))
        return "/settings";
      if (has(text, "appeal", "dispute")) return tradeId ? `/trade/${tradeId}` : "/trades";
      if (tradeId) return `/trade/${tradeId}`;
      return "/notifications";
  }
};
