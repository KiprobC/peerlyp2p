import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const CTASection = () => {
  const { user } = useAuth();
  return (
    <section className="py-24 bg-card relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            {user ? (
              <>Explore the <span className="gradient-text">Marketplace</span></>
            ) : (
              <>Ready to Start <span className="gradient-text">Trading</span>?</>
            )}
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            {user 
              ? "Browse active offers or create your own to start trading with verified users."
              : "Join thousands of Kenyans already trading crypto safely and securely on our platform."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link to="/marketplace">
                  <Button variant="hero" size="xl">
                    Browse Offers
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/create-offer">
                  <Button variant="glass" size="xl">
                    Create Offer
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup">
                  <Button variant="hero" size="xl">
                    Create Free Account
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/marketplace">
                  <Button variant="glass" size="xl">
                    View Marketplace
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>No hidden fees</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>Verified traders</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
