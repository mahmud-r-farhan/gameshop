import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gameshop_mobile/providers/auth_provider.dart';
import 'package:gameshop_mobile/providers/cart_provider.dart';
import 'package:gameshop_mobile/models/product_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('CartProvider Tests', () {
    test('CartProvider initial state is empty', () {
      final cart = CartProvider();
      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
      expect(cart.totalPrice, 0.0);
    });

    test('addItem adds new product and updates total', () {
      final cart = CartProvider();
      final product = ProductModel(
        id: 'p1',
        name: 'Game 1',
        category: 'GAME',
        price: 50.0,
      );

      cart.addItem(product, quantity: 2);

      expect(cart.items.length, 1);
      expect(cart.itemCount, 2);
      expect(cart.totalPrice, 100.0);
      expect(cart.items.first.name, 'Game 1');
    });

    test('addItem increments quantity if product already in cart', () {
      final cart = CartProvider();
      final product = ProductModel(
        id: 'p1',
        name: 'Game 1',
        category: 'GAME',
        price: 50.0,
      );

      cart.addItem(product, quantity: 1);
      cart.addItem(product, quantity: 2);

      expect(cart.items.length, 1);
      expect(cart.itemCount, 3);
      expect(cart.totalPrice, 150.0);
    });

    test('updateQuantity modifies item quantity or removes if quantity <= 0', () {
      final cart = CartProvider();
      final product = ProductModel(
        id: 'p1',
        name: 'Game 1',
        category: 'GAME',
        price: 50.0,
      );

      cart.addItem(product, quantity: 3);
      cart.updateQuantity('p1', 5);

      expect(cart.itemCount, 5);
      expect(cart.totalPrice, 250.0);

      cart.updateQuantity('p1', 0);
      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
    });

    test('removeItem removes item from cart', () {
      final cart = CartProvider();
      final product1 = ProductModel(id: 'p1', name: 'Game 1', category: 'GAME', price: 50.0);
      final product2 = ProductModel(id: 'p2', name: 'Game 2', category: 'GAME', price: 30.0);

      cart.addItem(product1);
      cart.addItem(product2);

      cart.removeItem('p1');

      expect(cart.items.length, 1);
      expect(cart.items.first.id, 'p2');
    });

    test('clearCart empties the cart', () {
      final cart = CartProvider();
      final product = ProductModel(id: 'p1', name: 'Game 1', category: 'GAME', price: 50.0);

      cart.addItem(product);
      cart.clearCart();

      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
      expect(cart.totalPrice, 0.0);
    });
  });

  group('AuthProvider Tests', () {
    test('AuthProvider initial state', () {
      final auth = AuthProvider();
      expect(auth.user, isNull);
      expect(auth.token, isNull);
      expect(auth.isAuthenticated, isFalse);
      expect(auth.isAdmin, isFalse);
      expect(auth.loading, isFalse);
    });

    test('loadToken sets token from shared preferences', () async {
      SharedPreferences.setMockInitialValues({'access_token': 'my_mock_token'});
      final auth = AuthProvider();

      await auth.loadToken();

      expect(auth.token, 'my_mock_token');
      expect(auth.isAuthenticated, isTrue);
    });

    test('logout clears user and token', () async {
      SharedPreferences.setMockInitialValues({'access_token': 'token_to_clear'});
      final auth = AuthProvider();
      await auth.loadToken();

      await auth.logout();

      expect(auth.user, isNull);
      expect(auth.token, isNull);
      expect(auth.isAuthenticated, isFalse);
    });
  });
}
