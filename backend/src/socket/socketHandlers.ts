import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

let io: Server | null = null;

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export const setupSocketIO = (httpServer: HTTPServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [env.frontend.url, env.frontend.adminUrl],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token as string, env.jwt.secret) as any;
      (socket as any).userId = decoded.id;
      (socket as any).userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    console.log(`User ${userId} connected (${userRole})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join admin room if admin
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      socket.join('admin-room');
    }

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
    });
  });

  return io;
};

// Helper functions to emit events
export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToAdmin = (event: string, data: any) => {
  if (!io) return;
  io.to('admin-room').emit(event, data);
};

export const emitNewOrder = (order: any) => {
  emitToAdmin('new_order', {
    type: 'NEW_ORDER',
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    timestamp: new Date(),
  });
};

export const emitOrderUpdate = (userId: string, order: any) => {
  emitToUser(userId, 'order_update', {
    type: 'ORDER_UPDATE',
    data: order,
    timestamp: new Date(),
  });
};

export const emitPaymentVerified = (userId: string, orderId: string) => {
  emitToUser(userId, 'payment_verified', {
    type: 'PAYMENT_VERIFIED',
    orderId,
    message: 'Your payment has been verified!',
    timestamp: new Date(),
  });
};
