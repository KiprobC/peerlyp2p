import { Profile } from "@/hooks/useProfile";
import { User, Mail, Phone, MapPin, Calendar, CreditCard } from "lucide-react";

interface ProfileDetailsProps {
  profile: Profile | null;
}

export const ProfileDetails = ({ profile }: ProfileDetailsProps) => {
  const details = [
    { icon: User, label: "Full Name", value: profile?.full_name },
    { icon: Mail, label: "Email", value: profile?.email },
    { icon: Phone, label: "Phone", value: profile?.phone },
    { icon: MapPin, label: "Location", value: profile?.city ? `${profile.city}, ${profile.country}` : profile?.country },
    { icon: Calendar, label: "Date of Birth", value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : null },
    { icon: CreditCard, label: "M-PESA Phone", value: profile?.mpesa_phone },
  ];

  return (
    <div className="glass-card">
      <h3 className="font-semibold text-lg mb-4">Personal Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {details.map((detail, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
            <detail.icon className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{detail.label}</p>
              <p className="font-medium">{detail.value || "Not set"}</p>
            </div>
          </div>
        ))}
      </div>

      {profile?.bio && (
        <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Bio</p>
          <p>{profile.bio}</p>
        </div>
      )}
    </div>
  );
};
