import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/product_model.dart';
import '../config/constants.dart';

class CartItem {
  final String id;
  final String name;
  final double price;
  int quantity;
  final String? thumbnailUrl;
  final String? gameType;

  CartItem({
    required this.id, required this.name, required this.price,
    this.quantity = 1, this.thumbnailUrl, this.gameType,
  });

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'price': price, 'quantity': quantity,
    'thumbnailUrl': thumbnailUrl, 'gameType': gameType,
  };

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
    id: json['id'], name: json['name'],
    price: (json['price'] as num).toDouble(),
    quantity: json['quantity'] as int? ?? 1,
    thumbnailUrl: json['thumbnailUrl'], gameType: json['gameType'],
  );

  double get total => price * quantity;
}

class CartProvider extends ChangeNotifier {
  List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);
  double get totalPrice => _items.fold(0.0, (sum, item) => sum + item.total);

  Future<void> loadCart() async {
    final prefs = await SharedPreferences.getInstance();
    final cartData = prefs.getString(AppConstants.cartKey);
    if (cartData != null) {
      final List<dynamic> decoded = jsonDecode(cartData);
      _items = decoded.map((e) => CartItem.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    }
  }

  Future<void> _saveCart() async {
    final prefs = await SharedPreferences.getInstance();
    final cartData = jsonEncode(_items.map((e) => e.toJson()).toList());
    await prefs.setString(AppConstants.cartKey, cartData);
  }

  void addItem(ProductModel product, {int quantity = 1}) {
    final idx = _items.indexWhere((item) => item.id == product.id);
    if (idx >= 0) {
      _items[idx].quantity += quantity;
    } else {
      _items.add(CartItem(
        id: product.id, name: product.name, price: product.price,
        quantity: quantity, thumbnailUrl: product.thumbnailUrl,
        gameType: product.gameType,
      ));
    }
    _saveCart();
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
    final idx = _items.indexWhere((item) => item.id == productId);
    if (idx >= 0) {
      if (quantity <= 0) {
        _items.removeAt(idx);
      } else {
        _items[idx].quantity = quantity;
      }
      _saveCart();
      notifyListeners();
    }
  }

  void removeItem(String productId) {
    _items.removeWhere((item) => item.id == productId);
    _saveCart();
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _saveCart();
    notifyListeners();
  }
}
