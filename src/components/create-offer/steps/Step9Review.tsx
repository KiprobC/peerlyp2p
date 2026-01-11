import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Edit2 } from "lucide-react";
import { StepProps, WIZARD_STEPS } from "../types";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion, useCountries } from "@/hooks/useCountries";

interface Step9Props extends StepProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  goToStep: (step: number) => void;
}

export const Step9Review = ({ formData, onBack, onSubmit, isSubmitting, goToStep }: Step9Props) => {
  const { prices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();
  const { countries } = useCountries();

  const marketPrice = convert(prices[formData.crypto_type] || 0, "USD", formData.fiat_currency);
  const finalPrice = formData.pricing_type === "market"
    ? marketPrice * (1 + formData.price_margin / 100)
    : parseFloat(formData.fixed_price || "0");
  const cryptoAmount = parseFloat(formData.crypto_amount || "0");

  const Section = ({ title, stepNum, children }: { title: string; stepNum: number; children: React.ReactNode }) => (
    <div className="p-4 bg-card border rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button variant="ghost" size="sm" onClick={() => goToStep(stepNum)} className="h-7 px-2">
          <Edit2 className="w-3 h-3 mr-1" /> Edit
        </Button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Review Your Offer</h2>
        <p className="text-muted-foreground">Verify all details before publishing</p>
      </div>

      <div className="space-y-3">
        <Section title="Offer Type" stepNum={1}>
          <p className="text-lg font-bold capitalize">{formData.type} {formData.crypto_type}</p>
        </Section>

        <Section title="Amount & Price" stepNum={2}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Amount:</span> {cryptoAmount.toFixed(6)} {formData.crypto_type}</div>
            <div><span className="text-muted-foreground">Price:</span> {formatCurrency(finalPrice, formData.fiat_currency)}</div>
            <div><span className="text-muted-foreground">Limits:</span> {formData.min_amount} - {formData.max_amount}</div>
            <div><span className="text-muted-foreground">Value:</span> {formatCurrency(cryptoAmount * finalPrice, formData.fiat_currency)}</div>
          </div>
        </Section>

        <Section title="Market" stepNum={3}>
          <p className="text-sm">
            {formData.visibility === "global" ? "🌍 Global" : 
              formData.target_countries.map(c => countries.find(co => co.code === c)?.flag_emoji + " " + countries.find(co => co.code === c)?.name).join(", ")}
          </p>
        </Section>

        <Section title="Payment" stepNum={4}>
          <div className="flex flex-wrap gap-1">
            {formData.payment_methods.map(m => (
              <span key={m} className="px-2 py-1 bg-secondary text-xs rounded">{m}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Window: {formData.payment_window} min</p>
        </Section>

        <Section title="Controls" stepNum={6}>
          <div className="text-sm space-y-1">
            <p>KYC: {formData.kyc_required}</p>
            <p>New users: {formData.allow_new_users ? "Allowed" : "Not allowed"}</p>
            <p>Auto-cancel: {formData.auto_cancel_minutes} min</p>
          </div>
        </Section>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={onSubmit} className="flex-1 h-12" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          {isSubmitting ? "Creating..." : "Publish Offer"}
        </Button>
      </div>
    </div>
  );
};
