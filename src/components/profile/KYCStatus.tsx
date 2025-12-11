import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Shield, ShieldCheck, ShieldX, Clock, FileText, Camera, Upload, ArrowRight } from "lucide-react";
import { Profile } from "@/hooks/useProfile";
import { Link } from "react-router-dom";

interface KYCStatusProps {
  profile: Profile | null;
}

const kycStatusConfig = {
  pending: { 
    label: "Not Submitted", 
    icon: Shield, 
    variant: "secondary" as const, 
    color: "bg-muted",
    description: "Complete your KYC verification to unlock all features",
    progress: 0 
  },
  submitted: { 
    label: "Under Review", 
    icon: Clock, 
    variant: "outline" as const, 
    color: "bg-warning/20",
    description: "Your documents are being reviewed. This usually takes 24-48 hours.",
    progress: 50 
  },
  verified: { 
    label: "Verified", 
    icon: ShieldCheck, 
    variant: "default" as const, 
    color: "bg-primary/20",
    description: "Your identity has been verified. You have full access to all features.",
    progress: 100 
  },
  rejected: { 
    label: "Rejected", 
    icon: ShieldX, 
    variant: "destructive" as const, 
    color: "bg-destructive/20",
    description: "Your verification was rejected. Please submit new documents.",
    progress: 0 
  },
};

export const KYCStatus = ({ profile }: KYCStatusProps) => {
  const kycStatus = profile?.kyc_status || "pending";
  const statusConfig = kycStatusConfig[kycStatus];
  const StatusIcon = statusConfig.icon;

  const documents = [
    { 
      name: "ID Front", 
      icon: FileText, 
      uploaded: !!profile?.id_front_url,
      required: true 
    },
    { 
      name: "ID Back", 
      icon: FileText, 
      uploaded: !!profile?.id_back_url,
      required: true 
    },
    { 
      name: "Selfie", 
      icon: Camera, 
      uploaded: !!profile?.selfie_url,
      required: true 
    },
  ];

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">KYC Verification</h3>
        <Badge variant={statusConfig.variant} className="flex items-center gap-1">
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </Badge>
      </div>

      <div className={`p-4 rounded-lg ${statusConfig.color} mb-4`}>
        <p className="text-sm">{statusConfig.description}</p>
      </div>

      {kycStatus !== "verified" && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{statusConfig.progress}%</span>
            </div>
            <Progress value={statusConfig.progress} className="h-2" />
          </div>

          <div className="space-y-2 mb-4">
            {documents.map((doc) => (
              <div 
                key={doc.name}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <doc.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{doc.name}</span>
                  {doc.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                </div>
                <Badge variant={doc.uploaded ? "default" : "secondary"}>
                  {doc.uploaded ? "Uploaded" : "Missing"}
                </Badge>
              </div>
            ))}
          </div>

          <Link to="/profile/kyc">
            <Button className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              {kycStatus === "pending" ? "Start Verification" : "Update Documents"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </>
      )}

      {kycStatus === "verified" && profile?.kyc_verified_at && (
        <p className="text-sm text-muted-foreground">
          Verified on {new Date(profile.kyc_verified_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
