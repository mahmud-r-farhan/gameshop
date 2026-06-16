import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { productAPI } from '@/services/api';
import { useCartStore } from '@/store/useCartStore';
import { ShoppingCart, TrendingUp, Shield, Zap, Star, ChevronRight, Sparkles, ArrowRight, Gamepad2 } from 'lucide-react';
import toast from 'react-hot-toast';

const stagger = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay, ease: [0.25, 1, 0.5, 1] },
});

export const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCartStore();

  useEffect(() => { loadFeatured(); }, []);

  const loadFeatured = async () => {
    try {
      const res = await productAPI.getFeatured();
      setFeaturedProducts(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAddToCart = (product: any) => {
    addItem({ id: product.id, name: product.name, price: Number(product.price), thumbnailUrl: product.thumbnailUrl, gameType: product.gameType });
    toast.success(`${product.name} added to cart!`);
  };

  const categories = [
    { name: 'PUBG UC', icon: '🔫', gameType: 'PUBG', gradient: 'from-yellow-400/20 to-orange-500/20', border: 'border-yellow-500/20' },
    { name: 'Free Fire', icon: '🔥', gameType: 'FREE_FIRE', gradient: 'from-orange-400/20 to-red-500/20', border: 'border-orange-500/20' },
    { name: 'GTA V', icon: '🚗', gameType: 'GTA', gradient: 'from-blue-400/20 to-purple-500/20', border: 'border-blue-500/20' },
    { name: 'MLBB', icon: '⚔️', gameType: 'MLBB', gradient: 'from-green-400/20 to-teal-500/20', border: 'border-green-500/20' },
    { name: 'Valorant', icon: '🔫', gameType: 'VALORANT', gradient: 'from-red-400/20 to-pink-500/20', border: 'border-red-500/20' },
  ];

  return (
    <div className="w-full overflow-hidden">
      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated background layers */}
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-violet/5 rounded-full blur-[120px]" style={{ animation: 'float 5s ease-in-out infinite reverse' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

        <div className="container relative z-10 px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}>
            {/* Badge */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="inline-flex items-center space-x-2 glass rounded-full px-4 py-2 mb-8 neon-border-cyan">
              <Sparkles className="h-4 w-4 text-neon-cyan" />
              <span className="text-xs font-medium text-neon-cyan">Trusted by 50,000+ Gamers</span>
            </motion.div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.95] tracking-tight">
              Level Up Your
              <br />
              <span className="gradient-text text-[1.1em]">Gaming Experience</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              Get PUBG UC, Free Fire Diamonds, GTA Shark Cards and more at the best prices. 
              <span className="text-neon-cyan"> Instant delivery</span>, 
              <span className="text-neon-violet"> secure payment</span>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/products">
                <Button size="xl" className="relative group bg-gradient-to-r from-neon-cyan to-neon-violet hover:from-neon-cyan/90 hover:to-neon-violet/90 text-black font-bold text-base px-8 py-6 rounded-2xl shadow-2xl shadow-neon-cyan/20 overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    Browse Products
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </Button>
              </Link>
              <Link to="/products?category=CURRENCY">
                <Button size="xl" variant="outline" className="glass hover:bg-white/5 text-foreground border-white/10 px-8 py-6 rounded-2xl text-base hover:neon-border-cyan transition-all duration-300">
                  Game Currency
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center space-x-8 mt-12">
              {[
                { value: '50K+', label: 'Happy Gamers' },
                { value: '10K+', label: 'Orders Delivered' },
                { value: '4.9', label: 'Avg Rating' },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="text-center">
                  <div className="text-lg font-bold gradient-text">{stat.value}</div>
                  <div className="text-xs text-muted-foreground/60">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-neon-cyan/[0.02] to-background" />
        <div className="container px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: 'Instant Delivery', desc: 'Get your digital products within minutes of payment verification', gradient: 'from-neon-cyan/20 to-neon-cyan/5' },
              { icon: Shield, title: 'Secure Payments', desc: 'Multiple payment methods with admin verification for safety', gradient: 'from-neon-violet/20 to-neon-violet/5' },
              { icon: TrendingUp, title: 'Best Prices', desc: 'Competitive pricing with regular discounts and promotions', gradient: 'from-neon-amber/20 to-neon-amber/5' },
            ].map((feature, idx) => (
              <motion.div key={idx} {...stagger(idx * 0.1)} className="glass-card rounded-2xl p-8 text-center group">
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-7 w-7 text-neon-cyan" />
                </div>
                <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
                <p className="text-sm text-muted-foreground/70 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="container px-4">
          <motion.div {...stagger(0)} className="text-center mb-14">
            <Badge variant="outline" className="glass border-neon-cyan/20 text-neon-cyan mb-4 px-4 py-1.5">Game Categories</Badge>
            <h2 className="text-4xl md:text-5xl font-black mb-4">Shop by Game</h2>
            <p className="text-muted-foreground/70 max-w-xl mx-auto">Browse popular gaming titles and find the perfect currency pack for you</p>
          </motion.div>

          {/* Asymmetrical Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((cat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, ease: [0.25, 1, 0.5, 1] }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={idx === 0 ? 'md:col-span-2 md:row-span-2' : ''}
              >
                <Link to={`/products?gameType=${cat.gameType}`}>
                  <div className={`glass-card rounded-2xl p-6 text-center h-full flex flex-col items-center justify-center border ${cat.border} bg-gradient-to-br ${cat.gradient}`}>
                    <span className="text-5xl mb-4 block">{cat.icon}</span>
                    <h3 className="font-bold text-sm">{cat.name}</h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Products ─────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-neon-violet/[0.02] to-background" />
        <div className="container px-4 relative z-10">
          <motion.div {...stagger(0)} className="flex items-end justify-between mb-14">
            <div>
              <Badge variant="outline" className="glass border-neon-violet/20 text-neon-violet mb-4 px-4 py-1.5">Featured</Badge>
              <h2 className="text-4xl md:text-5xl font-black mb-2">Featured Products</h2>
              <p className="text-muted-foreground/70">Most popular gaming currencies and items</p>
            </div>
            <Link to="/products" className="hidden sm:flex items-center text-sm text-muted-foreground hover:text-neon-cyan transition-colors group">
              View All
              <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-white/5" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product: any, idx: number) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, ease: [0.25, 1, 0.5, 1] }}
                  whileHover={{ y: -6 }}
                >
                  <div className="glass-card rounded-2xl overflow-hidden group glass-card-glow">
                    <Link to={`/products/${product.id}`}>
                      <div className="relative h-48 bg-gradient-to-br from-neon-cyan/10 via-neon-violet/10 to-transparent flex items-center justify-center overflow-hidden">
                        {product.thumbnailUrl ? (
                          <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <Gamepad2 className="h-16 w-16 text-white/10" />
                        )}
                        {/* Discount Badge */}
                        {Number(product.originalPrice) > Number(product.price) && (
                          <div className="absolute top-3 right-3 glass rounded-full px-3 py-1 neon-border-cyan">
                            <span className="text-xs font-bold text-neon-cyan">
                              -{Math.round((1 - Number(product.price) / Number(product.originalPrice)) * 100)}%
                            </span>
                          </div>
                        )}
                        {/* Gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>
                    </Link>
                    <div className="p-5">
                      <Link to={`/products/${product.id}`}>
                        <h3 className="font-bold mb-1.5 group-hover:text-neon-cyan transition-colors line-clamp-1">{product.name}</h3>
                      </Link>
                      <div className="flex items-center space-x-1 mb-3">
                        <Star className="h-3.5 w-3.5 fill-neon-amber text-neon-amber" />
                        <span className="text-xs text-muted-foreground/60">{product.averageRating || 'New'}</span>
                        <span className="text-xs text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground/60">{product.gameType || 'Game'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold text-neon-cyan">BDT {Number(product.price).toLocaleString()}</span>
                          {Number(product.originalPrice) > 0 && (
                            <span className="text-xs text-muted-foreground/40 line-through ml-2">BDT {Number(product.originalPrice).toLocaleString()}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="h-9 w-9 rounded-xl glass flex items-center justify-center hover:bg-neon-cyan/10 hover:text-neon-cyan hover:neon-border-cyan transition-all duration-300 group/add"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Mobile View All */}
          <div className="text-center mt-8 sm:hidden">
            <Link to="/products">
              <Button variant="outline" className="glass border-white/10">
                View All Products
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/10 via-neon-violet/10 to-neon-cyan/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-cyan/5 rounded-full blur-[150px]" />

        <div className="container px-4 text-center relative z-10">
          <motion.div {...stagger(0)}>
            <Badge variant="outline" className="glass border-neon-cyan/20 text-neon-cyan mb-4 px-4 py-1.5">Get Started</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Ready to Level Up?
            </h2>
            <p className="text-lg text-muted-foreground/70 mb-8 max-w-xl mx-auto">
              Create an account and start purchasing your favorite gaming products instantly
            </p>
            <Link to="/register">
              <Button size="xl" className="bg-gradient-to-r from-neon-cyan to-neon-violet hover:from-neon-cyan/90 hover:to-neon-violet/90 text-black font-bold text-base px-10 py-6 rounded-2xl shadow-2xl shadow-neon-cyan/20">
                Create Free Account
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
