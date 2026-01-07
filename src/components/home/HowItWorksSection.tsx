import { UserPlus, Search, ShieldCheck, Wallet } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Account",
    description: "Sign up in seconds with email. Complete verification to unlock all features.",
  },
  {
    icon: Search,
    step: "02",
    title: "Find an Offer",
    description: "Browse buy or sell offers. Filter by payment method, price, and trader reputation.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Trade Securely",
    description: "Initiate trade and chat with your partner. Escrow protects both parties.",
  },
  {
    icon: Wallet,
    step: "04",
    title: "Get Your Crypto",
    description: "Confirm payment received. Crypto is released instantly from escrow.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start trading in four simple steps. It's that easy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
              )}
              
              <div className="relative z-10 text-center">
                <div className="w-24 h-24 rounded-2xl glass mx-auto mb-6 flex items-center justify-center group hover:border-primary/50 transition-all premium-border">
                  <step.icon className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-sm font-bold text-primary mb-2 block">{step.step}</span>
                <h3 className="text-xl font-semibold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;