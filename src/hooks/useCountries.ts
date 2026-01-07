import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Country {
  id: string;
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  phone_code: string;
  flag_emoji: string | null;
  is_active: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
}

interface CountryPaymentMethod {
  id: string;
  country_id: string;
  payment_method_id: string;
  is_active: boolean;
  priority: number;
  payment_methods: PaymentMethod;
}

// Exchange rates cache (in production, fetch from API)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  KES: 129,
  NGN: 1550,
  GBP: 0.79,
  EUR: 0.92,
  GHS: 15.5,
  ZAR: 18.5,
  TZS: 2650,
  UGX: 3750,
  RWF: 1350,
  ETB: 56,
  EGP: 31,
  MAD: 10,
  AED: 3.67,
  INR: 83,
  PHP: 56,
  CAD: 1.36,
  AUD: 1.53,
};

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCountries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCountries(data || []);
    } catch (error) {
      console.error("Error fetching countries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const getCountryByCode = useCallback(
    (code: string): Country | undefined => {
      return countries.find((c) => c.code === code);
    },
    [countries]
  );

  return { countries, loading, refetch: fetchCountries, getCountryByCode };
};

export const usePaymentMethods = (countryCode?: string) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      if (countryCode) {
        // Fetch country-specific payment methods
        const { data: countryData, error: countryError } = await supabase
          .from("countries")
          .select("id")
          .eq("code", countryCode)
          .single();

        if (countryError) throw countryError;

        const { data, error } = await supabase
          .from("country_payment_methods")
          .select(`
            id,
            country_id,
            payment_method_id,
            is_active,
            priority,
            payment_methods (*)
          `)
          .eq("country_id", countryData.id)
          .eq("is_active", true)
          .order("priority");

        if (error) throw error;

        const methods = (data as unknown as CountryPaymentMethod[])
          ?.map((cpm) => cpm.payment_methods)
          .filter(Boolean) || [];
        setPaymentMethods(methods);
      } else {
        // Fetch all payment methods
        const { data, error } = await supabase
          .from("payment_methods")
          .select("*")
          .eq("is_active", true)
          .order("display_name");

        if (error) throw error;
        setPaymentMethods(data || []);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  return { paymentMethods, loading, refetch: fetchPaymentMethods };
};

export const useCurrencyConversion = () => {
  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string): number => {
      const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
      const toRate = EXCHANGE_RATES[toCurrency] || 1;
      const usdAmount = amount / fromRate;
      return usdAmount * toRate;
    },
    []
  );

  const formatCurrency = useCallback(
    (amount: number, currencyCode: string, symbol?: string): string => {
      const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: currencyCode === "USD" ? 2 : 0,
        maximumFractionDigits: currencyCode === "USD" ? 2 : 0,
      }).format(amount);
      return `${symbol || currencyCode} ${formatted}`;
    },
    []
  );

  const getExchangeRate = useCallback(
    (fromCurrency: string, toCurrency: string): number => {
      const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
      const toRate = EXCHANGE_RATES[toCurrency] || 1;
      return toRate / fromRate;
    },
    []
  );

  return { convert, formatCurrency, getExchangeRate, rates: EXCHANGE_RATES };
};

// Auto-detect country from browser/timezone
export const useCountryDetection = () => {
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Try timezone-based detection first
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneCountryMap: Record<string, string> = {
          "Africa/Nairobi": "KE",
          "Africa/Lagos": "NG",
          "America/New_York": "US",
          "America/Los_Angeles": "US",
          "America/Chicago": "US",
          "Europe/London": "GB",
          "Africa/Accra": "GH",
          "Africa/Johannesburg": "ZA",
          "Africa/Dar_es_Salaam": "TZ",
          "Africa/Kampala": "UG",
          "Africa/Kigali": "RW",
          "Africa/Addis_Ababa": "ET",
          "Africa/Cairo": "EG",
          "Africa/Casablanca": "MA",
          "Asia/Dubai": "AE",
          "Asia/Kolkata": "IN",
          "Asia/Manila": "PH",
          "America/Toronto": "CA",
          "Australia/Sydney": "AU",
          "Europe/Paris": "EU",
          "Europe/Berlin": "EU",
        };

        const countryFromTimezone = timezoneCountryMap[timezone];
        if (countryFromTimezone) {
          setDetectedCountry(countryFromTimezone);
          setLoading(false);
          return;
        }

        // Fallback to browser language
        const language = navigator.language || "en-US";
        const languageCountryMap: Record<string, string> = {
          "en-KE": "KE",
          "sw-KE": "KE",
          "en-NG": "NG",
          "en-US": "US",
          "en-GB": "GB",
          "en-GH": "GH",
          "en-ZA": "ZA",
        };

        const countryFromLanguage = languageCountryMap[language];
        setDetectedCountry(countryFromLanguage || "US");
      } catch (error) {
        console.error("Error detecting country:", error);
        setDetectedCountry("US"); // Default fallback
      } finally {
        setLoading(false);
      }
    };

    detectCountry();
  }, []);

  return { detectedCountry, loading };
};
