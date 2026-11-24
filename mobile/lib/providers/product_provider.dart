import 'package:flutter/foundation.dart';
import '../models/product_model.dart';
import '../services/api_service.dart';
import '../utils/api_values.dart';

class ProductProvider extends ChangeNotifier {
  final ProductService _productService;
  final List<ProductModel> _products = [];
  List<ProductModel> _featured = [];
  ProductModel? _selectedProduct;
  bool _loading = false;
  bool _featuredLoading = false;
  String? _error;
  String? _featuredError;
  int _currentPage = 1;
  int _totalPages = 1;
  String _currentCategory = '';
  String _currentSort = 'newest';

  ProductProvider({ProductService? productService})
      : _productService = productService ?? ProductService();

  List<ProductModel> get products => List.unmodifiable(_products);
  List<ProductModel> get featured => List.unmodifiable(_featured);
  ProductModel? get selectedProduct => _selectedProduct;
  bool get loading => _loading;
  bool get featuredLoading => _featuredLoading;
  String? get error => _error;
  String? get featuredError => _featuredError;
  int get currentPage => _currentPage;
  int get totalPages => _totalPages;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadFeatured() async {
    _featuredLoading = true;
    _featuredError = null;
    notifyListeners();
    try {
      final data = await _productService.getFeatured();
      _featured = data
          .map((item) => ProductModel.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    } catch (e) {
      _featured = [];
      _featuredError = apiErrorMessage(e, fallback: 'Could not load featured products.');
    }
    _featuredLoading = false;
    notifyListeners();
  }

  Future<void> loadProducts({
    String? category,
    String? gameType,
    String? sort,
    bool refresh = false,
  }) async {
    if (refresh) {
      _currentPage = 1;
      _totalPages = 1;
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
      _currentCategory = category ?? _currentCategory;
      _currentSort = sort ?? _currentSort;

      final data = await _productService.getProducts(params: params);
      final List<dynamic> productList = (data['products'] as List?) ?? [];
      final pagination = data['pagination'] == null
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(data['pagination'] as Map);

      _products.addAll(
        productList.map((item) => ProductModel.fromJson(Map<String, dynamic>.from(item as Map))),
      );
      _totalPages = parseApiCount(pagination['totalPages'], field: 'totalPages', fallback: 1);
      _currentPage = parseApiCount(pagination['currentPage'], field: 'currentPage', fallback: _currentPage);
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not load products.');
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
    _error = null;
    notifyListeners();
    try {
      final data = await _productService.getProduct(id);
      _selectedProduct = ProductModel.fromJson(data);
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not load this product.');
    }
    _loading = false;
    notifyListeners();
  }
}
