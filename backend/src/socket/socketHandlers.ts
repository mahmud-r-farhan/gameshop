import type { Server as HTTPServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { USER_ROLES } from '../utils/constants.js';
import { verifyAccessToken } from '../utils/tokens.js';

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

const userRoom = (userId: string) => `user:${userId}`;
const orderRoom = (orderId: string) => `order:${orderId}`;
const ADMIN_ROOM = 'admin-room';

function log(message: string): void {
  if (!env.isTest && !env.isProd) console.log(message);
}

export function setupSocketIO(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : undefined,
      credentials: true,
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
    // Bound the payload so a malicious client cannot exhaust memory.
    maxHttpBufferSize: 1e5,
  });

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      next(new Error('Authentication required'));
      return;
    }

    try {
      // `verifyAccessToken` rejects refresh/reset tokens, so those can never be
      // used to open a realtime session.
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.userId!;
    const userRole = socket.userRole;

    log(`🔌 User ${userId} connected (${userRole})`);

    socket.join(userRoom(userId));
    if (userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.SUPER_ADMIN) {
      socket.join(ADMIN_ROOM);
    }

    /** Let a client follow a specific order it owns. */
    socket.on('order:subscribe', (orderId: unknown) => {
      if (typeof orderId !== 'string' || orderId.length === 0 || orderId.length > 64) return;
      socket.join(orderRoom(orderId));
    });

    socket.on('order:unsubscribe', (orderId: unknown) => {
      if (typeof orderId !== 'string') return;
      socket.leave(orderRoom(orderId));
    });

    socket.on('disconnect', (reason) => {
      log(`🔌 User ${userId} disconnected (${reason})`);
    });

    socket.on('error', (error: Error) => {
      log(`⚠️  Socket error for ${userId}: ${error.message}`);
    });
  });

  return io;
}

/** All emit helpers no-op safely when Socket.io has not been initialised. */
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(userRoom(userId)).emit(event, data);
}

export function emitToAdmin(event: string, data: unknown): void {
  io?.to(ADMIN_ROOM).emit(event, data);
}

export function emitToOrder(orderId: string, event: string, data: unknown): void {
  io?.to(orderRoom(orderId)).emit(event, data);
}

export function emitNewOrder(order: { id?: string; orderNumber?: string; totalAmount?: unknown; userId?: string }): void {
  emitToAdmin('new_order', {
    type: 'NEW_ORDER',
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    userId: order.userId,
    timestamp: new Date(),
  });
}

export function emitOrderUpdate(userId: string, order: { id?: string; [key: string]: unknown }): void {
  const payload = { type: 'ORDER_UPDATE', data: order, timestamp: new Date() };
  emitToUser(userId, 'order_update', payload);
  if (order.id) emitToOrder(String(order.id), 'order_update', payload);
}

export function emitPaymentVerified(userId: string, orderId: string): void {
  const payload = {
    type: 'PAYMENT_VERIFIED',
    orderId,
    message: 'Your payment has been verified!',
    timestamp: new Date(),
  };
  emitToUser(userId, 'payment_verified', payload);
  emitToOrder(orderId, 'payment_verified', payload);
}

export async function closeSocketIO(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => io?.close(() => resolve()));
  io = null;
}
