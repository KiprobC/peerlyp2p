import { usePasskeyContext } from "@/contexts/PasskeyContext";

export const usePasskeys = () => {
  return usePasskeyContext();
};