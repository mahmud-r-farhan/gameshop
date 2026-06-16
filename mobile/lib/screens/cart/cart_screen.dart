import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../providers/cart_provider.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shopping Cart'),
        actions: [
          Consumer<CartProvider>(
            builder: (_, cart, __) => cart.items.isEmpty
                ? const SizedBox()
                : IconButton(
                    icon: const Icon(Icons.delete_sweep_outlined, color: AppTheme.error, size: 20),
                    onPressed: () => Get.defaultDialog(
                      title: 'Clear Cart',
                      middleText: 'Remove all items?',
                      backgroundColor: AppTheme.bgSurface,
                      titleStyle: const TextStyle(color: AppTheme.textPrimary),
                      middleTextStyle: const TextStyle(color: AppTheme.textSecondary),
                      radius: 16,
                      cancel: TextButton(onPressed: () => Get.back(), child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted))),
                      confirm: TextButton(onPressed: () { cart.clearCart(); Get.back(); }, child: const Text('Clear', style: TextStyle(color: AppTheme.error))),
                    ),
                  ),
          ),
        ],
      ),
      body: Consumer<CartProvider>(
        builder: (_, cart, __) {
          if (cart.items.isEmpty) {
            return Center(
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
                    child: const Icon(Icons.shopping_cart_outlined, size: 48, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text('Your cart is empty', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
                  const SizedBox(height: 8),
                  Text('Browse games and add them to your cart', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7))),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => Get.offNamed(AppRoutes.home),
                    icon: const Icon(Icons.explore, size: 18),
                    label: const Text('Browse Games'),
                  ),
                ],
              ),
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: cart.items.length,
                  itemBuilder: (_, i) {
                    final item = cart.items[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 72, height: 72,
                            decoration: BoxDecoration(
                              color: AppTheme.neonCyan.withOpacity( 0.05),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.videogame_asset, color: AppTheme.textMuted, size: 28),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 4),
                                Text('BDT ${item.price.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w800, fontSize: 16)),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    GestureDetector(
                                      onTap: () => cart.updateQuantity(item.id, item.quantity - 1),
                                      child: Container(
                                        width: 32, height: 32,
                                        decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.borderColor)),
                                        child: const Icon(Icons.remove, size: 16, color: AppTheme.textSecondary),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 12),
                                      child: Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.textPrimary)),
                                    ),
                                    GestureDetector(
                                      onTap: () => cart.updateQuantity(item.id, item.quantity + 1),
                                      child: Container(
                                        width: 32, height: 32,
                                        decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.borderColor)),
                                        child: const Icon(Icons.add, size: 16, color: AppTheme.neonCyan),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: () => cart.removeItem(item.id),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: AppTheme.error.withOpacity( 0.1), borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.close, size: 16, color: AppTheme.error),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              // Checkout bar
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                decoration: const BoxDecoration(
                  color: AppTheme.bgSurface,
                  border: Border(top: BorderSide(color: AppTheme.borderColor)),
                ),
                child: SafeArea(
                  top: false,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Total', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 12)),
                            const SizedBox(height: 2),
                            Text('BDT ${cart.totalPrice.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w900, fontSize: 24)),
                          ],
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => Get.toNamed(AppRoutes.checkout),
                        icon: const Icon(Icons.lock_outline, size: 16),
                        label: Text('Checkout (${cart.items.length})', style: const TextStyle(fontWeight: FontWeight.w700)),
                        style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
