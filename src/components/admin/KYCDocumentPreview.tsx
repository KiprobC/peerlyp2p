import { useState } from "react";
import { isKycPdf } from "@/lib/kycDocuments";

export const KYCDocumentPreview = ({
  url,
  sourcePath,
  label,
  className = "h-40",
}: {
  url: string | null;
  sourcePath?: string | null;
  label: string;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center rounded bg-muted text-xs text-muted-foreground ${className}`}>
        Not available
      </div>
    );
  }

  if (isKycPdf(sourcePath || url)) {
    return <iframe title={label} src={url} className={`w-full rounded border-0 ${className}`} />;
  }

  return (
    <img
      src={url}
      alt={label}
      className={`w-full rounded object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
};
