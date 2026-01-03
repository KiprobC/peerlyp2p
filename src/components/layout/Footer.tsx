import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
          <p>© 2024 KenyaCoin Connect</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/how-it-works" className="hover:text-primary transition-colors">How It Works</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
