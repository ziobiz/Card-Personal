/** HQ browser URL stays on /admin; React Router keeps the real path internally. */

const INTERNAL_KEY = 'adminInternalPath';

function isAuthPath(path: string) {
  return (
    path.startsWith('/admin/login') ||
    path.startsWith('/admin/otp') ||
    path.startsWith('/admin/password')
  );
}

export function stashAdminInternalPath(path: string) {
  if (!path.startsWith('/admin/')) return;
  if (isAuthPath(path)) return;
  try {
    sessionStorage.setItem(INTERNAL_KEY, path);
  } catch {
    /* ignore */
  }
}

export function takeInternalPath(): string {
  try {
    const saved = sessionStorage.getItem(INTERNAL_KEY) || '';
    if (saved.startsWith('/admin/') && !isAuthPath(saved)) return saved;
  } catch {
    /* ignore */
  }
  return '/admin/dashboard';
}

/** Mask the address bar to /admin without changing React Router location. */
export function maskAdminBrowserUrl(pathname: string) {
  if (typeof window === 'undefined') return;
  if (!pathname.startsWith('/admin')) return;
  if (isAuthPath(pathname)) return;
  stashAdminInternalPath(pathname);
  if (window.location.pathname === '/admin' && !window.location.search && !window.location.hash) return;
  try {
    window.history.replaceState(window.history.state, '', '/admin');
  } catch {
    /* ignore */
  }
}
