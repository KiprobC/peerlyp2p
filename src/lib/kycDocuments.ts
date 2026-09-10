import { supabase } from "@/integrations/supabase/client";

export const KYC_DOCUMENT_BUCKET = "kyc-documents";

export function normalizeKycDocumentPath(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const objectPath = url.pathname.slice(markerIndex + marker.length);
      const bucketPrefix = `${KYC_DOCUMENT_BUCKET}/`;
      const bucketIndex = objectPath.indexOf(bucketPrefix);
      if (bucketIndex >= 0) return decodeURIComponent(objectPath.slice(bucketIndex + bucketPrefix.length));
    }
  } catch {
    // Stored values are normally paths; URL parsing is only for legacy metadata.
  }

  const bucketPrefix = `${KYC_DOCUMENT_BUCKET}/`;
  return value.startsWith(bucketPrefix) ? value.slice(bucketPrefix.length) : value;
}

export function isKycPdf(value: string | null | undefined): boolean {
  const path = normalizeKycDocumentPath(value);
  return !!path && path.toLowerCase().split("?")[0].endsWith(".pdf");
}

export async function createKycDocumentSignedUrl(value: string | null | undefined) {
  const path = normalizeKycDocumentPath(value);
  if (!path) return { url: null, error: null };

  const { data, error } = await supabase.storage
    .from(KYC_DOCUMENT_BUCKET)
    .createSignedUrl(path, 3600);
  return { url: data?.signedUrl ?? null, error };
}
