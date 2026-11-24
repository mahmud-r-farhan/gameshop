import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../providers/cart_provider.dart';
import '../../providers/order_provider.dart';
import '../../utils/api_values.dart';
import '../../utils/order_request.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _addressCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final cart = context.read<CartProvider>();
    final orderProvider = context.read<OrderProvider>();
    try {
      // The strict backend schema accepts only productId/quantity for items.
      // Prices are deliberately not sent; the server reprices from the DB.
      final items = cart.items
          .map((item) => <String, dynamic>{
                'productId': item.id,
                'quantity': item.quantity,
              })
          .toList();
      final success = await orderProvider.createOrder(
        items: items,
        deliveryAddress: _addressCtrl.text.trim(),
      );
      if (!mounted) return;
      if (success && orderProvider.selectedOrder != null) {
        await cart.clearCart();
        Get.offNamed(AppRoutes.orderDetail, arguments: orderProvider.selectedOrder!.id);
        Get.snackbar(
          'Order Placed!',
          'Your order has been placed successfully',
          backgroundColor: AppTheme.success.withOpacity(0.9),
          colorText: Colors.white,
          snackPosition: SnackPosition.BOTTOM,
        );
      } else {
        Get.snackbar(
          'Order Failed',
          orderProvider.error ?? 'Please try again',
          backgroundColor: AppTheme.error.withOpacity(0.9),
          colorText: Colors.white,
          snackPosition: SnackPosition.BOTTOM,
        );
      }
    } catch (e) {
      if (!mounted) return;
      Get.snackbar(
        'Order Failed',
        apiErrorMessage(e, fallback: 'Could not place your order. Please try again.'),
        backgroundColor: AppTheme.error.withOpacity(0.9),
        colorText: Colors.white,
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: cart.items.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.bgCard,
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: const Icon(Icons.shopping_cart_outlined,
                        size: 48, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 16),
                  const Text('Your cart is empty',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 18)),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () => Get.offNamed(AppRoutes.home),
                    icon: const Icon(Icons.storefront_outlined, size: 18),
                    label: const Text('Browse Products'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (cart.error != null)
                      _errorBanner(cart.error!, cart.clearError),
                    _section('Order Summary'),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Column(
                        children: [
                          ...cart.items.map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.name,
                                      style: const TextStyle(
                                          color: AppTheme.textPrimary, fontSize: 14),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text('x${item.quantity}',
                                      style: const TextStyle(color: AppTheme.textMuted)),
                                  const SizedBox(width: 12),
                                  Text(
                                    formatBdt(item.price * item.quantity),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.textPrimary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Divider(color: AppTheme.borderColor),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Estimated subtotal',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.textPrimary)),
                              Text(
                                formatBdt(cart.totalPrice),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: AppTheme.textPrimary),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          const Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Final prices, discounts and taxes are calculated by the server when the order is placed.',
                              style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _section('Delivery'),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: TextFormField(
                        controller: _addressCtrl,
                        style: const TextStyle(color: AppTheme.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Delivery Address',
                          hintText: 'House, street, area, city',
                          helperText: '10–500 characters',
                          prefixIcon: Icon(Icons.location_on_outlined,
                              color: AppTheme.neonCyan, size: 20),
                        ),
                        maxLines: 2,
                        maxLength: maxDeliveryAddressLength,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.done,
                        validator: validateDeliveryAddress,
                        onFieldSubmitted: (_) => _placeOrder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Payment',
                              style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: AppTheme.textPrimary)),
                          SizedBox(height: 6),
                          Text(
                            'Payment details are submitted separately after the order is created. The mobile app does not collect them at checkout.',
                            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
      bottomNavigationBar: cart.items.isEmpty
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              decoration: const BoxDecoration(
                color: AppTheme.bgSurface,
                border: Border(top: BorderSide(color: AppTheme.borderColor)),
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _loading ? null : _placeOrder,
                    icon: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: AppTheme.bgDark),
                          )
                        : const Icon(Icons.lock_outline),
                    label: Text(
                      _loading ? 'Processing...' : 'Place Order',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16)),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _errorBanner(String message, VoidCallback onDismiss) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.error.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppTheme.error, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13)),
          ),
          TextButton(onPressed: onDismiss, child: const Text('Dismiss')),
        ],
      ),
    );
  }

  Widget _section(String title) {
    return Padding(
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
  }
}
