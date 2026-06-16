import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/product_provider.dart';
import '../../widgets/product_card.dart';

class ProductGridScreen extends StatefulWidget {
  const ProductGridScreen({super.key});

  @override
  State<ProductGridScreen> createState() => _ProductGridScreenState();
}

class _ProductGridScreenState extends State<ProductGridScreen> {
  final _searchCtrl = TextEditingController();
  String _selectedCategory = '';
  String _selectedSort = 'newest';
  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProductProvider>().loadProducts(refresh: true);
    });
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<ProductProvider>().loadMore();
      }
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: AppTheme.neonCyan),
            onPressed: () => _showSearchDialog(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(
              color: AppTheme.bgSurface,
              border: Border(bottom: BorderSide(color: AppTheme.borderColor)),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _filterChip('All', '', Icons.grid_view_rounded),
                _filterChip('Currency', 'CURRENCY', Icons.monetization_on_outlined),
                _filterChip('Games', 'GAME', Icons.sports_esports_outlined),
                const SizedBox(width: 8),
                Container(width: 1, height: 24, color: AppTheme.borderColor),
                const SizedBox(width: 8),
                _sortButton(),
              ]),
            ),
          ),
          // Product Grid
          Expanded(
            child: Consumer<ProductProvider>(
              builder: (_, pp, __) {
                if (pp.loading && pp.products.isEmpty) {
                  return const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonCyan));
                }
                if (pp.products.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off, size: 48, color: AppTheme.textMuted.withOpacity(0.3)),
                        const SizedBox(height: 12),
                        const Text('No products found :(', style: TextStyle(color: AppTheme.textSecondary, fontSize: 16)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: AppTheme.neonCyan,
                  onRefresh: () => pp.loadProducts(refresh: true),
                  child: GridView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.6,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: pp.products.length + (pp.hasMore ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i >= pp.products.length) {
                        return const Center(child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.neonCyan),
                        ));
                      }
                      return ProductCard(product: pp.products[i]);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value, IconData icon) {
    final isSelected = _selectedCategory == value;
    return GestureDetector(
      onTap: () => setState(() {
        _selectedCategory = value;
        context.read<ProductProvider>().loadProducts(refresh: true);
      }),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.neonCyan.withOpacity(0.15) : AppTheme.bgCard,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? AppTheme.neonCyan.withOpacity(0.3) : AppTheme.borderColor),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isSelected ? AppTheme.neonCyan : AppTheme.textMuted),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: isSelected ? AppTheme.neonCyan : AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _sortButton() {
    return GestureDetector(
      onTap: () {
        Get.bottomSheet(
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: AppTheme.bgSurface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 20), decoration: BoxDecoration(color: AppTheme.textMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2))),
                const Text('Sort By', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
                const SizedBox(height: 16),
                _sortOption('Newest', 'newest'),
                _sortOption('Price: Low to High', 'price_asc'),
                _sortOption('Price: High to Low', 'price_desc'),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.borderColor)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.sort, size: 14, color: AppTheme.textSecondary),
            const SizedBox(width: 6),
            Text(_selectedSort == 'newest' ? 'Newest' : _selectedSort == 'price_asc' ? 'Low Price' : 'High Price', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _sortOption(String label, String value) {
    final isSelected = _selectedSort == value;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedSort = value);
        context.read<ProductProvider>().loadProducts(sort: value, refresh: true);
        Get.back();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.neonCyan.withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(isSelected ? Icons.radio_button_checked : Icons.radio_button_off, size: 20, color: isSelected ? AppTheme.neonCyan : AppTheme.textMuted),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(color: isSelected ? AppTheme.neonCyan : AppTheme.textPrimary, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  void _showSearchDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: AppTheme.borderColor)),
        content: TextField(
          controller: _searchCtrl,
          autofocus: true,
          style: const TextStyle(color: AppTheme.textPrimary),
          decoration: InputDecoration(
            hintText: 'Search products...',
            hintStyle: TextStyle(color: AppTheme.textMuted.withOpacity(0.5)),
            prefixIcon: const Icon(Icons.search, color: AppTheme.neonCyan),
            border: InputBorder.none,
            filled: true,
            fillColor: AppTheme.bgCard,
          ),
          onSubmitted: (v) {
            context.read<ProductProvider>().loadProducts(refresh: true);
            Navigator.pop(ctx);
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppTheme.neonCyan))),
        ],
      ),
    );
  }
}
