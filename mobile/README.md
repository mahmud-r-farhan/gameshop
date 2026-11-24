# GameShop Mobile (Flutter)

## Requirements

`pubspec.lock` currently requires Dart `>=3.11.0 <4.0.0` and Flutter
`>=3.38.4`; `pubspec.yaml` enforces the same lower bounds. Mobile CI installs
a stable Flutter `3.x` SDK and runs `flutter pub get`, `flutter analyze`, and
`flutter test`.

## Configuration

The debug default targets the Android emulator alias for the host machine:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run
```

For a physical device, an iOS simulator, or a release build, pass build-time
configuration:

```bash
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.10:5000/api/v1 \
  --dart-define=SOCKET_URL=http://192.168.1.10:5000

flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.example.com/api/v1 \
  --dart-define=SOCKET_URL=https://api.example.com
```

A release build that still contains `10.0.2.2` shows a configuration-error
screen instead of silently shipping an unreachable API URL. Do not commit real
secrets; these values are public endpoint URLs only.

## API contract notes

- The backend is the source of truth for prices, discounts and order totals.
  The app displays local cart estimates and sends only `productId` and
  `quantity` when creating an order.
- Prisma `Decimal` values may serialize as numeric strings. Models accept both
  JSON numbers and numeric strings; invalid values fail loudly.
- `/products/featured` returns a list. `/orders` uses strict Zod validation;
  unsupported fields such as client-supplied `price` and `null` optional fields
  are rejected.

## Deliberately deferred (maintainer approval required)

These flows touch authentication, password handling, payment verification or
order lifecycle changes. They are not faked in the current app:

- mobile OTP/reset-token password reset (the website flow is authoritative);
- refresh-token rotation and session redirect;
- payment transaction submission and order cancellation in the mobile UI;
- notification preferences and biometric authentication.

Adding any of these should include backend-contract tests and an explicit
review before release.
