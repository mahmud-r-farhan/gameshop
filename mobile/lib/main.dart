import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'config/constants.dart';
import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/product_provider.dart';
import 'providers/order_provider.dart';
import 'screens/home/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/home/product_grid_screen.dart';
import 'screens/product/product_detail_screen.dart';
import 'screens/product/product_reviews_screen.dart';
import 'screens/cart/cart_screen.dart';
import 'screens/cart/checkout_screen.dart';
import 'screens/orders/orders_screen.dart';
import 'screens/orders/order_detail_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/profile/settings_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GameShopApp());
}

class GameShopApp extends StatelessWidget {
  const GameShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: GetMaterialApp(
        title: AppConstants.appName,
        theme: AppTheme.darkTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.dark,
        debugShowCheckedModeBanner: false,
        initialRoute: AppRoutes.splash,
        defaultTransition: Transition.fadeIn,
        getPages: [
          GetPage(name: AppRoutes.splash, page: () => const SplashScreen()),
          GetPage(name: AppRoutes.login, page: () => const LoginScreen()),
          GetPage(name: AppRoutes.register, page: () => const RegisterScreen()),
          GetPage(name: AppRoutes.forgotPassword, page: () => const ForgotPasswordScreen()),
          GetPage(name: AppRoutes.home, page: () => const HomeScreen()),
          GetPage(name: AppRoutes.products, page: () => const ProductGridScreen()),
          GetPage(name: AppRoutes.productDetail, page: () => const ProductDetailScreen()),
          GetPage(name: AppRoutes.productReviews, page: () => const ProductReviewsScreen()),
          GetPage(name: AppRoutes.cart, page: () => const CartScreen()),
          GetPage(name: AppRoutes.checkout, page: () => const CheckoutScreen()),
          GetPage(name: AppRoutes.orders, page: () => const OrdersScreen()),
          GetPage(name: AppRoutes.orderDetail, page: () => const OrderDetailScreen()),
          GetPage(name: AppRoutes.profile, page: () => const ProfileScreen()),
          GetPage(name: AppRoutes.settings, page: () => const SettingsScreen()),
        ],
      ),
    );
  }
}
