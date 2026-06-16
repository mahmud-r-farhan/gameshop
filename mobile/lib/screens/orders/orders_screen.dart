import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../models/order_model.dart';
import '../../providers/order_provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _tabs = ['All', 'Pending', 'Processing', 'Completed', 'Cancelled'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    _tabCtrl.addListener(() { if (!_tabCtrl.indexIsChanging) context.read<OrderProvider>().loadOrders(); });
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<OrderProvider>().loadOrders());
  }

  @override
  void dispose() { _tabCtrl.dispose(); super.dispose(); }

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'pending': return AppTheme.neonAmber;
      case 'processing': return AppTheme.neonCyan;
      case 'completed': case 'delivered': return AppTheme.success;
      case 'cancelled': return AppTheme.error;
      default: return AppTheme.textMuted;
    }
  }

  IconData _statusIcon(String s) {
    switch (s.toLowerCase()) {
      case 'pending': return Icons.schedule;
      case 'processing': return Icons.inventory_2;
      case 'completed': case 'delivered': return Icons.check_circle;
      case 'cancelled': return Icons.cancel;
      default: return Icons.help_outline;
    }
  }

  String _filter(String tab) {
    switch (tab.toLowerCase()) {
      case 'all': return '';
      case 'pending': return 'pending';
      case 'processing': return 'processing';
      case 'completed': return 'completed,delivered';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Orders'),
        bottom: TabBar(
          controller: _tabCtrl, isScrollable: true,
          indicatorColor: AppTheme.neonCyan,
          labelColor: AppTheme.neonCyan,
          unselectedLabelColor: AppTheme.textMuted,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.loading && op.orders.isEmpty) return const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonCyan));
          final filtered = _filter(_tabs[_tabCtrl.index]).isEmpty
              ? op.orders
              : op.orders.where((o) => _filter(_tabs[_tabCtrl.index]).split(',').contains(o.orderStatus.toLowerCase())).toList();
          if (filtered.isEmpty) {
            return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(shape: BoxShape.circle, color: AppTheme.bgCard, border: Border.all(color: AppTheme.borderColor)),
                child: const Icon(Icons.receipt_long_outlined, size: 48, color: AppTheme.textMuted)),
              const SizedBox(height: 16), const Text('No orders found', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 8), Text('Your orders will appear here', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7))),
            ]));
          }
          return RefreshIndicator(
            color: AppTheme.neonCyan,
            onRefresh: () => op.loadOrders(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: filtered.length,
              itemBuilder: (_, i) => _OrderCard(
                order: filtered[i],
                statusColor: _statusColor(filtered[i].orderStatus),
                statusIcon: _statusIcon(filtered[i].orderStatus),
                onTap: () => Get.toNamed(AppRoutes.orderDetail, arguments: filtered[i].id),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final OrderModel order;
  final Color statusColor;
  final IconData statusIcon;
  final VoidCallback onTap;
  const _OrderCard({required this.order, required this.statusColor, required this.statusIcon, required this.onTap});

  String _formatDate(DateTime d) => '${d.day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.month-1]} ${d.year}';

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Order #${order.id.substring(0, 8).toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppTheme.textPrimary)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: statusColor.withOpacity( 0.15), borderRadius: BorderRadius.circular(20)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(statusIcon, size: 14, color: statusColor),
                const SizedBox(width: 4),
                Text(order.orderStatus.toUpperCase(), style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 10)),
              ]),
            ),
          ]),
          const SizedBox(height: 6),
          Text('${order.items.length} item(s)', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 13)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(_formatDate(order.createdAt), style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            Text('BDT ${order.totalAmount.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w900, fontSize: 18)),
          ]),
          const SizedBox(height: 6),
          Row(children: [
            Icon(order.paymentStatus == 'VERIFIED' || order.paymentStatus == 'PAID' ? Icons.check_circle : Icons.pending, size: 14,
              color: order.paymentStatus == 'VERIFIED' || order.paymentStatus == 'PAID' ? AppTheme.success : AppTheme.neonAmber),
            const SizedBox(width: 4),
            Text('Payment: ${order.paymentStatus.toUpperCase()}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
              color: order.paymentStatus == 'VERIFIED' || order.paymentStatus == 'PAID' ? AppTheme.success : AppTheme.neonAmber)),
          ]),
          const SizedBox(height: 8),
          const Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            Text('View Details', style: TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w600, fontSize: 12)),
            SizedBox(width: 4),
            Icon(Icons.chevron_right, size: 14, color: AppTheme.neonCyan),
          ]),
        ]),
      ),
    );
  }
}
