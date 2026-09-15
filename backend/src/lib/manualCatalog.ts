/**
 * Manual catalog only — body copy is prepared later.
 * Customer manual is shared across API / sub-solution / standalone.
 */

export type ManualAudience = 'hq' | 'partner' | 'customer';
export type ManualDelivery = 'api' | 'sub_solution' | 'sub_solution_standalone' | 'all';

export type ManualEntry = {
  id: string;
  audience: ManualAudience;
  delivery: ManualDelivery;
  ready: false;
  outlineKeys: string[];
};

export const MANUALS: ManualEntry[] = [
  {
    id: 'customer',
    audience: 'customer',
    delivery: 'all',
    ready: false,
    outlineKeys: ['manual.outCustomer1', 'manual.outCustomer2', 'manual.outCustomer3', 'manual.outCustomer4'],
  },
  {
    id: 'partner_api',
    audience: 'partner',
    delivery: 'api',
    ready: false,
    outlineKeys: ['manual.outApi1', 'manual.outApi2', 'manual.outApi3', 'manual.outCustomer1'],
  },
  {
    id: 'partner_sub',
    audience: 'partner',
    delivery: 'sub_solution',
    ready: false,
    outlineKeys: ['manual.outSub1', 'manual.outSub2', 'manual.outCustomer1'],
  },
  {
    id: 'partner_standalone',
    audience: 'partner',
    delivery: 'sub_solution_standalone',
    ready: false,
    outlineKeys: ['manual.outSolo1', 'manual.outSolo2', 'manual.outCustomer1'],
  },
  {
    id: 'hq_ops',
    audience: 'hq',
    delivery: 'all',
    ready: false,
    outlineKeys: ['manual.outHq1', 'manual.outHq2', 'manual.outHq3'],
  },
];

export function manualsFor(opts: { audience?: string; delivery?: string }): ManualEntry[] {
  const audience = opts.audience || 'hq';
  const delivery = opts.delivery || '';
  if (audience === 'hq') return MANUALS;
  if (audience === 'customer') return MANUALS.filter((m) => m.id === 'customer');
  const partner = MANUALS.filter((m) => m.id === 'customer' || (m.audience === 'partner' && (!delivery || m.delivery === delivery)));
  return partner;
}
