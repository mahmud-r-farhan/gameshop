import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../services/api_service.dart';
import '../../models/review_model.dart';

class ProductReviewsScreen extends StatefulWidget {
  const ProductReviewsScreen({super.key});

  @override
  State<ProductReviewsScreen> createState() => _ProductReviewsScreenState();
}

class _ProductReviewsScreenState extends State<ProductReviewsScreen> {
  final _service = ProductService();
  List<ReviewModel> _reviews = [];
  bool _loading = true;
  double _avgRating = 0;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    final productId = Get.arguments as String?;
    if (productId != null) _loadReviews(productId);
  }

  Future<void> _loadReviews(String productId) async {
    try {
      final data = await _service.getReviews(productId);
      _reviews = (data['reviews'] as List).map((e) => ReviewModel.fromJson(e)).toList();
      _avgRating = (data['averageRating'] as num?)?.toDouble() ?? 0;
      _total = data['totalReviews'] as int? ?? 0;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        backgroundColor: AppTheme.bgCard,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.bgDark,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: const Icon(Icons.arrow_back_rounded, color: AppTheme.textPrimary, size: 20),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Reviews ($_total)',
          style: const TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppTheme.borderColor, height: 1),
        ),
      ),
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 40, height: 40,
                    child: CircularProgressIndicator(
                      color: AppTheme.neonCyan.withOpacity( 0.7),
                      strokeWidth: 3,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Loading reviews...',
                    style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.6), fontSize: 14),
                  ),
                ],
              ),
            )
          : _reviews.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Icon(Icons.rate_review_outlined, size: 48, color: AppTheme.textSecondary.withOpacity( 0.4)),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'No reviews yet',
                        style: TextStyle(
                          color: AppTheme.textSecondary.withOpacity( 0.7),
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Be the first to review this product',
                        style: TextStyle(
                          color: AppTheme.textSecondary.withOpacity( 0.5),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _reviews.length + 1,
                  itemBuilder: (_, i) {
                    if (i == 0) {
                      return _buildRatingHeader();
                    }
                    final r = _reviews[i - 1];
                    return _buildReviewCard(r);
                  },
                ),
    );
  }

  Widget _buildRatingHeader() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Row(
        children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.amber.withOpacity( 0.2), Colors.orange.withOpacity( 0.1)],
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.amber.withOpacity( 0.2)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _avgRating.toStringAsFixed(1),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: Colors.amber,
                    letterSpacing: -1,
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (j) => Icon(
                    j < _avgRating.round() ? Icons.star : Icons.star_border,
                    color: Colors.amber, size: 12,
                  )),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$_total Reviews',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Average rating from customers',
                style: TextStyle(
                  color: AppTheme.textSecondary.withOpacity( 0.6),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReviewCard(ReviewModel r) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: AppTheme.neonCyan.withOpacity( 0.15),
                child: Text(
                  r.userName.isNotEmpty ? r.userName[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: AppTheme.neonCyan,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.userName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      r.createdAt.toString().substring(0, 10),
                      style: TextStyle(
                        color: AppTheme.textSecondary.withOpacity( 0.5),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity( 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.withOpacity( 0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '${r.rating}',
                      style: const TextStyle(
                        color: Colors.amber,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (r.comment != null && r.comment!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.bgDark.withOpacity( 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                r.comment!,
                style: TextStyle(
                  color: AppTheme.textSecondary.withOpacity( 0.85),
                  height: 1.5,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
