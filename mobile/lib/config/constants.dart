/// Android emulator alias for the host machine. Debug-only default; a release
/// build pointing here cannot reach the API from a real device.
const String _emulatorHost = '10.0.2.2';

class AppConstants {
  static const String appName = 'GameShop by Mahmud';
  static const String appTagline = 'Gaming Products at Best Prices';

  /// Override with `--dart-define=API_BASE_URL=https://example.com/api/v1`.
  /// Kept as a `const` so release builds can be checked at startup.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://$_emulatorHost:5000/api/v1',
  );

  /// Override with `--dart-define=SOCKET_URL=https://example.com`.
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://$_emulatorHost:5000',
  );

  /// True only in release builds (`--release` / `flutter build apk`).
  static const bool isRelease = bool.fromEnvironment('dart.vm.product');

  /// Non-null when a release build would silently ship the emulator address.
  /// Debug builds may use the default so local development needs no flags.
  static String? get releaseConfigError => validateReleaseConfig(
        isRelease: isRelease,
        apiBaseUrl: baseUrl,
        socketBaseUrl: socketUrl,
        emulatorHost: _emulatorHost,
      );

  /// Pure validation so release-configuration behavior is unit-testable even
  /// though `dart.vm.product` and `--dart-define` are compile-time constants.
  static String? validateReleaseConfig({
    required bool isRelease,
    required String apiBaseUrl,
    required String socketBaseUrl,
    required String emulatorHost,
  }) {
    if (!isRelease) return null;
    if (apiBaseUrl.trim().isEmpty || socketBaseUrl.trim().isEmpty) {
      return 'Release build is missing API_BASE_URL or SOCKET_URL.';
    }
    if (apiBaseUrl.contains(emulatorHost) ||
        socketBaseUrl.contains(emulatorHost)) {
      return 'Release build is pointing at the emulator address. Pass '
          '--dart-define=API_BASE_URL=https://<domain>/api/v1 and '
          '--dart-define=SOCKET_URL=https://<domain>.';
    }
    return null;
  }

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

  // Payment Methods — must match the backend's PAYMENT_METHOD_VALUES.
  static const List<String> paymentMethods = ['BKASH', 'NAGAD', 'ROCKET'];

  // Product Categories
  static const String categoryCurrency = 'CURRENCY';
  static const String categoryGame = 'GAME';

  // Game Types
  static const List<String> gameTypes = [
    'PUBG', 'FREE_FIRE', 'GTA', 'MLBB', 'VALORANT'
  ];
}
