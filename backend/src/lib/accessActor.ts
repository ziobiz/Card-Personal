import type { Request } from 'express';
import { accessAuditStore } from '../data/accessAuditStore.js';
import { accessGroupStore } from '../data/accessGroupStore.js';
import { operatorStore, type Operator } from '../data/operatorStore.js';
import { canUseMenu } from './resolveAccess.js';

export function hqActor(req: Request): Operator | null {
  const id = req.auth?.userId;
  const email = req.auth?.email;
  return (id && operatorStore.getById(id)) || (email && operatorStore.getByEmail(email)) || null;
}

export function partnerActor(req: Request): Operator | null {
  const id = req.auth?.userId;
  const op = id ? operatorStore.getById(id) : undefined;
  return op && op.scope === 'PARTNER' ? op : null;
}

export function defaultGroupId(owner: string): string {
  const groups = accessGroupStore.list(owner);
  return groups.find((g) => g.code === 'general')?.id || groups[0]?.id || '';
}

export function partnerHasSuper(partnerId: string): boolean {
  return operatorStore.list('PARTNER').some((o) => o.partnerId === partnerId && o.isSuper);
}

export function canManageHqAccess(op: Operator | null): boolean {
  if (!op || op.scope !== 'HQ') return false;
  return Boolean(op.isSuper) || canUseMenu(op, 'access');
}

export function canManagePartnerAccess(op: Operator | null): boolean {
  if (!op || op.scope !== 'PARTNER') return false;
  return Boolean(op.isSuper) || op.role === 'ADMIN' || canUseMenu(op, 'access');
}

export function writeAudit(input: {
  actor: Operator;
  owner: string;
  targetType: 'operator' | 'group';
  targetId: string;
  action: 'create' | 'update' | 'status' | 'menus' | 'group' | 'password' | 'otp';
  detail: string;
}) {
  accessAuditStore.add({
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    owner: input.owner,
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    detail: input.detail,
  });
}
