/**
 * Database seed.
 *
 * `package.json` exposed `npm run prisma:seed` and the README told contributors to
 * run `npx prisma db seed`, but the file did not exist — a fresh clone could not
 * get a working database. The seed is idempotent: everything is an `upsert` or a
 * guarded `create`, so it is safe to re-run against a populated database.
 *
 * Usage:
 *   npx prisma db seed            # (uses the `prisma.seed` config in package.json)
 *   npm run prisma:seed
 *
 * Environment:
 *   SEED_ADMIN_EMAIL     default admin@gameshop.local
 *   SEED_ADMIN_PASSWORD  default ChangeMe123!  — change this before any deploy
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@gameshop.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const CUSTOMER_EMAIL = process.env.SEED_CUSTOMER_EMAIL ?? 'customer@gameshop.local';
const CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD ?? 'ChangeMe123!';

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  category: string;
  gameType: string;
  price: number;
  originalPrice?: number;
  quantityAvailable: number;
  isFeatured: boolean;
  specifications: Array<{ name: string; value: string }>;
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'pubg-uc-60',
    name: 'PUBG Mobile 60 UC',
    description:
      'Top up 60 Unknown Cash on your PUBG Mobile account. Delivered to your in-game mailbox within minutes of payment verification.',
    category: 'CURRENCY',
    gameType: 'PUBG',
    price: 120,
    originalPrice: 140,
    quantityAvailable: -1,
    isFeatured: true,
    specifications: [
      { name: 'Delivery time', value: '5–15 minutes' },
      { name: 'Requirement', value: 'Player ID (numeric)' },
      { name: 'Region', value: 'Global' },
    ],
  },
  {
    slug: 'pubg-uc-325',
    name: 'PUBG Mobile 325 UC',
    description: 'The most popular UC bundle — 300 UC plus a 25 UC bonus.',
    category: 'CURRENCY',
    gameType: 'PUBG',
    price: 620,
    originalPrice: 690,
    quantityAvailable: -1,
    isFeatured: true,
    specifications: [
      { name: 'Delivery time', value: '5–15 minutes' },
      { name: 'Requirement', value: 'Player ID (numeric)' },
      { name: 'Bonus', value: '+25 UC' },
    ],
  },
  {
    slug: 'free-fire-100-diamonds',
    name: 'Free Fire 100 Diamonds',
    description: 'Instant 100 Diamond top up for Garena Free Fire.',
    category: 'CURRENCY',
    gameType: 'FREE_FIRE',
    price: 110,
    quantityAvailable: -1,
    isFeatured: false,
    specifications: [
      { name: 'Delivery time', value: 'Instant' },
      { name: 'Requirement', value: 'Player UID' },
    ],
  },
  {
    slug: 'free-fire-520-diamonds',
    name: 'Free Fire 520 Diamonds',
    description: 'Best value Diamond bundle for regular players.',
    category: 'CURRENCY',
    gameType: 'FREE_FIRE',
    price: 520,
    originalPrice: 580,
    quantityAvailable: -1,
    isFeatured: true,
    specifications: [
      { name: 'Delivery time', value: 'Instant' },
      { name: 'Requirement', value: 'Player UID' },
    ],
  },
  {
    slug: 'mlbb-86-diamonds',
    name: 'Mobile Legends 86 Diamonds',
    description: 'Top up 86 Diamonds on your Mobile Legends: Bang Bang account.',
    category: 'CURRENCY',
    gameType: 'MLBB',
    price: 210,
    quantityAvailable: -1,
    isFeatured: false,
    specifications: [
      { name: 'Delivery time', value: '5–10 minutes' },
      { name: 'Requirement', value: 'User ID + Zone ID' },
    ],
  },
  {
    slug: 'valorant-475-vp',
    name: 'Valorant 475 VP',
    description: '475 Valorant Points for skins and battle passes.',
    category: 'CURRENCY',
    gameType: 'VALORANT',
    price: 640,
    originalPrice: 700,
    quantityAvailable: 250,
    isFeatured: true,
    specifications: [
      { name: 'Delivery time', value: '10–30 minutes' },
      { name: 'Requirement', value: 'Riot ID + tagline' },
    ],
  },
  {
    slug: 'gta-v-shark-card-megalodon',
    name: 'GTA V Megalodon Shark Card',
    description: '12,500,000 GTA$ deposited into your GTA Online account.',
    category: 'GAME',
    gameType: 'GTA',
    price: 8900,
    originalPrice: 9900,
    quantityAvailable: 15,
    isFeatured: true,
    specifications: [
      { name: 'Platform', value: 'PC / PlayStation / Xbox' },
      { name: 'Delivery time', value: '1–24 hours' },
      { name: 'Requirement', value: 'Rockstar Social Club ID' },
    ],
  },
  {
    slug: 'pubg-mobile-royale-pass',
    name: 'PUBG Mobile Royale Pass',
    description: 'Current season Elite Royale Pass upgrade.',
    category: 'GAME',
    gameType: 'PUBG',
    price: 780,
    quantityAvailable: 60,
    isFeatured: false,
    specifications: [
      { name: 'Season', value: 'Current' },
      { name: 'Delivery time', value: '15–60 minutes' },
    ],
  },
];

const PAYMENT_GATEWAYS = [
  {
    gatewayName: 'bKash',
    gatewayType: 'MOBILE_BANKING',
    accountIdentifier: '01700000000',
    accountHolderName: 'GameShop Bangladesh',
    instructions:
      'Send money to 01700000000 using the bKash "Send Money" option, then submit the transaction ID (TrxID) from the confirmation SMS.',
    displayOrder: 1,
  },
  {
    gatewayName: 'Nagad',
    gatewayType: 'MOBILE_BANKING',
    accountIdentifier: '01800000000',
    accountHolderName: 'GameShop Bangladesh',
    instructions:
      'Send money to 01800000000 from your Nagad app, then submit the TrxID shown on the confirmation screen.',
    displayOrder: 2,
  },
  {
    gatewayName: 'Rocket',
    gatewayType: 'MOBILE_BANKING',
    accountIdentifier: '019000000001',
    accountHolderName: 'GameShop Bangladesh',
    instructions: 'Dial *322# or use the Rocket app to send money, then submit the TrxID.',
    displayOrder: 3,
  },
];

const ADMIN_SETTINGS = [
  {
    settingKey: 'shop.name',
    settingValue: 'GameShop',
    settingType: 'string',
    description: 'Storefront display name',
  },
  {
    settingKey: 'shop.currency',
    settingValue: 'BDT',
    settingType: 'string',
    description: 'Default currency code',
  },
  {
    settingKey: 'shop.supportPhone',
    settingValue: '+8801700000000',
    settingType: 'string',
    description: 'Customer support hotline',
  },
  {
    settingKey: 'orders.autoCancelUnpaidHours',
    settingValue: 72,
    settingType: 'number',
    description: 'Hours before an unpaid order is automatically cancelled',
  },
  {
    settingKey: 'reviews.requireVerifiedPurchase',
    settingValue: true,
    settingType: 'boolean',
    description: 'Only allow reviews from delivered orders',
  },
];

function log(message: string): void {
  console.log(`   ${message}`);
}

async function seedUsers() {
  console.log('👤 Users');

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      fullName: 'GameShop Admin',
      role: 'SUPER_ADMIN',
      phone: '01700000000',
      emailVerified: true,
      isActive: true,
      notificationPreferences: {},
    },
  });
  log(`super admin — ${admin.email}`);

  const customerPasswordHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);
  const customer = await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: { isActive: true },
    create: {
      email: CUSTOMER_EMAIL,
      passwordHash: customerPasswordHash,
      fullName: 'Demo Customer',
      role: 'USER',
      phone: '01811111111',
      division: 'Dhaka',
      district: 'Dhaka',
      address: 'House 12, Road 5, Dhanmondi, Dhaka 1205',
      postalCode: '1205',
      emailVerified: true,
      isActive: true,
      preferredPaymentMethod: 'BKASH',
      notificationPreferences: { orderUpdates: true, promotions: false },
    },
  });
  log(`demo customer — ${customer.email}`);

  return { admin, customer };
}

async function seedProducts(adminId: string) {
  console.log('🎮 Products');

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });

    if (existing) {
      log(`exists — ${product.name}`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        category: product.category,
        gameType: product.gameType,
        price: product.price.toFixed(2),
        originalPrice: product.originalPrice?.toFixed(2) ?? null,
        currency: 'BDT',
        quantityAvailable: product.quantityAvailable,
        isAvailable: true,
        isFeatured: product.isFeatured,
        thumbnailUrl: null,
        images: [],
        createdBy: adminId,
        specs: {
          create: product.specifications.map((spec) => ({
            specName: spec.name,
            specValue: spec.value,
          })),
        },
      },
    });
    log(`created — ${product.name}`);
  }
}

async function seedPaymentGateways() {
  console.log('💳 Payment gateways');

  for (const gateway of PAYMENT_GATEWAYS) {
    await prisma.paymentGateway.upsert({
      where: { gatewayName: gateway.gatewayName },
      update: gateway,
      create: { ...gateway, isEnabled: true },
    });
    log(`ready — ${gateway.gatewayName}`);
  }
}

async function seedSettings(adminId: string) {
  console.log('⚙️  Settings');

  for (const setting of ADMIN_SETTINGS) {
    const { settingKey, ...data } = setting;
    await prisma.adminSettings.upsert({
      where: { settingKey },
      update: data,
      create: { settingKey, ...data, updatedBy: adminId },
    });
    log(`ready — ${settingKey}`);
  }
}

async function seedPromotion(adminId: string) {
  console.log('🎟  Promotions');

  const code = 'WELCOME10';
  const now = new Date();
  const validUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const existing = await prisma.promotion.findUnique({ where: { code } });
  if (existing) {
    log(`exists — ${code}`);
    return;
  }

  await prisma.promotion.create({
    data: {
      code,
      description: '10% off your first order',
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      validFrom: now,
      validUntil,
      maxUsage: 1000,
      minPurchaseAmount: '200.00',
      isActive: true,
      createdBy: adminId,
    },
  });
  log(`created — ${code} (10% off, min ৳200)`);
}

async function main() {
  console.log('🌱 Seeding GameShop database…\n');

  const { admin } = await seedUsers();
  await seedProducts(admin.id);
  await seedPaymentGateways();
  await seedSettings(admin.id);
  await seedPromotion(admin.id);

  console.log('\n✅ Seed complete');
  console.log(`   Admin login:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   Customer login: ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);
  if (ADMIN_PASSWORD === 'ChangeMe123!') {
    console.warn('\n⚠️  You are using the default seed password — change it before deploying.');
  }
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
