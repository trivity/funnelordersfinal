import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { enqueueOutboundPush } from '../jobs/queues';
import { logger } from '../lib/logger';
import type { RuleCondition } from '@funnelorders/shared-types';

export async function listRoutingRules(userId: string, storeId?: string) {
  const where = storeId ? { storeId } : { userId };
  return prisma.routingRule.findMany({
    where,
    orderBy: { priority: 'asc' },
  });
}

export async function getRoutingRule(userId: string, id: string, storeId?: string) {
  const where = storeId ? { id, storeId } : { id, userId };
  const rule = await prisma.routingRule.findFirst({ where });
  if (!rule) throw new AppError('NOT_FOUND', 'Routing rule not found', 404);
  return rule;
}

export async function createRoutingRule(
  userId: string,
  data: {
    name: string;
    sourceFilter?: string | null;
    conditions?: RuleCondition[];
    destination?: string;
    destinations?: string[];
    active?: boolean;
    priority?: number;
  },
  storeId?: string,
) {
  const dests = data.destinations && data.destinations.length > 0 ? data.destinations : [data.destination!];
  return prisma.routingRule.create({
    data: {
      userId,
      ...(storeId && { storeId }),
      name: data.name,
      sourceFilter: data.sourceFilter as never,
      conditions: (data.conditions ?? []) as never,
      destination: dests[0] as never,
      destinations: dests,
      active: data.active ?? true,
      priority: data.priority ?? 0,
    },
  });
}

export async function updateRoutingRule(
  userId: string,
  id: string,
  data: {
    name?: string;
    sourceFilter?: string | null;
    conditions?: RuleCondition[];
    destination?: string;
    destinations?: string[];
    active?: boolean;
    priority?: number;
  },
  storeId?: string,
) {
  const where = storeId ? { id, storeId } : { id, userId };
  const rule = await prisma.routingRule.findFirst({ where });
  if (!rule) throw new AppError('NOT_FOUND', 'Routing rule not found', 404);

  const dests = data.destinations && data.destinations.length > 0 ? data.destinations : data.destination ? [data.destination] : undefined;

  return prisma.routingRule.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.sourceFilter !== undefined && { sourceFilter: data.sourceFilter as never }),
      ...(data.conditions !== undefined && { conditions: data.conditions as never }),
      ...(dests !== undefined && { destination: dests[0] as never, destinations: dests }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.priority !== undefined && { priority: data.priority }),
    },
  });
}

export async function deleteRoutingRule(userId: string, id: string, storeId?: string) {
  const where = storeId ? { id, storeId } : { id, userId };
  const rule = await prisma.routingRule.findFirst({ where });
  if (!rule) throw new AppError('NOT_FOUND', 'Routing rule not found', 404);
  await prisma.routingRule.delete({ where: { id } });
}

export async function reorderRules(userId: string, orderedIds: string[], storeId?: string) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.routingRule.updateMany({
        where: storeId ? { id, storeId } : { id, userId },
        data: { priority: index },
      }),
    ),
  );
}

/**
 * Phase 1 routing engine: matches rules by source and (if any) conditions, then
 * enqueues outbound push jobs for all matching destinations.
 */
export async function evaluateRoutingRules(
  userId: string,
  orderId: string,
  orderData: {
    source: string;
    total: number;
    customerEmail: string;
    tags: string[];
    lineItems: Array<{ name: string }>;
    storeId?: string;
  },
): Promise<void> {
  const scope = orderData.storeId ? { storeId: orderData.storeId, active: true } : { userId, active: true };
  const rules = await prisma.routingRule.findMany({
    where: scope,
    orderBy: { priority: 'asc' },
  });

  const matchedDestinations = new Set<string>();

  for (const rule of rules) {
    // Source filter
    if (rule.sourceFilter && rule.sourceFilter !== orderData.source) continue;

    // Condition evaluation (Phase 1: basic)
    const conditions = rule.conditions as unknown as RuleCondition[];
    if (conditions.length > 0) {
      const allMatch = conditions.every((cond) => evaluateCondition(cond, orderData));
      if (!allMatch) continue;
    }

    // Support multi-destination rules; fall back to legacy single destination
    const ruleDests = rule.destinations && rule.destinations.length > 0 ? rule.destinations : [rule.destination];
    let ruleMatched = false;

    for (const dest of ruleDests) {
      if (!matchedDestinations.has(dest)) {
        matchedDestinations.add(dest);
        ruleMatched = true;

        // Create routing log
        const routingLog = await prisma.orderRoutingLog.create({
          data: { orderId, destination: dest as never, status: 'PENDING' },
        });

        // Enqueue push job
        await enqueueOutboundPush(orderId, dest, routingLog.id, userId, orderData.storeId);

        logger.info('Routing rule matched', { ruleId: rule.id, destination: dest, orderId });
      }
    }

    if (ruleMatched) {
      // Update rule stats once per rule match
      await prisma.routingRule.update({
        where: { id: rule.id },
        data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() },
      });
    }
  }

  // Update order status
  if (matchedDestinations.size > 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PROCESSING' },
    });
  }
}

function evaluateCondition(
  cond: RuleCondition,
  order: { total: number; customerEmail: string; tags: string[]; lineItems: Array<{ name: string }> },
): boolean {
  const { field, operator, value } = cond;

  switch (field) {
    case 'total': {
      const num = Number(value);
      if (operator === 'gt') return order.total > num;
      if (operator === 'lt') return order.total < num;
      if (operator === 'eq') return order.total === num;
      return false;
    }
    case 'customerEmail': {
      const str = String(value).toLowerCase();
      const email = order.customerEmail.toLowerCase();
      if (operator === 'eq') return email === str;
      if (operator === 'contains') return email.includes(str);
      if (operator === 'not_contains') return !email.includes(str);
      return false;
    }
    case 'tag': {
      const str = String(value);
      if (operator === 'contains') return order.tags.includes(str);
      if (operator === 'not_contains') return !order.tags.includes(str);
      return false;
    }
    case 'productName': {
      const str = String(value).toLowerCase();
      const hasMatch = order.lineItems.some((li) => li.name.toLowerCase().includes(str));
      if (operator === 'contains') return hasMatch;
      if (operator === 'not_contains') return !hasMatch;
      return false;
    }
    default:
      return false;
  }
}
