import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../models/product_model.dart';
import '../../utils/api_values.dart';

class ProductCard extends StatelessWidget {
  final ProductModel product;

  const ProductCard({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    final imageUrl = product.displayImageUrl;
    final discountLabel = product.discountPercentage;
    final hasDiscount = discountLabel != null;

    return Semantics(
      button: true,
      label: '${product.name}, ${formatBdt(product.price)}',
      child: GestureDetector(
        onTap: () => Get.toNamed(AppRoutes.productDetail, arguments: product.id),
        child: Container(
          decoration: BoxDecoration(
            color: AppTheme.bgCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.borderColor),
            boxShadow: [
              BoxShadow(
                color: AppTheme.neonCyan.withOpacity(0.05),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image
              Expanded(
                flex: 3,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppTheme.neonCyan.withOpacity(0.1),
                            AppTheme.neonViolet.withOpacity(0.05),
                            AppTheme.bgDark,
                          ],
                        ),
                      ),
                      child: imageUrl != null
                          ? CachedNetworkImage(
                              imageUrl: imageUrl,
                              fit: BoxFit.cover,
                              placeholder: (_, _) => const Center(
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: AppTheme.neonCyan),
                                ),
                              ),
                              errorWidget: (_, _, _) => const Icon(
                                  Icons.videogame_asset,
                                  size: 40,
                                  color: Colors.white24),
                            )
                          : const Center(
                              child: Icon(Icons.videogame_asset,
                                  size: 40, color: Colors.white24),
                            ),
                    ),
                    // Discount badge
                    if (hasDiscount)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCard,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: AppTheme.neonCyan.withOpacity(0.3)),
                          ),
                          child: Text(
                            '-$discountLabel',
                            style: const TextStyle(
                                color: AppTheme.neonCyan,
                                fontSize: 10,
                                fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    // Game type badge
                    if (product.gameType != null)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCard,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            product.gameType!,
                            style: const TextStyle(
                                color: AppTheme.textMuted,
                                fontSize: 9,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              // Details
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppTheme.textPrimary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (product.averageRating > 0) ...[
                            const Icon(Icons.star,
                                size: 13, color: AppTheme.neonAmber),
                            const SizedBox(width: 3),
                            Text(
                              product.averageRating.toStringAsFixed(1),
                              style: const TextStyle(
                                  color: AppTheme.textMuted, fontSize: 11),
                            ),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            formatBdt(product.price),
                            style: const TextStyle(
                                color: AppTheme.neonCyan,
                                fontWeight: FontWeight.w800,
                                fontSize: 14),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (hasDiscount)
                            Text(
                              formatBdt(product.originalPrice!),
                              style: const TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 11,
                                  decoration: TextDecoration.lineThrough),
                            ),
                          const Spacer(),
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppTheme.bgCard,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: const Icon(Icons.add_shopping_cart,
                                size: 18, color: AppTheme.neonCyan),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
