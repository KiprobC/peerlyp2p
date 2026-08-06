import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertCircle,
  Phone,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useCountries, useCountryDetection } from "@/hooks/useCountries";
import { KYCCountryForm } from "@/components/profile/KYCCountryForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  formatPhoneForCountry,
  isValidPhoneForCountry,
  toE164,
} from "@/lib/phoneFormat";

const kycStatusConfig = {
  pending: {
    label: "Not Submitted",
    icon: Shield,
    variant: "secondary" as const,
  },
  submitted: {
    label: "Under Review",
    icon: Clock,
    variant: "outline" as const,
  },
  verified: {
    label: "Verified",
    icon: CheckCircle,
    variant: "default" as const,
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    variant: "destructive" as const,
  },
};

const KYCUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, loading } = useProfile();
  const { getCountryByCode } = useCountries();
  const { detectedCountry } = useCountryDetection();

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [identity, setIdentity] = useState({
    kyc_country: "",
    id_type: "",
    id_number: "",
  });
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const kycStatus = profile?.kyc_status || "pending";
  const statusConfig = kycStatusConfig[kycStatus];

  // Seed the form from the profile once it loads
  useEffect(() => {
    if (!profile) return;
    setIdentity((prev) => ({
      kyc_country: prev.kyc_country || profile.kyc_country || profile.country || "",
      id_type: prev.id_type || profile.id_type || "",
      id_number: prev.id_number || profile.id_number || "",
    }));
    setFullName((prev) => prev || profile.full_name || "");
    setDob((prev) => prev || (profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ""));
    setPhone((prev) => prev || profile.phone || "");
  }, [profile]);

  // Auto-select the detected country when nothing is set yet (user can override)
  useEffect(() => {
    if (detectedCountry && !identity.kyc_country) {
      setIdentity((prev) => (prev.kyc_country ? prev : { ...prev, kyc_country: detectedCountry }));
    }
  }, [detectedCountry, identity.kyc_country]);

  const country = getCountryByCode(identity.kyc_country);
  const dialCode = country?.phone_code || "";

  // Prefill / reformat the phone whenever the country changes
  useEffect(() => {
    if (!identity.kyc_country || !dialCode) return;
    setPhone((prev) => formatPhoneForCountry(prev || "", identity.kyc_country, dialCode));
  }, [identity.kyc_country, dialCode]);

  const documents = [
    {
      id: "id_front",
      name: "ID Front",
      description: "Front side of your National ID or Passport",
      icon: FileText,
      ref: idFrontRef,
      url: profile?.id_front_url,
      field: "id_front_url" as const,
      required: true,
    },
    {
      id: "id_back",
      name: "ID Back",
      description: "Back side of your National ID",
      icon: FileText,
      ref: idBackRef,
      url: profile?.id_back_url,
      field: "id_back_url" as const,
      required: true,
    },
    {
      id: "selfie",
      name: "Selfie with ID",
      description: "A clear selfie holding your ID next to your face",
      icon: Camera,
      ref: selfieRef,
      url: profile?.selfie_url,
      field: "selfie_url" as const,
      required: true,
    },
  ];

  const uploadedCount = documents.filter((d) => d.url).length;
  const progress = (uploadedCount / documents.length) * 100;

  const phoneValid = useMemo(
    () => (phone ? isValidPhoneForCountry(phone, identity.kyc_country, dialCode) : false),
    [phone, identity.kyc_country, dialCode]
  );

  const detailsComplete =
    !!identity.kyc_country &&
    !!identity.id_type &&
    identity.id_number.trim().length >= 4 &&
    fullName.trim().length >= 3 &&
    !!dob &&
    phoneValid;

  const handleFileUpload = async (
    file: File,
    docId: string,
    field: "id_front_url" | "id_back_url" | "selfie_url"
  ) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    setUploading((prev) => ({ ...prev, [docId]: true }));
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${docId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      await updateProfile({ [field]: fileName });
      toast.success(`${docId.replace("_", " ")} uploaded successfully`);
    } catch (error) {
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
    if (!detailsComplete) {
      toast.error("Please complete all verification details first");
      return;
    }
    if (!user || !profile) return;

    setIsSubmitting(true);
    let submissionId: string | undefined;

    try {
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc("submit_kyc_application", {
        p_country_code: identity.kyc_country,
        p_id_type: identity.id_type,
        p_id_number: identity.id_number.trim(),
        p_full_name: fullName.trim(),
        p_date_of_birth: dob,
        p_id_front_url: profile.id_front_url,
        p_id_back_url: profile.id_back_url,
        p_selfie_url: profile.selfie_url,
        p_phone: toE164(phone, identity.kyc_country, dialCode),
      });

      if (rpcErr) {
        const msg = rpcErr.message || "";
        if (msg.includes("COOLDOWN_ACTIVE")) {
          toast.error("Please wait a few minutes before resubmitting your documents.");
        } else if (msg.includes("SUBMISSION_IN_PROGRESS")) {
          toast.error("You already have a verification under review.");
        } else if (msg.includes("ALREADY_VERIFIED")) {
          toast.error("Your account is already verified.");
        } else if (msg.includes("MISSING_FIELDS")) {
          toast.error("Some verification details are missing. Please review the form.");
        } else {
          toast.error("Failed to submit verification");
        }
        throw rpcErr;
      }

      submissionId = (rpcData as any)?.submission_id;
      toast.info("Reviewing your documents…");

      const { data: result, error: fnErr } = await supabase.functions.invoke("kyc-auto-verify", {
        body: { submission_id: submissionId },
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

      // Never leave a submission stuck: hand it to manual review and alert admins.
      if (submissionId) {
        await (supabase as any).rpc("kyc_job_failed", {
          p_submission_id: submissionId,
          p_error: error instanceof Error ? error.message : "client_invoke_failed",
        });
        toast.message("Sent for manual review", {
          description: "Automatic checks were unavailable. Our team will review your documents.",
        });
        navigate("/profile");
      }
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

  const editable = kycStatus !== "verified" && kycStatus !== "submitted";

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Identity Verification</h1>
            </div>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <statusConfig.icon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {/* Status */}
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
                      Your documents are being reviewed. We'll notify you once the review is complete.
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
                      Your documents were rejected. Please review your details, upload new documents
                      and try again.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Step 1 — Verification details */}
          {editable && (
            <Card>
              <CardHeader>
                <CardTitle>Your details</CardTitle>
                <CardDescription>
                  These must match exactly what appears on your identity document.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <KYCCountryForm
                  formData={identity}
                  onChange={(patch) => setIdentity((prev) => ({ ...prev, ...patch }))}
                />

                <div className="space-y-2">
                  <Label>Full Name (as on document)</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Jane Achieng Otieno"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    Phone Number
                  </Label>
                  <Input
                    inputMode="tel"
                    value={phone}
                    onBlur={() => setPhoneTouched(true)}
                    onChange={(e) =>
                      setPhone(formatPhoneForCountry(e.target.value, identity.kyc_country, dialCode))
                    }
                    placeholder={
                      identity.kyc_country === "KE" ? "+254 712 345 678" : `${dialCode || "+"} …`
                    }
                  />
                  {phoneTouched && phone && !phoneValid && (
                    <p className="text-xs text-destructive">
                      {identity.kyc_country === "KE"
                        ? "Enter a valid Kenyan mobile number (e.g. 0712 345 678)."
                        : "Enter a valid phone number for the selected country."}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2 — Documents */}
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

          {kycStatus !== "verified" && (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${doc.url ? "bg-primary/20" : "bg-secondary"}`}>
                          <doc.icon
                            className={`w-6 h-6 ${doc.url ? "text-primary" : "text-muted-foreground"}`}
                          />
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

          {editable && (
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

          {editable && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmitKYC}
              disabled={uploadedCount < documents.length || !detailsComplete || isSubmitting}
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
