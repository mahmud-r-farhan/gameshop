import 'package:flutter_test/flutter_test.dart';
import 'package:gameshop_mobile/providers/order_provider.dart';
import 'package:gameshop_mobile/providers/product_provider.dart';
import 'package:gameshop_mobile/services/api_service.dart';
import 'package:gameshop_mobile/utils/order_request.dart';
import 'support/fakes.dart';

Map<String, dynamic> productJson(String id, {String price = '1000.00'}) => {
      'id': id,
      'name': 'PUBG UC',
      'category': 'CURRENCY',
      'price': price,
      'originalPrice': '1200.00',
      'isAvailable': true,
      'isFeatured': true,
      'thumbnailUrl': 'https://example.com/$id-thumb.jpg',
      'images': ['https://example.com/$id.jpg'],
      'averageRating': '4.8',
      'reviewCount': '25',
      'specs': [],
    };

Map<String, dynamic> orderJson() => {
      'id': 'ord-12345678',
      'orderNumber': 'ORD-1001',
      'subtotal': '1000.00',
      'discountAmount': '100.00',
      'totalAmount': '900.00',
      'paymentStatus': 'PENDING',
      'orderStatus': 'PENDING',
      'deliveryStatus': 'WAITING',
      'deliveryAddress': 'House 1, Dhaka, Bangladesh',
      'createdAt': '2026-01-01T10:00:00.000Z',
      'items': [
        {
          'id': 'item-1',
          'productName': 'PUBG UC',
          'quantity': '2',
          'price': '500.00',
        }
      ],
    };

void main() {
  group('Strict order request', () {
    test('sends only productId/quantity and omits null optional fields', () {
      final payload = buildCreateOrderRequest(
        items: [
          {'productId': 'p1', 'quantity': 2, 'price': 50.0},
        ],
        deliveryAddress: '  House 1, Dhaka, Bangladesh  ',
      );

      expect(payload['deliveryAddress'], 'House 1, Dhaka, Bangladesh');
      expect(payload.containsKey('deliveryInstructions'), isFalse);
      expect(payload.containsKey('promoCode'), isFalse);
      expect(payload['items'], [
        {'productId': 'p1', 'quantity': 2},
      ]);
      expect((payload['items'] as List).first.containsKey('price'), isFalse);
    });

    test('merges duplicate product lines and uppercases promo codes', () {
      final payload = buildCreateOrderRequest(
        items: [
          {'productId': 'p1', 'quantity': 2},
          {'productId': 'p1', 'quantity': 3},
        ],
        deliveryAddress: 'House 1, Dhaka, Bangladesh',
        promoCode: '  save10  ',
        deliveryInstructions: '  Leave at reception  ',
      );

      expect(payload['items'], [
        {'productId': 'p1', 'quantity': 5},
      ]);
      expect(payload['promoCode'], 'SAVE10');
      expect(payload['deliveryInstructions'], 'Leave at reception');
    });

    test('rejects short addresses and invalid quantities', () {
      expect(
        () => buildCreateOrderRequest(
          items: [
            {'productId': 'p1', 'quantity': 1},
          ],
          deliveryAddress: 'Short',
        ),
        throwsA(isA<OrderRequestException>()),
      );
      expect(
        () => buildCreateOrderRequest(
          items: [
            {'productId': 'p1', 'quantity': 0},
          ],
          deliveryAddress: 'House 1, Dhaka, Bangladesh',
        ),
        throwsA(isA<OrderRequestException>()),
      );
      expect(validateDeliveryAddress('House 1, Dhaka, Bangladesh'), isNull);
    });
  });

  group('API service contracts', () {
    test('resetPassword sends the signed token required by the backend', () async {
      final api = FakeApiClient();
      await AuthService(api: api).resetPassword(
        'buyer@example.com',
        'password1',
        'signed-reset-token',
      );

      final request = api.requests.single;
      expect(request.method, 'POST');
      expect(request.path, '/auth/reset-password');
      expect(request.data, {
        'email': 'buyer@example.com',
        'password': 'password1',
        'token': 'signed-reset-token',
      });
    });

    test('verifyOTP exposes the resetToken from the API envelope', () async {
      final api = FakeApiClient(
        responder: (path) =>
            path == '/auth/verify-otp' ? {'resetToken': 'signed-reset-token'} : <String, dynamic>{},
      );
      final result = await AuthService(api: api).verifyOTP('buyer@example.com', '123456');
      expect(result['resetToken'], 'signed-reset-token');
    });

    test('featured products are a list, not a map', () async {
      final api = FakeApiClient(
        responder: (path) => path == '/products/featured'
            ? [productJson('p1')]
            : <String, dynamic>{},
      );
      final products = await ProductService(api: api).getFeatured();
      expect(products, isA<List<dynamic>>());
      expect(products, hasLength(1));
    });
  });

  group('Providers with the real service layer', () {
    test('createOrder posts the strict payload and parses decimal strings', () async {
      final api = FakeApiClient(
        responder: (path) => path == '/orders' ? orderJson() : <String, dynamic>{},
      );
      final provider = OrderProvider(orderService: OrderService(api: api));

      final success = await provider.createOrder(
        items: [
          {'productId': 'p1', 'quantity': 2, 'price': 50.0},
        ],
        deliveryAddress: 'House 1, Dhaka, Bangladesh',
      );

      expect(success, isTrue);
      expect(provider.error, isNull);
      expect(provider.selectedOrder?.subtotal, 1000.0);
      expect(provider.selectedOrder?.totalAmount, 900.0);
      expect(provider.selectedOrder?.items.single.quantity, 2);
      final posted = api.requests.single.data as Map<String, dynamic>;
      expect(posted['items'], [
        {'productId': 'p1', 'quantity': 2},
      ]);
      expect(posted.containsKey('deliveryInstructions'), isFalse);
    });

    test('loadOrders accepts pagination values serialized as strings', () async {
      final api = FakeApiClient(
        responder: (path) => path == '/orders'
            ? {
                'orders': [orderJson()],
                'pagination': {'currentPage': '1', 'totalPages': '1'},
              }
            : <String, dynamic>{},
      );
      final provider = OrderProvider(orderService: OrderService(api: api));

      await provider.loadOrders(refresh: true);

      expect(provider.error, isNull);
      expect(provider.orders, hasLength(1));
      expect(provider.hasMore, isFalse);
    });

    test('loadFeatured parses decimal-string products and exposes errors', () async {
      final api = FakeApiClient(
        responder: (path) => path == '/products/featured'
            ? [productJson('p1')]
            : <String, dynamic>{},
      );
      final provider = ProductProvider(productService: ProductService(api: api));
      await provider.loadFeatured();
      expect(provider.featuredError, isNull);
      expect(provider.featured.single.price, 1000.0);
      expect(provider.featured.single.displayImageUrl,
          'https://example.com/p1-thumb.jpg');

      final failing = ProductProvider(
        productService: ProductService(
          api: FakeApiClient(
            error: testDioError(path: '/products/featured', statusCode: 500, message: ''),
          ),
        ),
      );
      await failing.loadFeatured();
      expect(failing.featured, isEmpty);
      expect(failing.featuredError, contains('server is unavailable'));
    });
  });
}
