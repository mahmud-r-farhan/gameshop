import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../config/theme.dart';
import '../../models/order_model.dart';
import '../../providers/order_provider.dart';
import '../../utils/api_values.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOrder());
  }

  Future<void> _loadOrder() async {
    final id = Get.arguments as String?;
    if (id == null) {
      Get.back();
      return;
    }
    final orderProvider = context.read<OrderProvider>();
    final loaded = await orderProvider.loadOrder(id);
    if (!loaded && mounted) {
      Get.snackbar(
        'Error',
        orderProvider.error ?? 'Failed to load order',
        backgroundColor: AppTheme.error.withOpacity(0.9),
        colorText: Colors.white,
      );
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return AppTheme.neonAmber;
      case 'processing':
        return AppTheme.neonCyan;
      case 'shipped':
        return AppTheme.neonViolet;
      case 'completed':
      case 'delivered':
        return AppTheme.success;
      case 'cancelled':
        return AppTheme.error;
      default:
        return AppTheme.textMuted;
    }
  }

  IconData _statusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return Icons.schedule;
      case 'processing':
        return Icons.inventory_2;
      case 'shipped':
        return Icons.local_shipping;
      case 'completed':
      case 'delivered':
        return Icons.check_circle;
      case 'cancelled':
        return Icons.cancel;
      default:
        return Icons.help_outline;
    }
  }

  List<_Step> _buildTimeline(OrderModel order) {
    final status = order.orderStatus.toLowerCase();
    final isCancelled = status == 'cancelled';
    return [
      _Step(
        title: 'Order Placed',
        sub: DateFormat('MMM dd, yyyy HH:mm').format(order.createdAt),
        done: true,
      ),
      _Step(
        title: 'Processing',
        sub: 'Order is being prepared',
        done: !isCancelled &&
            ['processing', 'shipped', 'completed', 'delivered']
                .contains(status),
        active: status == 'processing',
      ),
      if (!isCancelled)
        _Step(
          title: 'Shipped',
          sub: 'Package is on its way',
          done: ['shipped', 'completed', 'delivered'].contains(status),
          active: status == 'shipped',
        ),
      if (!isCancelled)
        _Step(
          title: 'Delivered',
          sub: 'Successfully delivered',
          done: ['completed', 'delivered'].contains(status),
          active: status == 'completed' || status == 'delivered',
          last: true,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          final order = op.selectedOrder;
          if (op.loading && order == null) {
            return const Center(
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: AppTheme.neonCyan),
            );
          }
          if (op.error != null && order == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 56, color: AppTheme.error),
                    const SizedBox(height: 12),
                    Text(op.error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppTheme.textSecondary)),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _loadOrder,
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }
          if (order == null) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline,
                      size: 64, color: AppTheme.textMuted),
                  SizedBox(height: 16),
                  Text('Order not found',
                      style: TextStyle(
                          color: AppTheme.textSecondary, fontSize: 18)),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: AppTheme.neonCyan,
            onRefresh: _loadOrder,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: _cardDecoration(),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Order #${order.orderNumber}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: AppTheme.textPrimary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: _statusColor(order.orderStatus)
                                .withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(_statusIcon(order.orderStatus),
                                  size: 14,
                                  color: _statusColor(order.orderStatus)),
                              const SizedBox(width: 4),
                              Text(
                                order.orderStatus.toUpperCase(),
                                style: TextStyle(
                                    color: _statusColor(order.orderStatus),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _header('Order Items'),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: _cardDecoration(),
                    child: Column(
                      children: order.items
                          .map(
                            (item) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: AppTheme.neonCyan
                                          .withOpacity(0.05),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.videogame_asset,
                                        color: AppTheme.textMuted, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.productName,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: AppTheme.textPrimary,
                                              fontSize: 14),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          'Qty: ${item.quantity} x ${formatBdt(item.price)}',
                                          style: const TextStyle(
                                              color: AppTheme.textMuted,
                                              fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    formatBdt(item.total),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.textPrimary,
                                        fontSize: 15),
                                  ),
                                ],
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: _cardDecoration(),
                    child: Column(
                      children: [
                        _row('Subtotal', order.subtotal),
                        if (order.discountAmount > 0)
                          _row('Discount', -order.discountAmount),
                        _row('Shipping', 0),
                        const Divider(color: AppTheme.borderColor),
                        _row('Total', order.totalAmount, bold: true),
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Payment: ${order.paymentStatus.toUpperCase()}',
                            style: const TextStyle(
                                color: AppTheme.textSecondary, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _header('Order Timeline'),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: _cardDecoration(),
                    child: Column(
                      children: _buildTimeline(order)
                          .map((step) => _TimelineWidget(step: step))
                          .toList(),
                    ),
                  ),
                  if (order.orderStatus.toLowerCase() == 'pending') ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: _cardDecoration(),
                      child: const Text(
                        'Need to cancel this order? Contact support; cancellation is not available in the mobile app yet.',
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 13),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  BoxDecoration _cardDecoration() => BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderColor),
      );

  Widget _header(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          title,
          style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppTheme.textPrimary,
              letterSpacing: -0.3),
        ),
      );

  Widget _row(String label, double amount, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.w800 : FontWeight.normal,
                  fontSize: bold ? 16 : 14,
                  color: bold
                      ? AppTheme.textPrimary
                      : AppTheme.textSecondary),
            ),
            Text(
              formatBdt(amount),
              style: TextStyle(
                  fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
                  fontSize: bold ? 18 : 15,
                  color:
                      bold ? AppTheme.neonCyan : AppTheme.textSecondary),
            ),
          ],
        ),
      );
}

class _Step {
  final String title;
  final String sub;
  final bool done;
  final bool active;
  final bool last;

  _Step({
    required this.title,
    this.sub = '',
    this.done = false,
    this.active = false,
    this.last = false,
  });
}

class _TimelineWidget extends StatelessWidget {
  final _Step step;

  const _TimelineWidget({required this.step});

  @override
  Widget build(BuildContext context) {
    final color = step.done
        ? AppTheme.success
        : step.active
            ? AppTheme.neonCyan
            : AppTheme.textMuted.withOpacity(0.2);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color,
                  ),
                  child: step.done
                      ? const Icon(Icons.check,
                          size: 12, color: AppTheme.bgDark)
                      : null,
                ),
                if (!step.last)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: color.withOpacity(0.3),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: step.last ? 0 : 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.title,
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: step.done || step.active
                            ? AppTheme.textPrimary
                            : AppTheme.textMuted),
                  ),
                  if (step.sub.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(step.sub,
                        style: const TextStyle(
                            color: AppTheme.textMuted, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
