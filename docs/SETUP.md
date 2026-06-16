# GameShop Setup Guide

## Prerequisites

- **Node.js** 18+ (recommended: 18.17 LTS)
- **npm** 9+ (comes with Node.js)
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** & Docker Compose (optional, for containerized development)
- **Flutter** 3.x (for mobile development)
- **Git**

## 1. Repository Setup

```bash
git clone https://github.com/mahmud-r-farhan/gameshop.git
cd gameshop
```

## 2. Backend Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://gameshop:password@localhost:5432/gameshop_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# Server
API_PORT=5000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
```

### Database Setup

```bash
# Create PostgreSQL database
createdb gameshop_db

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed initial data
npx prisma db seed
```

### Start Backend

```bash
npm run dev
# Server starts at http://localhost:5000
# Health check: http://localhost:5000/health
```

## 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

### Start Frontend

```bash
npm run dev
# Server starts at http://localhost:5173
```

## 4. Admin Panel Setup

```bash
cd admin
npm install
cp .env.example .env
```

Edit `admin/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### Start Admin Panel

```bash
npm run dev
# Server starts at http://localhost:5174
```

## 5. Mobile App Setup

```bash
cd mobile
flutter pub get
```

### Run on Android Emulator

```bash
flutter run
```

### Run on iOS Simulator

```bash
cd ios && pod install && cd ..
flutter run
```

## 6. Docker Setup (Alternative)

Start all services with Docker:

```bash
# From project root
docker-compose up -d
```

Access:
- Frontend: http://localhost:5173
- Admin Panel: http://localhost:5174
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

### Useful Docker Commands

```bash
# View logs
docker-compose logs -f

# Rebuild specific service
docker-compose build backend

# Access database
docker-compose exec postgres psql -U gameshop -d gameshop_db

# Access Redis
docker-compose exec redis redis-cli

# Stop all services
docker-compose down

# Remove volumes (careful — deletes data!)
docker-compose down -v
```

## 7. Verify Setup

```bash
# Backend health check
curl http://localhost:5000/health
# Expected: {"status":"UP","timestamp":"..."}

# Frontend
open http://localhost:5173

# Admin
open http://localhost:5174
```

## 8. Default Admin Account

After seeding, you can login with:
- **Email:** admin@gameshop.com
- **Password:** Admin123!

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>
```

### Database Connection Error

```bash
# Ensure PostgreSQL is running
pg_isready

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Prisma Client Issues

```bash
# Regenerate Prisma client
cd backend
npx prisma generate
npx prisma migrate dev
```
