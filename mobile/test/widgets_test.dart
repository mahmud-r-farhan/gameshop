import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gameshop_mobile/models/product_model.dart';
import 'package:gameshop_mobile/widgets/product_card.dart';
import 'package:gameshop_mobile/screens/auth/forgot_password_screen.dart';
import 'package:gameshop_mobile/screens/cart/cart_screen.dart';
import 'package:gameshop_mobile/screens/cart/checkout_screen.dart';
import 'package:gameshop_mobile/screens/profile/settings_screen.dart';
import 'package:gameshop_mobile/providers/cart_provider.dart';
import 'package:gameshop_mobile/providers/auth_provider.dart';
import 'package:gameshop_mobile/providers/product_provider.dart';
import 'package:gameshop_mobile/providers/order_provider.dart';

ProductModel _product({
  String id = 'p1',
  String name = 'Game 1',
  double price = 50.0,
  double? originalPrice,
}) =>
    ProductModel(
      id: id,
      name: name,
      category: 'GAME',
      price: price,
      originalPrice: originalPrice,
    );

Widget _withProviders(Widget home, {CartProvider? cart}) => MultiProvider(
      providers: [
        ChangeNotifierProvider<CartProvider>(create: (_) => cart ?? CartProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: GetMaterialApp(home: home),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Widget Tests', () {
    testWidgets('ProductCard displays product details accurately',
        (WidgetTester tester) async {
      final product = ProductModel(
        id: 'p1',
        name: 'PUBG Mobile 660 UC',
        category: 'CURRENCY',
        gameType: 'PUBG',
        price: 1000,
        originalPrice: 1200,
        averageRating: 4.8,
      );

      await tester.pumpWidget(
        GetMaterialApp(
          home: Scaffold(body: ProductCard(product: product)),
        ),
      );

      expect(find.text('PUBG Mobile 660 UC'), findsOneWidget);
      expect(find.text('PUBG'), findsOneWidget);
      expect(find.text('BDT 1000'), findsOneWidget);
      expect(find.text('-17%'), findsOneWidget);
    });

    testWidgets('CartScreen shows empty cart message when no items',
        (WidgetTester tester) async {
      await tester.pumpWidget(_withProviders(const CartScreen()));

      expect(find.text('Shopping Cart'), findsOneWidget);
      expect(find.text('Your cart is empty'), findsOneWidget);
      expect(find.text('Browse Games'), findsOneWidget);
    });

    testWidgets('CartScreen displays cart items when items present',
        (WidgetTester tester) async {
      final cartProvider = CartProvider();
      await cartProvider.addItem(
        ProductModel(
          id: 'p100',
          name: 'Valorant Points',
          category: 'CURRENCY',
          price: 1500,
        ),
        quantity: 2,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CartProvider>.value(value: cartProvider),
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => ProductProvider()),
            ChangeNotifierProvider(create: (_) => OrderProvider()),
          ],
          child: const GetMaterialApp(home: CartScreen()),
        ),
      );

      expect(find.text('Valorant Points'), findsOneWidget);
      expect(find.text('BDT 1500'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('BDT 3000'), findsOneWidget);
    });
  });

  group('Checkout honesty', () {
    testWidgets('Checkout uses server totals and backend address rules',
        (WidgetTester tester) async {
      final cartProvider = CartProvider();
      await cartProvider.addItem(_product(price: 1500), quantity: 2);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CartProvider>.value(value: cartProvider),
            ChangeNotifierProvider(create: (_) => OrderProvider()),
          ],
          child: const GetMaterialApp(home: CheckoutScreen()),
        ),
      );

      expect(find.text('Estimated subtotal'), findsOneWidget);
      expect(find.text('BDT 3000'), findsOneWidget);
      expect(find.text('Tax (10%)'), findsNothing);
      expect(find.text('PayPal'), findsNothing);
      expect(find.text('Place Order'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), 'Short');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Place Order'));
      await tester.pump();

      expect(
        find.text('Delivery address must be at least 10 characters'),
        findsOneWidget,
      );
    });
  });

  group('No fake settings or password flows', () {
    testWidgets('Settings shows BDT and no non-functional switches',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const GetMaterialApp(home: SettingsScreen()),
      );

      expect(find.text('BDT (৳)'), findsOneWidget);
      expect(find.text('USD (\$)'), findsNothing);
      expect(find.byType(Switch), findsNothing);
      expect(find.text('Change Password'), findsNothing);
    });

    testWidgets('Forgot password screen does not claim a fake OTP was sent',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const GetMaterialApp(home: ForgotPasswordScreen()),
      );

      expect(find.text('Reset Password'), findsOneWidget);
      expect(find.text('OTP Sent'), findsNothing);
      expect(find.textContaining('GameShop website'), findsOneWidget);
      expect(find.text('Back to Login'), findsOneWidget);
    });
  });
}
