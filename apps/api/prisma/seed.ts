import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@funnelorders.io';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        planTier: 'AGENCY',
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log('Admin user created:', adminEmail);
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
