import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Lock,
  LifeBuoy,
  Loader2,
  Mail,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import peerlyLogo from "@/assets/peerly-logo.png";

type Option = "menu" | "password" | "recovery-code" | "identity" | "google";

const options: {
  id: Exclude<Option, "menu">;
  icon: typeof Lock;
  title: string;
  description: string;
}[] = [
  {
    id: "password",
    icon: Lock,
    title: "I forgot my password",
    description: "Get a secure reset link by email",
  },
  {
    id: "recovery-code",
    icon: KeyRound,
    title: "I lost my phone or authenticator app",
    description: "Sign in with one of your saved recovery codes",
  },
  {
    id: "identity",
    icon: LifeBuoy,
    title: "I lost my authenticator and my recovery codes",
    description: "Submit an identity verification request to our support team",
  },
  {
    id: "google",
    icon: Mail,
    title: "My Google sign-in isn't working",
    description: "Troubleshoot Google account access",
  },
];

const AccountRecovery = () => {
  const navigate = useNavigate();
  const [option, setOption] = useState<Option>("menu");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Identity verification form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [explanation, setExplanation] = useState("");

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("account_recovery_requests" as any).insert({
        username: username.trim().replace(/^@/, ""),
        email: email.trim().toLowerCase(),
        explanation: explanation.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("Recovery request failed:", err);
      toast.error("Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center mb-8">
          <img src={peerlyLogo} alt="Peerly" className="h-8 w-auto" />
        </Link>
        {children}
      </div>
    </div>
  );

  if (option === "menu") {
    return (
      <Shell>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Can't sign in?</h1>
          <p className="text-muted-foreground">
            Choose what's happening and we'll get you back into your account.
          </p>
        </div>

        <div className="space-y-3">
          {options.map(({ id, icon: Icon, title, description }) => (
            <button
              key={id}
              type="button"
              onClick={() => setOption(id)}
              className="w-full flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const BackButton = () => (
    <button
      type="button"
      onClick={() => {
        setOption("menu");
        setSubmitted(false);
      }}
      className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      All recovery options
    </button>
  );

  if (option === "password") {
    return (
      <Shell>
        <BackButton />
        <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
        <p className="text-muted-foreground mb-6">
          We'll email you a secure link to choose a new password. The link expires shortly after
          it's sent.
        </p>
        <Button className="w-full" size="lg" onClick={() => navigate("/forgot-password")}>
          Continue to password reset
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </Shell>
    );
  }

  if (option === "recovery-code") {
    return (
      <Shell>
        <BackButton />
        <h1 className="text-2xl font-bold mb-2">Use a recovery code</h1>
        <p className="text-muted-foreground mb-4">
          Sign in with your email and password as usual. When we ask for your authenticator code,
          choose <span className="text-foreground font-medium">"Lost your phone? Use a recovery
          code"</span> and enter one of the codes you saved.
        </p>
        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground mb-6 space-y-1">
          <p>Each recovery code works only once.</p>
          <p>
            Using one turns off two-factor authentication and invalidates every remaining code, so
            set up a new authenticator right away.
          </p>
        </div>
        <Button className="w-full" size="lg" onClick={() => navigate("/login")}>
          Continue to sign in
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </Shell>
    );
  }

  if (option === "google") {
    return (
      <Shell>
        <BackButton />
        <h1 className="text-2xl font-bold mb-2">Google sign-in issues</h1>
        <ul className="space-y-3 text-sm text-muted-foreground mb-6 list-disc pl-5">
          <li>Make sure you're picking the same Google account you originally signed up with.</li>
          <li>
            If a pop-up was blocked, allow pop-ups for this site and try "Continue with Google"
            again.
          </li>
          <li>
            If you first created your account with an email and password, sign in that way instead
            — Google sign-in only works once it's linked.
          </li>
          <li>Signing in from a private/incognito window can block third-party sign-in.</li>
        </ul>
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => navigate("/login")}>
            Try signing in again
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setOption("identity")}>
            Still stuck? Contact support
          </Button>
        </div>
      </Shell>
    );
  }

  // identity verification
  return (
    <Shell>
      <BackButton />
      {submitted ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">Request received</h1>
          <p className="text-muted-foreground mb-6">
            Our support team will review your identity verification request and email you at{" "}
            <span className="text-foreground">{email}</span>. For your security, this review is
            done manually and can take up to 48 hours.
          </p>
          <Button className="w-full" onClick={() => navigate("/login")}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-2">Verify your identity</h1>
          <p className="text-muted-foreground mb-6">
            Without your authenticator or a recovery code, our support team has to verify you
            manually before two-factor authentication can be reset.
          </p>

          <form onSubmit={handleIdentitySubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Your username</label>
              <Input
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Account email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">What happened?</label>
              <Textarea
                rows={5}
                maxLength={1000}
                placeholder="Tell us how you lost access, and anything that helps us confirm the account is yours (recent trade IDs, deposit amounts, the country you trade from...)"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {explanation.length}/1000
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Support will never ask for your password, recovery codes, or authenticator codes.
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || explanation.trim().length < 20}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit verification request"
              )}
            </Button>
          </form>
        </>
      )}
    </Shell>
  );
};

export default AccountRecovery;
