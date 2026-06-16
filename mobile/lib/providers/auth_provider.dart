import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../config/constants.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  UserModel? _user;
  String? _token;
  bool _loading = false;
  String? _error;

  UserModel? get user => _user;
  String? get token => _token;
  bool get loading => _loading;
  String? get error => _error;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;
  bool get isAdmin => _user?.role == 'ADMIN' || _user?.role == 'SUPER_ADMIN';

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConstants.tokenKey);
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await _authService.login(email, password);
      _user = UserModel.fromJson(data['user']);
      _token = data['accessToken'] as String;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, _token!);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      return false;
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
        if (phone != null) 'phone': phone,
      });
      _user = UserModel.fromJson(data['user']);
      _token = data['accessToken'] as String;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, _token!);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _user = null;
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.tokenKey);
    notifyListeners();
  }

  Future<void> loadProfile() async {
    try {
      final data = await _authService.getProfile();
      _user = UserModel.fromJson(data);
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> updateProfile(Map<String, dynamic> data) async {
    try {
      final result = await _authService.updateProfile(data);
      _user = UserModel.fromJson(result);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
