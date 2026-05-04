import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock,
  Shield,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const kycStatusConfig = {
  pending: { 
    label: "Not Submitted", 
    icon: Shield, 
    variant: "secondary" as const,
    color: "text-muted-foreground"
  },
  submitted: { 
    label: "Under Review", 
    icon: Clock, 
    variant: "outline" as const,
    color: "text-warning"
  },
  verified: { 
    label: "Verified", 
    icon: CheckCircle, 
    variant: "default" as const,
    color: "text-primary"
  },
  rejected: { 
    label: "Rejected", 
    icon: XCircle, 
    variant: "destructive" as const,
    color: "text-destructive"
  },
};

const KYCUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, loading } = useProfile();
  
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const kycStatus = profile?.kyc_status || "pending";
  const statusConfig = kycStatusConfig[kycStatus];

  const documents = [
    {
      id: "id_front",
      name: "ID Front",
      description: "Front side of your National ID or Passport",
      icon: FileText,
      ref: idFrontRef,
      url: profile?.id_front_url,
      field: "id_front_url" as const,
    },
    {
      id: "id_back",
      name: "ID Back",
      description: "Back side of your National ID",
      icon: FileText,
      ref: idBackRef,
      url: profile?.id_back_url,
      field: "id_back_url" as const,
    },
    {
      id: "selfie",
      name: "Selfie with ID",
      description: "A clear selfie holding your ID next to your face",
      icon: Camera,
      ref: selfieRef,
      url: profile?.selfie_url,
      field: "selfie_url" as const,
    },
  ];

  const uploadedCount = documents.filter((d) => d.url).length;
  const progress = (uploadedCount / documents.length) * 100;

  const handleFileUpload = async (
    file: File,
    docId: string,
    field: "id_front_url" | "id_back_url" | "selfie_url"
  ) => {
    if (!user) return;

    setUploading((prev) => ({ ...prev, [docId]: true }));
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${docId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the storage URL (not public for KYC docs)
      const url = `${user.id}/${docId}.${fileExt}`;

      await updateProfile({ [field]: url });
      toast.success(`${docId.replace("_", " ")} uploaded successfully`);
    } catch (error: any) {
      console.error("Error uploading:", error);
      toast.error(`Failed to upload ${docId.replace("_", " ")}`);
    } finally {
      setUploading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleSubmitKYC = async () => {
    if (uploadedCount < documents.length) {
      toast.error("Please upload all required documents");
      return;
    }
    if (!user || !profile) return;

    setIsSubmitting(true);
    try {
      await updateProfile({
        kyc_status: "submitted",
        kyc_submitted_at: new Date().toISOString(),
      });

      // Create a submission record
      const { data: sub, error: subErr } = await (supabase as any)
        .from("kyc_submissions")
        .insert({
          user_id: user.id,
          country_code: profile.kyc_country || profile.country,
          id_type: profile.id_type,
          id_number: profile.id_number,
          full_name: profile.full_name,
          date_of_birth: profile.date_of_birth,
          id_front_url: profile.id_front_url,
          id_back_url: profile.id_back_url,
          selfie_url: profile.selfie_url,
          status: "pending",
        })
        .select()
        .single();

      if (subErr) throw subErr;

      toast.info("Bot is reviewing your documents…");

      const { data: result, error: fnErr } = await supabase.functions.invoke("kyc-auto-verify", {
        body: { submission_id: sub.id },
      });

      if (fnErr) throw fnErr;

      const status = (result as any)?.status;
      if (status === "auto_approved") {
        toast.success("Identity verified automatically!");
      } else if (status === "auto_rejected") {
        const reason = (result as any)?.reason;
        toast.error(
          reason === "document_reused"
            ? "These documents are already linked to another account."
            : "Verification failed. Please upload clear, valid documents."
        );
      } else {
        toast.success("Submitted for manual review (24–48h).");
      }
      navigate("/profile");
    } catch (error) {
      console.error("Error submitting KYC:", error);
      toast.error("Failed to submit KYC");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">KYC Verification</h1>
            </div>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <statusConfig.icon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {/* Status Card */}
          {kycStatus === "verified" ? (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primary">Identity Verified</h2>
                    <p className="text-muted-foreground">
                      Your identity has been verified. You have full access to all platform features.
                    </p>
                    {profile?.kyc_verified_at && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Verified on {new Date(profile.kyc_verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : kycStatus === "submitted" ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-warning/20 rounded-full">
                    <Clock className="w-8 h-8 text-warning" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Under Review</h2>
                    <p className="text-muted-foreground">
                      Your documents are being reviewed. This usually takes 24-48 hours.
                      We'll notify you once the review is complete.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : kycStatus === "rejected" ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-destructive/20 rounded-full">
                    <XCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-destructive">Verification Rejected</h2>
                    <p className="text-muted-foreground">
                      Your documents were rejected. Please upload new documents and try again.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Progress */}
          {kycStatus !== "verified" && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Progress</CardTitle>
                <CardDescription>
                  Upload all required documents to complete verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {uploadedCount} of {documents.length} documents uploaded
                  </span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {kycStatus !== "verified" && (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${doc.url ? "bg-primary/20" : "bg-secondary"}`}>
                          <doc.icon className={`w-6 h-6 ${doc.url ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{doc.name}</h3>
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                          {doc.url && (
                            <Badge variant="default" className="mt-2">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Uploaded
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <input
                          ref={doc.ref}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, doc.id, doc.field);
                          }}
                        />
                        <Button
                          variant={doc.url ? "outline" : "default"}
                          size="sm"
                          onClick={() => doc.ref.current?.click()}
                          disabled={uploading[doc.id] || kycStatus === "submitted"}
                        >
                          {uploading[doc.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          {doc.url ? "Replace" : "Upload"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Guidelines */}
          {kycStatus !== "verified" && kycStatus !== "submitted" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Upload Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Make sure all text on your ID is clearly visible</li>
                  <li>• Use good lighting and avoid glare</li>
                  <li>• For the selfie, hold your ID next to your face</li>
                  <li>• Supported formats: JPG, PNG, GIF (max 5MB)</li>
                  <li>• All documents must be valid and not expired</li>
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          {kycStatus !== "verified" && kycStatus !== "submitted" && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmitKYC}
              disabled={uploadedCount < documents.length || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Submit for Verification
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default KYCUpload;
