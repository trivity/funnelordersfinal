import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

async function main() {
  const [email, password, firstName = 'Admin', lastName = 'User'] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: tsx src/scripts/create-admin.ts <email> <password> [firstName] [lastName]');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        planTier: 'AGENCY',
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log('Updated existing user to admin:', normalizedEmail);
  } else {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName,
          lastName,
          role: 'ADMIN',
          planTier: 'AGENCY',
          subscriptionStatus: 'ACTIVE',
        },
      });
      await tx.store.create({ data: { userId: user.id, name: 'My Store' } });
    });
    console.log('Admin user created:', normalizedEmail);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
