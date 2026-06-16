import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/constants.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<double> _glowPulse;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));
    _fadeIn = CurvedAnimation(parent: _animCtrl, curve: const Interval(0.0, 0.6, curve: Curves.easeOut));
    _glowPulse = Tween<double>(begin: 0.5, end: 1.0).animate(CurvedAnimation(parent: _animCtrl, curve: const Interval(0.3, 1.0, curve: Curves.easeInOut)));
    _animCtrl.forward();
    _navigate();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(seconds: 2));
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AppConstants.tokenKey);
    Get.offNamed(token != null && token.isNotEmpty ? AppRoutes.home : AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppTheme.bgDark, Color(0xFF0D0F1A), AppTheme.bgSurface],
          ),
        ),
        child: Stack(
          children: [
            // Ambient glow
            Positioned(top: -100, left: -100, child: Container(width: 300, height: 300, decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppTheme.neonCyan.withOpacity(0.06), blurRadius: 100, spreadRadius: 50)]))),
            Positioned(bottom: -80, right: -80, child: Container(width: 250, height: 250, decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppTheme.neonViolet.withOpacity(0.06), blurRadius: 100, spreadRadius: 50)]))),
            // Grid pattern
            Positioned.fill(child: CustomPaint(painter: _GridPainter())),
            Center(
              child: FadeTransition(
                opacity: _fadeIn,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Animated glow icon
                    AnimatedBuilder(
                      animation: _glowPulse,
                      builder: (_, child) => Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.bgCard,
                          border: Border.all(color: AppTheme.neonCyan.withOpacity(_glowPulse.value * 0.4)),
                          boxShadow: [
                            BoxShadow(color: AppTheme.neonCyan.withOpacity(_glowPulse.value * 0.15), blurRadius: 40, spreadRadius: 10),
                          ],
                        ),
                        child: const Icon(Icons.sports_esports, size: 56, color: AppTheme.neonCyan),
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(AppConstants.appName, style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -1)),
                    const SizedBox(height: 8),
                    Text(AppConstants.appTagline, style: TextStyle(fontSize: 14, color: AppTheme.textSecondary.withOpacity(0.7))),
                    const SizedBox(height: 48),
                    SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5, valueColor: AlwaysStoppedAnimation<Color>(AppTheme.neonCyan.withOpacity(0.7))),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = AppTheme.borderColor..strokeWidth = 0.5;
    const spacing = 40.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
