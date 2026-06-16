class AppConstants {
  static const String appName = 'GameShop by Mahmud';
  static const String baseUrl = 'http://10.0.2.2:5000/api/v1';
  static const String socketUrl = 'http://10.0.2.2:5000';
  static const String appTagline = 'Gaming Products at Best Prices';

  // Shared Preferences Keys
  static const String tokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'user_data';
  static const String cartKey = 'cart_items';

  // Pagination
  static const int defaultPageSize = 20;

  // Order Status
  static const String orderPending = 'PENDING';
  static const String orderProcessing = 'PROCESSING';
  static const String orderDelivered = 'DELIVERED';
  static const String orderCancelled = 'CANCELLED';

  // Payment Status
  static const String paymentPending = 'PENDING';
  static const String paymentPendingVerification = 'PENDING_VERIFICATION';
  static const String paymentVerified = 'VERIFIED';
  static const String paymentFailed = 'FAILED';

  // Product Categories
  static const String categoryCurrency = 'CURRENCY';
  static const String categoryGame = 'GAME';

  // Game Types
  static const List<String> gameTypes = [
    'PUBG', 'FREE_FIRE', 'GTA', 'MLBB', 'VALORANT'
  ];
}
