import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';

class ApiService {
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

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString(AppConstants.tokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          // Token expired - clear and redirect to login
          SharedPreferences.getInstance().then((prefs) {
            prefs.remove(AppConstants.tokenKey);
          });
        }
        handler.next(error);
      },
    ));
  }

  Future<Response> get(String path, {Map<String, dynamic>? params}) =>
      _dio.get(path, queryParameters: params);

  Future<Response> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  Future<Response> put(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response> patch(String path, {dynamic data}) =>
      _dio.patch(path, data: data);

  Future<Response> delete(String path) =>
      _dio.delete(path);
}

class AuthService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _api.post('/auth/login', data: {
      'email': email, 'password': password,
    });
    return res.data['data'];
  }

  Future<Map<String, dynamic>> register(Map<String, dynamic> data) async {
    final res = await _api.post('/auth/register', data: data);
    return res.data['data'];
  }

  Future<void> forgotPassword(String email) async {
    await _api.post('/auth/forgot-password', data: {'email': email});
  }

  Future<Map<String, dynamic>> verifyOTP(String email, String otp) async {
    final res = await _api.post('/auth/verify-otp', data: {'email': email, 'otp': otp});
    return res.data['data'];
  }

  Future<void> resetPassword(String email, String password) async {
    await _api.post('/auth/reset-password', data: {'email': email, 'password': password});
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await _api.get('/auth/profile');
    return res.data['data'];
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final res = await _api.patch('/auth/profile', data: data);
    return res.data['data'];
  }
}

class ProductService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getProducts({Map<String, dynamic>? params}) async {
    final res = await _api.get('/products', params: params);
    return res.data['data'];
  }

  Future<Map<String, dynamic>> getFeatured() async {
    final res = await _api.get('/products/featured');
    return res.data['data'];
  }

  Future<Map<String, dynamic>> getProduct(String id) async {
    final res = await _api.get('/products/$id');
    return res.data['data'];
  }

  Future<Map<String, dynamic>> getReviews(String productId, {int page = 1}) async {
    final res = await _api.get('/reviews/product/$productId', params: {'page': page});
    return res.data['data'];
  }
}

class OrderService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> data) async {
    final res = await _api.post('/orders', data: data);
    return res.data['data'];
  }

  Future<Map<String, dynamic>> getOrders({Map<String, dynamic>? params}) async {
    final res = await _api.get('/orders', params: params);
    return res.data['data'];
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final res = await _api.get('/orders/$id');
    return res.data['data'];
  }

  Future<Map<String, dynamic>> submitPayment(String orderId, Map<String, dynamic> data) async {
    final res = await _api.post('/orders/$orderId/submit-payment', data: data);
    return res.data['data'];
  }

  Future<Map<String, dynamic>> createReview(Map<String, dynamic> data) async {
    final res = await _api.post('/reviews', data: data);
    return res.data['data'];
  }
}
