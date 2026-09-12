import 'package:flutter_test/flutter_test.dart';
import 'package:gameshop_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('GameShopApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const GameShopApp());
    expect(find.byType(GameShopApp), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
  });
}
