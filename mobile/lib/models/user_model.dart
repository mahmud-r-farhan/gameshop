class UserModel {
  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final String? division;
  final String? district;
  final String? address;
  final String? postalCode;

  UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    this.phone,
    this.avatarUrl,
    this.role = 'USER',
    this.division,
    this.district,
    this.address,
    this.postalCode,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      role: json['role'] as String? ?? 'USER',
      division: json['division'] as String?,
      district: json['district'] as String?,
      address: json['address'] as String?,
      postalCode: json['postalCode'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'fullName': fullName,
    'phone': phone,
    'avatarUrl': avatarUrl,
    'role': role,
    'division': division,
    'district': district,
    'address': address,
    'postalCode': postalCode,
  };

  UserModel copyWith({String? fullName, String? phone, String? address}) {
    return UserModel(
      id: id, email: email, fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone, avatarUrl: avatarUrl, role: role,
      division: division, district: district, address: address ?? this.address,
      postalCode: postalCode,
    );
  }
}
