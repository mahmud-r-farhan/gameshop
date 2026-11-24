/// Client-side mirrors of the backend's auth schemas. The server remains the
/// source of truth; these checks only prevent an obviously invalid request.
final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
final RegExp _phonePattern = RegExp(r'^\+?8801[3-9]\d{8}$|^01[3-9]\d{8}$');
final RegExp _letterPattern = RegExp(r'[A-Za-z]');
final RegExp _digitPattern = RegExp(r'\d');

String? emailProblem(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty) return 'Email is required';
  if (email.length > 254) return 'Email is too long';
  if (!_emailPattern.hasMatch(email)) return 'Enter a valid email address';
  return null;
}

String? fullNameProblem(String? value) {
  final name = value?.trim() ?? '';
  if (name.isEmpty) return 'Full name is required';
  if (name.length < 2) return 'Full name must be at least 2 characters';
  if (name.length > 120) return 'Full name must be at most 120 characters';
  return null;
}

String? optionalPhoneProblem(String? value) {
  final phone = value?.trim() ?? '';
  if (phone.isEmpty) return null;
  if (!_phonePattern.hasMatch(phone)) {
    return 'Use a valid BD number, e.g. 01712345678';
  }
  return null;
}

/// Mirrors `passwordSchema` in `backend/src/schemas/auth.schema.ts`.
String? passwordProblem(String? value) {
  final password = value ?? '';
  if (password.isEmpty) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (!_letterPattern.hasMatch(password)) {
    return 'Password must contain at least one letter';
  }
  if (!_digitPattern.hasMatch(password)) {
    return 'Password must contain at least one digit';
  }
  return null;
}

String? confirmPasswordProblem(String? value, String password) {
  if (value == null || value.isEmpty) return 'Please confirm your password';
  if (value != password) return 'Passwords do not match';
  return null;
}
