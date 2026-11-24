import 'package:flutter/foundation.dart';
import '../models/order_model.dart';
import '../services/api_service.dart';
import '../utils/api_values.dart';
import '../utils/order_request.dart';

class OrderProvider extends ChangeNotifier {
  final OrderService _orderService;
  final List<OrderModel> _orders = [];
  OrderModel? _selectedOrder;
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;

  OrderProvider({OrderService? orderService})
      : _orderService = orderService ?? OrderService();

  List<OrderModel> get orders => List.unmodifiable(_orders);
  OrderModel? get selectedOrder => _selectedOrder;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadOrders({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _totalPages = 1;
      _orders.clear();
    }
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _orderService.getOrders(params: {
        'page': _currentPage,
        'limit': 10,
      });
      final List<dynamic> orderList = (data['orders'] as List?) ?? [];
      final pagination = data['pagination'] == null
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(data['pagination'] as Map);
      _orders.addAll(
        orderList.map((item) => OrderModel.fromJson(Map<String, dynamic>.from(item as Map))),
      );
      _totalPages = parseApiCount(pagination['totalPages'], field: 'totalPages', fallback: 1);
      _currentPage = parseApiCount(pagination['currentPage'], field: 'currentPage', fallback: _currentPage);
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not load your orders.');
    }
    _loading = false;
    notifyListeners();
  }

  Future<bool> loadOrder(String id) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await _orderService.getOrder(id);
      _selectedOrder = OrderModel.fromJson(data);
      return true;
    } catch (e) {
      _selectedOrder = null;
      _error = apiErrorMessage(e, fallback: 'Could not load this order.');
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> createOrder({
    required List<Map<String, dynamic>> items,
    required String deliveryAddress,
    String? promoCode,
    String? deliveryInstructions,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final payload = buildCreateOrderRequest(
        items: items,
        deliveryAddress: deliveryAddress,
        promoCode: promoCode,
        deliveryInstructions: deliveryInstructions,
      );
      final data = await _orderService.createOrder(payload);
      _selectedOrder = OrderModel.fromJson(data);
      return true;
    } catch (e) {
      _error = e is OrderRequestException
          ? e.message
          : apiErrorMessage(e, fallback: 'Could not place your order. Please try again.');
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> submitPayment(String orderId, String transactionId, String paymentMethod) async {
    _error = null;
    try {
      await _orderService.submitPayment(orderId, {
        'transactionId': transactionId,
        'paymentMethod': paymentMethod,
      });
      await loadOrder(orderId);
      return true;
    } catch (e) {
      _error = apiErrorMessage(e, fallback: 'Could not submit payment details.');
      notifyListeners();
      return false;
    }
  }
}
