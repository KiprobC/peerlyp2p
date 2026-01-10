import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const PrivacyPolicy = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground">
                Peerly ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our peer-to-peer cryptocurrency trading platform.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Full name and date of birth</li>
                    <li>Email address and phone number</li>
                    <li>Government-issued ID documents for KYC verification</li>
                    <li>Selfie/photo for identity verification</li>
                    <li>Bank account details and payment method information</li>
                    <li>Country and city of residence</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Transaction Data</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Trade history and transaction records</li>
                    <li>Wallet balances and cryptocurrency holdings</li>
                    <li>Payment confirmations and receipts</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Technical Data</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>IP address and device information</li>
                    <li>Browser type and operating system</li>
                    <li>Usage patterns and preferences</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>To verify your identity and comply with KYC/AML regulations</li>
                <li>To facilitate peer-to-peer cryptocurrency trades</li>
                <li>To process payments and manage escrow services</li>
                <li>To communicate with you about trades, disputes, and platform updates</li>
                <li>To detect and prevent fraud, money laundering, and other illegal activities</li>
                <li>To improve our platform and user experience</li>
                <li>To comply with legal obligations and regulatory requirements</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement robust security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>End-to-end encryption for sensitive data</li>
                <li>Secure escrow system for cryptocurrency transactions</li>
                <li>Two-factor authentication (2FA) support</li>
                <li>Regular security audits and monitoring</li>
                <li>Secure document storage for KYC materials</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information for as long as your account is active or as needed to provide services. We may also retain data to comply with legal obligations, resolve disputes, and enforce agreements. KYC documents are retained as required by applicable regulations.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Access and download your personal data</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your account and data (subject to legal requirements)</li>
                <li>Opt out of marketing communications</li>
                <li>Lodge a complaint with a data protection authority</li>
              </ul>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">7. Third-Party Services</h2>
              <p className="text-muted-foreground">
                We may share your information with trusted third parties for payment processing, identity verification, and regulatory compliance. All third parties are required to maintain the confidentiality and security of your information.
              </p>
            </section>

            <section className="glass-card">
              <h2 className="text-xl font-semibold mb-4">8. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy or our data practices, please contact us through our support system or email us at privacy@peerly.com.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
