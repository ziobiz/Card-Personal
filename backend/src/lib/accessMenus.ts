/** PG-style menu keys for HQ and partner consoles. */

export const HQ_MENU_KEYS = [
  'dashboard',
  'brand',
  'sandbox',
  'settings',
  'platform',
  'partners',
  'partners_new',
  'org',
  'fee_list',
  'fee_policy',
  'operators',
  'operators_partner',
  'customers',
  'cards',
  'manuals',
  'access',
] as const;

export const PARTNER_MENU_KEYS = ['home', 'api', 'fees', 'staff', 'manual', 'access'] as const;

export type HqMenuKey = (typeof HQ_MENU_KEYS)[number];
export type PartnerMenuKey = (typeof PARTNER_MENU_KEYS)[number];

export const HQ_PATH_TO_MENU: Record<string, HqMenuKey> = {
  '/admin/dashboard': 'dashboard',
  '/admin/brand': 'brand',
  '/admin/sandbox': 'sandbox',
  '/admin/settings': 'settings',
  '/admin/platform': 'platform',
  '/admin/partners': 'partners',
  '/admin/partners/new': 'partners_new',
  '/admin/org': 'org',
  '/admin/fee-list': 'fee_list',
  '/admin/fee-policy': 'fee_policy',
  '/admin/operators': 'operators',
  '/admin/operators/partner': 'operators_partner',
  '/admin/customers': 'customers',
  '/admin/cards': 'cards',
  '/admin/manuals': 'manuals',
  '/admin/access': 'access',
};

export const DEFAULT_GROUP_MENUS: Record<string, string[]> = {
  general: [...HQ_MENU_KEYS],
  settlement: ['dashboard', 'fee_list', 'fee_policy', 'partners', 'manuals'],
  issuance: ['dashboard', 'cards', 'customers', 'partners', 'partners_new', 'manuals'],
};

export const DEFAULT_PARTNER_GROUP_MENUS: Record<string, string[]> = {
  general: [...PARTNER_MENU_KEYS],
  settlement: ['home', 'fees', 'manual'],
  issuance: ['home', 'api', 'manual', 'staff'],
};

export function normalizeMenus(raw: unknown, catalog: readonly string[]): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : [];
  const allowed = new Set(catalog);
  const next = list.filter((k) => allowed.has(k));
  return next.length ? [...new Set(next)] : [...catalog];
}
