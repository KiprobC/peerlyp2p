import { usePasskeyContext } from "@/contexts/PasskeyContext";

export const usePasskeys = () => {
  return usePasskeyContext();
};

export { checkHasPasskey, loginWithPasskey } from "@/lib/passkeyAuth";
