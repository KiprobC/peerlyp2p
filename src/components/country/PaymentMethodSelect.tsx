import { usePaymentMethods, PaymentMethod } from "@/hooks/useCountries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, 
  Building2, 
  Wallet, 
  CreditCard, 
  Send, 
  Globe,
  Check 
} from "lucide-react";

interface PaymentMethodSelectProps {
  countryCode?: string;
  selectedMethods: string[];
  onMethodsChange: (methods: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  smartphone: Smartphone,
  building: Building2,
  wallet: Wallet,
  "credit-card": CreditCard,
  send: Send,
  globe: Globe,
};

export const PaymentMethodSelect = ({
  countryCode,
  selectedMethods,
  onMethodsChange,
  maxSelections,
  disabled,
}: PaymentMethodSelectProps) => {
  const { paymentMethods, loading } = usePaymentMethods(countryCode);

  const toggleMethod = (methodName: string) => {
    if (disabled) return;

    if (selectedMethods.includes(methodName)) {
      onMethodsChange(selectedMethods.filter((m) => m !== methodName));
    } else {
      if (maxSelections && selectedMethods.length >= maxSelections) {
        return;
      }
      onMethodsChange([...selectedMethods, methodName]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payment methods available for this country
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {paymentMethods.map((method) => {
        const isSelected = selectedMethods.includes(method.name);
        const Icon = iconMap[method.icon || "credit-card"] || CreditCard;

        return (
          <Button
            key={method.id}
            type="button"
            variant={isSelected ? "default" : "secondary"}
            size="sm"
            onClick={() => toggleMethod(method.name)}
            disabled={disabled}
            className="relative"
          >
            <Icon className="w-4 h-4 mr-2" />
            {method.display_name}
            {isSelected && (
              <Check className="w-3 h-3 ml-2" />
            )}
          </Button>
        );
      })}
    </div>
  );
};

interface PaymentMethodBadgesProps {
  methods: string[];
  countryCode?: string;
}

export const PaymentMethodBadges = ({ methods, countryCode }: PaymentMethodBadgesProps) => {
  const { paymentMethods } = usePaymentMethods(countryCode);

  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((methodName) => {
        const method = paymentMethods.find((m) => m.name === methodName);
        const displayName = method?.display_name || methodName;
        const Icon = iconMap[method?.icon || "credit-card"] || CreditCard;

        return (
          <Badge key={methodName} variant="secondary" className="text-xs">
            <Icon className="w-3 h-3 mr-1" />
            {displayName}
          </Badge>
        );
      })}
    </div>
  );
};
