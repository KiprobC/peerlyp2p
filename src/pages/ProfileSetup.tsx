import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KYCCountryForm } from "@/components/profile/KYCCountryForm";
import peerlyLogo from "@/assets/peerly-logo.png";
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

type FormErrors = Record<string, string>;

const isValidAdultDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));
  if (
    selected.getUTCFullYear() !== year ||
    selected.getUTCMonth() !== month - 1 ||
    selected.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedUtc = selected.getTime();
  if (selectedUtc >= todayUtc) return false;

  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() > month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 18;
};

const isValidPhone = (value: string): boolean => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return /^[+\d\s().-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15;
};

const getDateInputMax = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

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
  const [errors, setErrors] = useState<FormErrors>({});

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
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[e.target.name];
      return next;
    });
  };

  const handleKYCChange = useCallback((data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(data).forEach(key => delete next[key]);
      return next;
    });
  }, []);

  const validatePersonalInfo = (): FormErrors => {
    const next: FormErrors = {};
    if (formData.full_name.trim().length < 2) next.full_name = "Enter your full name.";
    if (!isValidPhone(formData.phone)) next.phone = "Enter a valid phone number.";
    if (!formData.date_of_birth) {
      next.date_of_birth = "Date of birth is required.";
    } else if (!isValidAdultDate(formData.date_of_birth)) {
      next.date_of_birth = "Enter a valid past date. You must be at least 18 years old.";
    }
    if (!formData.city.trim()) next.city = "City is required.";
    if (!formData.address.trim()) next.address = "Address is required.";
    return next;
  };

  const validateKYC = (): FormErrors => {
    const next: FormErrors = {};
    if (!formData.kyc_country) next.kyc_country = "Select your country of residence.";
    if (!formData.id_type) next.id_type = "Select an ID type.";
    if (formData.id_number.trim().length < 4) next.id_number = "Enter a valid ID number.";
    if (!idFrontUrl) next.id_front = "Upload the front of your ID.";
    if (!idBackUrl) next.id_back = "Upload the back of your ID.";
    if (!selfieUrl) next.selfie = "Upload a selfie with your ID.";
    if (!isValidAdultDate(formData.date_of_birth)) {
      next.date_of_birth = "You must be at least 18 years old to complete verification.";
    }
    return next;
  };

  const validatePayment = (): FormErrors => {
    const next: FormErrors = {};
    if (!isValidPhone(formData.mpesa_phone)) next.mpesa_phone = "Enter a valid M-PESA phone number.";
    if (!formData.bank_name.trim()) next.bank_name = "Bank name is required.";
    if (!formData.bank_account_name.trim()) next.bank_account_name = "Account name is required.";
    if (formData.bank_account_number.trim().length < 4) {
      next.bank_account_number = "Enter a valid account number.";
    }
    return next;
  };

  const validateStep = (step: number): FormErrors => {
    if (step === 1) return validatePersonalInfo();
    if (step === 2) return { ...validateKYC() };
    if (step === 3) return validatePayment();
    return {
      ...validatePersonalInfo(),
      ...validateKYC(),
      ...validatePayment(),
      ...(!avatarUrl ? { avatar: "Upload a profile picture." } : {}),
    };
  };

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

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        [type === "avatar" ? "avatar" : type]: "Choose an image file no larger than 5MB.",
      }));
      return;
    }

    setIsSubmitting(true);
    const bucket = type === "avatar" ? "avatars" : "kyc-documents";
    const url = await uploadFile(file, bucket, type);
    
    if (url) {
      if (type === "id_front") setIdFrontUrl(url);
      else if (type === "id_back") setIdBackUrl(url);
      else if (type === "selfie") setSelfieUrl(url);
      else setAvatarUrl(url);
      setErrors(prev => {
        const next = { ...prev };
        delete next[type === "avatar" ? "avatar" : type];
        return next;
      });
      toast.success("File uploaded successfully");
    } else {
      toast.error("Failed to upload file");
    }
    setIsSubmitting(false);
  };

  const saveStep = async () => {
    const validationErrors = validateStep(currentStep);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the highlighted fields before continuing.");
      return;
    }

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
        kyc_status: idFrontUrl && idBackUrl && selfieUrl ? "submitted" : "pending",
        kyc_submitted_at: idFrontUrl && idBackUrl && selfieUrl ? new Date().toISOString() : null,
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
              <img src={peerlyLogo} alt="Peerly" className="h-8 w-auto" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 xl:max-w-none peerly-desktop-page py-8">
        {/* Progress Steps */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="hidden sm:flex items-center justify-between">
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
          <div className="grid grid-cols-4 gap-1 sm:hidden">
            {steps.map((step) => (
              <div key={step.id} className="min-w-0 flex flex-col items-center text-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    currentStep >= step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                </div>
                <span className="text-[10px] leading-tight mt-1 break-words">{step.title}</span>
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
                    {errors.full_name && <p className="mt-1 text-xs text-destructive">{errors.full_name}</p>}
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
                    {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        name="date_of_birth"
                        type="date"
                        max={getDateInputMax()}
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                    {errors.date_of_birth && <p className="mt-1 text-xs text-destructive">{errors.date_of_birth}</p>}
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
                    {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <Input
                      name="address"
                      placeholder="Your address"
                      value={formData.address}
                      onChange={handleChange}
                    />
                    {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address}</p>}
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
                  errors={errors}
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
                      {errors.id_front && <p className="mt-1 text-xs text-destructive">{errors.id_front}</p>}
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
                      {errors.id_back && <p className="mt-1 text-xs text-destructive">{errors.id_back}</p>}
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
                    {errors.selfie && <p className="mt-1 text-xs text-destructive">{errors.selfie}</p>}
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
                      {errors.mpesa_phone && <p className="mt-1 text-xs text-destructive">{errors.mpesa_phone}</p>}
                    </div>
                  </div>

                  <div className="p-4 bg-secondary rounded-lg">
                    <h3 className="font-semibold mb-3">Bank Transfer</h3>
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
                        {errors.bank_name && <p className="mt-1 text-xs text-destructive">{errors.bank_name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Name</label>
                        <Input
                          name="bank_account_name"
                          placeholder="Account holder name"
                          value={formData.bank_account_name}
                          onChange={handleChange}
                        />
                        {errors.bank_account_name && <p className="mt-1 text-xs text-destructive">{errors.bank_account_name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Account Number</label>
                        <Input
                          name="bank_account_number"
                          placeholder="Your account number"
                          value={formData.bank_account_number}
                          onChange={handleChange}
                        />
                        {errors.bank_account_number && <p className="mt-1 text-xs text-destructive">{errors.bank_account_number}</p>}
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
                {errors.avatar && <p className="text-xs text-destructive">{errors.avatar}</p>}
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
