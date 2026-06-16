import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { orderAPI } from '@/services/api';
import { Package, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const res = await orderAPI.getMyOrders();
      setOrders(res.data.data.orders);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const statusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'warning';
      case 'PROCESSING': return 'info';
      case 'DELIVERED': return 'success';
      case 'CANCELLED': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) return <div className="container px-4 py-20 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div className="container px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="h-20 w-20 mx-auto text-muted-foreground mb-6" />
          <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
          <p className="text-muted-foreground mb-6">Start shopping to see your orders here</p>
          <Link to="/products"><Button>Browse Products</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any, idx: number) => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={statusColor(order.orderStatus) as any}>{order.orderStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">BDT {Number(order.totalAmount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{order.items?.length || 0} items</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={order.paymentStatus === 'VERIFIED' ? 'success' : 'warning'}>{order.paymentStatus}</Badge>
                      <Link to={`/orders/${order.id}`}><Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button></Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
