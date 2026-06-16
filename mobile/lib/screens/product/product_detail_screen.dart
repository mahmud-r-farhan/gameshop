import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../models/product_model.dart';
import '../../providers/cart_provider.dart';
import '../../providers/product_provider.dart';

class ProductDetailScreen extends StatefulWidget {
  final String? productId;
  const ProductDetailScreen({super.key, this.productId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  @override
  void initState() {
    super.initState();
    final id = widget.productId ?? Get.arguments as String?;
    if (id != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<ProductProvider>().loadProduct(id);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.bgCard,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        title: Text(
          'Product Details',
          style: TextStyle(
            color: AppTheme.textPrimary.withOpacity( 0.9),
            fontWeight: FontWeight.w600,
            fontSize: 18,
          ),
        ),
      ),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.loading) return const Center(child: CircularProgressIndicator(color: AppTheme.neonCyan));

          final product = pp.selectedProduct ?? (Get.arguments as ProductModel?);
          if (product == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.search_off_rounded, size: 64, color: AppTheme.textSecondary),
                  const SizedBox(height: 16),
                  Text('Product not found', style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 16)),
                ],
              ),
            );
          }

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Hero Image Section
                Container(
                  height: 300,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppTheme.neonCyan.withOpacity( 0.3),
                        AppTheme.neonViolet.withOpacity( 0.2),
                        AppTheme.bgDark,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Decorative glow orbs
                      Positioned(
                        top: -40, right: -40,
                        child: Container(
                          width: 180, height: 180,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppTheme.neonCyan.withOpacity( 0.08),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: -20, left: -20,
                        child: Container(
                          width: 140, height: 140,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppTheme.neonViolet.withOpacity( 0.06),
                          ),
                        ),
                      ),
                      // Product image
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: SizedBox(
                          width: 200, height: 220,
                          child: product.thumbnailUrl != null
                              ? Image.network(
                                  product.thumbnailUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.sports_esports, size: 80, color: Colors.white54),
                                )
                              : const Icon(Icons.sports_esports, size: 80, color: Colors.white54),
                        ),
                      ),
                    ],
                  ),
                ),

                // Content Section
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category & Game Type chips
                      Row(children: [
                        _glassChip(product.category, AppTheme.neonCyan),
                        if (product.gameType != null) ...[
                          const SizedBox(width: 8),
                          _glassChip(product.gameType!, AppTheme.neonAmber),
                        ],
                      ]),
                      const SizedBox(height: 16),

                      // Product Name
                      Text(
                        product.name,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Price Section
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              product.formattedPrice,
                              style: const TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.neonCyan,
                                letterSpacing: -1,
                              ),
                            ),
                            if (product.discountPercentage != null) ...[
                              const SizedBox(width: 12),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  'BDT ${product.originalPrice!.toInt()}',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    color: AppTheme.textSecondary,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(colors: [Color(0xFFFF6B6B), Color(0xFFFF4757)]),
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [
                                    BoxShadow(color: Colors.red.withOpacity( 0.3), blurRadius: 8, offset: const Offset(0, 2)),
                                  ],
                                ),
                                child: Text(
                                  '-${product.discountPercentage}',
                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Description
                      if (product.description != null) ...[
                        Text(
                          product.description!,
                          style: TextStyle(
                            color: AppTheme.textSecondary.withOpacity( 0.85),
                            height: 1.6,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Specifications
                      if (product.specs.isNotEmpty) ...[
                        const Text(
                          'Specifications',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCard,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.borderColor),
                          ),
                          child: Column(
                            children: product.specs.map((s) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Row(
                                children: [
                                  Container(
                                    width: 6, height: 6,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: AppTheme.neonCyan.withOpacity( 0.6),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '${s.name ?? ''}: ',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textPrimary,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    s.value ?? '',
                                    style: TextStyle(
                                      color: AppTheme.textSecondary.withOpacity( 0.8),
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            )).toList(),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Rating Row
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity( 0.15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.star_rounded, color: Colors.amber, size: 28),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  product.averageRating.toStringAsFixed(1),
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                Text(
                                  '${product.reviewCount} reviews',
                                  style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 13),
                                ),
                              ],
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () => Get.toNamed(AppRoutes.productReviews, arguments: product.id),
                              style: TextButton.styleFrom(
                                foregroundColor: AppTheme.neonCyan,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(color: AppTheme.neonCyan.withOpacity( 0.3)),
                                ),
                              ),
                              child: const Text('See Reviews', style: TextStyle(fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Add to Cart Button
                      Container(
                        width: double.infinity,
                        height: 56,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: const LinearGradient(
                            colors: [AppTheme.neonCyan, Color(0xFF00D4AA)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.neonCyan.withOpacity( 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            context.read<CartProvider>().addItem(product);
                            Get.snackbar(
                              'Added to Cart',
                              product.name,
                              backgroundColor: AppTheme.bgCard,
                              colorText: AppTheme.textPrimary,
                              borderRadius: 12,
                              borderColor: AppTheme.neonCyan.withOpacity( 0.3),
                              borderWidth: 1,
                              icon: const Icon(Icons.check_circle_rounded, color: AppTheme.neonCyan),
                              duration: const Duration(seconds: 2),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.shopping_cart_rounded, color: Colors.white, size: 22),
                              const SizedBox(width: 10),
                              Text(
                                'Add to Cart - ${product.formattedPrice}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _glassChip(String label, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: accentColor.withOpacity( 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accentColor.withOpacity( 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: accentColor,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
