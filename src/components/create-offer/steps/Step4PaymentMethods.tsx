import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Check, Clock, Camera, FileText, AlertTriangle } from "lucide-react";
import { StepProps } from "../types";
import { usePaymentMethods } from "@/hooks/useCountries";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROOF_OPTIONS = [
  { id: "receipt", label: "Payment Receipt", icon: FileText },
  { id: "screenshot", label: "Screenshot", icon: Camera },
  { id: "reference", label: "Reference Number", icon: FileText },
];

const TIME_OPTIONS = [
  { value: "15", label: "15 minutes", description: "Quick trades" },
  { value: "30", label: "30 minutes", description: "Standard" },
  { value: "45", label: "45 minutes", description: "More flexibility" },
  { value: "60", label: "60 minutes", description: "Maximum time" },
];

export const Step4PaymentMethods = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { profile } = useProfile();
  const userCountry = profile?.country || profile?.kyc_country;
  
  // Get payment methods for user's country or first target country
  const targetCountry = formData.target_countries[0] || userCountry || "";
  const { paymentMethods, loading: methodsLoading } = usePaymentMethods(targetCountry);

  const toggleMethod = (methodName: string) => {
    const current = formData.payment_methods;
    if (current.includes(methodName)) {
      updateFormData({ payment_methods: current.filter(m => m !== methodName) });
    } else {
      updateFormData({ payment_methods: [...current, methodName] });
    }
  };

  const toggleProof = (proofId: string) => {
    const current = formData.proof_required;
    if (current.includes(proofId)) {
      updateFormData({ proof_required: current.filter(p => p !== proofId) });
    } else {
      updateFormData({ proof_required: [...current, proofId] });
    }
  };

  const canProceed = formData.payment_methods.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Payment Methods</h2>
        <p className="text-muted-foreground">
          Select how you want to {formData.type === "sell" ? "receive" : "send"} payments
        </p>
      </div>

      {/* Payment Methods Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Accepted Payment Methods
          <span className="text-destructive ml-1">*</span>
        </Label>
        
        {methodsLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">No payment methods available</p>
              <p className="text-sm text-muted-foreground">
                Please select a target country first or check if payment methods are configured.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => {
              const isSelected = formData.payment_methods.includes(method.name);
              
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => toggleMethod(method.name)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left relative",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <p className="font-medium text-sm">{method.display_name}</p>
                  {method.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {method.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {formData.payment_methods.length === 0 && !methodsLoading && paymentMethods.length > 0 && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Select at least one payment method
          </p>
        )}
      </div>

      {/* Payment Window */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Payment Window</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          How long the buyer has to complete payment
        </p>
        <Select
          value={formData.payment_window}
          onValueChange={(value) => updateFormData({ payment_window: value })}
        >
          <SelectTrigger className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-sm">— {option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Proof Required (Optional) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Proof Required (Optional)</Label>
        <p className="text-sm text-muted-foreground">
          What should traders provide as payment confirmation?
        </p>
        <div className="flex flex-wrap gap-2">
          {PROOF_OPTIONS.map((proof) => {
            const isSelected = formData.proof_required.includes(proof.id);
            const Icon = proof.icon;
            
            return (
              <button
                key={proof.id}
                type="button"
                onClick={() => toggleProof(proof.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{proof.label}</span>
                {isSelected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
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
