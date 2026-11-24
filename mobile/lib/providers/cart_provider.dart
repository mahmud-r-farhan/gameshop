import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/product_model.dart';
import '../config/constants.dart';
import '../utils/api_values.dart';

class CartItem {
  final String id;
  final String name;
  final double price;
  int quantity;
  final String? thumbnailUrl;
  final String? gameType;

  CartItem({
    required this.id,
    required this.name,
    required this.price,
    this.quantity = 1,
    this.thumbnailUrl,
    this.gameType,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price': price,
        'quantity': quantity,
        'thumbnailUrl': thumbnailUrl,
        'gameType': gameType,
      };

  factory CartItem.fromJson(Map<String, dynamic> json) {
    final quantity = parseApiCount(json['quantity'], field: 'quantity', fallback: 1);
    final price = parseApiAmount(json['price'], field: 'price');
    if (quantity <= 0) {
      throw const FormatException('Saved cart quantity must be positive');
    }
    if (price < 0) {
      throw const FormatException('Saved cart price cannot be negative');
    }
    return CartItem(
      id: json['id'] as String,
      name: json['name'] as String,
      price: price,
      quantity: quantity,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      gameType: json['gameType'] as String?,
    );
  }

  double get total => price * quantity;
}

class CartProvider extends ChangeNotifier {
  List<CartItem> _items = [];
  String? _error;

  List<CartItem> get items => List.unmodifiable(_items);
  String? get error => _error;
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);
  double get totalPrice => _items.fold(0.0, (sum, item) => sum + item.total);

  /// Corrupt or stale local cart data must not crash startup. It is discarded
  /// and surfaced as a retryable error rather than silently swallowed.
  Future<void> loadCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartData = prefs.getString(AppConstants.cartKey);
      if (cartData == null || cartData.isEmpty) {
        _items = [];
        _error = null;
        return;
      }
      final decoded = jsonDecode(cartData);
      if (decoded is! List) {
        throw const FormatException('Saved cart is not a list');
      }
      _items = decoded
          .map((entry) => CartItem.fromJson(Map<String, dynamic>.from(entry as Map)))
          .toList();
      _error = null;
    } catch (_) {
      _items = [];
      _error = 'Your saved cart could not be loaded. Please add your items again.';
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(AppConstants.cartKey);
      } catch (_) {
        // Keep the in-memory reset even if local storage is unavailable.
      }
    } finally {
      notifyListeners();
    }
  }

  Future<void> _saveCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartData = jsonEncode(_items.map((item) => item.toJson()).toList());
      await prefs.setString(AppConstants.cartKey, cartData);
    } catch (_) {
      _error = 'Could not save your cart. Please try again.';
      notifyListeners();
    }
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }

  Future<void> addItem(ProductModel product, {int quantity = 1}) async {
    if (quantity <= 0 || !product.price.isFinite || product.price < 0) return;
    final idx = _items.indexWhere((item) => item.id == product.id);
    if (idx >= 0) {
      _items[idx].quantity += quantity;
    } else {
      _items.add(CartItem(
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        thumbnailUrl: product.thumbnailUrl,
        gameType: product.gameType,
      ));
    }
    _error = null;
    notifyListeners();
    await _saveCart();
  }

  Future<void> updateQuantity(String productId, int quantity) async {
    final idx = _items.indexWhere((item) => item.id == productId);
    if (idx < 0) return;
    if (quantity <= 0) {
      _items.removeAt(idx);
    } else {
      _items[idx].quantity = quantity;
    }
    _error = null;
    notifyListeners();
    await _saveCart();
  }

  Future<void> removeItem(String productId) async {
    _items.removeWhere((item) => item.id == productId);
    _error = null;
    notifyListeners();
    await _saveCart();
  }

  Future<void> clearCart() async {
    _items.clear();
    _error = null;
    notifyListeners();
    await _saveCart();
  }
}
