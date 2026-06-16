import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { orderAPI } from '@/services/api';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const res = await orderAPI.getById(id!);
      setOrder(res.data.data);
    } catch (err) {
      toast.error('Order not found');
    } finally { setLoading(false); }
  };

  if (loading) return <div className="container px-4 py-20 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;
  if (!order) return <div className="container px-4 py-20 text-center"><h2 className="text-2xl font-bold">Order not found</h2><Link to="/orders"><Button variant="link"><ArrowLeft className="mr-1 h-4 w-4" />Back to Orders</Button></Link></div>;

  const statusIcon = (status: string) => {
    switch(status) {
      case 'DELIVERED': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'CANCELLED': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="container px-4 py-8 max-w-3xl mx-auto">
      <Link to="/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"><ArrowLeft className="h-4 w-4 mr-1" />Back to Orders</Link>
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order #{order.orderNumber}</CardTitle>
                <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center space-x-2">
                {statusIcon(order.orderStatus)}
                <Badge variant={order.orderStatus === 'DELIVERED' ? 'success' : order.orderStatus === 'CANCELLED' ? 'destructive' : 'warning'}>{order.orderStatus}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Payment</p><Badge variant={order.paymentStatus === 'VERIFIED' ? 'success' : 'warning'}>{order.paymentStatus}</Badge></div>
              <div><p className="text-sm text-muted-foreground">Delivery</p><Badge variant={order.deliveryStatus === 'DELIVERED' ? 'success' : 'secondary'}>{order.deliveryStatus}</Badge></div>
            </div>
            <div><p className="text-sm text-muted-foreground mb-1">Delivery Address</p><p className="text-sm">{order.deliveryAddress}</p></div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity} × BDT {Number(item.price).toLocaleString()}</p>
                  </div>
                  <p className="font-semibold">BDT {(item.quantity * Number(item.price)).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>BDT {Number(order.subtotal).toLocaleString()}</span></div>
              {Number(order.discountAmount) > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-BDT {Number(order.discountAmount).toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>BDT {Number(order.totalAmount).toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
