/**
 * Exchange-style copy polish for treasury (deposit / withdrawal) surfaces.
 *
 * This is a pure UX/terminology layer applied on the client. It does NOT
 * change any backend workflow, RPC, notification storage or schema — it
 * only rewrites user-visible strings so the experience feels like a modern
 * crypto exchange instead of an admin approval queue.
 */

export type TreasuryStatus =
  | "pending"
  | "approved"
  | "sent"
  | "rejected"
  | "completed"
  | "failed";

/** Friendly status label for deposit/withdrawal request badges. */
export const treasuryStatusLabel = (
  status: string,
  kind: "deposit" | "withdrawal" = "deposit",
): string => {
  const s = (status || "").toLowerCase();
  if (kind === "withdrawal") {
    switch (s) {
      case "pending":
        return "Preparing Blockchain Transfer";
      case "processing":
      case "approved":
        return "Preparing Blockchain Transfer";
      case "sent":
      case "completed":
        return "Blockchain Transfer Sent";
      case "rejected":
      case "failed":
        return "Processing Cancelled";
      default:
        return status;
    }
  }
  switch (s) {
    case "pending":
      return "Awaiting Network Confirmation";
    case "processing":
      return "Deposit Processing";
    case "approved":
    case "completed":
      return "Deposit Confirmed";
    case "rejected":
    case "failed":
      return "Processing Cancelled";
    default:
      return status;
  }
};

/** Rewrite wallet_transactions.description strings into exchange-style copy. */
export const polishTxDescription = (desc?: string | null): string => {
  if (!desc) return "";
  return desc
    .replace(/Manual deposit approved/gi, "Blockchain deposit completed")
    .replace(/Manual withdrawal sent/gi, "Blockchain transfer completed")
    .replace(/Manual deposit rejected/gi, "Deposit processing cancelled")
    .replace(/Manual deposit/gi, "Blockchain deposit")
    .replace(/Manual withdrawal/gi, "Blockchain transfer")
    .replace(/admin verified/gi, "Blockchain confirmed")
    .replace(/admin approved/gi, "Deposit confirmed")
    .replace(/approved by admin/gi, "processed on the blockchain")
    .replace(/sent by admin/gi, "broadcast to the blockchain");
};

/**
 * Rewrite notification title/message so treasury notifications read like
 * exchange alerts. Matches on the source strings emitted by treasury RPCs
 * without altering how notifications are stored.
 */
export const polishNotification = (
  title?: string | null,
  message?: string | null,
): { title: string; message: string } => {
  let t = title || "";
  let m = message || "";

  // Titles
  if (/deposit approved/i.test(t) || /deposit.*credited/i.test(t)) {
    t = "Deposit Confirmed";
    if (!m || /approved|credited/i.test(m)) {
      m =
        "Your blockchain deposit has completed processing and your wallet has been credited.";
    }
  } else if (/deposit rejected/i.test(t)) {
    t = "Deposit Not Completed";
    m = "We couldn't complete processing for your recent deposit. View the details for more information.";
  } else if (/withdrawal approved/i.test(t)) {
    t = "Withdrawal Processing";
    m = "Your withdrawal is being prepared for broadcast to the blockchain.";
  } else if (/withdrawal sent/i.test(t)) {
    t = "Blockchain Transfer Sent";
    // preserve TX hash if present in the original message
    const txMatch = m.match(/TX[:\s]+([A-Za-z0-9x]+)/i);
    m = txMatch
      ? `Your cryptocurrency has been successfully broadcast to the blockchain. TX: ${txMatch[1]}`
      : "Your cryptocurrency has been successfully broadcast to the blockchain.";
  } else if (/waiting for admin|awaiting admin/i.test(t)) {
    t = "Awaiting Network Confirmation";
    m = m || "Your deposit is in the Network Confirmation Process.";
  }

  // Body-level catch-alls
  m = m
    .replace(/Manual deposit approved/gi, "Blockchain deposit completed")
    .replace(/Manual withdrawal sent/gi, "Blockchain transfer completed")
    .replace(/approved by admin/gi, "processed on the blockchain")
    .replace(/waiting for admin/gi, "awaiting network confirmation");

  return { title: t, message: m };
};
