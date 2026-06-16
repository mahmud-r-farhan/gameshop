import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/product_provider.dart';
import '../../widgets/product_card.dart';
import 'product_grid_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductProvider>().loadFeatured();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: [
        _buildHomeTab(),
        const ProductGridScreen(),
      ]),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) {
          if (i == 2) { Get.toNamed(AppRoutes.cart); return; }
          if (i == 3) { Get.toNamed(AppRoutes.profile); return; }
          setState(() => _currentIndex = i);
        },
        type: BottomNavigationBarType.fixed,
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          const BottomNavigationBarItem(icon: Icon(Icons.store_outlined), activeIcon: Icon(Icons.store), label: 'Products'),
          BottomNavigationBarItem(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.shopping_cart_outlined),
                if (cart.itemCount > 0)
                  Positioned(right: -8, top: -4, child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: AppTheme.neonCyan, shape: BoxShape.circle),
                    child: Text('${cart.itemCount}', style: const TextStyle(color: AppTheme.bgDark, fontSize: 9, fontWeight: FontWeight.w800)),
                  )),
              ],
            ),
            label: 'Cart',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 32),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppTheme.bgDark, Color(0xFF0D1020), AppTheme.bgSurface],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Consumer<AuthProvider>(builder: (_, auth, __) => Row(
                  children: [
                    Text('Welcome, ${auth.user?.fullName ?? 'Guest'}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                    const Spacer(),
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.bgCard,
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: const Icon(Icons.notifications_outlined, size: 18, color: AppTheme.neonCyan),
                    ),
                  ],
                )),
                const SizedBox(height: 8),
                const Text('Gaming Products\nat Best Prices', style: TextStyle(color: AppTheme.textPrimary, fontSize: 30, fontWeight: FontWeight.w900, height: 1.1)),
              ],
            ),
          ),
          // Stats bar
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: AppTheme.bgCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _stat('50K+', 'Gamers', AppTheme.neonCyan),
                Container(width: 1, height: 30, color: AppTheme.borderColor),
                _stat('10K+', 'Orders', AppTheme.neonViolet),
                Container(width: 1, height: 30, color: AppTheme.borderColor),
                _stat('4.9', 'Rating', AppTheme.neonAmber),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Categories
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionHeader(title: 'Shop by Game', action: 'See All'),
                const SizedBox(height: 12),
                SizedBox(
                  height: 90,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    _categoryCard('PUBG', '🔫', AppTheme.neonAmber.withOpacity(0.15)),
                    _categoryCard('Free Fire', '🔥', Colors.orange.withOpacity(0.15)),
                    _categoryCard('GTA', '🚗', AppTheme.neonCyan.withOpacity(0.15)),
                    _categoryCard('MLBB', '⚔️', AppTheme.neonViolet.withOpacity(0.15)),
                    _categoryCard('Valorant', '🔫', Colors.red.withOpacity(0.15)),
                  ]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Featured Products
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _SectionHeader(title: 'Featured', action: 'See All', onAction: () => setState(() => _currentIndex = 1)),
          ),
          const SizedBox(height: 8),
          Consumer<ProductProvider>(builder: (_, pp, __) {
            if (pp.featured.isEmpty) {
              return SizedBox(
                height: 240,
                child: Center(child: pp.loading
                  ? const CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonCyan)
                  : const Text('No products yet', style: TextStyle(color: AppTheme.textSecondary))),
              );
            }
            return SizedBox(
              height: 270,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: pp.featured.length,
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: SizedBox(width: 180, child: ProductCard(product: pp.featured[i])),
                ),
              ),
            );
          }),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _stat(String value, String label, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 18)),
        Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
      ],
    );
  }

  Widget _categoryCard(String name, String emoji, Color bgColor) {
    return GestureDetector(
      onTap: () => Get.toNamed(AppRoutes.products, arguments: {'gameType': name.toUpperCase().replaceAll(' ', '_')}),
      child: Container(
        width: 90,
        margin: const EdgeInsets.only(right: 10),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 4),
            Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: AppTheme.textPrimary), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String action;
  final VoidCallback? onAction;
  const _SectionHeader({required this.title, this.action = '', this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.3)),
        if (action.isNotEmpty)
          GestureDetector(
            onTap: onAction,
            child: Text(action, style: const TextStyle(color: AppTheme.neonCyan, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
      ],
    );
  }
}
