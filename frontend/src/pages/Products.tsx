import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { productAPI } from '@/services/api';
import { useCartStore } from '@/store/useCartStore';
import {
  ShoppingCart, Star, Search, SlidersHorizontal, Gamepad2,
  ChevronLeft, ChevronRight, X, Sparkles, Filter, ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const categories = ['ALL', 'CURRENCY', 'GAME'];
const gameTypes = ['ALL', 'PUBG', 'FREE_FIRE', 'GTA', 'MLBB', 'VALORANT'];

export const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const category = searchParams.get('category') || 'ALL';
  const gameType = searchParams.get('gameType') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const { addItem } = useCartStore();

  useEffect(() => { loadProducts(); }, [category, gameType, page, sort, searchParams.get('search')]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, sort };
      if (category !== 'ALL') params.category = category;
      if (gameType !== 'ALL') params.gameType = gameType;
      const s = searchParams.get('search');
      if (s) params.search = s;
      const res = await productAPI.list(params);
      setProducts(res.data.data.products);
      setPagination(res.data.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'ALL') params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); updateParams('search', search); };

  const handleAddToCart = (product: any) => {
    addItem({ id: product.id, name: product.name, price: Number(product.price), thumbnailUrl: product.thumbnailUrl, gameType: product.gameType });
    toast.success('Added to cart!');
  };

  const filterContent = (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 glass border-white/5 bg-white/5" />
        </form>
      </div>
      {/* Categories */}
      <div>
        <h4 className="text-xs font-semibold text-neon-cyan uppercase tracking-wider mb-3">Category</h4>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => updateParams('category', c)}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                category === c
                  ? 'glass neon-border-cyan text-neon-cyan'
                  : 'glass hover:border-white/10 text-muted-foreground hover:text-foreground'
              }`}
            >
              {c === 'ALL' ? 'All' : c === 'CURRENCY' ? 'Game Currency' : 'Games'}
            </button>
          ))}
        </div>
      </div>
      {/* Game Types */}
      <div>
        <h4 className="text-xs font-semibold text-neon-violet uppercase tracking-wider mb-3">Game Type</h4>
        <div className="flex flex-wrap gap-2">
          {gameTypes.map(g => (
            <button key={g} onClick={() => updateParams('gameType', g)}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                gameType === g
                  ? 'glass neon-border-violet text-neon-violet'
                  : 'glass hover:border-white/10 text-muted-foreground hover:text-foreground'
              }`}
            >
              {g === 'ALL' ? 'All Games' : g}
            </button>
          ))}
        </div>
      </div>
      {/* Sort */}
      <div>
        <h4 className="text-xs font-semibold text-neon-amber uppercase tracking-wider mb-3">
          <ArrowUpDown className="h-3 w-3 inline mr-1" />
          Sort By
        </h4>
        <select value={sort} onChange={e => updateParams('sort', e.target.value)}
          className="w-full p-2.5 rounded-xl glass border border-white/5 text-sm bg-transparent focus:border-neon-cyan/30 focus:outline-none text-muted-foreground"
        >
          <option value="newest" className="bg-background">Newest</option>
          <option value="price_asc" className="bg-background">Price: Low to High</option>
          <option value="price_desc" className="bg-background">Price: High to Low</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Desktop Filters */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 glass-card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center">
                <Filter className="h-4 w-4 mr-2 text-neon-cyan" />
                Filters
              </h3>
              {(category !== 'ALL' || gameType !== 'ALL') && (
                <button onClick={() => { setSearchParams({}); setSearch(''); }} className="text-xs text-muted-foreground hover:text-neon-cyan transition-colors">
                  Clear all
                </button>
              )}
            </div>
            {filterContent}
          </div>
        </div>

        {/* Products Area */}
        <div className="flex-1 min-w-0">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-black">Products</h1>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {pagination.total || 0} items found
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Mobile Filter Toggle */}
              <Button variant="outline" size="sm" className="lg:hidden glass border-white/10" onClick={() => setShowMobileFilters(true)}>
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              {/* Sort (desktop) */}
              <select value={sort} onChange={e => updateParams('sort', e.target.value)}
                className="hidden sm:block p-2 rounded-xl glass border border-white/5 text-xs bg-transparent focus:border-neon-cyan/30 focus:outline-none text-muted-foreground"
              >
                <option value="newest" className="bg-background">Newest</option>
                <option value="price_asc" className="bg-background">Price: Low → High</option>
                <option value="price_desc" className="bg-background">Price: High → Low</option>
              </select>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-40 bg-white/5" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Gamepad2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-2">No products found</h3>
              <p className="text-muted-foreground/60 mb-6">Try adjusting your filters</p>
              <Button variant="outline" className="glass border-white/10" onClick={() => { setSearchParams({}); setSearch(''); }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Staggered Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {products.map((product: any, idx: number) => {
                  const isTall = idx % 5 === 0; // Every 5th card is visually taller
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{ delay: (idx % 6) * 0.06, ease: [0.25, 1, 0.5, 1] }}
                      whileHover={{ y: -6 }}
                      className={`${isTall ? 'sm:row-span-1' : ''}`}
                    >
                      <div className={`glass-card rounded-2xl overflow-hidden group glass-card-glow ${isTall ? 'border-neon-cyan/10' : ''}`}>
                        <Link to={`/products/${product.id}`}>
                          <div className={`relative ${isTall ? 'h-52' : 'h-40'} bg-gradient-to-br from-neon-cyan/10 via-neon-violet/10 to-transparent flex items-center justify-center overflow-hidden`}>
                            {product.thumbnailUrl ? (
                              <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                              <Gamepad2 className="h-16 w-16 text-white/10" />
                            )}
                            {Number(product.originalPrice) > Number(product.price) && (
                              <div className="absolute top-3 right-3 glass rounded-full px-3 py-1 neon-border-cyan">
                                <span className="text-xs font-bold text-neon-cyan">
                                  -{Math.round((1 - Number(product.price) / Number(product.originalPrice)) * 100)}%
                                </span>
                              </div>
                            )}
                            {isTall && (
                              <div className="absolute top-3 left-3 glass rounded-full px-3 py-1">
                                <Sparkles className="h-3 w-3 text-neon-amber" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          </div>
                        </Link>
                        <div className="p-5">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-white/5 text-muted-foreground">
                              {product.gameType || 'Game'}
                            </Badge>
                            {product.isFeatured && (
                              <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-neon-cyan/20 text-neon-cyan">
                                Featured
                              </Badge>
                            )}
                          </div>
                          <Link to={`/products/${product.id}`}>
                            <h3 className="font-bold mb-1 group-hover:text-neon-cyan transition-colors line-clamp-1">{product.name}</h3>
                          </Link>
                          <div className="flex items-center space-x-1 mb-3">
                            <Star className={`h-3 w-3 ${product.averageRating ? 'fill-neon-amber text-neon-amber' : 'text-muted-foreground/40'}`} />
                            <span className="text-xs text-muted-foreground/60">{product.averageRating || 'New'}</span>
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
                              className="min-h-[44px] min-w-[44px] rounded-xl glass flex items-center justify-center hover:bg-neon-cyan/10 hover:text-neon-cyan hover:neon-border-cyan transition-all duration-300 group/add"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-10">
                  <Button variant="outline" size="sm" disabled={page <= 1}
                    onClick={() => updateParams('page', String(page - 1))}
                    className="glass border-white/5 hover:border-neon-cyan/30 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                    const start = Math.max(1, page - 3);
                    const p = start + i;
                    if (p > pagination.totalPages) return null;
                    return (
                      <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                        onClick={() => updateParams('page', String(p))}
                        className={p === page
                          ? 'bg-gradient-to-r from-neon-cyan to-neon-violet text-black font-bold'
                          : 'glass border-white/5 hover:border-white/10'
                        }
                      >
                        {p}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= pagination.totalPages}
                    onClick={() => updateParams('page', String(page + 1))}
                    className="glass border-white/5 hover:border-neon-cyan/30 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setShowMobileFilters(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden mobile-sheet p-6 pb-8 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center">
                  <Filter className="h-5 w-5 mr-2 text-neon-cyan" />
                  Filters
                </h3>
                <button onClick={() => setShowMobileFilters(false)} className="h-10 w-10 rounded-xl glass flex items-center justify-center hover:text-neon-cyan">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {filterContent}
              <div className="mt-6">
                <Button className="w-full bg-gradient-to-r from-neon-cyan to-neon-violet text-black font-bold" onClick={() => setShowMobileFilters(false)}>
                  Apply Filters
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
