export function solutionSlugFromPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): string {
  const m = pathname.match(/^\/s\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : '';
}

export function withTenant(path: string, slug?: string): string {
  const s = slug ?? solutionSlugFromPath();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!s || p.startsWith('/admin') || p.startsWith('/partner')) return p;
  return `/s/${s}${p === '/' ? '' : p}`;
}
