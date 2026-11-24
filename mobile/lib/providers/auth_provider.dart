import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../config/constants.dart';
import '../utils/api_values.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  UserModel? _user;
  String? _token;
  bool _loading = false;
  String? _error;

  AuthProvider({AuthService? authService})
      : _authService = authService ?? AuthService();

  UserModel? get user => _user;
  String? get token => _token;
  bool get loading => _loading;
  String? get error => _error;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;
  bool get isAdmin => _user?.role == 'ADMIN' || _user?.role == 'SUPER_ADMIN';

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConstants.tokenKey);
    _error = null;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await _authService.login(email, password);
      final user = data['user'];
      final token = data['accessToken'];
      if (user is! Map || token is! String || token.isEmpty) {
        throw const FormatException('Unexpected login response');
      }
      _user = UserModel.fromJson(Map<String, dynamic>.from(user));
      _token = token;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, token);
      return true;
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not sign in. Please try again.');
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> register(String email, String password, String fullName, {String? phone}) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await _authService.register({
        'email': email,
        'password': password,
        'fullName': fullName,
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      });
      final user = data['user'];
      final token = data['accessToken'];
      if (user is! Map || token is! String || token.isEmpty) {
        throw const FormatException('Unexpected registration response');
      }
      _user = UserModel.fromJson(Map<String, dynamic>.from(user));
      _token = token;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, token);
      return true;
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not create your account. Please try again.');
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _user = null;
    _token = null;
    _error = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.tokenKey);
    notifyListeners();
  }

  /// Returns false and exposes a user-safe error instead of silently ignoring
  /// profile failures (which previously left the profile screen stuck in its
  /// "Not signed in" state while a token was still present).
  Future<bool> loadProfile() async {
    _error = null;
    try {
      final data = await _authService.getProfile();
      _user = UserModel.fromJson(data);
      notifyListeners();
      return true;
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not load your profile. Please try again.');
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile(Map<String, dynamic> data) async {
    _error = null;
    try {
      final result = await _authService.updateProfile(data);
      _user = UserModel.fromJson(result);
      notifyListeners();
      return true;
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not update your profile. Please try again.');
      notifyListeners();
      return false;
    }
  }
}
