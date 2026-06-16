import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import {
  ShoppingCart,
  User,
  LogOut,
  Package,
  Menu,
  X,
  Gamepad2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { getItemCount } = useCartStore();
  const navigate = useNavigate();

  const cartCount = getItemCount();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Spacer for fixed nav */}
      <div className={`${scrolled ? 'h-20' : 'h-16'} transition-all duration-300`} />

 <motion.nav
  className={`fixed z-50 transition-all duration-500
    ${
      scrolled
        ? 'top-3 left-1/2 -translate-x-1/2 max-w-3xl w-[90%] md:w-auto rounded-full pill-nav'
        : 'top-0 left-0 right-0 rounded-none glass-strong'
    }
  `}
>
        <div className={`flex items-center justify-between transition-all duration-300
          ${scrolled ? 'h-12 px-4' : 'h-16 px-4 md:px-8 container'}`}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 shrink-0">
            <div className="relative">
              <Gamepad2 className="h-7 w-7 text-neon-cyan" />
              <Sparkles className="absolute -top-1 -right-2 h-3 w-3 text-neon-violet animate-pulse-glow" />
            </div>
            <span className={`text-lg font-bold gradient-text ${scrolled && 'hidden md:inline'}`}>
              GameShop
            </span>
          </Link>

          {/* Desktop Navigation - hidden when scrolled to pill */}
          <div className={`hidden md:flex items-center space-x-1 ${scrolled && 'hidden'}`}>
            {[
              { to: '/products', label: 'Products' },
              { to: '/products?category=CURRENCY', label: 'GCurrency' },
              { to: '/products?category=GAME', label: 'Games' },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="relative px-4 py-2 text-sm font-medium text-muted-foreground hover:text-neon-cyan transition-colors duration-300 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-neon-cyan group-hover:w-3/4 transition-all duration-300 rounded-full" />
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-2">
            {/* Cart */}
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative hover:bg-neon-cyan/10 hover:text-neon-cyan transition-all duration-300">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-neon-cyan text-black font-bold rounded-full">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 hover:bg-neon-violet/10 hover:text-neon-violet transition-all duration-300"
                >
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet flex items-center justify-center">
                    <span className="text-xs font-bold text-black">
                      {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm">{user?.fullName}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isProfileOpen && 'rotate-180'}`} />
                </Button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl glass-strong p-2 shadow-2xl"
                    >
                      <div className="px-3 py-2 mb-1 border-b border-white/5">
                        <p className="text-sm font-medium">{user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <div className="space-y-1">
                        <Link to="/profile" className="flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors" onClick={() => setIsProfileOpen(false)}>
                          <User className="h-4 w-4 text-neon-cyan" />
                          <span>Profile</span>
                        </Link>
                        <Link to="/orders" className="flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors" onClick={() => setIsProfileOpen(false)}>
                          <Package className="h-4 w-4 text-neon-violet" />
                          <span>Orders</span>
                        </Link>
                        {user?.role === 'ADMIN' && (
                          <Link to="/admin" className="flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors" onClick={() => setIsProfileOpen(false)}>
                            <Gamepad2 className="h-4 w-4 text-neon-amber" />
                            <span>Admin Panel</span>
                          </Link>
                        )}
                      </div>
                      <hr className="my-1 border-white/5" />
                      <button onClick={handleLogout} className="flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors w-full">
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all duration-300">Login</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="bg-gradient-to-r from-neon-cyan to-neon-violet hover:from-neon-cyan/90 hover:to-neon-violet/90 text-black font-semibold shadow-lg shadow-neon-cyan/20 transition-all duration-300">
                    Register
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Toggle */}
            <Button variant="ghost" size="icon" className="md:hidden hover:text-neon-cyan" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/5 md:hidden"
            >
              <div className="px-4 py-4 space-y-1">
                {[
                  { to: '/products', label: 'All Products', icon: '🛒' },
                  { to: '/products?category=CURRENCY', label: 'Game Currency', icon: '💰' },
                  { to: '/products?category=GAME', label: 'Games', icon: '🎮' },
                ].map(link => (
                  <Link key={link.to} to={link.to} className="flex items-center space-x-3 px-4 py-3 text-sm rounded-xl hover:bg-white/5 transition-colors" onClick={() => setIsMenuOpen(false)}>
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
                {!isAuthenticated && (
                  <div className="flex space-x-2 pt-3 border-t border-white/5">
                    <Link to="/login" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">Login</Button>
                    </Link>
                    <Link to="/register" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full bg-gradient-to-r from-neon-cyan to-neon-violet text-black font-semibold">Register</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
};
