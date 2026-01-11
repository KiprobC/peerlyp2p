import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { WizardProgress } from "@/components/create-offer/WizardProgress";
import { OfferFormData, initialFormData, WIZARD_STEPS } from "@/components/create-offer/types";
import { Step1OfferType, Step2Cryptocurrency, Step3TargetMarket, Step4PaymentMethods, Step5Pricing, Step6TradeControls, Step7Terms, Step8FeesEscrow, Step9Review } from "@/components/create-offer/steps";
import { useMyOffers } from "@/hooks/useOffers";
import { useProfile } from "@/hooks/useProfile";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion } from "@/hooks/useCountries";
import { useAvailableBalance } from "@/hooks/useAvailableBalance";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CreateOffer = () => {
  const navigate = useNavigate();
  const { createOffer } = useMyOffers();
  const { profile, loading: profileLoading } = useProfile();
  const { prices } = useCryptoPrices("USD");
  const { convert } = useCurrencyConversion();
  const { refetch: refetchBalance } = useAvailableBalance();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OfferFormData>(() => ({
    ...initialFormData,
    fiat_currency: profile?.preferred_currency || "USD",
    target_countries: profile?.country ? [profile.country] : [],
  }));

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        fiat_currency: profile.preferred_currency || "USD",
        target_countries: prev.target_countries.length === 0 && profile.country ? [profile.country] : prev.target_countries,
      }));
    }
  }, [profile]);

  const updateFormData = (updates: Partial<OfferFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step: number) => setCurrentStep(step);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const marketPrice = convert(prices[formData.crypto_type] || 0, "USD", formData.fiat_currency);
      const finalPrice = formData.pricing_type === "market"
        ? Math.round(marketPrice * (1 + formData.price_margin / 100))
        : parseFloat(formData.fixed_price);

      const { error } = await createOffer({
        type: formData.type,
        crypto_type: formData.crypto_type,
        crypto_amount: parseFloat(formData.crypto_amount),
        price_per_unit: finalPrice,
        price_margin: formData.pricing_type === "market" ? formData.price_margin : null,
        min_amount: parseFloat(formData.min_amount),
        max_amount: parseFloat(formData.max_amount),
        payment_methods: formData.payment_methods,
        time_limit: parseInt(formData.payment_window),
        terms: [formData.terms, formData.payment_instructions].filter(Boolean).join("\n\n---\n\n") || null,
        is_active: true,
        fiat_currency: formData.fiat_currency,
      });

      if (error) throw error;
      toast.success("Offer created successfully!");
      refetchBalance();
      navigate("/marketplace");
    } catch (error: any) {
      toast.error(error.message || "Failed to create offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stepProps = { formData, updateFormData, onNext: handleNext, onBack: handleBack, isFirstStep: currentStep === 1, isLastStep: currentStep === WIZARD_STEPS.length };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
            <h1 className="text-lg font-semibold">Create Offer</h1>
            <Button variant="ghost" size="icon" onClick={() => navigate("/marketplace")}><X className="w-5 h-5" /></Button>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-8">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="mb-6">
            <WizardProgress currentStep={currentStep} completedSteps={completedSteps} />
          </div>

          <div className="glass-card">
            {currentStep === 1 && <Step1OfferType {...stepProps} />}
            {currentStep === 2 && <Step2Cryptocurrency {...stepProps} />}
            {currentStep === 3 && <Step3TargetMarket {...stepProps} />}
            {currentStep === 4 && <Step4PaymentMethods {...stepProps} />}
            {currentStep === 5 && <Step5Pricing {...stepProps} />}
            {currentStep === 6 && <Step6TradeControls {...stepProps} />}
            {currentStep === 7 && <Step7Terms {...stepProps} />}
            {currentStep === 8 && <Step8FeesEscrow {...stepProps} />}
            {currentStep === 9 && <Step9Review {...stepProps} onSubmit={handleSubmit} isSubmitting={isSubmitting} goToStep={goToStep} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateOffer;
