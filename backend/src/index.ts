import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';
import { setupSocketIO } from './socket/socketHandlers.js';
import prisma from './config/database.js';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [env.frontend.url, env.frontend.adminUrl],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// API routes
app.use('/api/v1', routes);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Setup Socket.io
const io = setupSocketIO(httpServer);
app.set('io', io);

// Database connection & server start
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    httpServer.listen(env.port, () => {
      console.log(`🚀 Server running on port ${env.port}`);
      console.log(`📍 Environment: ${env.nodeEnv}`);
      console.log(`🔗 Frontend URL: ${env.frontend.url}`);
      console.log(`🔗 Admin URL: ${env.frontend.adminUrl}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();

export default app;
