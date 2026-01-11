export interface OfferFormData {
  // Step 1: Offer Type
  type: "buy" | "sell";
  
  // Step 2: Cryptocurrency
  crypto_type: string;
  crypto_amount: string;
  
  // Step 3: Target Market
  target_countries: string[];
  visibility: "country" | "global";
  
  // Step 4: Payment Methods
  payment_methods: string[];
  payment_window: string;
  proof_required: string[];
  
  // Step 5: Pricing
  pricing_type: "market" | "fixed";
  price_margin: number;
  fixed_price: string;
  min_amount: string;
  max_amount: string;
  
  // Step 6: Trade Controls
  max_trades_per_user: string;
  allow_new_users: boolean;
  kyc_required: "none" | "basic" | "full";
  trusted_only: boolean;
  auto_cancel_minutes: string;
  
  // Step 7: Terms
  terms: string;
  payment_instructions: string;
  
  // Step 8: Confirmation
  escrow_confirmed: boolean;
  
  // Metadata
  fiat_currency: string;
}

export interface StepProps {
  formData: OfferFormData;
  updateFormData: (updates: Partial<OfferFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export const initialFormData: OfferFormData = {
  type: "sell",
  crypto_type: "BTC",
  crypto_amount: "",
  target_countries: [],
  visibility: "country",
  payment_methods: [],
  payment_window: "30",
  proof_required: [],
  pricing_type: "market",
  price_margin: 0,
  fixed_price: "",
  min_amount: "",
  max_amount: "",
  max_trades_per_user: "",
  allow_new_users: true,
  kyc_required: "none",
  trusted_only: false,
  auto_cancel_minutes: "30",
  terms: "",
  payment_instructions: "",
  escrow_confirmed: false,
  fiat_currency: "USD",
};

export const WIZARD_STEPS = [
  { id: 1, title: "Offer Type", description: "Choose what you want to do" },
  { id: 2, title: "Cryptocurrency", description: "Select asset & amount" },
  { id: 3, title: "Target Market", description: "Who can see your offer" },
  { id: 4, title: "Payment Methods", description: "How you'll get paid" },
  { id: 5, title: "Pricing", description: "Set your rates" },
  { id: 6, title: "Trade Controls", description: "Limit & protect" },
  { id: 7, title: "Terms", description: "Instructions for traders" },
  { id: 8, title: "Fees & Escrow", description: "Review costs" },
  { id: 9, title: "Review", description: "Publish your offer" },
];
