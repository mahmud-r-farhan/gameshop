import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCartStore } from '@/store/useCartStore';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

export const Cart = () => {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice, getItemCount } = useCartStore();

  const handleQuantityChange = (id: string, quantity: number) => {
    if (quantity <= 0) removeItem(id);
    else updateQuantity(id, quantity);
  };

  if (items.length === 0) {
    return (
      <div className="container px-4 py-20 text-center">
        <ShoppingCart className="h-20 w-20 mx-auto text-muted-foreground mb-6" />
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-8">Looks like you haven't added anything yet</p>
        <Link to="/products"><Button size="lg"><ShoppingBag className="mr-2 h-5 w-5" />Browse Products</Button></Link>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <p className="text-muted-foreground">{getItemCount()} items in your cart</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { clearCart(); toast.success('Cart cleared'); }}>
          <Trash2 className="h-4 w-4 mr-2" />Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item, idx) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-8 w-8 text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${item.id}`}><h3 className="font-semibold hover:text-primary transition-colors line-clamp-1">{item.name}</h3></Link>
                    <p className="text-sm text-muted-foreground">{item.gameType}</p>
                    <p className="text-lg font-bold text-primary mt-1">BDT {Number(item.price).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">BDT {(item.price * item.quantity).toLocaleString()}</p>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-auto p-1" onClick={() => { removeItem(item.id); toast.success('Item removed'); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div>
          <Card className="sticky top-24">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>BDT {getTotalPrice().toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>Calculated at checkout</span></div>
                <hr />
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>BDT {getTotalPrice().toLocaleString()}</span></div>
              </div>
              <Link to="/checkout"><Button className="w-full mt-6" size="lg">Proceed to Checkout</Button></Link>
              <Link to="/products"><Button variant="link" className="w-full mt-2"><ArrowLeft className="h-4 w-4 mr-1" />Continue Shopping</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
