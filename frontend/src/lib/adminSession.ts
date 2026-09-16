/**
 * HQ admin session — isolated from member `localStorage.token`.
 * sessionStorage dies when the browser/tab session ends, so opening a
 * bookmarked /admin/dashboard URL after closing the browser cannot restore HQ.
 */

const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_MUST_CHANGE = 'adminMustChangePassword';

type JwtPayload = {
  isAdmin?: boolean;
  otpPending?: boolean;
  purpose?: string;
  exp?: number;
  email?: string;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_MUST_CHANGE);
    sessionStorage.removeItem('adminOtpEnroll');
  } catch {
    /* ignore */
  }
  purgeLegacyAdminToken();
}

/** Old builds stored HQ JWT in the same localStorage key as members. */
export function purgeLegacyAdminToken() {
  try {
    const leftover = localStorage.getItem('token');
    if (!leftover) return;
    const payload = decodeJwt(leftover);
    if (payload?.isAdmin) localStorage.removeItem('token');
  } catch {
    /* ignore */
  }
}

export function isUsableAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload?.isAdmin) return false;
  if (payload.otpPending) return false;
  if (payload.purpose === 'admin_otp_enroll') return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now() + 3000) return false;
  return true;
}

export function adminTokenEmail(): string {
  const payload = decodeJwt(getAdminToken() || '');
  return String(payload?.email || '');
}

export function kickToAdminLogin() {
  clearAdminSession();
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '';
  if (path.startsWith('/admin/login') || path.startsWith('/admin/otp') || path.startsWith('/admin/password')) return;
  if (path.startsWith('/admin')) window.location.replace('/admin/login');
}
