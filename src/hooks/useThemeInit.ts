import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useThemeInit = () => {
  const { user } = useAuth();

  const applyTheme = (theme: string) => {
    if (theme === "system") {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", systemPrefersDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  };

  useEffect(() => {
    const initTheme = async () => {
      if (!user) {
        // Default to dark theme for non-authenticated users
        document.documentElement.classList.add("dark");
        return;
      }

      try {
        const { data } = await supabase
          .from("user_settings")
          .select("theme")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.theme) {
          applyTheme(data.theme);
        } else {
          // Default to dark if no preference saved
          document.documentElement.classList.add("dark");
        }
      } catch (error) {
        console.error("Error loading theme:", error);
        document.documentElement.classList.add("dark");
      }
    };

    initTheme();

    // Listen for system theme changes when in "system" mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      // Only apply if user has system preference - we'll check this when it changes
    };
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [user]);
};
