import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server as HTTPServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';

// `order:subscribe` now looks up the order's owner. The same in-memory Prisma
// double the HTTP suite uses keeps these tests database-free.
vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const {
  setupSocketIO,
  closeSocketIO,
  getIO,
  emitNewOrder,
  emitOrderUpdate,
  emitPaymentVerified,
  emitToUser,
} = await import('../../src/socket/socketHandlers.js');
const { generateAccessToken, generateRefreshToken } = await import('../../src/utils/tokens.js');
const { model, resetPrismaMock } = await import('../helpers/prisma-mock.js');

/**
 * Realtime layer.
 *
 * The README advertised real-time order updates, and `emitNewOrder` /
 * `emitOrderUpdate` / `emitPaymentVerified` existed — but nothing ever called
 * them, so no browser ever received an event. These tests drive a real Socket.IO
 * server over a real WebSocket, which is the only way to prove both halves: that
 * the handshake authenticates, and that an emit actually reaches the right room.
 */

const CUSTOMER = { id: 'customer-1', email: 'buyer@example.com', role: 'USER' };
const OTHER_CUSTOMER = { id: 'customer-2', email: 'other@example.com', role: 'USER' };
const ADMIN = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
const ORDER_ID = 'order-1';

const tokenFor = (user: { id: string; email: string; role: string }) =>
  generateAccessToken({ id: user.id, email: user.email, role: user.role });

let httpServer: HTTPServer;
let baseUrl = '';
const clients: Socket[] = [];

async function startServer(): Promise<void> {
  httpServer = createServer();
  setupSocketIO(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopServer(): Promise<void> {
  for (const client of clients.splice(0)) {
    if (client.connected) client.disconnect();
    client.close();
  }
  await closeSocketIO();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}

/**
 * The client's `connect` event fires when the handshake packet arrives, which is
 * *before* the server's `connection` handler has necessarily finished joining
 * rooms. Emitting straight after `connect` is therefore a race — so the helper
 * resolves one macrotask later, once the room joins have landed.
 */
const ROOM_JOIN_SETTLE_MS = 40;

function connect(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 5000,
      ...(token ? { auth: { token } } : {}),
    });
    clients.push(socket);
    socket.once('connect', () => setTimeout(() => resolve(socket), ROOM_JOIN_SETTLE_MS));
    socket.once('connect_error', (error: Error) => {
      socket.close();
      reject(error);
    });
  });
}

/** Resolve with the payload of the next `event`, or reject after `timeoutMs`. */
function nextEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    function handler(payload: T) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, handler);
  });
}

/** Assert that `event` does NOT arrive within `windowMs`. */
async function expectNoEvent(socket: Socket, event: string, windowMs = 250): Promise<void> {
  const received = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(false);
    }, windowMs);
    function handler() {
      clearTimeout(timer);
      resolve(true);
    }
    socket.once(event, handler);
  });

  expect(await received).toBe(false);
}

/** Emit `order:subscribe` and resolve with the server's ack (or fail on timeout). */
function subscribe(socket: Socket, orderId: unknown): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit('order:subscribe', orderId, (error: Error | null, ack: { ok: boolean }) => {
      if (error) reject(error);
      else resolve(ack);
    });
  });
}

/** Every subscription test starts with ORDER_ID owned by CUSTOMER. */
function givenOrderOwnedBy(ownerId: string | null): void {
  resetPrismaMock();
  model('order').findUnique.mockResolvedValue(ownerId === null ? null : { userId: ownerId });
}

// Declared first: `io` is still null here, which is exactly the state these
// assertions need. Vitest runs tests in declaration order.
describe('emit helpers before Socket.IO is initialised', () => {
  it('no-op instead of throwing when a service emits during boot', async () => {
    expect(() => {
      emitToUser(CUSTOMER.id, 'order_update', {});
      emitNewOrder({ id: ORDER_ID });
      emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID });
      emitPaymentVerified(CUSTOMER.id, ORDER_ID);
    }).not.toThrow();
  });

  it('makes the uninitialised state explicit through getIO()', () => {
    expect(() => getIO()).toThrow(/not initialized/i);
  });
});

