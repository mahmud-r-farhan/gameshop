# GameShop API Documentation

Base URL: `/api/v1`

## Authentication

Request bodies use strict Zod schemas: unknown keys are rejected with `400`.
Passwords must be 8–128 characters and contain at least one letter and one
digit. Phone numbers are Bangladeshi (`+8801XXXXXXXXX` or `01XXXXXXXXX`).

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass1",
  "fullName": "John Doe",
  "phone": "+8801712345678"
}
```
The field is `fullName`, not `name`. `phone` is optional.

Response: `201`
```json
{
  "success": true,
  "message": "Registration successful",
  "data": { "user": { "id": "uuid", "email": "user@example.com", "fullName": "John Doe", "role": "USER" }, "accessToken": "jwt", "refreshToken": "jwt" }
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "SecurePass1" }
```

Response: `200`
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "fullName": "John Doe", "role": "USER" },
    "accessToken": "jwt",
    "refreshToken": "jwt"
  }
}
```

### Refresh / Logout
```http
POST /api/v1/auth/refresh
{ "refreshToken": "jwt" }
```
Returns a rotated `{ user, accessToken, refreshToken }` pair.

```http
POST /api/v1/auth/logout
```
Stateless (JWT); clients clear their own tokens. Response:
`{ "success": true, "message": "Logged out" }`.

### Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```
Response: `200`
`{ "success": true, "message": "If the email exists, an OTP has been sent" }`
— identical whether or not the address is registered.

### Verify OTP
```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{ "email": "user@example.com", "otp": "123456" }
```
Response: `200`
```json
{ "success": true, "data": { "resetToken": "jwt", "expiresInSeconds": 900 } }
```
The token is signed with the refresh secret, has `type: password_reset`, is bound
to the account's current password hash, and expires in 15 minutes.

### Reset Password
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "NewSecurePass1",
  "token": "<resetToken from /auth/verify-otp>"
}
```
`token` is required (minimum 20 characters). `otp` is **not** accepted here.
Response: `200` `{ "success": true, "message": "Password reset successful" }`.

### Get Profile
```http
GET /api/v1/auth/profile
Authorization: Bearer <accessToken>
```
Response: `200`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "phone": "+8801712345678",
    "role": "USER"
  }
}
```

### Update Profile
```http
PATCH /api/v1/auth/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "fullName": "John Updated", "phone": "+8801876543210" }
```
Allow-listed fields only: `fullName`, `phone`, `avatarUrl`, `division`,
`district`, `address`, `postalCode`, `preferredPaymentMethod`,
`notificationPreferences`. `role`, `isActive` and other unknown keys are
rejected. Response: `200` `{ "success": true, "data": { ...updated user } }`.

### Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer <accessToken>

{ "currentPassword": "SecurePass1", "newPassword": "AnotherPass2" }
```

## Products

### List Products
```http
GET /api/v1/products?category=GAME&game_type=PUBG&page=1&limit=20&sort=newest&search=query
Authorization: Bearer <token> (optional)

Response: 200
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "title": "PUBG Mobile UC - 300 UC",
        "category": "CURRENCY",
        "gameType": "PUBG",
        "price": 500,
        "originalPrice": 550,
        "discountPercentage": 9,
        "isFeatured": true,
        "images": ["url1"],
        "rating": 4.8,
        "reviewCount": 234
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Get Single Product
```http
GET /api/v1/products/:id

Response: 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "PUBG Mobile UC - 300 UC",
    "description": "Official PUBG Mobile UC...",
    "price": 500,
    "originalPrice": 550,
    "category": "CURRENCY",
    "gameType": "PUBG",
    "isAvailable": true,
    "isFeatured": true,
    "images": ["url1", "url2"],
    "specs": [{ "specName": "UC Amount", "specValue": "300 UC" }],
    "rating": 4.8,
    "reviewCount": 234
  }
}
```

### Get Featured Products
```http
GET /api/v1/products/featured

Response: 200
{ "success": true, "data": [...featured products] }
```

## Orders

### Create Order
```http
POST /api/v1/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [{ "productId": "uuid", "quantity": 1 }],
  "paymentMethod": "bkash",
  "shippingAddress": "123 Main St, Dhaka",
  "phone": "+8801234567890"
}

Response: 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "totalAmount": 500,
    "status": "pending",
    "paymentStatus": "pending"
  }
}
```

### List User Orders
```http
GET /api/v1/orders?status=pending&page=1&limit=20
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid",
        "totalAmount": 500,
        "status": "pending",
        "paymentStatus": "pending",
        "items": [...],
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
  }
}
```

### Get Order Detail
```http
GET /api/v1/orders/:id
Authorization: Bearer <token>

Response: 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "totalAmount": 500,
    "status": "pending",
    "paymentStatus": "pending",
    "items": [{ "productName": "PUBG UC", "quantity": 1, "price": 500 }],
    "user": { "id": "uuid", "name": "John", "email": "john@example.com" },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

## Reviews

### Create Review
```http
POST /api/v1/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "uuid",
  "orderId": "uuid",
  "rating": 5,
  "comment": "Excellent product!"
}

