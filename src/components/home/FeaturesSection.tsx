import { Shield, Zap, Smartphone, Users, Lock, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Secure Escrow",
    description: "Every trade is protected by our smart escrow system. Crypto is held securely until payment is confirmed.",
    color: "text-primary",
  },
  {
    icon: Smartphone,
    title: "MPESA Integration",
    description: "Pay instantly with MPESA, Kenya's most popular mobile money service. Fast, simple, and reliable.",
    color: "text-accent",
  },
  {
    icon: Zap,
    title: "Instant Trades",
    description: "Complete trades in minutes. Our streamlined process gets you your crypto or cash quickly.",
    color: "text-primary",
  },
  {
    icon: Users,
    title: "Trusted Community",
    description: "Trade with verified users. Our rating system helps you find reliable trading partners.",
    color: "text-accent",
  },
  {
    icon: Lock,
    title: "Bank-Grade Security",
    description: "Two-factor authentication, encryption, and cold storage keep your assets safe.",
    color: "text-primary",
  },
  {
    icon: TrendingUp,
    title: "Best Rates",
    description: "Competitive pricing with low fees. Get the best value for your trades.",
    color: "text-accent",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Choose <span className="gradient-text">KenyaCoin</span>?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for Kenyans, by Kenyans. We understand what you need for safe and easy crypto trading.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card hover:border-primary/30 transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