describe('handshake authentication', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it('rejects a connection with no token', async () => {
    await expect(connect()).rejects.toThrow(/authentication required/i);
  });

  it('rejects a connection with a garbage token', async () => {
    await expect(connect('not-a-jwt')).rejects.toThrow(/invalid token/i);
  });

  /**
   * A refresh token is a valid JWT signed with a different secret and a
   * different `type`; accepting it here would turn a long-lived renewal
   * credential into a realtime session.
   */
  it('rejects a refresh token presented as a session token', async () => {
    await expect(connect(generateRefreshToken(CUSTOMER.id))).rejects.toThrow(/invalid token/i);
  });

  it('accepts a valid access token', async () => {
    const socket = await connect(tokenFor(CUSTOMER));
    expect(socket.connected).toBe(true);
  });

  it('accepts a token supplied through the query string as well', async () => {
    const socket = await new Promise<Socket>((resolve, reject) => {
      const client = ioClient(`${baseUrl}?token=${encodeURIComponent(tokenFor(CUSTOMER))}`, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        timeout: 5000,
      });
      clients.push(client);
      client.once('connect', () => setTimeout(() => resolve(client), ROOM_JOIN_SETTLE_MS));
      client.once('connect_error', reject);
    });
    expect(socket.connected).toBe(true);
  });
});

describe('room isolation', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it('delivers an order update to the customer who owns it', async () => {
    const customer = await connect(tokenFor(CUSTOMER));
    const incoming = nextEvent(customer, 'order_update');

    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'PROCESSING' });

    const payload = await incoming;
    expect(payload).toMatchObject({
      type: 'ORDER_UPDATE',
      data: { id: ORDER_ID, orderStatus: 'PROCESSING' },
    });
  });

  it('does not deliver one customer\'s order update to another', async () => {
    const victim = await connect(tokenFor(CUSTOMER));
    const bystander = await connect(tokenFor(OTHER_CUSTOMER));

    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'PROCESSING' });

    await expect(nextEvent(victim, 'order_update')).resolves.toBeDefined();
    await expectNoEvent(bystander, 'order_update');
  });

  it('delivers new_order to administrators', async () => {
    const admin = await connect(tokenFor(ADMIN));
    const incoming = nextEvent(admin, 'new_order');

    emitNewOrder({ id: ORDER_ID, orderNumber: 'ORD-1', totalAmount: '360.00', userId: CUSTOMER.id });

    await expect(incoming).resolves.toMatchObject({
      type: 'NEW_ORDER',
      orderId: ORDER_ID,
      orderNumber: 'ORD-1',
    });
  });

  /**
   * A customer must never see the admin firehose: it contains every other
   * customer's order numbers and totals.
   */
  it('does not deliver admin events to a customer', async () => {
    const customer = await connect(tokenFor(CUSTOMER));

    emitNewOrder({ id: ORDER_ID, orderNumber: 'ORD-1', totalAmount: '360.00', userId: OTHER_CUSTOMER.id });

    await expectNoEvent(customer, 'new_order');
  });

  it('joins a super admin to the admin room as well', async () => {
    const root = await connect(tokenFor({ id: 'root', email: 'root@example.com', role: 'SUPER_ADMIN' }));
    const incoming = nextEvent(root, 'new_order');

    emitNewOrder({ id: ORDER_ID });

    await expect(incoming).resolves.toBeDefined();
  });
});

