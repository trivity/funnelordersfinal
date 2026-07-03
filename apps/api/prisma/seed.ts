import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMINS = [
  { email: 'admin@funnelorders.io', password: 'Admin1234!', firstName: 'Admin', lastName: 'User' },
  { email: 'cody@727digital.com', password: process.env.SEED_ADMIN_CODY_PASSWORD, firstName: 'Cody', lastName: '727 Digital' },
];

async function seedAdmin(admin: (typeof DEFAULT_ADMINS)[number]) {
  const email = admin.email.toLowerCase();
  if (!admin.password) {
    console.log('Skipping admin (no password set):', email);
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(admin.password, 12);

  if (existing) {
    console.log('Admin user already exists:', email);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: 'ADMIN',
        planTier: 'AGENCY',
        subscriptionStatus: 'ACTIVE',
      },
    });
    await tx.store.create({ data: { userId: user.id, name: 'My Store' } });
  });
  console.log('Admin user created:', email);
}

async function main() {
  for (const admin of DEFAULT_ADMINS) {
    await seedAdmin(admin);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
