import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [currentStep, setCurrentStep] = useState(profile?.setup_step || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);

  // Form data
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    date_of_birth: profile?.date_of_birth || "",
    city: profile?.city || "",
    address: profile?.address || "",
    id_type: profile?.id_type || "national_id",
    id_number: profile?.id_number || "",
    mpesa_phone: profile?.mpesa_phone || "",
    bank_name: profile?.bank_name || "",
    bank_account_name: profile?.bank_account_name || "",
    bank_account_number: profile?.bank_account_number || "",
  });

  const [idFrontUrl, setIdFrontUrl] = useState(profile?.id_front_url || "");
  const [idBackUrl, setIdBackUrl] = useState(profile?.id_back_url || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    type: "id_front" | "id_back" | "avatar"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    const bucket = type === "avatar" ? "avatars" : "kyc-documents";
    const url = await uploadFile(file, bucket, type);
    
    if (url) {
      if (type === "id_front") setIdFrontUrl(url);
      else if (type === "id_back") setIdBackUrl(url);
      else setAvatarUrl(url);
      toast.success("File uploaded successfully");
    } else {
      toast.error("Failed to upload file");
    }
    setIsSubmitting(false);
  };

  const saveStep = async () => {
    setIsSubmitting(true);

    let updates: Record<string, any> = { setup_step: currentStep + 1 };

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
        id_type: formData.id_type,
        id_number: formData.id_number,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        kyc_status: "submitted",
        kyc_submitted_at: new Date().toISOString(),
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
      <div className="glass border-b border-white/10 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">K</span>
            </div>
            <span className="font-bold text-xl text-foreground">
              Kenya<span className="text-primary">Coin</span>
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
                        placeholder="Nairobi"
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

            {/* Step 2: KYC Verification */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">KYC Verification</h2>
                  <p className="text-muted-foreground">Upload your ID for verification</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">ID Type</label>
                    <select
                      name="id_type"
                      value={formData.id_type}
                      onChange={handleChange}
                      className="w-full h-11 rounded-lg border border-border bg-secondary/50 px-4 text-foreground"
                    >
                      <option value="national_id">National ID</option>
                      <option value="passport">Passport</option>
                      <option value="driving_license">Driving License</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">ID Number</label>
                    <Input
                      name="id_number"
                      placeholder="Enter your ID number"
                      value={formData.id_number}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">ID Front</label>
                    <input
                      type="file"
                      ref={idFrontRef}
                      onChange={(e) => handleFileUpload(e, "id_front")}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => idFrontRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors ${
                        idFrontUrl ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      {idFrontUrl ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Check className="w-5 h-5" />
                          <span>Front uploaded</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-8 h-8" />
                          <span>Click to upload ID front</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">ID Back</label>
                    <input
                      type="file"
                      ref={idBackRef}
                      onChange={(e) => handleFileUpload(e, "id_back")}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => idBackRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors ${
                        idBackUrl ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      {idBackUrl ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Check className="w-5 h-5" />
                          <span>Back uploaded</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-8 h-8" />
                          <span>Click to upload ID back</span>
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
                    <h3 className="font-semibold text-primary mb-3">MPESA</h3>
                    <div>
                      <label className="block text-sm font-medium mb-2">MPESA Phone Number</label>
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
                  <p className="text-muted-foreground">Add a photo to complete your profile</p>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-32 h-32 rounded-full bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/70 transition-colors overflow-hidden border-4 border-primary/20"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, "avatar")}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    {avatarUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button variant="hero" onClick={saveStep} disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : currentStep === 4
                  ? "Complete Setup"
                  : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
