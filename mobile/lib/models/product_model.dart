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
    required this.id, required this.name, this.description,
    required this.category, this.gameType, required this.price,
    this.originalPrice, this.isAvailable = true, this.isFeatured = false,
    this.thumbnailUrl, this.images = const [],
    this.averageRating = 0, this.reviewCount = 0, this.specs = const [],
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String,
      gameType: json['gameType'] as String?,
      price: (json['price'] as num).toDouble(),
      originalPrice: (json['originalPrice'] as num?)?.toDouble(),
      isAvailable: json['isAvailable'] as bool? ?? true,
      isFeatured: json['isFeatured'] as bool? ?? false,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      images: (json['images'] as List?)?.cast<String>() ?? [],
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      reviewCount: (json['reviewCount'] as int?) ?? 0,
      specs: (json['specs'] as List?)?.map((s) => ProductSpec.fromJson(s)).toList() ?? [],
    );
  }

  String get formattedPrice => 'BDT ${price.toInt().toString()}';
  String? get discountPercentage {
    if (originalPrice == null || originalPrice == 0) return null;
    final discount = ((originalPrice! - price) / originalPrice! * 100).round();
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
