# GameShop Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
├──────────────────────┬──────────────────┬──────────────────┤
│   Web App (React)    │  Mobile (Flutter)│  Admin (Vue 3)   │
│   Port: 5173         │  iOS & Android   │  Port: 5174      │
└──────────┬───────────┴────────┬─────────┴────────┬──────────┘
           │                    │                  │
           │     HTTPS / REST   │                  │
           └────────┬───────────┴──────┬───────────┘
                    │                  │
                    ▼                  ▼
           ┌────────────────────────────────┐
           │    Nginx Reverse Proxy         │
           │  - SSL Termination             │
           │  - Rate Limiting               │
           │  - Load Balancing              │
           │  - Static File Serving         │
           └────────────┬───────────────────┘
                        │
                        ▼
           ┌────────────────────────────────┐
           │     Backend API (Node.js)      │
           │     Port: 5000                 │
           │                                │
           │  ┌─ Auth Controller          ──┤
           │  ├─ Product Controller       ──┤
           │  ├─ Order Controller         ──┤
           │  ├─ Payment Controller       ──┤
           │  ├─ Review Controller        ──┤
           │  └─ Admin Controller         ──┤
           └────┬──────────────────────┬────┘
                │                      │
                ▼                      ▼
    ┌───────────────────┐  ┌──────────────────┐
    │   PostgreSQL      │  │    Redis         │
    │   - Users         │  │  - Sessions      │
    │   - Products      │  │  - OTP Cache     │
    │   - Orders        │  │  - Rate Limiting │
    │   - Reviews       │  │  - Cart Cache    │
    │   - Payments      │  │                  │
    │   - Promotions    │  │                  │
    └───────────────────┘  └──────────────────┘
```

## Architecture Decisions

### Why Node.js over Golang?

| Factor | Node.js | Golang |
|--------|---------|--------|
| Development Speed | ✅ Faster | ❌ Slower |
| Full-stack JS | ✅ Frontend + Backend | ❌ Different language |
| Package Ecosystem | ✅ Rich (npm) | ❌ Smaller |
| Real-time (Socket.io) | ✅ Native support | ❌ Manual implementation |
| Team Familiarity | ✅ Easier to hire | ❌ Niche |
| Performance | ❌ Slower (~2x) | ✅ Faster |
| Concurrency | ✅ Async/await | ✅ Goroutines |

**Decision:** Node.js wins for this project because the productivity gain outweighs the performance difference for an e-commerce platform at this scale.

### Why PostgreSQL over MongoDB?

| Factor | PostgreSQL | MongoDB |
|--------|-----------|---------|
| ACID Transactions | ✅ Full support | ❌ Limited |
| Order Data | ✅ Relational integrity | ❌ Manual consistency |
| Financial Records | ✅ Audit-ready | ❌ Risk of data loss |
| Complex Queries | ✅ JOINs, aggregations | ❌ Aggregation pipeline |
| JSON Support | ✅ JSONB | ✅ Native |

**Decision:** PostgreSQL for data integrity — orders and payments require ACID compliance.

### Why Zustand over Redux?

- ✅ Minimal boilerplate
- ✅ No context providers needed
- ✅ Built-in persistence middleware
- ✅ TypeScript friendly
- ✅ Tiny bundle size (~1KB)

### Why shadcn/ui over Material-UI?

- ✅ Copy-paste, not dependency
- ✅ Full customization control
- ✅ Tailwind CSS integration
- ✅ Accessible out of the box
- ✅ Smaller bundle size

## Data Flow

### Order Creation Flow

```
User → Checkout → Backend API → PostgreSQL Transaction
                                   │
                                   ├─ Validate items
                                   ├─ Calculate pricing
                                   ├─ Apply promo code
                                   ├─ Create order record
                                   └─ Emit Socket.io event
                                        │
                                        ▼
                                   Frontend updates in real-time
                                   Admin receives notification
```

### Payment Verification Flow

```
User submits transaction ID
        │
Admin views pending payments
        │
Admin clicks "Verify Payment"
        │
Backend API updates:
  - Payment: PENDING → VERIFIED
  - Order: PENDING → PROCESSING
        │
Notification sent to user
        │
Real-time status update
```

## Security Architecture

```
Client → HTTPS (TLS 1.3) → Nginx → Backend
                                    │
                                    ├─ CORS validation
                                    ├─ Rate limiting
                                    ├─ JWT verification
                                    ├─ Input validation (Zod)
                                    └─ SQL injection protection (Prisma)
```

## Database Schema

See `backend/prisma/schema.prisma` for the complete database schema.

Key tables:
- **users** — Customer and admin accounts
- **products** — Game products and currencies
- **orders** — Customer orders with items
- **payments** — Payment records and verification
- **reviews** — Product ratings and reviews
- **promotions** — Discount codes and campaigns
- **payment_gateways** — Payment provider configuration
