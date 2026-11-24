import 'package:flutter_test/flutter_test.dart';
import 'package:gameshop_mobile/config/constants.dart';
import 'package:gameshop_mobile/main.dart';
import 'package:gameshop_mobile/utils/api_values.dart';
import 'package:gameshop_mobile/utils/validation.dart';
import 'support/fakes.dart';

void main() {
  group('Build configuration', () {
    test('debug builds may use the emulator default', () {
      expect(
        AppConstants.validateReleaseConfig(
          isRelease: false,
          apiBaseUrl: 'http://10.0.2.2:5000/api/v1',
          socketBaseUrl: 'http://10.0.2.2:5000',
          emulatorHost: '10.0.2.2',
        ),
        isNull,
      );
      expect(AppConstants.releaseConfigError, isNull);
    });

    test('release builds reject the emulator default', () {
      final error = AppConstants.validateReleaseConfig(
        isRelease: true,
        apiBaseUrl: 'http://10.0.2.2:5000/api/v1',
        socketBaseUrl: 'https://api.example.com',
        emulatorHost: '10.0.2.2',
      );
      expect(error, contains('emulator address'));
      expect(error, contains('API_BASE_URL'));
    });

    test('release builds accept real public URLs', () {
      expect(
        AppConstants.validateReleaseConfig(
          isRelease: true,
          apiBaseUrl: 'https://api.example.com/api/v1',
          socketBaseUrl: 'https://api.example.com',
          emulatorHost: '10.0.2.2',
        ),
        isNull,
      );
    });

    testWidgets('startup shows a configuration error instead of API screens',
        (tester) async {
      await tester.pumpWidget(
        const ConfigErrorApp(message: 'Release build is misconfigured.'),
      );
      expect(find.text('Mobile configuration error'), findsOneWidget);
      expect(find.text('Release build is misconfigured.'), findsOneWidget);
    });
  });

  group('Display helpers', () {
    test('formatBdt keeps whole taka compact and preserves fractions', () {
      expect(formatBdt(1000), 'BDT 1000');
      expect(formatBdt(1000.5), 'BDT 1000.50');
      expect(formatBdt(1000.005), 'BDT 1000.01');
    });

    test('formatBdt never emits NaN', () {
      expect(formatBdt(double.nan), 'BDT --');
      expect(formatBdt(double.infinity), 'BDT --');
    });

    test('apiErrorMessage prefers the backend message and hides internals', () {
      expect(
        apiErrorMessage(testDioError(statusCode: 400, message: 'Invalid email or password')),
        'Invalid email or password',
      );
      expect(
        apiErrorMessage(testDioError(statusCode: 401, message: '')),
        'Your session has expired. Please sign in again.',
      );
      expect(
        apiErrorMessage(Exception('dio internals: stacktrace')),
        'Something went wrong. Please try again.',
      );
    });
  });

  group('Auth validation', () {
    test('passwordProblem mirrors the backend password policy', () {
      expect(passwordProblem(null), 'Password is required');
      expect(passwordProblem('short1'), 'Password must be at least 8 characters');
      expect(passwordProblem('password'), 'Password must contain at least one digit');
      expect(passwordProblem('12345678'), 'Password must contain at least one letter');
      expect(passwordProblem('password1'), isNull);
    });

    test('email, name and phone validators accept valid values', () {
      expect(emailProblem('buyer@example.com'), isNull);
      expect(emailProblem('not-an-email'), 'Enter a valid email address');
      expect(fullNameProblem('A'), 'Full name must be at least 2 characters');
      expect(optionalPhoneProblem(''), isNull);
      expect(optionalPhoneProblem('01712345678'), isNull);
      expect(optionalPhoneProblem('123'), contains('valid BD number'));
    });
  });
}
