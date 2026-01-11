import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, Globe, MapPin, Check, Info, TrendingUp } from "lucide-react";
import { StepProps } from "../types";
import { useCountries } from "@/hooks/useCountries";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Step3TargetMarket = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { countries, loading: countriesLoading } = useCountries();
  const { profile } = useProfile();
  
  const userCountry = profile?.country || profile?.kyc_country;
  const isGlobal = formData.visibility === "global";

  // Get demand indicator (mock - in production, fetch from analytics)
  const getDemandIndicator = (countryCode: string) => {
    const highDemand = ["KE", "NG", "GH", "ZA", "US"];
    const mediumDemand = ["GB", "IN", "PH", "VN"];
    if (highDemand.includes(countryCode)) return { label: "High Demand", color: "text-green-500", bg: "bg-green-500/10" };
    if (mediumDemand.includes(countryCode)) return { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500/10" };
    return null;
  };

  const toggleCountry = (countryCode: string) => {
    const current = formData.target_countries;
    if (current.includes(countryCode)) {
      updateFormData({ target_countries: current.filter(c => c !== countryCode) });
    } else {
      updateFormData({ target_countries: [...current, countryCode] });
    }
  };

  const handleVisibilityChange = (global: boolean) => {
    if (global) {
      updateFormData({ visibility: "global", target_countries: [] });
    } else {
      updateFormData({ 
        visibility: "country", 
        target_countries: userCountry ? [userCountry] : [] 
      });
    }
  };

  // Auto-select user's country on first load
  if (formData.target_countries.length === 0 && userCountry && !isGlobal) {
    updateFormData({ target_countries: [userCountry] });
  }

  const canProceed = isGlobal || formData.target_countries.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Target Market</h2>
        <p className="text-muted-foreground">
          Choose where your offer will be visible and who can trade with you
        </p>
      </div>

      {/* Visibility Toggle */}
      <div className="p-4 bg-secondary/50 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isGlobal ? "bg-blue-500/20" : "bg-primary/20"
            )}>
              {isGlobal ? (
                <Globe className="w-5 h-5 text-blue-500" />
              ) : (
                <MapPin className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">{isGlobal ? "Global Visibility" : "Country-Specific"}</p>
              <p className="text-sm text-muted-foreground">
                {isGlobal ? "Anyone worldwide can see your offer" : "Only traders in selected countries"}
              </p>
            </div>
          </div>
          <Switch
            checked={isGlobal}
            onCheckedChange={handleVisibilityChange}
          />
        </div>
      </div>

      {/* Country Selection */}
      {!isGlobal && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select Countries</Label>
          <p className="text-sm text-muted-foreground">
            Your offer will only be visible to traders in these countries
          </p>
          
          {countriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
              {countries.map((country) => {
                const isSelected = formData.target_countries.includes(country.code);
                const demand = getDemandIndicator(country.code);
                const isUserCountry = country.code === userCountry;
                
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggleCountry(country.code)}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3",
                      "hover:scale-[1.01] active:scale-[0.99]",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-2xl">{country.flag_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{country.name}</p>
                        {isUserCountry && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                            Your country
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {country.currency_symbol} {country.currency_code}
                      </p>
                    </div>
                    {demand && (
                      <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full", demand.bg, demand.color)}>
                        <TrendingUp className="w-3 h-3" />
                        {demand.label}
                      </div>
                    )}
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          {isGlobal ? (
            <p>Global offers reach more traders but may require currency conversions. Payment methods will be filtered based on trader locations.</p>
          ) : (
            <p>Country-specific offers ensure traders share the same currency and payment methods, reducing complexity.</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-12" disabled={!canProceed}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
