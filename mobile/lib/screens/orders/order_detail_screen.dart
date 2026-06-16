import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../config/theme.dart';
import '../../models/order_model.dart';
import '../../providers/order_provider.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  @override
  void initState() { super.initState(); _loadOrder(); }

  Future<void> _loadOrder() async {
    final id = Get.arguments as String?;
    if (id == null) { Get.back(); return; }
    try {
      await context.read<OrderProvider>().loadOrder(id);
    } catch (_) { Get.snackbar('Error', 'Failed to load order', backgroundColor: AppTheme.error.withOpacity( 0.9), colorText: Colors.white); }
  }

  Color _sc(String s) {
    switch (s.toLowerCase()) {
      case 'pending': return AppTheme.neonAmber;
      case 'processing': return AppTheme.neonCyan;
      case 'shipped': return AppTheme.neonViolet;
      case 'completed': case 'delivered': return AppTheme.success;
      case 'cancelled': return AppTheme.error;
      default: return AppTheme.textMuted;
    }
  }

  IconData _si(String s) {
    switch (s.toLowerCase()) {
      case 'pending': return Icons.schedule;
      case 'processing': return Icons.inventory_2;
      case 'shipped': return Icons.local_shipping;
      case 'completed': case 'delivered': return Icons.check_circle;
      case 'cancelled': return Icons.cancel;
      default: return Icons.help_outline;
    }
  }

  List<_Step> _buildTimeline(OrderModel order) {
    final s = order.orderStatus.toLowerCase();
    final isCancelled = s == 'cancelled';
    return [
      _Step(title: 'Order Placed', sub: DateFormat('MMM dd, yyyy HH:mm').format(order.createdAt), done: true),
      _Step(title: 'Processing', sub: 'Order is being prepared', done: !isCancelled && ['processing','shipped','completed','delivered'].contains(s), active: s == 'processing'),
      if (!isCancelled) _Step(title: 'Shipped', sub: 'Package is on its way', done: ['shipped','completed','delivered'].contains(s), active: s == 'shipped'),
      if (!isCancelled) _Step(title: 'Delivered', sub: 'Successfully delivered', done: ['completed','delivered'].contains(s), active: s == 'completed' || s == 'delivered', last: true),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          final order = op.selectedOrder;
          if (op.loading && order == null) return const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonCyan));
          if (order == null) {
            return const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.error_outline, size: 64, color: AppTheme.textMuted),
            SizedBox(height: 16), Text('Order not found', style: TextStyle(color: AppTheme.textSecondary, fontSize: 18)),
          ]));
          }
          return RefreshIndicator(
            color: AppTheme.neonCyan,
            onRefresh: _loadOrder,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Status header
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('Order #${order.id.substring(0, 8).toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.textPrimary)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: _sc(order.orderStatus).withOpacity( 0.15), borderRadius: BorderRadius.circular(20)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(_si(order.orderStatus), size: 14, color: _sc(order.orderStatus)),
                        const SizedBox(width: 4),
                        Text(order.orderStatus.toUpperCase(), style: TextStyle(color: _sc(order.orderStatus), fontWeight: FontWeight.w700, fontSize: 11)),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),
                // Items
                _header('Order Items'),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: order.items.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      Container(width: 48, height: 48, decoration: BoxDecoration(color: AppTheme.neonCyan.withOpacity( 0.05), borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Icons.videogame_asset, color: AppTheme.textMuted, size: 22)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('Qty: ${item.quantity} x BDT ${item.price.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                      ])),
                      Text('BDT ${(item.price * item.quantity).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.textPrimary, fontSize: 15)),
                    ]),
                  )).toList()),
                ),
                const SizedBox(height: 16),
                // Total
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: [
                    _row('Subtotal', order.totalAmount),
                    _row('Shipping', 0),
                    const Divider(color: AppTheme.borderColor),
                    _row('Total', order.totalAmount, bold: true),
                  ]),
                ),
                const SizedBox(height: 16),
                // Timeline
                _header('Order Timeline'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: _buildTimeline(order).map((s) => _TimelineWidget(step: s)).toList()),
                ),
                if (order.orderStatus.toLowerCase() == 'pending') ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => Get.snackbar('Cancelled', 'Cancellation requested', backgroundColor: AppTheme.error.withOpacity( 0.9), colorText: Colors.white),
                      icon: const Icon(Icons.cancel_outlined, size: 18),
                      label: const Text('Cancel Order'),
                      style: OutlinedButton.styleFrom(foregroundColor: AppTheme.error, side: const BorderSide(color: AppTheme.error), padding: const EdgeInsets.symmetric(vertical: 14)),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _header(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.3)));

  Widget _row(String l, double a, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(l, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.normal, fontSize: bold ? 16 : 14, color: bold ? AppTheme.textPrimary : AppTheme.textSecondary)),
      Text('BDT ${a.toStringAsFixed(0)}', style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w600, fontSize: bold ? 18 : 15, color: bold ? AppTheme.neonCyan : AppTheme.textSecondary)),
    ]),
  );
}

class _Step {
  final String title, sub;
  final bool done, active, last;
  _Step({required this.title, this.sub = '', this.done = false, this.active = false, this.last = false});
}

class _TimelineWidget extends StatelessWidget {
  final _Step step;
  const _TimelineWidget({required this.step});

  @override
  Widget build(BuildContext context) {
    final color = step.done ? AppTheme.success : step.active ? AppTheme.neonCyan : AppTheme.textMuted.withOpacity( 0.2);
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 32, child: Column(children: [
          Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, color: step.done ? AppTheme.success : step.active ? AppTheme.neonCyan : AppTheme.textMuted.withOpacity( 0.2)),
            child: step.done ? const Icon(Icons.check, size: 12, color: AppTheme.bgDark) : null),
          if (!step.last) Expanded(child: Container(width: 2, color: color.withOpacity( 0.3))),
        ])),
        const SizedBox(width: 12),
        Expanded(child: Padding(padding: EdgeInsets.only(bottom: step.last ? 0 : 24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(step.title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: step.done || step.active ? AppTheme.textPrimary : AppTheme.textMuted)),
          if (step.sub.isNotEmpty) ...[const SizedBox(height: 2), Text(step.sub, style: const TextStyle(color: AppTheme.textMuted, fontSize: 12))],
        ]))),
      ]),
    );
  }
}
