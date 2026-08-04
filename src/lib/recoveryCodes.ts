/**
 * One-time 2FA recovery codes.
 *
 * Format: XXXX-XXXX using an unambiguous alphabet (no 0/O/1/I).
 * Codes are generated client-side with crypto randomness, shown exactly once,
 * and only their SHA-256 hash is ever persisted (server-side).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;

const randomChars = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export const generateRecoveryCodes = (count = RECOVERY_CODE_COUNT): string[] => {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`${randomChars(4)}-${randomChars(4)}`);
  }
  return Array.from(codes);
};

export const normalizeRecoveryCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, "");

export const formatCodesForExport = (codes: string[], appName = "Peerly"): string =>
  [
    `${appName} — Two-Factor Recovery Codes`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "Keep these somewhere safe and private.",
    "Each recovery code can only be used once.",
    "Using one code invalidates every remaining code and a new set is issued.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c}`),
    "",
  ].join("\n");

export const downloadRecoveryCodes = (codes: string[], appName = "Peerly") => {
  const blob = new Blob([formatCodesForExport(codes, appName)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${appName.toLowerCase()}-recovery-codes.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const printRecoveryCodes = (codes: string[], appName = "Peerly") => {
  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return false;
  const rows = codes
    .map((c) => `<li style="font-family:monospace;font-size:18px;letter-spacing:2px">${c}</li>`)
    .join("");
  win.document.write(`<!doctype html><html><head><title>${appName} recovery codes</title></head>
    <body style="font-family:system-ui,sans-serif;padding:40px;color:#111">
      <h1 style="font-size:22px">${appName} — Two-Factor Recovery Codes</h1>
      <p style="font-size:13px">Generated ${new Date().toLocaleString()}</p>
      <p style="font-size:13px"><strong>Each recovery code can only be used once.</strong></p>
      <ol style="line-height:2">${rows}</ol>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
};
