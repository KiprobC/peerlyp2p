import { Shield, Zap, Smartphone, Users, Lock, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Secure Escrow",
    description: "Every trade is protected by our smart escrow system. Crypto is held securely until payment is confirmed.",
  },
  {
    icon: Users,
    title: "Verified Traders",
    description: "Trade with confidence. Our reputation system helps you find reliable, verified trading partners.",
  },
  {
    icon: Zap,
    title: "Instant Trades",
    description: "Complete trades in minutes. Our streamlined process gets you your crypto or cash quickly.",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Pricing",
    description: "Always get the best rates with live market prices and competitive trading margins.",
  },
  {
    icon: Lock,
    title: "Bank-Grade Security",
    description: "Two-factor authentication, encryption, and advanced security keep your assets safe.",
  },
  {
    icon: Smartphone,
    title: "Mobile First",
    description: "Trade anywhere, anytime. Our platform is optimized for seamless mobile experience.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Why Choose <span className="gradient-text">Peerly</span>?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for trust, speed, and transparency. We put control back in the hands of users — peer to peer, done right.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card premium-border group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;