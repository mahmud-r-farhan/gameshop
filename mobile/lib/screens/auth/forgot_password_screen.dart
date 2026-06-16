import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  bool _sent = false;

  @override
  void dispose() { _emailCtrl.dispose(); super.dispose(); }

  void _sendOtp() {
    if (_emailCtrl.text.trim().isEmpty) return;
    setState(() => _sent = true);
    Get.snackbar('OTP Sent', 'Check your email for the OTP',
        backgroundColor: AppTheme.neonCyan.withOpacity(0.9), colorText: AppTheme.bgDark, snackPosition: SnackPosition.BOTTOM);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [AppTheme.bgDark, AppTheme.bgSurface]),
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
                      color: AppTheme.bgCard,        border: Border.all(color: AppTheme.neonAmber.withOpacity(0.3)),
        boxShadow: [BoxShadow(color: AppTheme.neonAmber.withOpacity(0.1), blurRadius: 30)],
                    ),
                    child: const Icon(Icons.lock_reset, size: 48, color: AppTheme.neonAmber),
                  ),
                  const SizedBox(height: 24),
                  const Text('Reset Password', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                  const SizedBox(height: 8),
                  Text('Enter your email to receive an OTP', style: TextStyle(color: AppTheme.textSecondary.withOpacity(0.7))),
                  const SizedBox(height: 32),

                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: AppTheme.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined, color: AppTheme.neonCyan, size: 20),
                    ),
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity, height: 52,
                    child: ElevatedButton(
                      onPressed: _sendOtp,
                      child: Text(_sent ? 'Resend OTP' : 'Send OTP', style: const TextStyle(fontSize: 16)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  SizedBox(
                    width: double.infinity, height: 52,
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
