import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gameshop_mobile/models/product_model.dart';
import 'package:gameshop_mobile/widgets/product_card.dart';
import 'package:gameshop_mobile/screens/cart/cart_screen.dart';
import 'package:gameshop_mobile/providers/cart_provider.dart';
import 'package:gameshop_mobile/providers/auth_provider.dart';
import 'package:gameshop_mobile/providers/product_provider.dart';
import 'package:gameshop_mobile/providers/order_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Widget Tests', () {
    testWidgets('ProductCard displays product details accurately', (WidgetTester tester) async {
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
          home: Scaffold(
            body: ProductCard(product: product),
          ),
        ),
      );

      expect(find.text('PUBG Mobile 660 UC'), findsOneWidget);
      expect(find.text('PUBG'), findsOneWidget);
      expect(find.text('BDT 1000'), findsOneWidget);
      expect(find.text('-17%'), findsOneWidget);
    });

    testWidgets('CartScreen shows empty cart message when no items', (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => CartProvider()),
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => ProductProvider()),
            ChangeNotifierProvider(create: (_) => OrderProvider()),
          ],
          child: const GetMaterialApp(
            home: CartScreen(),
          ),
        ),
      );

      expect(find.text('Shopping Cart'), findsOneWidget);
      expect(find.text('Your cart is empty'), findsOneWidget);
      expect(find.text('Browse Games'), findsOneWidget);
    });

    testWidgets('CartScreen displays cart items when items present', (WidgetTester tester) async {
      final cartProvider = CartProvider();
      final product = ProductModel(
        id: 'p100',
        name: 'Valorant Points',
        category: 'CURRENCY',
        price: 1500,
      );
      cartProvider.addItem(product, quantity: 2);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CartProvider>.value(value: cartProvider),
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => ProductProvider()),
            ChangeNotifierProvider(create: (_) => OrderProvider()),
          ],
          child: const GetMaterialApp(
            home: CartScreen(),
          ),
        ),
      );

      expect(find.text('Valorant Points'), findsOneWidget);
      expect(find.text('BDT 1500'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('BDT 3000'), findsOneWidget);
    });
  });
}