describe('per-order subscriptions', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    givenOrderOwnedBy(CUSTOMER.id);
  });

  // Regression: any logged-in user could join another customer's order room and
  // receive that order's status and payment events. This deliberately emits
  // without an ack, so it fails against the old handler because the events
  // actually arrive — not merely because the ack was missing.
  it('refuses to join an order room that belongs to another customer', async () => {
    const attacker = await connect(tokenFor(OTHER_CUSTOMER));
    attacker.emit('order:subscribe', ORDER_ID);
    await new Promise((resolve) => setTimeout(resolve, ROOM_JOIN_SETTLE_MS));

    const noUpdate = expectNoEvent(attacker, 'order_update');
    const noPayment = expectNoEvent(attacker, 'payment_verified');
    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'DELIVERED' });
    emitPaymentVerified(CUSTOMER.id, ORDER_ID);
    await noUpdate;
    await noPayment;
  });

  it('acks a denied join without revealing whether the order exists', async () => {
    const attacker = await connect(tokenFor(OTHER_CUSTOMER));

    await expect(subscribe(attacker, ORDER_ID)).resolves.toEqual({ ok: false });

    // The ownership check must look up the requested order, not a client-supplied user id.
    expect(model('order').findUnique).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      select: { userId: true },
    });
  });

  it('returns the same negative ack when the order does not exist', async () => {
    givenOrderOwnedBy(null);
    const socket = await connect(tokenFor(OTHER_CUSTOMER));

    await expect(subscribe(socket, ORDER_ID)).resolves.toEqual({ ok: false });
    await expectNoEvent(socket, 'order_update');
  });

  it('lets the owner follow their own order', async () => {
    const owner = await connect(tokenFor(CUSTOMER));

    await expect(subscribe(owner, ORDER_ID)).resolves.toEqual({ ok: true });

    const incoming = nextEvent(owner, 'order_update');
    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'DELIVERED' });
    await expect(incoming).resolves.toMatchObject({ data: { orderStatus: 'DELIVERED' } });
  });

  // Staff are not in the customer's user room, so an event here proves the
  // order room itself was joined.
  it('lets an administrator follow an order they do not own', async () => {
    const admin = await connect(tokenFor(ADMIN));

    await expect(subscribe(admin, ORDER_ID)).resolves.toEqual({ ok: true });

    const incoming = nextEvent(admin, 'order_update');
    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'DELIVERED' });
    await expect(incoming).resolves.toMatchObject({ data: { orderStatus: 'DELIVERED' } });
  });

  it('lets a super admin follow an order they do not own', async () => {
    const root = await connect(tokenFor({ id: 'root', email: 'root@example.com', role: 'SUPER_ADMIN' }));

    await expect(subscribe(root, ORDER_ID)).resolves.toEqual({ ok: true });
  });

  it('stops delivering after unsubscribe', async () => {
    const admin = await connect(tokenFor(ADMIN));
    await expect(subscribe(admin, ORDER_ID)).resolves.toEqual({ ok: true });

    admin.emit('order:unsubscribe', ORDER_ID);
    await new Promise((resolve) => setTimeout(resolve, ROOM_JOIN_SETTLE_MS));

    const noUpdate = expectNoEvent(admin, 'order_update');
    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID, orderStatus: 'DELIVERED' });
    await noUpdate;
  });

  it('rejects malformed subscription payloads instead of crashing the socket', async () => {
    const socket = await connect(tokenFor(CUSTOMER));

    for (const bad of [12345, '', 'x'.repeat(5000), null, undefined, { id: ORDER_ID }]) {
      await expect(subscribe(socket, bad)).resolves.toEqual({ ok: false });
    }
    socket.emit('order:unsubscribe', 42);
    expect(model('order').findUnique).not.toHaveBeenCalled();

    // The connection must still be usable afterwards.
    const incoming = nextEvent(socket, 'order_update');
    emitOrderUpdate(CUSTOMER.id, { id: ORDER_ID });
    await expect(incoming).resolves.toBeDefined();
    expect(socket.connected).toBe(true);
  });

  it('denies the join instead of crashing when the ownership lookup fails', async () => {
    model('order').findUnique.mockRejectedValue(new Error('database unavailable'));
    const socket = await connect(tokenFor(CUSTOMER));

    await expect(subscribe(socket, ORDER_ID)).resolves.toEqual({ ok: false });
    expect(socket.connected).toBe(true);
  });
});

describe('payment notifications', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    givenOrderOwnedBy(CUSTOMER.id);
  });

  it('reaches the paying customer', async () => {
    const customer = await connect(tokenFor(CUSTOMER));
    const incoming = nextEvent(customer, 'payment_verified');

    emitPaymentVerified(CUSTOMER.id, ORDER_ID);

    await expect(incoming).resolves.toMatchObject({
      type: 'PAYMENT_VERIFIED',
      orderId: ORDER_ID,
    });
  });

  it('reaches a client following the order room', async () => {
    const admin = await connect(tokenFor(ADMIN));
    await expect(subscribe(admin, ORDER_ID)).resolves.toEqual({ ok: true });

    const incoming = nextEvent(admin, 'payment_verified');
    emitPaymentVerified(CUSTOMER.id, ORDER_ID);
    await expect(incoming).resolves.toBeDefined();
  });

  it('does not reach an unrelated customer', async () => {
    const bystander = await connect(tokenFor(OTHER_CUSTOMER));

    emitPaymentVerified(CUSTOMER.id, ORDER_ID);

    await expectNoEvent(bystander, 'payment_verified');
  });
});
