import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';

/// Thin HTTP contract used by the service classes.
///
/// Keeping this as an interface lets unit tests assert exact request payloads
/// without a running backend or a mocked platform HTTP client.
abstract class ApiClient {
  Future<Response> get(String path, {Map<String, dynamic>? params});
  Future<Response> post(String path, {dynamic data});
  Future<Response> put(String path, {dynamic data});
  Future<Response> patch(String path, {dynamic data});
  Future<Response> delete(String path);
}

class ApiService implements ApiClient {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio _dio;

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));
    _addInterceptors();
  }

  void _addInterceptors() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString(AppConstants.tokenKey);
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Await the cleanup; the old fire-and-forget future could race with
          // the next request after a session expired.
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove(AppConstants.tokenKey);
        }
        handler.next(error);
      },
    ));
  }

  @override
  Future<Response> get(String path, {Map<String, dynamic>? params}) =>
      _dio.get(path, queryParameters: params);

  @override
  Future<Response> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  @override
  Future<Response> put(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  @override
  Future<Response> patch(String path, {dynamic data}) =>
      _dio.patch(path, data: data);

  @override
  Future<Response> delete(String path) => _dio.delete(path);
}

class AuthService {
  final ApiClient _api;

  AuthService({ApiClient? api}) : _api = api ?? ApiService();

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _api.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return _responseMap(res, '/auth/login');
  }

  Future<Map<String, dynamic>> register(Map<String, dynamic> data) async {
    final res = await _api.post('/auth/register', data: data);
    return _responseMap(res, '/auth/register');
  }

  /// The backend deliberately returns the same generic message whether or not
  /// the account exists; the client must not add its own existence hints.
  Future<void> forgotPassword(String email) async {
    await _api.post('/auth/forgot-password', data: {'email': email});
  }

  Future<Map<String, dynamic>> verifyOTP(String email, String otp) async {
    final res = await _api.post('/auth/verify-otp', data: {
      'email': email,
      'otp': otp,
    });
    return _responseMap(res, '/auth/verify-otp');
  }

  /// `/auth/reset-password` uses a `.strict()` schema requiring `token`, the
  /// signed `resetToken` returned by `/auth/verify-otp`.
  Future<void> resetPassword(String email, String password, String token) async {
    await _api.post('/auth/reset-password', data: {
      'email': email,
      'password': password,
      'token': token,
    });
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await _api.get('/auth/profile');
    return _responseMap(res, '/auth/profile');
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final res = await _api.patch('/auth/profile', data: data);
    return _responseMap(res, '/auth/profile');
  }
}

class ProductService {
  final ApiClient _api;

  ProductService({ApiClient? api}) : _api = api ?? ApiService();

  Future<Map<String, dynamic>> getProducts({Map<String, dynamic>? params}) async {
    final res = await _api.get('/products', params: params);
    return _responseMap(res, '/products');
  }

  /// The featured endpoint returns a list, not an object. Its previous
  /// `Map<String, dynamic>` return type threw at runtime before the provider
  /// could display any featured product.
  Future<List<dynamic>> getFeatured() async {
    final res = await _api.get('/products/featured');
    return _responseList(res, '/products/featured');
  }

  Future<Map<String, dynamic>> getProduct(String id) async {
    final res = await _api.get('/products/$id');
    return _responseMap(res, '/products/$id');
  }

  Future<Map<String, dynamic>> getReviews(String productId, {int page = 1}) async {
    final res = await _api.get('/reviews/product/$productId', params: {'page': page});
    return _responseMap(res, '/reviews/product/$productId');
  }
}

class OrderService {
  final ApiClient _api;

  OrderService({ApiClient? api}) : _api = api ?? ApiService();

  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> data) async {
    final res = await _api.post('/orders', data: data);
    return _responseMap(res, '/orders');
  }

  Future<Map<String, dynamic>> getOrders({Map<String, dynamic>? params}) async {
    final res = await _api.get('/orders', params: params);
    return _responseMap(res, '/orders');
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final res = await _api.get('/orders/$id');
    return _responseMap(res, '/orders/$id');
  }

  Future<Map<String, dynamic>> submitPayment(String orderId, Map<String, dynamic> data) async {
    final res = await _api.post('/orders/$orderId/submit-payment', data: data);
    return _responseMap(res, '/orders/$orderId/submit-payment');
  }

  Future<Map<String, dynamic>> createReview(Map<String, dynamic> data) async {
    final res = await _api.post('/reviews', data: data);
    return _responseMap(res, '/reviews');
  }
}

Map<String, dynamic> _responseMap(Response res, String path) {
  final value = _responseData(res, path);
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('Expected an object in the response from $path');
}

List<dynamic> _responseList(Response res, String path) {
  final value = _responseData(res, path);
  if (value is List) return List<dynamic>.from(value);
  throw FormatException('Expected a list in the response from $path');
}

Object? _responseData(Response res, String path) {
  final body = res.data;
  if (body is Map && body.containsKey('data')) return body['data'];
  throw FormatException('Unexpected response envelope from $path');
}