Response: 201
{
  "success": true,
  "data": { "id": "uuid", "rating": 5, "comment": "Excellent product!" }
}
```

### Get Product Reviews
```http
GET /api/v1/reviews/product/:productId?page=1&limit=10

Response: 200
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "comment": "Great service!",
        "userName": "John",
        "createdAt": "2024-01-15"
      }
    ],
    "averageRating": 4.8,
    "totalReviews": 234
  }
}
```

### Get Rating Distribution
```http
GET /api/v1/reviews/product/:productId/distribution

Response: 200
{
  "success": true,
  "data": {
    "distribution": { "1": 5, "2": 3, "3": 12, "4": 45, "5": 169 },
    "averageRating": 4.8,
    "totalReviews": 234
  }
}
```

## Admin Endpoints

All admin endpoints require `Authorization: Bearer <admin_token>`.

### Dashboard Stats
```http
GET /api/v1/admin/dashboard/stats

Response: 200
{
  "success": true,
  "data": {
    "today": { "totalOrders": 45, "totalRevenue": 45000, "pendingPayments": 12, "deliveredOrders": 35 },
    "weekly": { "totalOrders": 280, "totalRevenue": 280000 },
    "monthly": { "totalOrders": 1200, "totalRevenue": 1200000 },
    "topProducts": [{ "name": "PUBG UC 300", "sales": 150 }],
    "paymentMethods": { "bkash": 60, "nagad": 25, "rocket": 15 }
  }
}
```

### List All Orders (Admin)
```http
GET /api/v1/admin/orders?status=pending&paymentStatus=pending&page=1&limit=20
```

### Update Order Status
```http
PATCH /api/v1/admin/orders/:id/status
Content-Type: application/json

{ "status": "processing" }
```

### Verify Payment
```http
PATCH /api/v1/admin/orders/:id/payment
Content-Type: application/json

{ "paymentStatus": "paid" }
```

### Create Product
```http
POST /api/v1/admin/products
Content-Type: application/json

{
  "title": "PUBG Mobile UC - 300 UC",
  "category": "CURRENCY",
  "gameType": "PUBG",
  "price": 500,
  "description": "Official PUBG UC",
  "images": ["url1", "url2"],
  "specs": [{ "specName": "UC Amount", "specValue": "300 UC" }]
}
```

### Update Product
```http
PUT /api/v1/admin/products/:id
Content-Type: application/json

{
  "price": 450,
  "isAvailable": true,
  "isFeatured": true
}
```

### Delete Product
```http
DELETE /api/v1/admin/products/:id
```

### Create Promotion
```http
POST /api/v1/admin/promotions
Content-Type: application/json

{
  "code": "SAVE10",
  "discountType": "percentage",
  "discountValue": 10,
  "validUntil": "2024-02-01T00:00:00Z",
  "minPurchase": 1000
}
```

### List Users (Admin)
```http
GET /api/v1/admin/users?page=1&limit=20
```

### Toggle User Status
```http
PATCH /api/v1/admin/users/:id/toggle-status
```

### List Payment Gateways
```http
GET /api/v1/admin/payment-gateways
```

### Create/Update Payment Gateway
```http
POST /api/v1/admin/payment-gateways
Content-Type: application/json

{
  "gatewayName": "BKASH",
  "accountNumber": "01700123456",
  "accountHolder": "GameShop Bangladesh",
  "instructions": "Send money to this bKash number...",
  "isEnabled": true
}
```

### Toggle Gateway Status
```http
PATCH /api/v1/admin/payment-gateways/:id/toggle
```

## Realtime (Socket.io)

Connect to the API origin with an access token in the handshake:
`io('/', { auth: { token: accessToken } })`. Refresh, reset and invalid tokens are
rejected at connection time.

### Subscribe to an order

```js
socket.emit('order:subscribe', orderId, (ack) => {
  // ack: { ok: true } | { ok: false }
});
```

The server looks up the order and joins the caller to `order:<id>` only when the
caller owns it, or has the `ADMIN` / `SUPER_ADMIN` role. A malformed ID, an ID
that does not exist, and another customer's ID all produce the same
`{ ok: false }` ack, so subscriptions cannot be used to enumerate orders.
`socket.emit('order:unsubscribe', orderId)` leaves the room.

| Event | Room | Payload |
|---|---|---|
| `order_update` | `user:<userId>` and `order:<id>` | `{ type: 'ORDER_UPDATE', data: order, timestamp }` |
| `payment_verified` | `user:<userId>` and `order:<id>` | `{ type: 'PAYMENT_VERIFIED', orderId, message, timestamp }` |
| `new_order` | admin room only | `{ type: 'NEW_ORDER', orderId, orderNumber, totalAmount, userId, timestamp }` |

Clients without an ack callback are still subject to the same authorization
check. The ack is optional only for backwards compatibility.

## Error Responses

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error
