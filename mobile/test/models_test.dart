import 'package:flutter_test/flutter_test.dart';
import 'package:gameshop_mobile/models/product_model.dart';
import 'package:gameshop_mobile/models/user_model.dart';
import 'package:gameshop_mobile/models/order_model.dart';
import 'package:gameshop_mobile/models/review_model.dart';

void main() {
  group('ProductModel Tests', () {
    test('ProductModel.fromJson parses json correctly', () {
      final json = {
        'id': 'prod-1',
        'name': 'PUBG Mobile 660 UC',
        'description': 'In-game currency',
        'category': 'CURRENCY',
        'gameType': 'PUBG',
        'price': 1000,
        'originalPrice': 1200,
        'isAvailable': true,
        'isFeatured': true,
        'thumbnailUrl': 'http://example.com/thumb.jpg',
        'images': ['http://example.com/1.jpg'],
        'averageRating': 4.8,
        'reviewCount': 25,
        'specs': [
          {'id': 'spec-1', 'specName': 'Region', 'specValue': 'Global'},
        ],
      };

      final product = ProductModel.fromJson(json);

      expect(product.id, 'prod-1');
      expect(product.name, 'PUBG Mobile 660 UC');
      expect(product.category, 'CURRENCY');
      expect(product.gameType, 'PUBG');
      expect(product.price, 1000.0);
      expect(product.originalPrice, 1200.0);
      expect(product.formattedPrice, 'BDT 1000');
      expect(product.discountPercentage, '17%');
      expect(product.specs.length, 1);
      expect(product.specs.first.name, 'Region');
      expect(product.specs.first.value, 'Global');
    });

    test('ProductModel handles missing optional fields', () {
      final json = {
        'id': 'prod-2',
        'name': 'Free Fire Diamonds',
        'category': 'CURRENCY',
        'price': 500,
      };

      final product = ProductModel.fromJson(json);

      expect(product.id, 'prod-2');
      expect(product.isAvailable, isTrue);
      expect(product.isFeatured, isFalse);
      expect(product.discountPercentage, isNull);
      expect(product.averageRating, 0.0);
      expect(product.reviewCount, 0);
      expect(product.images, isEmpty);
      expect(product.specs, isEmpty);
    });
  });

  group('UserModel Tests', () {
    test('UserModel.fromJson and toJson work correctly', () {
      final json = {
        'id': 'user-1',
        'email': 'test@example.com',
        'fullName': 'Test User',
        'phone': '01711111111',
        'avatarUrl': 'http://example.com/avatar.jpg',
        'role': 'USER',
        'division': 'Dhaka',
        'district': 'Dhaka',
        'address': 'Gulshan 1',
        'postalCode': '1212',
      };

      final user = UserModel.fromJson(json);

      expect(user.id, 'user-1');
      expect(user.email, 'test@example.com');
      expect(user.fullName, 'Test User');
      expect(user.role, 'USER');

      final map = user.toJson();
      expect(map['email'], 'test@example.com');
      expect(map['fullName'], 'Test User');
    });

    test('UserModel.copyWith creates updated copy', () {
      final user = UserModel(
        id: 'u1',
        email: 'user@test.com',
        fullName: 'Original Name',
      );

      final updated = user.copyWith(fullName: 'New Name', phone: '01800000000');

      expect(updated.id, 'u1');
      expect(updated.email, 'user@test.com');
      expect(updated.fullName, 'New Name');
      expect(updated.phone, '01800000000');
    });
  });

  group('OrderModel Tests', () {
    test('OrderModel.fromJson parses order correctly', () {
      final json = {
        'id': 'ord-12345678',
        'orderNumber': 'ORD-1001',
        'subtotal': 1000,
        'discountAmount': 100,
        'totalAmount': 900,
        'paymentStatus': 'VERIFIED',
        'orderStatus': 'DELIVERED',
        'deliveryStatus': 'DELIVERED',
        'deliveryAddress': 'Dhaka, Bangladesh',
        'createdAt': '2026-01-01T10:00:00.000Z',
        'items': [
          {
            'id': 'item-1',
            'productName': 'PUBG UC',
            'quantity': 2,
            'price': 500,
          }
        ],
        'user': {
          'id': 'u1',
          'fullName': 'Buyer',
          'email': 'buyer@example.com',
        }
      };

      final order = OrderModel.fromJson(json);

      expect(order.id, 'ord-12345678');
      expect(order.orderNumber, 'ORD-1001');
      expect(order.totalAmount, 900.0);
      expect(order.paymentStatus, 'VERIFIED');
      expect(order.orderStatus, 'DELIVERED');
      expect(order.items.length, 1);
      expect(order.items.first.total, 1000.0);
      expect(order.user?.fullName, 'Buyer');
    });
  });

  group('ReviewModel Tests', () {
    test('ReviewModel.fromJson parses review correctly', () {
      final json = {
        'id': 'rev-1',
        'rating': 5,
        'comment': 'Excellent service!',
        'user': {
          'fullName': 'John Doe',
          'avatarUrl': 'http://example.com/avatar.jpg',
        },
        'createdAt': '2026-02-01T12:00:00.000Z',
        'helpfulCount': 10,
      };

      final review = ReviewModel.fromJson(json);

      expect(review.id, 'rev-1');
      expect(review.rating, 5);
      expect(review.comment, 'Excellent service!');
      expect(review.userName, 'John Doe');
      expect(review.helpfulCount, 10);
    });
  });
}
