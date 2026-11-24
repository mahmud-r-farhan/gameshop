import 'package:dio/dio.dart';

/// Parse a numeric API value.
///
/// Prisma `Decimal` fields are serialized as strings (`"4500.00"`) by the
/// backend, while seeded/mock payloads and older clients use JSON numbers.
/// Dart's `as num` cast crashes on the string form. Both forms are accepted
/// here, and non-finite/invalid values fail loudly instead of becoming `NaN`
/// on a price or total.
double parseApiAmount(Object? value, {required String field}) {
  final parsed = _tryParseDouble(value);
  if (parsed == null) {
    throw FormatException('$field must be a finite number, got ${value.runtimeType}');
  }
  return parsed;
}

/// Optional counterpart of [parseApiAmount].
double? parseOptionalApiAmount(Object? value, {required String field}) =>
    value == null ? null : parseApiAmount(value, field: field);

/// Parse an integer API value, accepting numeric strings from API mocks too.
int parseApiCount(Object? value, {required String field, int? fallback}) {
  if (value == null && fallback != null) return fallback;
  final parsed = _tryParseInt(value);
  if (parsed == null) {
    throw FormatException('$field must be a whole number, got ${value.runtimeType}');
  }
  return parsed;
}

/// Format BDT without silently truncating fractional taka.
///
/// Whole amounts keep the familiar "BDT 1000" style; fractional amounts show
/// two decimals. Formatting is display-only — the backend remains the source
/// of truth for all prices, discounts and order totals.
String formatBdt(double amount) {
  if (!amount.isFinite) return 'BDT --';
  final cents = (amount * 100).round();
  final whole = cents ~/ 100;
  if (cents % 100 == 0) return 'BDT $whole';
  return 'BDT ${(cents / 100).toStringAsFixed(2)}';
}

/// Convert a Dio/network error into a user-safe message.
///
/// The backend's `{ message }` envelope is preferred. Raw exception strings
/// are never shown because they can contain internals, URLs or response bodies.
String apiErrorMessage(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final message = data['message'] ?? data['error'];
      if (message is String && message.trim().isNotEmpty) {
        return message.trim();
      }
    }
    final type = error.type;
    if (type == DioExceptionType.connectionTimeout ||
        type == DioExceptionType.sendTimeout ||
        type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Please try again.';
    }
    if (type == DioExceptionType.connectionError) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    final status = error.response?.statusCode;
    if (status == 401) return 'Your session has expired. Please sign in again.';
    if (status != null && status >= 500) {
      return 'The server is unavailable. Please try again.';
    }
  }
  return fallback;
}

double? _tryParseDouble(Object? value) {
  if (value is num) return value.isFinite ? value.toDouble() : null;
  if (value is String) {
    final parsed = double.tryParse(value.trim());
    return parsed != null && parsed.isFinite ? parsed : null;
  }
  return null;
}

int? _tryParseInt(Object? value) {
  if (value is int) return value;
  if (value is num && value.isFinite) {
    final rounded = value.round();
    return value - rounded == 0 ? rounded : null;
  }
  if (value is String) {
    final text = value.trim();
    final parsedInt = int.tryParse(text);
    if (parsedInt != null) return parsedInt;
    final parsedDouble = double.tryParse(text);
    if (parsedDouble == null || !parsedDouble.isFinite) return null;
    final rounded = parsedDouble.round();
    return parsedDouble - rounded == 0 ? rounded : null;
  }
  return null;
}
