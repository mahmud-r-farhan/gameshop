import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:get/get.dart';
import '../../config/theme.dart';
import '../../config/routes.dart';
import '../../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: auth.user == null
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(shape: BoxShape.circle, color: AppTheme.bgCard, border: Border.all(color: AppTheme.borderColor)),
                child: const Icon(Icons.person_outline, size: 48, color: AppTheme.textMuted)),
              const SizedBox(height: 16), const Text('Not signed in', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 24),
              ElevatedButton.icon(onPressed: () => Get.offNamed(AppRoutes.login), icon: const Icon(Icons.login, size: 18), label: const Text('Sign In')),
            ]))
          : ListView(padding: const EdgeInsets.all(16), children: [
              // Profile header
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                child: Column(children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(colors: [AppTheme.neonCyan, AppTheme.neonViolet]),
                      border: Border.all(color: AppTheme.neonCyan.withOpacity( 0.3), width: 2),
                    ),
                    child: Center(child: Text((auth.user!.fullName.isNotEmpty ? auth.user!.fullName : auth.user!.email)[0].toUpperCase(), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: AppTheme.bgDark))),
                  ),
                  const SizedBox(height: 12),
                  Text(auth.user!.fullName.isNotEmpty ? auth.user!.fullName : 'User', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.textPrimary)),
                  const SizedBox(height: 4),
                  Text(auth.user!.email, style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 14)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(color: AppTheme.neonCyan.withOpacity( 0.15), borderRadius: BorderRadius.circular(20)),
                    child: Text(auth.user!.role.toUpperCase(), style: const TextStyle(color: AppTheme.neonCyan, fontWeight: FontWeight.w700, fontSize: 10)),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              // Menu options
              Container(
                decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                child: Column(children: [
                  _option(Icons.person_outline, 'Edit Profile', 'Update your name and email', () => _editProfile(context, auth)),
                  _divider(),
                  _option(Icons.shopping_bag_outlined, 'My Orders', 'View your order history', () => Get.toNamed(AppRoutes.orders)),
                  _divider(),
                  _option(Icons.payment_outlined, 'Payment Methods', 'Manage payment options', () => Get.snackbar('Coming Soon', 'Payment methods coming soon', backgroundColor: AppTheme.neonCyan.withOpacity( 0.9), colorText: AppTheme.bgDark)),
                ]),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(color: AppTheme.bgCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)),
                child: _option(Icons.info_outline, 'About', 'Version 1.0.0', () {}),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Get.defaultDialog(
                    title: 'Sign Out',
                    middleText: 'Are you sure?',
                    backgroundColor: AppTheme.bgSurface,
                    titleStyle: const TextStyle(color: AppTheme.textPrimary),
                    middleTextStyle: const TextStyle(color: AppTheme.textSecondary),
                    radius: 16,
                    cancel: TextButton(onPressed: () => Get.back(), child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted))),
                    confirm: TextButton(onPressed: () { auth.logout(); Get.back(); Get.offNamed(AppRoutes.login); }, child: const Text('Sign Out', style: TextStyle(color: AppTheme.error))),
                  ),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Sign Out'),
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.error, side: const BorderSide(color: AppTheme.error), padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ),
              const SizedBox(height: 24),
            ]),
    );
  }

  Widget _option(IconData icon, String title, String sub, VoidCallback onTap) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: AppTheme.neonCyan.withOpacity( 0.1), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: AppTheme.neonCyan, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14)),
      subtitle: Text(sub, style: TextStyle(color: AppTheme.textSecondary.withOpacity( 0.7), fontSize: 12)),
      trailing: const Icon(Icons.chevron_right, color: AppTheme.textMuted, size: 20),
      onTap: onTap,
    );
  }

  Widget _divider() => const Divider(height: 1, indent: 64, color: AppTheme.borderColor);

  void _editProfile(BuildContext context, AuthProvider auth) {
    final nameCtrl = TextEditingController(text: auth.user?.fullName ?? '');
    final phoneCtrl = TextEditingController(text: auth.user?.phone ?? '');
    final formKey = GlobalKey<FormState>();
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.all(24).copyWith(bottom: MediaQuery.of(context).viewInsets.bottom + 16),
        decoration: const BoxDecoration(color: AppTheme.bgSurface, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Form(key: formKey, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: AppTheme.textMuted.withOpacity( 0.3), borderRadius: BorderRadius.circular(2))),
          const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.textPrimary)),
          const SizedBox(height: 20),
          TextFormField(controller: nameCtrl, style: const TextStyle(color: AppTheme.textPrimary),
            decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.person_outline, color: AppTheme.neonCyan, size: 20)),
            validator: (v) => v!.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(controller: phoneCtrl, style: const TextStyle(color: AppTheme.textPrimary),
            decoration: const InputDecoration(labelText: 'Phone', prefixIcon: Icon(Icons.phone_outlined, color: AppTheme.neonCyan, size: 20)),
          ),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () async {
              if (formKey.currentState!.validate()) {
                await auth.updateProfile({'fullName': nameCtrl.text, 'phone': phoneCtrl.text});
                Get.back();
              }
            },
            child: const Text('Save Changes'),
          )),
        ])),
      ),
    );
  }
}
