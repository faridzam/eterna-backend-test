import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const passwordHash = await argon2.hash('stockflow-demo-password', {
    type: argon2.argon2id,
  });
  const user = await prisma.user.upsert({
    where: { email: 'demo@stockflow.local' },
    update: { name: 'StockFlow Demo', passwordHash, role: 'ADMIN' },
    create: {
      name: 'StockFlow Demo',
      email: 'demo@stockflow.local',
      passwordHash,
      role: 'ADMIN',
    },
  });
  const staffPasswordHash = await argon2.hash('stockflow-staff-password', {
    type: argon2.argon2id,
  });
  await prisma.user.upsert({
    where: { email: 'staff@stockflow.local' },
    update: { name: 'StockFlow Staff', passwordHash: staffPasswordHash, role: 'STAFF' },
    create: {
      name: 'StockFlow Staff',
      email: 'staff@stockflow.local',
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
