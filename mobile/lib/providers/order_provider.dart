import 'package:flutter/foundation.dart';
import '../models/order_model.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  final OrderService _orderService = OrderService();
  final List<OrderModel> _orders = [];
  OrderModel? _selectedOrder;
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;

  List<OrderModel> get orders => _orders;
  OrderModel? get selectedOrder => _selectedOrder;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadOrders({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _orders.clear();
    }
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _orderService.getOrders(params: {
        'page': _currentPage, 'limit': 10,
      });
      final List<dynamic> orderList = data['orders'];
      final pagination = data['pagination'];
      _orders.addAll(orderList.map((e) => OrderModel.fromJson(e)));
      _totalPages = pagination['totalPages'] as int;
      _currentPage = pagination['currentPage'] as int;
    } catch (e) {
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> loadOrder(String id) async {
    _loading = true;
    notifyListeners();
    try {
      final data = await _orderService.getOrder(id);
      _selectedOrder = OrderModel.fromJson(data);
    } catch (e) {
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }

  Future<bool> createOrder({
    required List<Map<String, dynamic>> items,
    required String deliveryAddress,
    String? promoCode,
    String? deliveryInstructions,
  }) async {
    _loading = true;
    notifyListeners();
    try {
      final data = await _orderService.createOrder({
        'items': items,
        'deliveryAddress': deliveryAddress,
        'deliveryInstructions': deliveryInstructions,
        if (promoCode != null) 'promoCode': promoCode,
      });
      _selectedOrder = OrderModel.fromJson(data);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> submitPayment(String orderId, String transactionId, String paymentMethod) async {
    try {
      await _orderService.submitPayment(orderId, {
        'transactionId': transactionId,
        'paymentMethod': paymentMethod,
      });
      await loadOrder(orderId);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
