function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type DateQuickKey = 'today' | 'thisMonth' | 'yesterday' | 'week1' | 'week2' | 'lastMonth';

export function rangeForQuick(key: DateQuickKey, now = new Date()): { from: string; to: string } {
  const today = startOfDay(now);
  if (key === 'today') return { from: toYmd(today), to: toYmd(today) };
  if (key === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: toYmd(y), to: toYmd(y) };
  }
  if (key === 'week1') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === 'week2') {
    const from = new Date(today);
    from.setDate(from.getDate() - 13);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toYmd(from), to: toYmd(today) };
  }
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toYmd(from), to: toYmd(to) };
}

export function inYmdRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return !from && !to;
  const ymd = toYmd(new Date(iso));
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

export type EntityFilterState = {
  dateField: string;
  dateFrom: string;
  dateTo: string;
  quick: DateQuickKey | '';
  searchField: string;
  keyword: string;
  status: string;
};

export const EMPTY_ENTITY_FILTER: EntityFilterState = {
  dateField: 'createdAt',
  dateFrom: '',
  dateTo: '',
  quick: '',
  searchField: 'all',
  keyword: '',
  status: '',
};

export function matchKeyword(haystack: string, keyword: string): boolean {
  if (!keyword.trim()) return true;
  return haystack.toLowerCase().includes(keyword.trim().toLowerCase());
}

export function filterByEntity<T>(
  items: T[],
  filter: EntityFilterState,
  get: {
    date: (item: T, field: string) => string | undefined;
    status: (item: T) => string;
    text: (item: T, field: string) => string;
  }
): T[] {
  const kw = filter.keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.status && get.status(item) !== filter.status) return false;
    if (!inYmdRange(get.date(item, filter.dateField), filter.dateFrom, filter.dateTo)) return false;
    if (!kw) return true;
    return get.text(item, filter.searchField).toLowerCase().includes(kw);
  });
}
