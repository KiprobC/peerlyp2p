import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <Link to="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Peerly's peer-to-peer cryptocurrency trading platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">2. Eligibility</h2>
              <p className="text-muted-foreground mb-4">
                To use Peerly, you must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Be at least 18 years old</li>
                <li>Complete our KYC (Know Your Customer) verification process</li>
                <li>Have the legal capacity to enter into a binding agreement</li>
                <li>Not be prohibited from using our services under applicable laws</li>
                <li>Not be located in a restricted jurisdiction</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">3. Account Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must not share your account with others</li>
                <li>You must provide accurate and truthful information</li>
                <li>You must immediately notify us of any unauthorized access</li>
                <li>You are responsible for all activities under your account</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">4. Trading Rules</h2>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Escrow System</h3>
                  <p>
                    All trades are secured by our escrow system. When a trade is initiated, the seller's cryptocurrency is locked in escrow until the buyer confirms payment.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Payment Confirmation</h3>
                  <p>
                    Buyers must complete payment within the specified time limit. Sellers must release escrow only after verifying payment has been received.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Cancellation Policy</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Buyers may cancel a trade before marking payment as sent</li>
                    <li>Trades that exceed the payment window may be automatically cancelled</li>
                    <li>Cancelled trades return escrowed funds to the seller</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">5. Dispute Resolution</h2>
              <p className="text-muted-foreground mb-4">
                In case of a trade dispute:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Either party may raise a dispute through the trade chat</li>
                <li>A moderator will be assigned to review the case</li>
                <li>Both parties must provide evidence to support their claims</li>
                <li>The moderator's decision is final and binding</li>
                <li>Escrowed funds will be released according to the resolution</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">6. Fees</h2>
              <p className="text-muted-foreground">
                Peerly charges fees for trades, deposits, withdrawals, and internal transfers. Current fee rates are displayed in the platform. We reserve the right to modify fees with prior notice to users.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">7. Prohibited Activities</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Money laundering or terrorist financing</li>
                <li>Fraud or deceptive practices</li>
                <li>Manipulating trades or ratings</li>
                <li>Creating multiple accounts</li>
                <li>Using the platform for illegal purposes</li>
                <li>Harassing or threatening other users</li>
                <li>Attempting to circumvent security measures</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Peerly facilitates peer-to-peer trades but does not guarantee the outcome of any transaction. We are not liable for losses resulting from market volatility, user disputes, or third-party actions. Our liability is limited to the amount of fees paid by you in the 12 months preceding any claim.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">9. Account Termination</h2>
              <p className="text-muted-foreground">
                We may suspend or terminate your account for violations of these terms, suspected fraud, or regulatory requirements. You may close your account at any time, subject to completing any pending trades and withdrawing your funds.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these Terms of Service at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notification.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">11. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact us through our support system or email legal@peerly.com.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
