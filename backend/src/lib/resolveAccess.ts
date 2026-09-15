import { accessGroupStore } from '../data/accessGroupStore.js';
import type { Operator } from '../data/operatorStore.js';
import { HQ_MENU_KEYS, PARTNER_MENU_KEYS } from './accessMenus.js';

export function resolveOperatorMenus(op?: Operator | null): string[] {
  if (!op) return [];
  const catalog = op.scope === 'PARTNER' ? PARTNER_MENU_KEYS : HQ_MENU_KEYS;
  if (op.isSuper || (op.role === 'ADMIN' && !op.groupId && op.scope === 'HQ')) return [...catalog];
  if (op.menuOverride && op.menuOverride.length) {
    return op.menuOverride.filter((k) => (catalog as readonly string[]).includes(k));
  }
  const group = op.groupId ? accessGroupStore.get(op.groupId) : undefined;
  if (group?.menus?.length) return group.menus.filter((k) => (catalog as readonly string[]).includes(k));
  if (op.scope === 'PARTNER' && op.role === 'ADMIN') return [...PARTNER_MENU_KEYS];
  return op.scope === 'PARTNER' ? ['home', 'manual'] : ['dashboard'];
}

export function canUseMenu(op: Operator | null | undefined, menu: string): boolean {
  if (!op) return false;
  if (op.isSuper) return true;
  return resolveOperatorMenus(op).includes(menu);
}
