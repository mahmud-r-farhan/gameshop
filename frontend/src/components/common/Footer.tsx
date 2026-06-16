import { Link } from 'react-router-dom';
import { Gamepad2, Mail, Phone, MapPin, Sparkles, Heart } from 'lucide-react';

const socialLinks = [
  { icon: '𝕏', href: '#', label: 'Twitter / X' },
  { icon: '▶', href: '#', label: 'Discord' },
  { icon: '📷', href: '#', label: 'Instagram' },
  { icon: '💬', href: '#', label: 'Telegram' },
];

export const Footer = () => {
  return (
    <footer className="relative border-t border-white/5 overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />

      <div className="container relative z-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center space-x-2">
              <div className="relative">
                <Gamepad2 className="h-7 w-7 text-neon-cyan" />
                <Sparkles className="absolute -top-1 -right-2 h-3 w-3 text-neon-violet animate-pulse-glow" />
              </div>
              <span className="text-lg font-bold gradient-text">GameShop</span>
            </Link>
            <p className="text-sm text-muted-foreground/80 leading-relaxed">
              Your trusted destination for gaming products, in-game currencies, and digital items at the best prices.
            </p>
            <div className="flex space-x-2">
              {socialLinks.map(social => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="h-9 w-9 rounded-xl glass flex items-center justify-center text-sm hover:text-neon-cyan hover:border-neon-cyan/30 transition-all duration-300 hover:scale-110"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neon-cyan uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/products', label: 'All Products' },
                { to: '/products?category=CURRENCY', label: 'Game Currency' },
                { to: '/products?category=GAME', label: 'Games' },
                { to: '/cart', label: 'Shopping Cart' },
                { to: '/orders', label: 'My Orders' },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-muted-foreground/80 hover:text-neon-cyan transition-colors duration-300 group flex items-center space-x-2">
                    <span className="w-0 group-hover:w-2 h-[1px] bg-neon-cyan transition-all duration-300" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neon-violet uppercase tracking-wider">Support</h3>
            <ul className="space-y-2.5">
              {['FAQ', 'Shipping Info', 'Return Policy', 'Contact Us', 'Privacy Policy'].map(item => (
                <li key={item}>
                  <Link to="#" className="text-sm text-muted-foreground/80 hover:text-neon-violet transition-colors duration-300">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neon-amber uppercase tracking-wider">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-3 text-sm text-muted-foreground/80">
                <div className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-neon-cyan" />
                </div>
                <span>+880 1773784824</span>
              </li>
              <li className="flex items-center space-x-3 text-sm text-muted-foreground/80">
                <div className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-neon-violet" />
                </div>
                <span>support@gameshopdotcom</span>
              </li>
              <li className="flex items-center space-x-3 text-sm text-muted-foreground/80">
                <div className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-neon-amber" />
                </div>
                <span>Bogra 5800, Bangladesh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground/60 flex items-center space-x-1">
            <span>&copy; {new Date().getFullYear()} GameShop.</span>
            <span className="flex items-center space-x-1">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-red-400 fill-red-400" />
              <span>for gamers</span>
            </span>
          </p>
          <div className="flex items-center space-x-4 text-xs text-muted-foreground/40">
            <span>v1.0.0</span>
            <span className="w-1 h-1 rounded-full bg-white/10" />
            <span>All rights reserved</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
