import 'package:flutter/material.dart';
import '../../config/constants.dart';
import '../../config/theme.dart';

/// Only implemented, truthful settings are shown.
///
/// The previous screen had notification switches that did nothing, a USD
/// label for a BDT-only shop, and a password dialog that reported success
/// without calling any API. Those affordances were removed rather than left as
/// misleading functionality.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _section('Account'),
          _card([
            _infoTile(
              Icons.notifications_outlined,
              'Order updates',
              'Track payment and delivery status from My Orders',
            ),
            _divider(),
            _infoTile(
              Icons.lock_outline,
              'Password',
              'Password changes are currently handled on the GameShop website',
              divider: false,
            ),
          ]),
          const SizedBox(height: 20),
          _section('Preferences'),
          _card([
            _infoTile(Icons.language, 'Language', 'English'),
            _divider(),
            _infoTile(Icons.currency_exchange, 'Currency', 'BDT (৳)',
                divider: false),
          ]),
          const SizedBox(height: 20),
          _section('About'),
          _card([
            _infoTile(
              Icons.info_outline,
              AppConstants.appName,
              'Version 1.0.0',
              divider: false,
            ),
          ]),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          title,
          style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppTheme.textPrimary),
        ),
      );

  Widget _card(List<Widget> children) => Container(
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Column(children: children),
      );

  Widget _infoTile(
    IconData icon,
    String title,
    String subtitle, {
    bool divider = true,
  }) {
    return Column(
      children: [
        ListTile(
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.neonCyan.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: AppTheme.neonCyan, size: 20),
          ),
          title: Text(
            title,
            style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary,
                fontSize: 14),
          ),
          subtitle: Text(
            subtitle,
            style: TextStyle(
                color: AppTheme.textSecondary.withOpacity(0.7), fontSize: 12),
          ),
        ),
        if (divider) _divider(),
      ],
    );
  }

  Widget _divider() =>
      const Divider(height: 1, indent: 64, color: AppTheme.borderColor);
}
