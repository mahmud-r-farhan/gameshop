import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gameshop_mobile/config/constants.dart';
import 'package:gameshop_mobile/models/product_model.dart';
import 'package:gameshop_mobile/providers/auth_provider.dart';
import 'package:gameshop_mobile/providers/cart_provider.dart';
import 'package:gameshop_mobile/services/api_service.dart';
import 'support/fakes.dart';

class _FailingAuthService extends AuthService {
  _FailingAuthService()
      : super(
          api: FakeApiClient(
            error: testDioError(
              path: '/auth/login',
              statusCode: 401,
              message: 'Invalid email or password',
            ),
          ),
        );
}

ProductModel _product({String id = 'p1', double price = 50.0}) => ProductModel(
      id: id,
      name: 'Game $id',
      category: 'GAME',
      price: price,
    );

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

    test('addItem adds new product and updates total', () async {
      final cart = CartProvider();
      await cart.addItem(_product(), quantity: 2);

      expect(cart.items.length, 1);
      expect(cart.itemCount, 2);
      expect(cart.totalPrice, 100.0);
      expect(cart.items.first.name, 'Game p1');
    });

    test('addItem increments quantity if product already in cart', () async {
      final cart = CartProvider();
      await cart.addItem(_product(), quantity: 1);
      await cart.addItem(_product(), quantity: 2);

      expect(cart.items.length, 1);
      expect(cart.itemCount, 3);
      expect(cart.totalPrice, 150.0);
    });

    test('addItem ignores non-positive quantities', () async {
      final cart = CartProvider();
      await cart.addItem(_product(), quantity: 0);
      await cart.addItem(_product(), quantity: -2);
      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
    });

    test('updateQuantity modifies item quantity or removes if quantity <= 0', () async {
      final cart = CartProvider();
      await cart.addItem(_product(), quantity: 3);
      await cart.updateQuantity('p1', 5);

      expect(cart.itemCount, 5);
      expect(cart.totalPrice, 250.0);

      await cart.updateQuantity('p1', 0);
      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
    });

    test('removeItem removes item from cart', () async {
      final cart = CartProvider();
      await cart.addItem(_product(id: 'p1'));
      await cart.addItem(_product(id: 'p2', price: 30.0));

      await cart.removeItem('p1');

      expect(cart.items.length, 1);
      expect(cart.items.first.id, 'p2');
    });

    test('clearCart empties the cart', () async {
      final cart = CartProvider();
      await cart.addItem(_product());
      await cart.clearCart();

      expect(cart.items, isEmpty);
      expect(cart.itemCount, 0);
      expect(cart.totalPrice, 0.0);
    });

    test('loadCart restores decimal-string prices and string counts', () async {
      SharedPreferences.setMockInitialValues({
        AppConstants.cartKey: jsonEncode([
          {
            'id': 'p1',
            'name': 'Game p1',
            'price': '50.50',
            'quantity': '2',
          }
        ]),
      });
      final cart = CartProvider();
      await cart.loadCart();

      expect(cart.itemCount, 2);
      expect(cart.totalPrice, 101.0);
      expect(cart.error, isNull);
    });

    test('loadCart discards corrupt data with a visible error', () async {
      SharedPreferences.setMockInitialValues({
        AppConstants.cartKey: '{not valid json',
      });
      final cart = CartProvider();
      await cart.loadCart();

      expect(cart.items, isEmpty);
      expect(cart.error, contains('could not be loaded'));
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(AppConstants.cartKey), isNull);
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

    test('login returns false and exposes a user-safe error on API failure', () async {
      final auth = AuthProvider(authService: _FailingAuthService());
      final success = await auth.login('buyer@example.com', 'wrongpass');

      expect(success, isFalse);
      expect(auth.loading, isFalse);
      expect(auth.isAuthenticated, isFalse);
      expect(auth.error, 'Invalid email or password');
    });

    test('loadProfile returns false instead of swallowing errors', () async {
      final auth = AuthProvider(authService: _FailingAuthService());
      final success = await auth.loadProfile();

      expect(success, isFalse);
      expect(auth.error, 'Invalid email or password');
    });
  });
}
