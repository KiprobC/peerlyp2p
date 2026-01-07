import { useCountries, Country } from "@/hooks/useCountries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface CountrySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CountrySelect = ({
  value,
  onValueChange,
  placeholder = "Select country",
  disabled,
  className,
}: CountrySelectProps) => {
  const { countries, loading } = useCountries();

  if (loading) {
    return <Skeleton className="h-10 w-full" />;
  }

  const selectedCountry = countries.find((c) => c.code === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCountry && (
            <span className="flex items-center gap-2">
              <span>{selectedCountry.flag_emoji}</span>
              <span>{selectedCountry.name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {countries.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            <span className="flex items-center gap-2">
              <span>{country.flag_emoji}</span>
              <span>{country.name}</span>
              <span className="text-muted-foreground text-xs">
                ({country.currency_code})
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface CurrencySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CurrencySelect = ({
  value,
  onValueChange,
  placeholder = "Select currency",
  disabled,
  className,
}: CurrencySelectProps) => {
  const { countries, loading } = useCountries();

  if (loading) {
    return <Skeleton className="h-10 w-full" />;
  }

  // Get unique currencies
  const currencies = Array.from(
    new Map(
      countries.map((c) => [
        c.currency_code,
        { code: c.currency_code, symbol: c.currency_symbol, flag: c.flag_emoji },
      ])
    ).values()
  );

  const selectedCurrency = currencies.find((c) => c.code === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCurrency && (
            <span className="flex items-center gap-2">
              <span>{selectedCurrency.symbol}</span>
              <span>{selectedCurrency.code}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{currency.symbol}</span>
              <span>{currency.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
