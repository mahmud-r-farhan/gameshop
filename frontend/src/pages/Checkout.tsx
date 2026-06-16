import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCartStore } from '@/store/useCartStore';
import { orderAPI } from '@/services/api';
import { ShoppingBag, MapPin, Ticket, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export const Checkout = () => {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return toast.error('Please enter delivery address');
    setLoading(true);
    try {
      const res = await orderAPI.create({
        items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        deliveryAddress: address,
        deliveryInstructions: instructions,
        promoCode: promoCode || undefined,
      });
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/orders`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="container px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><ShoppingBag className="h-5 w-5 mr-2" />Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity}</span>
                  <span>BDT {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <hr />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>BDT {getTotalPrice().toLocaleString()}</span></div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><MapPin className="h-5 w-5 mr-2" />Delivery Address</CardTitle></CardHeader>
            <CardContent>
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter your full delivery address" className="w-full p-3 border rounded-lg min-h-[100px] bg-background" required />
              <Input placeholder="Delivery instructions (optional)" value={instructions} onChange={e => setInstructions(e.target.value)} className="mt-3" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><Ticket className="h-5 w-5 mr-2" />Promo Code</CardTitle></CardHeader>
            <CardContent>
              <Input placeholder="Enter promo code (optional)" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex space-x-4">
          <Button type="button" variant="outline" onClick={() => navigate('/cart')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <Button type="submit" className="flex-1" size="lg" disabled={loading}>{loading ? 'Placing order...' : 'Place Order'}</Button>
        </div>
      </form>
    </div>
  );
};
