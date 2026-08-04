/**
 * "Remember me" persistence.
 *
 * Supabase always persists its token in localStorage (the client is generated
 * and must not be edited), so opting out is enforced at the app layer:
 *
 *  - remember = true  → the session survives browser restarts (default Supabase behaviour).
 *  - remember = false → the session is dropped as soon as the browser session ends.
 *
 * The browser-session marker lives in sessionStorage, which the browser clears
 * when the tab/browser is closed. On the next launch the marker is gone, so a
 * non-remembered session is signed out during auth initialization.
 */
const REMEMBER_KEY = "auth_remember_me";
const BROWSER_SESSION_KEY = "auth_browser_session";

export const setRememberMe = (remember: boolean) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    if (!remember) sessionStorage.setItem(BROWSER_SESSION_KEY, "1");
    else sessionStorage.removeItem(BROWSER_SESSION_KEY);
  } catch {
    /* storage unavailable — fail open to the default (remembered) behaviour */
  }
};

export const getRememberMe = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
};

/**
 * True when a stored session belongs to a "don't remember me" login whose
 * browser session has already ended — it must not be restored.
 */
export const shouldDiscardStoredSession = (): boolean => {
  try {
    if (localStorage.getItem(REMEMBER_KEY) !== "false") return false;
    return sessionStorage.getItem(BROWSER_SESSION_KEY) !== "1";
  } catch {
    return false;
  }
};

export const clearRememberMe = () => {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(BROWSER_SESSION_KEY);
  } catch {
    /* ignore */
  }
};
