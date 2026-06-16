import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

router.get('/', async (req, res) => {
  const health: any = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {},
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'UP';
  } catch (error) {
    health.checks.database = 'DOWN';
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
