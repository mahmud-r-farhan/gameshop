/// Limits mirror `createOrderSchema` and `orderItemSchema` in
/// `backend/src/schemas/order.schema.ts`.
const int minDeliveryAddressLength = 10;
const int maxDeliveryAddressLength = 500;
const int maxOrderInstructionsLength = 500;
const int maxPromoCodeLength = 40;
const int minPromoCodeLength = 3;
const int maxItemsPerOrder = 50;
const int maxQuantityPerItem = 999;

class OrderRequestException implements Exception {
  final String message;
  const OrderRequestException(this.message);

  @override
  String toString() => message;
}

String? validateDeliveryAddress(String? address) {
  final trimmed = (address ?? '').trim();
  if (trimmed.isEmpty) return 'Please enter your delivery address';
  if (trimmed.length < minDeliveryAddressLength) {
    return 'Delivery address must be at least $minDeliveryAddressLength characters';
  }
  if (trimmed.length > maxDeliveryAddressLength) {
    return 'Delivery address must be at most $maxDeliveryAddressLength characters';
  }
  return null;
}

/// Build the exact payload accepted by `POST /orders`.
///
/// The backend's `createOrderSchema` is `.strict()` and its `orderItemSchema`
/// allows only `productId` and `quantity`: client-derived `price` is rejected,
/// and the server reprices every item from the database. Optional fields are
/// omitted rather than sent as `null`, which strict optional string schemas
/// reject. Duplicate lines are merged because the backend rejects them to
/// prevent stock-limit bypasses.
Map<String, dynamic> buildCreateOrderRequest({
  required List<Map<String, dynamic>> items,
  required String deliveryAddress,
  String? promoCode,
  String? deliveryInstructions,
}) {
  final address = deliveryAddress.trim();
  final addressError = validateDeliveryAddress(address);
  if (addressError != null) throw OrderRequestException(addressError);
  if (items.isEmpty) throw const OrderRequestException('Your cart is empty');

  final quantities = <String, int>{};
  for (final item in items) {
    final productId = item['productId'];
    final quantity = item['quantity'];
    if (productId is! String || productId.trim().isEmpty) {
      throw const OrderRequestException('A cart item is missing its product ID');
    }
    if (quantity is! int || quantity <= 0 || quantity > maxQuantityPerItem) {
      throw OrderRequestException('Quantity must be between 1 and $maxQuantityPerItem');
    }
    final merged = (quantities[productId] ?? 0) + quantity;
    if (merged > maxQuantityPerItem) {
      throw OrderRequestException('Quantity must be between 1 and $maxQuantityPerItem');
    }
    quantities[productId] = merged;
  }
  if (quantities.length > maxItemsPerOrder) {
    throw OrderRequestException('An order cannot contain more than $maxItemsPerOrder items');
  }

  final payload = <String, dynamic>{
    'items': quantities.entries
        .map((entry) => <String, dynamic>{
              'productId': entry.key,
              'quantity': entry.value,
            })
        .toList(),
    'deliveryAddress': address,
  };

  final instructions = deliveryInstructions?.trim();
  if (instructions != null && instructions.isNotEmpty) {
    if (instructions.length > maxOrderInstructionsLength) {
      throw OrderRequestException('Delivery instructions must be at most $maxOrderInstructionsLength characters');
    }
    payload['deliveryInstructions'] = instructions;
  }
  final promo = promoCode?.trim();
  if (promo != null && promo.isNotEmpty) {
    if (promo.length < minPromoCodeLength || promo.length > maxPromoCodeLength) {
      throw OrderRequestException('Promo code must be between $minPromoCodeLength and $maxPromoCodeLength characters');
    }
    payload['promoCode'] = promo.toUpperCase();
  }
  return payload;
}
