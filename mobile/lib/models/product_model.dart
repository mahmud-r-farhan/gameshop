import '../utils/api_values.dart';

class ProductModel {
  final String id;
  final String name;
  final String? description;
  final String category;
  final String? gameType;
  final double price;
  final double? originalPrice;
  final bool isAvailable;
  final bool isFeatured;
  final String? thumbnailUrl;
  final List<String> images;
  final double averageRating;
  final int reviewCount;
  final List<ProductSpec> specs;

  ProductModel({
    required this.id,
    required this.name,
    this.description,
    required this.category,
    this.gameType,
    required this.price,
    this.originalPrice,
    this.isAvailable = true,
    this.isFeatured = false,
    this.thumbnailUrl,
    this.images = const [],
    this.averageRating = 0,
    this.reviewCount = 0,
    this.specs = const [],
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String,
      gameType: json['gameType'] as String?,
      price: parseApiAmount(json['price'], field: 'price'),
      originalPrice: parseOptionalApiAmount(json['originalPrice'], field: 'originalPrice'),
      isAvailable: json['isAvailable'] as bool? ?? true,
      isFeatured: json['isFeatured'] as bool? ?? false,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      images: (json['images'] as List?)
              ?.map((url) => url.toString().trim())
              .where((url) => url.isNotEmpty)
              .toList() ??
          [],
      averageRating: parseApiAmount(json['averageRating'] ?? 0, field: 'averageRating'),
      reviewCount: parseApiCount(json['reviewCount'], field: 'reviewCount', fallback: 0),
      specs: (json['specs'] as List?)
              ?.map((spec) => ProductSpec.fromJson(Map<String, dynamic>.from(spec as Map)))
              .toList() ??
          [],
    );
  }

  String get formattedPrice => formatBdt(price);

  /// Prefer the backend-provided thumbnail; fall back to the first image.
  String? get displayImageUrl {
    final thumbnail = thumbnailUrl?.trim();
    if (thumbnail != null && thumbnail.isNotEmpty) return thumbnail;
    for (final image in images) {
      if (image.isNotEmpty) return image;
    }
    return null;
  }

  String? get discountPercentage {
    final original = originalPrice;
    if (original == null || original <= 0 || original <= price) return null;
    final discount = ((original - price) / original * 100).round();
    return '$discount%';
  }
}

class ProductSpec {
  final String id;
  final String? name;
  final String? value;

  ProductSpec({required this.id, this.name, this.value});

  factory ProductSpec.fromJson(Map<String, dynamic> json) => ProductSpec(
        id: json['id'] as String,
        name: json['specName'] as String? ?? json['name'] as String?,
        value: json['specValue'] as String? ?? json['value'] as String?,
      );
}
