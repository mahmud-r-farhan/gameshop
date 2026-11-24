import '../utils/api_values.dart';

class OrderModel {
  final String id;
  final String orderNumber;
  final double subtotal;
  final double discountAmount;
  final double totalAmount;
  final String paymentStatus;
  final String orderStatus;
  final String deliveryStatus;
  final String deliveryAddress;
  final String? deliveryInstructions;
  final String? transactionId;
  final String? paymentMethod;
  final String? promoCode;
  final DateTime createdAt;
  final DateTime? deliveredAt;
  final List<OrderItemModel> items;
  final UserBrief? user;

  OrderModel({
    required this.id,
    required this.orderNumber,
    required this.subtotal,
    this.discountAmount = 0,
    required this.totalAmount,
    this.paymentStatus = 'PENDING',
    this.orderStatus = 'PENDING',
    this.deliveryStatus = 'WAITING',
    required this.deliveryAddress,
    this.deliveryInstructions,
    this.transactionId,
    this.paymentMethod,
    this.promoCode,
    required this.createdAt,
    this.deliveredAt,
    this.items = const [],
    this.user,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      subtotal: parseApiAmount(json['subtotal'], field: 'subtotal'),
      discountAmount: parseApiAmount(json['discountAmount'] ?? 0, field: 'discountAmount'),
      totalAmount: parseApiAmount(json['totalAmount'], field: 'totalAmount'),
      paymentStatus: json['paymentStatus'] as String? ?? 'PENDING',
      orderStatus: json['orderStatus'] as String? ?? 'PENDING',
      deliveryStatus: json['deliveryStatus'] as String? ?? 'WAITING',
      deliveryAddress: json['deliveryAddress'] as String? ?? '',
      deliveryInstructions: json['deliveryInstructions'] as String?,
      transactionId: json['transactionId'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      promoCode: json['promoCode'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      deliveredAt: json['deliveredAt'] != null
          ? DateTime.parse(json['deliveredAt'] as String)
          : null,
      items: (json['items'] as List?)
              ?.map((item) => OrderItemModel.fromJson(Map<String, dynamic>.from(item as Map)))
              .toList() ??
          [],
      user: json['user'] != null
          ? UserBrief.fromJson(Map<String, dynamic>.from(json['user'] as Map))
          : null,
    );
  }
}

class OrderItemModel {
  final String id;
  final String productName;
  final int quantity;
  final double price;

  OrderItemModel({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.price,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) => OrderItemModel(
        id: json['id'] as String,
        productName: json['productName'] as String? ?? 'Product',
        quantity: parseApiCount(json['quantity'], field: 'quantity', fallback: 1),
        price: parseApiAmount(json['price'], field: 'price'),
      );

  double get total => price * quantity;
}

class UserBrief {
  final String id;
  final String fullName;
  final String? email;
  final String? phone;

  UserBrief({required this.id, required this.fullName, this.email, this.phone});

  factory UserBrief.fromJson(Map<String, dynamic> json) => UserBrief(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        email: json['email'] as String?,
        phone: json['phone'] as String?,
      );
}
