import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export async function getUserStores(userId: string) {
  return prisma.store.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function createStore(userId: string, name: string) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  const storeCount = await prisma.store.count({ where: { userId } });
  if (storeCount >= user.maxStores) {
    throw new AppError(
      'PLAN_LIMIT',
      `Your plan allows a maximum of ${user.maxStores} store${user.maxStores === 1 ? '' : 's'}. Upgrade to add more.`,
      403,
    );
  }
  return prisma.store.create({ data: { userId, name } });
}

export async function updateStore(userId: string, storeId: string, name: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, userId } });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found', 404);
  return prisma.store.update({ where: { id: storeId }, data: { name } });
}

export async function deleteStore(userId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, userId } });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found', 404);
  const count = await prisma.store.count({ where: { userId } });
  if (count <= 1) throw new AppError('VALIDATION_ERROR', 'Cannot delete your last store', 400);
  return prisma.store.delete({ where: { id: storeId } });
}
