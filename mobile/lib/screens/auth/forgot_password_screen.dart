import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';

/// Mobile password reset is intentionally not faked.
///
/// The old screen reported "OTP Sent" without contacting the backend and had
/// no OTP verification or signed reset-token step. A real reset flow touches
/// password handling and needs explicit maintainer approval; until then this
/// screen gives an honest, non-misleading instruction instead of a dead end.
class ForgotPasswordScreen extends StatelessWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppTheme.bgDark, AppTheme.bgSurface],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.bgCard,
                      border: Border.all(
                          color: AppTheme.neonAmber.withOpacity(0.3)),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.neonAmber.withOpacity(0.1),
                          blurRadius: 30,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.lock_reset,
                        size: 48, color: AppTheme.neonAmber),
                  ),
                  const SizedBox(height: 24),
                  Semantics(
                    header: true,
                    child: const Text(
                      'Reset Password',
                      style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Password reset is available on the GameShop website. '
                    'Please use the website’s Forgot Password flow, then sign in here with your new password.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: AppTheme.textSecondary.withOpacity(0.85),
                        fontSize: 15,
                        height: 1.4),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed: () => Get.back(),
                      child: const Text('Back to Login'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
