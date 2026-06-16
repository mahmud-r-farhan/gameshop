import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../providers/cart_provider.dart';
import '../../providers/order_provider.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _selectedPayment = 'bkash';
  final _addressCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  bool _loading = false;

  final _paymentMethods = [
    {'value': 'bkash', 'label': 'bKash', 'icon': Icons.phone_android, 'desc': 'Send money to bKash number'},
    {'value': 'nagad', 'label': 'Nagad', 'icon': Icons.phone_iphone, 'desc': 'Send money to Nagad number'},
    {'value': 'rocket', 'label': 'Rocket', 'icon': Icons.account_balance, 'desc': 'Send money to Rocket number'},
    {'value': 'paypal', 'label': 'PayPal', 'icon': Icons.account_balance, 'desc': 'Send money to PayPal account'},
  ];

  @override
  void dispose() { _addressCtrl.dispose(); _phoneCtrl.dispose(); super.dispose(); }

  Future<void> _placeOrder() async {
    if (_addressCtrl.text.trim().isEmpty) {
      Get.snackbar('Address Required', 'Please enter your delivery address', backgroundColor: AppTheme.neonAmber.withOpacity( 0.9), colorText: AppTheme.bgDark, snackPosition: SnackPosition.BOTTOM);
      return;
    }
    setState(() => _loading = true);
    try {
      final cart = context.read<CartProvider>();
      final orderProvider = context.read<OrderProvider>();
      final items = cart.items.map((item) => {
        'productId': item.id,
        'quantity': item.quantity,
        'price': item.price,
      }).toList();
      final success = await orderProvider.createOrder(items: items, deliveryAddress: _addressCtrl.text.trim());
      if (success && orderProvider.selectedOrder != null) {
        cart.clearCart();
        Get.offNamed(AppRoutes.orderDetail, arguments: orderProvider.selectedOrder!.id);
        Get.snackbar('Order Placed!', 'Your order has been placed successfully', backgroundColor: AppTheme.success.withOpacity( 0.9), colorText: Colors.white, snackPosition: SnackPosition.BOTTOM);
      } else {
        Get.snackbar('Order Failed', orderProvider.error ?? 'Please try again', backgroundColor: AppTheme.error.withOpacity( 0.9), colorText: Colors.white, snackPosition: SnackPosition.BOTTOM);
      }
    } catch (e) {
      Get.snackbar('Order Failed', e.toString().replaceAll('Exception: ', ''), backgroundColor: AppTheme.error.withOpacity( 0.9), colorText: Colors.white, snackPosition: SnackPosition.BOTTOM);
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: cart.items.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(shape: BoxShape.circle, color: AppTheme.bgCard, border: Border.all(color: AppTheme.borderColor)), child: const Icon(Icons.shopping_cart_outlined, size: 48, color: AppTheme.textMuted)),
              const SizedBox(height: 16), const Text('Your cart is empty', style: TextStyle(color: AppTheme.textSecondary, fontSize: 18)),
            ]))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _section('Order Summary'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: [
                    ...cart.items.map((item) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(children: [
                      Expanded(child: Text(item.name, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      Text('x${item.quantity}', style: const TextStyle(color: AppTheme.textMuted)),
                      const SizedBox(width: 12),
                      Text('BDT ${(item.price * item.quantity).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                    ]))),
                    const Divider(color: AppTheme.borderColor),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      const Text('Subtotal', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                      Text('BDT ${cart.totalPrice.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.textPrimary)),
                    ]),
                    const SizedBox(height: 4),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('Tax (10%)', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7))),
                      Text('BDT ${(cart.totalPrice * 0.1).toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.textSecondary)),
                    ]),
                    const Divider(color: AppTheme.borderColor, thickness: 2),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      const Text('Total', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.textPrimary)),
                      Text('BDT ${(cart.totalPrice * 1.1).toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w900, fontSize: 22)),
                    ]),
                  ]),
                ),
                const SizedBox(height: 16),
                _section('Contact & Delivery'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: [
                    TextFormField(controller: _addressCtrl, style: const TextStyle(color: AppTheme.textPrimary),
                      decoration: const InputDecoration(labelText: 'Delivery Address', hintText: 'Enter your full address', prefixIcon: Icon(Icons.location_on_outlined, color: AppTheme.neonCyan, size: 20)),
                      maxLines: 2, textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(controller: _phoneCtrl, style: const TextStyle(color: AppTheme.textPrimary),
                      decoration: const InputDecoration(labelText: 'Phone Number', prefixIcon: Icon(Icons.phone_outlined, color: AppTheme.neonCyan, size: 20)),
                      keyboardType: TextInputType.phone,
                    ),
                  ]),
                ),
                const SizedBox(height: 16),
                _section('Payment Method'),
                Container(
                  decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                  child: Column(children: _paymentMethods.map((pm) => RadioListTile<String>(
                    title: Text(pm['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                    subtitle: Text(pm['desc'] as String, style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 12)),
                    secondary: Icon(pm['icon'] as IconData, color: AppTheme.neonCyan, size: 22),
                    value: pm['value'] as String,
                    groupValue: _selectedPayment,
                    activeColor: AppTheme.neonCyan,
                    onChanged: (v) => setState(() => _selectedPayment = v!),
                    toggleable: false,
                  )).toList()),
                ),
                const SizedBox(height: 100),
              ]),
            ),
      bottomNavigationBar: cart.items.isEmpty ? null : Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: const BoxDecoration(color: AppTheme.bgSurface, border: Border(top: BorderSide(color: AppTheme.borderColor))),
        child: SafeArea(top: false, child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loading ? null : _placeOrder,
            icon: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.bgDark)) : const Icon(Icons.lock_outline),
            label: Text(_loading ? 'Processing...' : 'Place Order - BDT ${(cart.totalPrice * 1.1).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          ),
        )),
      ),
    );
  }

  Widget _section(String title) {
    return Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.3)));
  }
}
