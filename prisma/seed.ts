import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const passwordHash = await argon2.hash('stockflow', {
    type: argon2.argon2id,
  });
  const user = await prisma.user.upsert({
    where: { email: 'admin@stockflow.com' },
    update: { name: 'StockFlow Admin', passwordHash, role: 'ADMIN' },
    create: {
      name: 'StockFlow Admin',
      email: 'admin@stockflow.com',
      passwordHash,
      role: 'ADMIN',
    },
  });
  const staffPasswordHash = await argon2.hash('stockflow', {
    type: argon2.argon2id,
  });
  const staff = await prisma.user.upsert({
    where: { email: 'staff@stockflow.com' },
    update: { name: 'StockFlow Staff', passwordHash: staffPasswordHash, role: 'STAFF' },
    create: {
      name: 'StockFlow Staff',
      email: 'staff@stockflow.com',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
    },
  });
  await prisma.product.createMany({
    data: [
      {
        userId: user.id,
        sku: 'SF-100',
        name: 'Packing tape',
        description: 'Clear packing tape roll',
        unitPriceCents: 350,
        quantityOnHand: 40,
      },
      {
        userId: user.id,
        sku: 'SF-200',
        name: 'Shipping box',
        description: 'Medium corrugated box',
        unitPriceCents: 225,
        quantityOnHand: 75,
      },
      {
        userId: user.id,
        sku: 'SF-300',
        name: 'Label sheet',
        description: 'A4 shipping-label sheet',
        unitPriceCents: 125,
        quantityOnHand: 120,
      },
      {
        userId: staff.id,
        sku: 'SF-400',
        name: 'Pallet wrap',
        description: 'Stretch wrap for pallets',
        unitPriceCents: 850,
        quantityOnHand: 25,
      },
    ],
    skipDuplicates: true,
  });
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
