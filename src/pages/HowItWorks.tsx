import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Clock, Smartphone, HelpCircle } from "lucide-react";
import SupportChatDialog from "@/components/support/SupportChatDialog";

const faqs = [
  {
    question: "How does the escrow system work?",
    answer: "When a trade is initiated, the seller's crypto is automatically locked in our secure escrow. Once the buyer confirms payment, the crypto is released to them. This protects both parties."
  },
  {
    question: "What payment methods are supported?",
    answer: "We support MPESA, bank transfers (most Kenyan banks), and Airtel Money. More payment methods are being added regularly."
  },
  {
    question: "How long do trades take?",
    answer: "Most trades are completed within 15-30 minutes. The time depends on the payment method and how quickly both parties respond."
  },
  {
    question: "Is my money safe?",
    answer: "Yes! We use bank-grade security, 2FA authentication, and our escrow system ensures funds are only released when both parties fulfill their obligations."
  },
  {
    question: "What are the fees?",
    answer: "Creating offers is free. We charge a small percentage fee only when a trade is completed successfully. See our fee schedule for details."
  },
];

const HowItWorks = () => {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24">
        {/* Hero */}
        <section className="py-16 bg-card">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              How <span className="gradient-text">KenyaCoin</span> Works
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn how to buy and sell cryptocurrency safely using our peer-to-peer platform.
            </p>
          </div>
        </section>

        {/* How It Works Steps */}
        <HowItWorksSection />

        {/* Security Section */}
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">
                  Your Security is Our <span className="gradient-text">Priority</span>
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Secure Escrow</h3>
                      <p className="text-muted-foreground text-sm">
                        Crypto is held in escrow during trades, protecting both buyers and sellers.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">24/7 Monitoring</h3>
                      <p className="text-muted-foreground text-sm">
                        Our team monitors trades around the clock to prevent fraud.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Two-Factor Authentication</h3>
                      <p className="text-muted-foreground text-sm">
                        Add an extra layer of security to your account with 2FA.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="glass-card p-8 text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <h3 className="text-xl font-bold mb-2">Trade with Confidence</h3>
                <p className="text-muted-foreground mb-6">
                  Over 50,000 successful trades completed with a 99.9% success rate.
                </p>
                <Link to="/signup">
                  <Button variant="hero" size="lg">
                    Start Trading Safely
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Frequently Asked <span className="gradient-text">Questions</span>
              </h2>
              <p className="text-muted-foreground">
                Got questions? We've got answers.
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="glass-card">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground text-sm">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-muted-foreground mb-4">Still have questions?</p>
              <Button variant="outline" onClick={() => setSupportOpen(true)}>
                Contact Support
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <SupportChatDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </div>
  );
};

export default HowItWorks;
