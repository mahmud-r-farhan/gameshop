import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _section('Notifications'),
        Container(
          decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
          child: Column(children: [
            _switch(Icons.notifications_outlined, 'Push Notifications', 'Receive order updates', true, (_) {}),
            _divider(),
            _switch(Icons.email_outlined, 'Email Notifications', 'Receive promotional emails', false, (_) {}, divider: false),
          ]),
        ),
        const SizedBox(height: 20),
        _section('Preferences'),
        Container(
          decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
          child: Column(children: [
            _option(Icons.language, 'Language', 'English', () {}),
            _divider(),
            _option(Icons.currency_exchange, 'Currency', 'USD (\$)', () {}, divider: false),
          ]),
        ),
        const SizedBox(height: 20),
        _section('Security'),
        Container(
          decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
          child: Column(children: [
            _option(Icons.lock_outline, 'Change Password', 'Update your password', () => _changePassword(context)),
            _divider(),
            _option(Icons.fingerprint, 'Biometric Auth', 'Use fingerprint or face ID', () {}, divider: false),
          ]),
        ),
        const SizedBox(height: 20),
        _section('Support'),
        Container(
          decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
          child: Column(children: [
            _option(Icons.help_outline, 'Help Center', 'FAQs and support', () => Get.snackbar('Coming Soon', 'Help center coming soon', backgroundColor: AppTheme.neonCyan.withOpacity(0.9), colorText: AppTheme.bgDark)),
            _divider(),
            _option(Icons.message_outlined, 'Contact Us', 'Get in touch', () => Get.snackbar('Coming Soon', 'Contact coming soon', backgroundColor: AppTheme.neonCyan.withOpacity(0.9), colorText: AppTheme.bgDark), divider: false),
          ]),
        ),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
          child: _option(Icons.info_outline, 'About GameShop', 'Version 1.0.0', () {}, arrow: false, divider: false),
        ),
        const SizedBox(height: 32),
      ]),
    );
  }

  Widget _section(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)));

  Widget _option(IconData icon, String title, String sub, VoidCallback onTap, {bool arrow = true, bool divider = true}) {
    return Column(children: [
      ListTile(
        leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: AppTheme.neonCyan.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: AppTheme.neonCyan, size: 20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14)),
        subtitle: Text(sub, style: TextStyle(color: AppTheme.textSecondary.withOpacity(0.7), fontSize: 12)),
        trailing: arrow ? const Icon(Icons.chevron_right, color: AppTheme.textMuted, size: 20) : null,
        onTap: onTap,
      ),
      if (divider) _divider(),
    ]);
  }

  Widget _switch(IconData icon, String title, String sub, bool val, ValueChanged<bool> onChanged, {bool divider = true}) {
    return Column(children: [
      ListTile(
        leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: AppTheme.neonCyan.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: AppTheme.neonCyan, size: 20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14)),
        subtitle: Text(sub, style: TextStyle(color: AppTheme.textSecondary.withOpacity(0.7), fontSize: 12)),
        trailing: Switch(value: val, onChanged: onChanged, activeThumbColor: AppTheme.neonCyan),
      ),
      if (divider) _divider(),
    ]);
  }

  Widget _divider() => const Divider(height: 1, indent: 64, color: AppTheme.borderColor);

  void _changePassword(BuildContext context) {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController(); // ignore: unused_local_variable
    final formKey = GlobalKey<FormState>();
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(color: AppTheme.bgSurface, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Form(key: formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: AppTheme.textMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2))),
          const Text('Change Password', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textPrimary)),
          const SizedBox(height: 20),
          TextFormField(controller: currentCtrl, obscureText: true, style: const TextStyle(color: AppTheme.textPrimary),
            decoration: const InputDecoration(labelText: 'Current Password', prefixIcon: Icon(Icons.lock_outline, color: AppTheme.neonCyan, size: 20)),
            validator: (v) => v!.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(controller: newCtrl, obscureText: true, style: const TextStyle(color: AppTheme.textPrimary),
            decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock, color: AppTheme.neonCyan, size: 20)),
            validator: (v) => v!.length < 6 ? 'Min 6 chars' : null,
          ),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () { if (formKey.currentState!.validate()) { Get.back(); Get.snackbar('Success', 'Password changed', backgroundColor: AppTheme.success.withOpacity(0.9), colorText: Colors.white); } },
            child: const Text('Update Password'),
          )),
          const SizedBox(height: 16),
        ])),
      ),
    );
  }
}
