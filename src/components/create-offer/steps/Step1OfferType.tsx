import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";
import { StepProps } from "../types";
import { cn } from "@/lib/utils";

export const Step1OfferType = ({ formData, updateFormData, onNext }: StepProps) => {
  const options = [
    {
      type: "sell" as const,
      title: "Sell Crypto",
      subtitle: "Receive Fiat Money",
      description: "You have crypto and want to exchange it for cash. Buyers will pay you via your chosen payment methods.",
      icon: ArrowUpFromLine,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/50",
    },
    {
      type: "buy" as const,
      title: "Buy Crypto",
      subtitle: "Pay with Fiat Money",
      description: "You want to acquire crypto by paying sellers through their accepted payment methods.",
      icon: ArrowDownToLine,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">What would you like to do?</h2>
        <p className="text-muted-foreground">
          Choose whether you want to sell your cryptocurrency or buy from other traders
        </p>
      </div>

      <div className="grid gap-4">
        {options.map((option) => {
          const isSelected = formData.type === option.type;
          const Icon = option.icon;
          
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => updateFormData({ type: option.type })}
              className={cn(
                "w-full p-6 rounded-xl border-2 transition-all text-left",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected
                  ? `${option.borderColor} ${option.bgColor}`
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isSelected ? option.bgColor : "bg-secondary"
                )}>
                  <Icon className={cn("w-6 h-6", isSelected ? option.color : "text-muted-foreground")} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{option.title}</h3>
                    {isSelected && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", option.bgColor, option.color)}>
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{option.subtitle}</p>
                  <p className="text-sm text-muted-foreground/80">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          {formData.type === "sell" ? (
            <p>When someone responds to your offer, your crypto will be locked in escrow until you confirm receiving payment.</p>
          ) : (
            <p>When you respond to a sell offer, the seller's crypto is locked in escrow until they confirm your payment.</p>
          )}
        </div>
      </div>

      <Button onClick={onNext} className="w-full h-12" size="lg">
        Continue
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
};
