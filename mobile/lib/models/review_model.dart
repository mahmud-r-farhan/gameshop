class ReviewModel {
  final String id;
  final int rating;
  final String? comment;
  final String userName;
  final String? avatarUrl;
  final DateTime createdAt;
  final int helpfulCount;

  ReviewModel({
    required this.id, required this.rating, this.comment,
    required this.userName, this.avatarUrl, required this.createdAt,
    this.helpfulCount = 0,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return ReviewModel(
      id: json['id'] as String,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      userName: user?['fullName'] as String? ?? json['userName'] as String? ?? 'Anonymous',
      avatarUrl: user?['avatarUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      helpfulCount: json['helpfulCount'] as int? ?? 0,
    );
  }
}

class ReviewStats {
  final double averageRating;
  final int totalReviews;
  final Map<int, int> distribution;

  ReviewStats({
    this.averageRating = 0, this.totalReviews = 0,
    this.distribution = const {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
  });
}
