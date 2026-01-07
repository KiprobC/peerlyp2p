import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KYCCountryForm } from "@/components/profile/KYCCountryForm";
import {
  User,
  CreditCard,
  Shield,
  Camera,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Phone,
  MapPin,
  Calendar,
  Building,
  FileImage,
} from "lucide-react";

const steps = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "KYC Verification", icon: Shield },
  { id: 3, title: "Payment Details", icon: CreditCard },
  { id: 4, title: "Profile Picture", icon: Camera },
];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, loading } = useProfile();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  // Form data
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    city: "",
    address: "",
    kyc_country: "",
    id_type: "",
    id_number: "",
    mpesa_phone: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
  });

  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [idBackUrl, setIdBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Populate form data from profile
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        date_of_birth: profile.date_of_birth || "",
        city: profile.city || "",
        address: profile.address || "",
        kyc_country: profile.kyc_country || "",
        id_type: profile.id_type || "",
        id_number: profile.id_number || "",
        mpesa_phone: profile.mpesa_phone || "",
        bank_name: profile.bank_name || "",
        bank_account_name: profile.bank_account_name || "",
        bank_account_number: profile.bank_account_number || "",
      });
      setIdFrontUrl(profile.id_front_url || "");
      setIdBackUrl(profile.id_back_url || "");
      setSelfieUrl(profile.selfie_url || "");
      setAvatarUrl(profile.avatar_url || "");
      if (profile.setup_step) {
        setCurrentStep(profile.setup_step);
      }
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKYCChange = useCallback((data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "id_front" | "id_back" | "selfie" | "avatar"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    const bucket = type === "avatar" ? "avatars" : "kyc-documents";
    const url = await uploadFile(file, bucket, type);
    
    if (url) {
      if (type === "id_front") setIdFrontUrl(url);
      else if (type === "id_back") setIdBackUrl(url);
      else if (type === "selfie") setSelfieUrl(url);
      else setAvatarUrl(url);
      toast.success("File uploaded successfully");
    } else {
      toast.error("Failed to upload file");
    }
    setIsSubmitting(false);
  };

  const saveStep = async () => {
    setIsSubmitting(true);

    let updates: Record<string, unknown> = { setup_step: currentStep + 1 };

    if (currentStep === 1) {
      updates = {
        ...updates,
        full_name: formData.full_name,
        phone: formData.phone,
        date_of_birth: formData.date_of_birth || null,
        city: formData.city,
        address: formData.address,
      };
    } else if (currentStep === 2) {
      updates = {
        ...updates,
        kyc_country: formData.kyc_country,
        id_type: formData.id_type,
        id_number: formData.id_number,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl,
        kyc_status: idFrontUrl && selfieUrl ? "submitted" : "pending",
        kyc_submitted_at: idFrontUrl && selfieUrl ? new Date().toISOString() : null,
      };
    } else if (currentStep === 3) {
      updates = {
        ...updates,
        mpesa_phone: formData.mpesa_phone,
        bank_name: formData.bank_name,
        bank_account_name: formData.bank_account_name,
        bank_account_number: formData.bank_account_number,
      };
    } else if (currentStep === 4) {
      updates = {
        ...updates,
        avatar_url: avatarUrl,
        setup_completed: true,
      };
    }

    const { error } = await updateProfile(updates);
    
    if (error) {
      toast.error("Failed to save. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (currentStep === 4) {
      toast.success("Profile setup complete!");
      navigate("/dashboard");
    } else {
      setCurrentStep(currentStep + 1);
    }
    
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b border-border py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <span className="font-bold text-xl text-foreground">
              Peer<span className="text-primary">ly</span>
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs mt-2 text-center hidden sm:block">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 sm:w-24 h-1 mx-2 rounded ${
                      currentStep > step.id ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-xl mx-auto">
          <div className="glass-card">
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Personal Information</h2>
                  <p className="text-muted-foreground">Tell us a bit about yourself</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        name="full_name"
                        placeholder="Enter your full name"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        name="phone"
                        placeholder="+254 7XX XXX XXX"
                        value={formData.phone}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        name="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        name="city"
                        placeholder="Your city"
                        value={formData.city}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <Input
                      name="address"
                      placeholder="Your address"
                      value={formData.address}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: KYC Verification with Country-Aware Form */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">KYC Verification</h2>
                  <p className="text-muted-foreground">Verify your identity for secure trading</p>
                </div>

                {/* Country-aware KYC Form */}
                <KYCCountryForm
                  formData={{
                    kyc_country: formData.kyc_country,
                    id_type: formData.id_type,
                    id_number: formData.id_number,
                  }}
                  onChange={handleKYCChange}
                />

                {/* Document Uploads */}
                <div className="space-y-4 pt-4 border-t">
                  <label className="block text-sm font-medium">Upload Documents</label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* ID Front */}
                    <div>
                      <input
                        type="file"
                        ref={idFrontRef}
                        onChange={(e) => handleFileUpload(e, "id_front")}
                        accept="image/*"
                        className="hidden"
                      />
                      <div
                        onClick={() => idFrontRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors ${
                          idFrontUrl ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        {idFrontUrl ? (
                          <div className="flex flex-col items-center gap-2 text-primary">
                            <Check className="w-6 h-6" />
                            <span className="text-xs">Front uploaded</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileImage className="w-6 h-6" />
                            <span className="text-xs">ID Front</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ID Back */}
                    <div>
                      <input
                        type="file"
                        ref={idBackRef}
                        onChange={(e) => handleFileUpload(e, "id_back")}
                        accept="image/*"
                        className="hidden"
                      />
                      <div
                        onClick={() => idBackRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors ${
                          idBackUrl ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        {idBackUrl ? (
                          <div className="flex flex-col items-center gap-2 text-primary">
                            <Check className="w-6 h-6" />
                            <span className="text-xs">Back uploaded</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileImage className="w-6 h-6" />
                            <span className="text-xs">ID Back</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selfie with ID */}
                  <div>
                    <input
                      type="file"
                      ref={selfieRef}
                      onChange={(e) => handleFileUpload(e, "selfie")}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => selfieRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors ${
                        selfieUrl ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      {selfieUrl ? (
                        <div className="flex flex-col items-center gap-2 text-primary">
                          <Check className="w-8 h-8" />
                          <span className="text-sm">Selfie uploaded</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Camera className="w-8 h-8" />
                          <span className="text-sm">Selfie with ID</span>
                          <span className="text-xs">Hold your ID next to your face</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Payment Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Payment Details</h2>
                  <p className="text-muted-foreground">Add your payment methods for trading</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <h3 className="font-semibold text-primary mb-3">M-PESA</h3>
                    <div>
                      <label className="block text-sm font-medium mb-2">M-PESA Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          name="mpesa_phone"
                          placeholder="+254 7XX XXX XXX"
                          value={formData.mpesa_phone}
                          onChange={handleChange}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary rounded-lg">
                    <h3 className="font-semibold mb-3">Bank Transfer (Optional)</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank Name</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            name="bank_name"
                            placeholder="e.g., Equity Bank"
                            value={formData.bank_name}
                            onChange={handleChange}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Name</label>
                        <Input
                          name="bank_account_name"
                          placeholder="Account holder name"
                          value={formData.bank_account_name}
                          onChange={handleChange}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Number</label>
                        <Input
                          name="bank_account_number"
                          placeholder="Your account number"
                          value={formData.bank_account_number}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Profile Picture */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Profile Picture</h2>
                  <p className="text-muted-foreground">Add a photo to personalize your profile</p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, "avatar")}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors ${
                    avatarUrl ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  {avatarUrl ? (
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover"
                      />
                      <span className="text-primary">Click to change photo</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <Upload className="w-12 h-12" />
                      <div>
                        <p className="font-medium">Click to upload a photo</p>
                        <p className="text-sm">JPG, PNG up to 5MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 mt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={saveStep} disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-foreground" />
                ) : currentStep === 4 ? (
                  <>
                    Complete Setup
                    <Check className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
