import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productAPI, reviewAPI } from '@/services/api';
import { useCartStore } from '@/store/useCartStore';
import { ShoppingCart, Star, ArrowLeft, Gamepad2, Shield, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCartStore();

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const res = await productAPI.getById(id!);
      setProduct(res.data.data);
      const revRes = await reviewAPI.getProductReviews(id!);
      setReviews(revRes.data.data);
    } catch (err) {
      toast.error('Product not found');
    } finally { setLoading(false); }
  };

  if (loading) return <div className="container px-4 py-20 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;
  if (!product) return <div className="container px-4 py-20 text-center"><h2 className="text-2xl font-bold">Product not found</h2><Link to="/products"><Button variant="link"><ArrowLeft className="mr-1 h-4 w-4" />Back to Products</Button></Link></div>;

  return (
    <div className="container px-4 py-8">
      <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"><ArrowLeft className="h-4 w-4 mr-1" />Back to Products</Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative h-80 md:h-96 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center overflow-hidden">
          {product.thumbnailUrl ? <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" /> : <Gamepad2 className="h-24 w-24 text-white/50" />}
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center space-x-2 mb-2">
            <Badge>{product.category}</Badge>
            {product.gameType && <Badge variant="secondary">{product.gameType}</Badge>}
          </div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <div className="flex items-center space-x-2 mb-4">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{product.averageRating || 'New'}</span>
            <span className="text-muted-foreground">({product.totalReviews || 0} reviews)</span>
          </div>
          {product.description && <p className="text-muted-foreground mb-6">{product.description}</p>}
          <div className="mb-6">
            <span className="text-3xl font-bold text-primary">BDT {Number(product.price).toLocaleString()}</span>
            {product.originalPrice > 0 && <span className="text-lg text-muted-foreground line-through ml-3">BDT {Number(product.originalPrice).toLocaleString()}</span>}
          </div>
          {product.specs?.length > 0 && (
            <div className="mb-6 space-y-2">
              <h3 className="font-semibold">Specifications</h3>
              {product.specs.map((s: any) => <div key={s.id} className="flex justify-between text-sm border-b pb-1"><span className="text-muted-foreground">{s.specName}</span><span className="font-medium">{s.specValue}</span></div>)}
            </div>
          )}
          <div className="flex space-x-3 mb-6">
            <div className="flex items-center text-sm text-muted-foreground"><Zap className="h-4 w-4 mr-1 text-green-500" />Instant Delivery</div>
            <div className="flex items-center text-sm text-muted-foreground"><Shield className="h-4 w-4 mr-1 text-blue-500" />Secure</div>
          </div>
          <Button size="lg" className="w-full" onClick={() => { addItem({ id: product.id, name: product.name, price: Number(product.price), thumbnailUrl: product.thumbnailUrl, gameType: product.gameType }); toast.success('Added to cart!'); }}>
            <ShoppingCart className="mr-2 h-5 w-5" />Add to Cart - BDT {Number(product.price).toLocaleString()}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
