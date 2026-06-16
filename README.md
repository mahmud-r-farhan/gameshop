<div align="center">

  <h1>🎮 GameShop E-Commerce Platform</h1>

  <p><strong>A full-stack gaming products marketplace with React web app, Flutter mobile app, and Vue 3 admin panel</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#project-structure">Structure</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react" alt="React 18"/>
    <img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat&logo=vue.js" alt="Vue 3"/>
    <img src="https://img.shields.io/badge/Flutter-3-02569B?style=flat&logo=flutter" alt="Flutter 3"/>
    <img src="https://img.shields.io/badge/Node_JS-18-339933?style=flat&logo=node.js" alt="Node 18"/>
    <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql" alt="PostgreSQL 15"/>
    <img src="https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker" alt="Docker"/>
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/>
  </p>
</div>

---

## ✨ Features

### 👤 Customer Features
- **Browse & Search** — Explore games and in-game currencies by category, game type, and price
- **User Authentication** — Register, login, forgot password with OTP verification
- **Shopping Cart** — Add/remove items, adjust quantities, persistent storage
- **Checkout & Payment** — Multiple payment methods (bKash, Nagad, Rocket), transaction ID submission
- **Order Tracking** — Real-time order status updates with timeline view
- **Product Reviews** — Rate and review purchased products
- **User Profile** — Edit profile, view order history, manage settings
- **Responsive Design** — Optimized for desktop, tablet, and mobile

### 🔧 Admin Features
- **Dashboard** — Real-time analytics with revenue charts, order stats, and KPIs
- **Product Management** — CRUD operations, featured products, availability control
- **Order Management** — View, filter, update order status (verify payment, deliver, cancel)
- **Payment Verification** — Manual payment verification with transaction tracking
- **Promotions** — Create and manage discount codes
- **Payment Gateways** — Configure bKash, Nagad, Rocket accounts and instructions
- **User Management** — Enable/disable customer accounts
- **Analytics** — Sales reports, top products, payment method distribution

### 📱 Mobile Features
- **Cross-Platform** — iOS and Android from a single Flutter codebase
- **Native Performance** — Smooth animations and fast load times
- **Biometric Auth** — Fingerprint and face ID support
- **Push Notifications** — Real-time order updates
- **Offline Support** — Cart persistence, cached product listings

---

## 🛠 Tech Stack

### Frontend (Web)
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework with hooks |
| **Vite** | Build tool with instant HMR |
| **TypeScript** | Type safety and developer experience |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Smooth animations and transitions |
| **React Query** | Server state management |
| **Zustand** | Client state management |
| **React Router v6** | Client-side routing |
| **shadcn/ui** | Accessible, reusable UI components |

### Admin Panel
| Technology | Purpose |
|-----------|---------|
| **Vue 3** | Progressive JavaScript framework |
| **Vite** | Build tool and dev server |
| **Pinia** | State management |
| **Vue Router** | Client-side routing |
| **Chart.js** | Data visualization |
| **Tailwind CSS** | Utility-first styling |

### Mobile App
| Technology | Purpose |
|-----------|---------|
| **Flutter 3** | Cross-platform mobile framework |
| **Dart** | Programming language |
| **Provider** | State management |
| **GetX** | Navigation and utilities |
| **Dio** | HTTP client and API integration |
| **SharedPreferences** | Local data persistence |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js 18** | JavaScript runtime |
| **Express.js** | Web framework |
| **TypeScript** | Type safety |
| **Prisma ORM** | Database modeling and migrations |
| **PostgreSQL 15** | Primary database |
| **Redis 7** | Caching and session store |
| **JWT** | Authentication tokens |
| **Socket.io** | Real-time communication |
| **Zod** | Input validation |
| **Helmet** | Security headers |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-service orchestration |
| **Nginx** | Reverse proxy and static serving |
| **GitHub Actions** | CI/CD pipeline |
| **Prometheus** | Metrics collection |
| **Grafana** | Monitoring dashboards |

---

## 📁 Project Structure

```
gameshop/
├── backend/          # Node.js + Express REST API
│   ├── src/
│   │   ├── config/       # Database, Redis, env config
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/    # Auth, rate limiting, validation
│   │   ├── routes/       # API route definitions
│   │   ├── services/     # Business logic layer
│   │   ├── socket/       # WebSocket handlers
│   │   ├── events/       # Event publishers
│   │   └── utils/        # Helpers and utilities
│   ├── prisma/           # Schema and migrations
│   └── tests/            # Unit and integration tests
│
├── frontend/         # React web application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page-level components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API service layer
│   │   ├── store/       # Zustand state stores
│   │   └── lib/         # Utilities and helpers
│   └── public/          # Static assets
│
├── admin/            # Vue 3 admin dashboard
│   ├── src/
│   │   ├── views/       # Admin page views
│   │   ├── components/  # Reusable Vue components
│   │   ├── layout/      # Admin layout with sidebar
│   │   ├── router/      # Route definitions
│   │   ├── store/       # Pinia state stores
│   │   └── services/    # API integration
│   └── public/
│
├── mobile/           # Flutter mobile app
│   ├── lib/
│   │   ├── screens/     # App screens
│   │   ├── models/      # Data models
│   │   ├── providers/   # State management
│   │   ├── services/    # API and data services
│   │   ├── widgets/     # Reusable widgets
│   │   └── config/      # Theme and routing
│   └── android/ & ios/  # Platform-specific code
│
├── nginx/            # Nginx production config
├── .github/          # CI/CD workflows
├── docs/             # Project documentation
└── scripts/          # Utility scripts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)
- Flutter 3.x (for mobile)

### 1. Clone & Install

```bash
git clone https://github.com/mahmud-r-farhan/gameshop.git
cd gameshop

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Admin Panel
cd admin && npm install && cd ..
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit the .env files with your configuration
```

### 3. Database Setup

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ..
```

### 4. Start Development Servers

```bash
# Start backend (port 5000)
cd backend && npm run dev &

# Start frontend (port 5173)
cd frontend && npm run dev &

# Start admin panel (port 5174)
cd admin && npm run dev &

# Open in browser
open http://localhost:5173
```

### 5. Using Docker (Alternative)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📱 Mobile App Setup

```bash
cd mobile

# Install Flutter dependencies
flutter pub get

# Run on Android
flutter run

# Run on iOS
cd ios && pod install && cd ..
flutter run
```

---

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with production values

# 2. Deploy
docker-compose -f docker-compose.prod.yml up -d

# 3. Setup SSL (first time)
certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and architecture decisions |
| [API Reference](docs/API.md) | Complete API endpoint documentation |
| [Setup Guide](docs/SETUP.md) | Detailed local development setup |
| [Deployment](docs/DEPLOYMENT.md) | Production deployment guide |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute to the project |
| [Security](docs/SECURITY.md) | Security policies and practices |

---

## 🔐 Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

Key variables:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/gameshop_db
REDIS_URL=redis://:password@localhost:6379
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:5173
```

---

## 🧪 Testing

```bash
# Backend
cd backend && npm run test

# Frontend
cd frontend && npm run test

# Mobile
cd mobile && flutter test
```

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Workflow
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---


<div align="center">
  <p>Built with ❤️ by the Mahmud Rahman</p>

</div>
