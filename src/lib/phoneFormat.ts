/**
 * Phone helpers for KYC.
 *
 * - Kenya (KE) gets strict local numbering rules: +254 followed by 9 digits
 *   starting with 7 or 1 (mobile ranges). Local forms like 07xx / 01xx are
 *   normalised automatically.
 * - Every other country simply gets its international calling code prefilled
 *   and a light-touch digit/length validation.
 */

export const KENYA_DIAL_CODE = "+254";

/** Strips everything except digits. */
const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * Normalises any Kenyan input (0712345678, 254712345678, +254712345678,
 * 712345678) into the canonical +254XXXXXXXXX form.
 */
export const normalizeKenyanPhone = (raw: string): string => {
  let d = digitsOnly(raw);
  if (d.startsWith("254")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return `${KENYA_DIAL_CODE}${d.slice(0, 9)}`;
};

/** Pretty display form: +254 712 345 678 */
export const formatKenyanPhone = (raw: string): string => {
  const local = normalizeKenyanPhone(raw).slice(KENYA_DIAL_CODE.length);
  const parts = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 9)].filter(Boolean);
  return [KENYA_DIAL_CODE, ...parts].join(" ").trim();
};

export const isValidKenyanPhone = (raw: string): boolean => {
  const local = normalizeKenyanPhone(raw).slice(KENYA_DIAL_CODE.length);
  return /^(7|1)\d{8}$/.test(local);
};

/**
 * Formats input for any country: keeps the dial code pinned to the front and
 * applies Kenyan grouping when the country is Kenya.
 */
export const formatPhoneForCountry = (raw: string, countryCode: string, dialCode: string): string => {
  if (countryCode === "KE") return formatKenyanPhone(raw);

  const code = dialCode?.startsWith("+") ? dialCode : `+${digitsOnly(dialCode || "")}`;
  let d = digitsOnly(raw);
  const codeDigits = digitsOnly(code);
  if (codeDigits && d.startsWith(codeDigits)) d = d.slice(codeDigits.length);
  else if (d.startsWith("0")) d = d.slice(1);
  return d ? `${code} ${d}` : code;
};

/** Canonical E.164-ish value to persist. */
export const toE164 = (raw: string, countryCode: string, dialCode: string): string => {
  if (countryCode === "KE") return normalizeKenyanPhone(raw);
  const code = dialCode?.startsWith("+") ? dialCode : `+${digitsOnly(dialCode || "")}`;
  const codeDigits = digitsOnly(code);
  let d = digitsOnly(raw);
  if (codeDigits && d.startsWith(codeDigits)) d = d.slice(codeDigits.length);
  else if (d.startsWith("0")) d = d.slice(1);
  return `${code}${d}`;
};

export const isValidPhoneForCountry = (raw: string, countryCode: string, dialCode: string): boolean => {
  if (countryCode === "KE") return isValidKenyanPhone(raw);
  const national = toE164(raw, countryCode, dialCode).replace(/^\+\d{1,4}/, "");
  return national.length >= 6 && national.length <= 12;
};
