import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Camera, Save, Loader2, Lock, AtSign, AlertTriangle, Settings } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EditProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, loading } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    username: "",
    phone: "",
    bio: "",
    city: "",
    country: "Kenya",
    mpesa_phone: "",
  });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [usernameChanged, setUsernameChanged] = useState(false);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        city: profile.city || "",
        country: profile.country || "Kenya",
        mpesa_phone: profile.mpesa_phone || "",
      });
      setAvatarUrl(profile.avatar_url || "");
      setUsernameChanged(profile.username_changed || false);
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      await updateProfile({ avatar_url: publicUrl });
      toast.success("Profile photo updated");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Check if username is being changed for the first time
      const isChangingUsername = !usernameChanged && formData.username !== profile?.username;
      
      // Validate username format
      if (isChangingUsername) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(formData.username)) {
          toast.error("Username must be 3-20 characters, letters, numbers, and underscores only");
          setIsSubmitting(false);
          return;
        }

        // Check if username is already taken
        const { data: existingUser, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", formData.username)
          .neq("user_id", user?.id)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existingUser) {
          toast.error("Username is already taken");
          setIsSubmitting(false);
          return;
        }
      }

      const updateData = {
        ...formData,
        // Mark username as changed if it's being updated for the first time
        ...(isChangingUsername && { username_changed: true }),
      };

      const { error } = await updateProfile(updateData);
      if (error) throw error;
      
      if (isChangingUsername) {
        toast.success("Username updated! This was your one-time change.");
      } else {
        toast.success("Profile updated successfully");
      }
      navigate("/profile");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
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
              <h1 className="text-xl font-bold">Edit Profile</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-24">
        <div className="container mx-auto px-4 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Section */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="w-24 h-24 border-4 border-primary/20">
                    <AvatarImage src={avatarUrl} alt={profile?.full_name || "User"} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-medium">Upload a new photo</p>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Username Section - Special Card */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AtSign className="w-5 h-5 text-primary" />
                  Username (Wallet ID)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your username serves as your wallet address. Others can send crypto to you using this username.
                  </p>
                  {usernameChanged && (
                    <div className="flex items-center gap-2 text-amber-500 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Username has already been changed and cannot be edited again.</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="username">Username</Label>
                    {usernameChanged ? (
                      <Badge variant="secondary">Locked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500">
                        One-time edit
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="username"
                      disabled={usernameChanged}
                      className="pl-9"
                    />
                  </div>
                  {!usernameChanged && (
                    <p className="text-xs text-muted-foreground">
                      3-20 characters. Letters, numbers, and underscores only.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information (Read-only for name/email) */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Read-only fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Read-only
                      </Badge>
                    </div>
                    <Input
                      id="full_name"
                      value={profile?.full_name || ""}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email">Email</Label>
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Read-only
                      </Badge>
                    </div>
                    <Input
                      id="email"
                      value={profile?.email || user?.email || ""}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <Separator />

                {/* Editable fields */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Nairobi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Kenya"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mpesa_phone">M-PESA Phone</Label>
                  <Input
                    id="mpesa_phone"
                    name="mpesa_phone"
                    value={formData.mpesa_phone}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security Link - Redirect to Settings */}
            <Card className="border-muted">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Password & Security</p>
                      <p className="text-sm text-muted-foreground">
                        Manage password, 2FA, and security settings
                      </p>
                    </div>
                  </div>
                  <Link to="/settings">
                    <Button variant="outline" size="sm">
                      Go to Settings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EditProfile;
