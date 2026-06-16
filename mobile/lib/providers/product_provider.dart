import 'package:flutter/foundation.dart';
import '../models/product_model.dart';
import '../services/api_service.dart';

class ProductProvider extends ChangeNotifier {
  final ProductService _productService = ProductService();
  final List<ProductModel> _products = [];
  List<ProductModel> _featured = [];
  ProductModel? _selectedProduct;
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;
  String _currentCategory = '';
  String _currentSort = 'newest';

  List<ProductModel> get products => _products;
  List<ProductModel> get featured => _featured;
  ProductModel? get selectedProduct => _selectedProduct;
  bool get loading => _loading;
  String? get error => _error;
  int get currentPage => _currentPage;
  int get totalPages => _totalPages;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadFeatured() async {
    try {
      final data = await _productService.getFeatured();
      _featured = (data as List).map((e) => ProductModel.fromJson(e)).toList();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> loadProducts({String? category, String? gameType, String? sort, bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _products.clear();
    }
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final params = <String, dynamic>{
        'page': _currentPage,
        'limit': 20,
        'sort': sort ?? _currentSort,
      };
      if (category != null && category.isNotEmpty) params['category'] = category;
      if (gameType != null && gameType.isNotEmpty) params['gameType'] = gameType;
      _currentCategory = category ?? '';
      _currentSort = sort ?? _currentSort;

      final data = await _productService.getProducts(params: params);
      final List<dynamic> productList = data['products'];
      final pagination = data['pagination'];

      _products.addAll(productList.map((e) => ProductModel.fromJson(e)));
      _totalPages = pagination['totalPages'] as int;
      _currentPage = pagination['currentPage'] as int;
    } catch (e) {
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> loadMore() async {
    if (!hasMore || _loading) return;
    _currentPage++;
    await loadProducts(category: _currentCategory);
  }

  Future<void> loadProduct(String id) async {
    _loading = true;
    notifyListeners();
    try {
      final data = await _productService.getProduct(id);
      _selectedProduct = ProductModel.fromJson(data);
    } catch (e) {
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }
}
