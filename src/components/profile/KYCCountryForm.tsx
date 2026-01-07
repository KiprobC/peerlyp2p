import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "@/components/country/CountrySelect";
import { useCountries, useCountryDetection } from "@/hooks/useCountries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Globe, FileText } from "lucide-react";

interface KYCCountryFormProps {
  formData: {
    kyc_country: string;
    id_type: string;
    id_number: string;
  };
  onChange: (data: Partial<{
    kyc_country: string;
    id_type: string;
    id_number: string;
  }>) => void;
}

// Country-specific ID types
const ID_TYPES_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  KE: [
    { value: "national_id", label: "National ID (Huduma Namba)" },
    { value: "passport", label: "Passport" },
    { value: "driving_license", label: "Driving License" },
  ],
  NG: [
    { value: "nin", label: "National Identification Number (NIN)" },
    { value: "voters_card", label: "Voter's Card" },
    { value: "passport", label: "International Passport" },
    { value: "driving_license", label: "Driver's License" },
  ],
  US: [
    { value: "ssn", label: "Social Security Number" },
    { value: "passport", label: "US Passport" },
    { value: "driving_license", label: "State Driver's License" },
    { value: "state_id", label: "State ID Card" },
  ],
  GB: [
    { value: "passport", label: "UK Passport" },
    { value: "driving_license", label: "UK Driving Licence" },
    { value: "biometric_residence", label: "Biometric Residence Permit" },
  ],
  GH: [
    { value: "ghana_card", label: "Ghana Card" },
    { value: "passport", label: "Passport" },
    { value: "voters_id", label: "Voter's ID" },
    { value: "driving_license", label: "Driver's License" },
  ],
  ZA: [
    { value: "national_id", label: "South African ID" },
    { value: "passport", label: "Passport" },
    { value: "driving_license", label: "Driver's License" },
  ],
  IN: [
    { value: "aadhaar", label: "Aadhaar Card" },
    { value: "pan", label: "PAN Card" },
    { value: "passport", label: "Passport" },
    { value: "driving_license", label: "Driving License" },
    { value: "voters_id", label: "Voter ID (EPIC)" },
  ],
  PH: [
    { value: "philsys", label: "Philippine ID (PhilSys)" },
    { value: "passport", label: "Philippine Passport" },
    { value: "driving_license", label: "Driver's License" },
    { value: "umid", label: "UMID Card" },
  ],
  DEFAULT: [
    { value: "national_id", label: "National ID" },
    { value: "passport", label: "Passport" },
    { value: "driving_license", label: "Driving License" },
  ],
};

export const KYCCountryForm = ({ formData, onChange }: KYCCountryFormProps) => {
  const { detectedCountry, loading: detectingCountry } = useCountryDetection();
  const { countries, getCountryByCode } = useCountries();
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Auto-select detected country if no country is set
  useEffect(() => {
    if (detectedCountry && !formData.kyc_country && !hasAutoSelected) {
      onChange({ kyc_country: detectedCountry });
      setHasAutoSelected(true);
    }
  }, [detectedCountry, formData.kyc_country, hasAutoSelected, onChange]);

  const selectedCountry = getCountryByCode(formData.kyc_country);
  const idTypes = ID_TYPES_BY_COUNTRY[formData.kyc_country] || ID_TYPES_BY_COUNTRY.DEFAULT;

  // Reset ID type when country changes
  const handleCountryChange = (countryCode: string) => {
    const newIdTypes = ID_TYPES_BY_COUNTRY[countryCode] || ID_TYPES_BY_COUNTRY.DEFAULT;
    onChange({
      kyc_country: countryCode,
      id_type: newIdTypes[0]?.value || "national_id",
    });
  };

  return (
    <div className="space-y-4">
      {/* Country Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          Country of Residence
        </Label>
        <CountrySelect
          value={formData.kyc_country}
          onValueChange={handleCountryChange}
          placeholder={detectingCountry ? "Detecting..." : "Select your country"}
        />
        {detectedCountry && formData.kyc_country === detectedCountry && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Auto-detected based on your location
          </p>
        )}
      </div>

      {/* ID Type Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          ID Type
        </Label>
        <Select
          value={formData.id_type}
          onValueChange={(value) => onChange({ id_type: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select ID type" />
          </SelectTrigger>
          <SelectContent>
            {idTypes.map((idType) => (
              <SelectItem key={idType.value} value={idType.value}>
                {idType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ID Number */}
      <div className="space-y-2">
        <Label>ID Number</Label>
        <Input
          value={formData.id_number}
          onChange={(e) => onChange({ id_number: e.target.value })}
          placeholder={getIdNumberPlaceholder(formData.kyc_country, formData.id_type)}
        />
      </div>

      {/* Country-specific info */}
      {selectedCountry && (
        <div className="p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">{selectedCountry.flag_emoji}</span>
            <span className="font-medium">{selectedCountry.name}</span>
            <span className="text-muted-foreground">
              • {selectedCountry.currency_code} ({selectedCountry.currency_symbol})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

function getIdNumberPlaceholder(countryCode: string, idType: string): string {
  const placeholders: Record<string, Record<string, string>> = {
    KE: {
      national_id: "e.g., 12345678",
      passport: "e.g., A1234567",
    },
    NG: {
      nin: "e.g., 12345678901",
      voters_card: "e.g., 1234567890123456789",
    },
    US: {
      ssn: "e.g., XXX-XX-XXXX",
      passport: "e.g., 123456789",
    },
    IN: {
      aadhaar: "e.g., 1234 5678 9012",
      pan: "e.g., ABCDE1234F",
    },
  };

  return placeholders[countryCode]?.[idType] || "Enter your ID number";
}

export default KYCCountryForm;
