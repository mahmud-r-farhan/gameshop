import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { orderAPI } from '@/services/api';
import { Package, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OrderListItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: string | number;
  orderStatus: string;
  paymentStatus: string;
  items?: { id: string }[];
}

interface OrdersPage {
  orders: OrderListItem[];
}

type BadgeVariant = 'warning' | 'info' | 'success' | 'destructive' | 'secondary';

const statusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'PROCESSING': return 'info';
    case 'DELIVERED': return 'success';
    case 'CANCELLED': return 'destructive';
    default: return 'secondary';
  }
};

export const Orders = () => {
  const { data, isPending, isError, refetch } = useQuery<OrdersPage>({
    queryKey: ['orders'],
    queryFn: () => orderAPI.getMyOrders().then((res) => res.data.data),
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-label="Loading orders">
        <div className="mb-8 h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">My Orders</h1>
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-6 text-sm">
          <span>We couldn't load your orders.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const orders = data?.orders ?? [];

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
          {orders.map((order, idx) => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Order #{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={statusVariant(order.orderStatus)}>{order.orderStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">BDT {Number(order.totalAmount).toLocaleString('en-BD')}</p>
                      <p className="text-xs text-muted-foreground">{order.items?.length || 0} items</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={order.paymentStatus === 'VERIFIED' ? 'success' : 'warning'}>{order.paymentStatus}</Badge>
                      <Link to={`/orders/${order.id}`} aria-label={`View order ${order.orderNumber}`}>
                        <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                      </Link>
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
