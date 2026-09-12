import { vi } from 'vitest';

/**
 * In-memory Prisma test double.
 *
 * Every model method is a `vi.fn()` so individual tests can stub exactly the
 * query they care about, and `$transaction` executes the callback against the
 * same mock — which is what lets us assert that a service really did keep its
 * writes inside one transaction.
 */

const MODEL_METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

export const MODELS = [
  'user',
  'product',
  'productSpec',
  'promotion',
  'orderItem',
  'order',
  'orderStatusHistory',
  'review',
  'payment',
  'customerFeedback',
  'paymentGateway',
  'adminSettings',
] as const;

export type ModelName = (typeof MODELS)[number];

type MockFn = ReturnType<typeof vi.fn>;

export interface PrismaMock {
  $connect: MockFn;
  $disconnect: MockFn;
  $queryRaw: MockFn;
  $queryRawUnsafe: MockFn;
  $executeRaw: MockFn;
  $transaction: MockFn;
  [key: string]: unknown;
}

export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $connect: vi.fn(async () => undefined),
    $disconnect: vi.fn(async () => undefined),
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
    $queryRawUnsafe: vi.fn(async () => [{ ok: 1 }]),
    $executeRaw: vi.fn(async () => 1),
    // Callback form (used by the services) and array form both supported.
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: PrismaMock) => unknown)(mock);
      if (Array.isArray(arg)) return Promise.all(arg);
      throw new Error(`Unsupported $transaction argument: ${typeof arg}`);
    }),
  };

  for (const model of MODELS) {
    const modelMock: Record<string, MockFn> = {};
    for (const method of MODEL_METHODS) {
      modelMock[method] = vi.fn(async () => null);
    }
    mock[model] = modelMock;
  }

  return mock;
}

/** Shared instance used by every unit test via `vi.mock`. */
export const prismaMock = createPrismaMock();

/** Typed accessor: `model('order').findMany`. */
export function model(name: ModelName): Record<string, MockFn> {
  return prismaMock[name] as Record<string, MockFn>;
}

/**
 * Reset every stub between tests so state cannot leak across cases.
 *
 * `mockReset` (not `mockClear`) is deliberate: queued `mockResolvedValueOnce`
 * implementations survive `mockClear`, which would let one test's fixtures
 * answer another test's queries.
 */
export function resetPrismaMock(): void {
  for (const key of Object.keys(prismaMock)) {
    const value = prismaMock[key];
    if (typeof value === 'function' && 'mockReset' in (value as MockFn)) {
      (value as MockFn).mockReset();
    }
    if (value && typeof value === 'object') {
      for (const method of Object.values(value as Record<string, unknown>)) {
        if (typeof method === 'function' && 'mockReset' in (method as MockFn)) {
          (method as MockFn).mockReset();
          (method as MockFn).mockResolvedValue(null);
        }
      }
    }
  }

  // Restore the $transaction passthrough, which `mockClear` does not reset.
  prismaMock.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: PrismaMock) => unknown)(prismaMock);
    if (Array.isArray(arg)) return Promise.all(arg);
    throw new Error(`Unsupported $transaction argument: ${typeof arg}`);
  });
  prismaMock.$queryRaw = vi.fn(async () => [{ ok: 1 }]);
}

/**
 * Build an error shaped like `PrismaClientKnownRequestError` without importing
 * the generated client (which may not exist in a unit-test environment).
 */
export function prismaError(code: string, meta: Record<string, unknown> = {}): Error {
  const error = new Error(`Prisma error ${code}`);
  error.name = 'PrismaClientKnownRequestError';
  (error as Error & { code: string; meta: Record<string, unknown> }).code = code;
  (error as Error & { meta: Record<string, unknown> }).meta = meta;
  return error;
}
