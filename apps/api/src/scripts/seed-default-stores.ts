import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log('Found users:', users.length);

  for (const user of users) {
    const existingStore = await prisma.store.findFirst({ where: { userId: user.id } });
    let storeId: string;
    if (existingStore) {
      storeId = existingStore.id;
      console.log('Existing store for', user.email, ':', storeId);
    } else {
      const store = await prisma.store.create({ data: { userId: user.id, name: 'My Store' } });
      storeId = store.id;
      console.log('Created store for', user.email, ':', storeId);
    }

    const o = await prisma.order.updateMany({ where: { userId: user.id, storeId: null }, data: { storeId } });
    const i = await prisma.integration.updateMany({ where: { userId: user.id, storeId: null }, data: { storeId } });
    const r = await prisma.routingRule.updateMany({ where: { userId: user.id, storeId: null }, data: { storeId } });
    const w = await prisma.webhookEndpoint.updateMany({ where: { userId: user.id, storeId: null }, data: { storeId } });
    console.log('  Updated: orders=%d integrations=%d rules=%d webhooks=%d', o.count, i.count, r.count, w.count);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
