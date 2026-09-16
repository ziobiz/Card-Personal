/**
 * Server-side Open Graph HTML for SPA routes.
 * Crawlers (LINE / WhatsApp / etc.) do not execute JS — tags must be in the first HTML <head>.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { brandStore, type BrandConfig } from '../data/brandStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolved at runtime — works from backend/src or backend/dist */
function resolveIndexHtmlPath(): string {
  const env = (process.env.FRONTEND_DIST || '').trim();
  if (env) {
    const p = join(env, 'index.html');
    if (existsSync(p)) return p;
  }
  const candidates = [
    join(__dirname, '../../../frontend/dist/index.html'),
    join(__dirname, '../../frontend/dist/index.html'),
    join(process.cwd(), 'frontend/dist/index.html'),
    join(process.cwd(), '../frontend/dist/index.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function requestOrigin(req: {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
}): string {
  const xfProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = xfProto || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
    .split(',')[0]
    .trim();
  return `${proto}://${host}`.replace(/\/$/, '');
}

function absoluteUrl(origin: string, pathOrUrl: string): string {
  const s = (pathOrUrl || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${origin}${s}`;
  return `${origin}/${s}`;
}

/** Path / host → admin vs member OG surface (no org-domain inheritance) */
export function resolveOgSurface(host: string, pathWithQuery: string): 'admin' | 'member' {
  const h = host.toLowerCase().split(':')[0].trim();
  if (h.startsWith('admin.')) return 'admin';
  const path = (pathWithQuery.split('?')[0] || '/').toLowerCase();
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  return 'member';
}

const DEFAULT_MEMBER_DESC = 'Secure digital card and payment platform.';
const DEFAULT_ADMIN_DESC = 'Administrator console.';
const DEFAULT_OG_IMAGE = '/brand/icocard-logo.png';

export function resolveOgPayload(
  brand: BrandConfig,
  surface: 'admin' | 'member',
  origin: string,
  pageUrl: string
): { title: string; description: string; image: string; url: string } {
  if (surface === 'admin') {
    const title =
      (brand.ogAdminTitle || '').trim() ||
      `${(brand.productName || 'ICOCARD').trim()} Admin`;
    const description =
      (brand.ogAdminDescription || '').trim() || DEFAULT_ADMIN_DESC;
    const imagePath =
      (brand.ogAdminImage || '').trim() ||
      (brand.logoAdmin || '').trim() ||
      DEFAULT_OG_IMAGE;
    // Prefer public HTTPS paths — skip data: URLs for crawlers
    const image =
      absoluteUrl(origin, imagePath.startsWith('data:') ? DEFAULT_OG_IMAGE : imagePath) ||
      absoluteUrl(origin, DEFAULT_OG_IMAGE);
    return { title, description, image, url: pageUrl };
  }

  const title =
    (brand.ogMemberTitle || '').trim() ||
    (brand.browserTitle || '').trim() ||
    (brand.productName || 'ICOCARD').trim();
  const description =
    (brand.ogMemberDescription || '').trim() ||
    (brand.loginMainText || '').trim() ||
    DEFAULT_MEMBER_DESC;
  const imagePath =
    (brand.ogMemberImage || '').trim() ||
    (brand.logoLogin || '').trim() ||
    DEFAULT_OG_IMAGE;
  const image =
    absoluteUrl(origin, imagePath.startsWith('data:') ? DEFAULT_OG_IMAGE : imagePath) ||
    absoluteUrl(origin, DEFAULT_OG_IMAGE);
  return { title, description, image, url: pageUrl };
}

function buildOgMetaBlock(og: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const t = escapeAttr(og.title);
  const d = escapeAttr(og.description);
  const img = escapeAttr(og.image);
  const u = escapeAttr(og.url);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join('\n    ');
}

/** Inject / replace OG tags in SPA index.html. Never uses page body text. */
export function renderSpaHtml(req: {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
  query?: Record<string, unknown>;
}): { html: string; status: number } {
  const originalUri = String(
    req.headers['x-original-uri'] ||
      req.headers['x-original-url'] ||
      (typeof req.query?.path === 'string' ? req.query.path : '') ||
      '/'
  );
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
    .split(',')[0]
    .trim();
  const origin = requestOrigin(req);
  const pathOnly = originalUri.startsWith('http')
    ? new URL(originalUri).pathname + (new URL(originalUri).search || '')
    : originalUri.startsWith('/')
      ? originalUri
      : `/${originalUri}`;
  const pageUrl = `${origin}${pathOnly.split('#')[0]}`;
  const surface = resolveOgSurface(host, pathOnly);
  const brand = brandStore.get();
  const og = resolveOgPayload(brand, surface, origin, pageUrl);
  const meta = buildOgMetaBlock(og);

  const indexPath = resolveIndexHtmlPath();
  let html: string;
  if (!existsSync(indexPath)) {
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>${meta}</head><body><div id="root"></div></body></html>`;
    return { html, status: 200 };
  }
  html = readFileSync(indexPath, 'utf-8');

  // Remove existing title / description / og / twitter tags so crawlers never see body scrape fallbacks
  html = html.replace(/<title>[^<]*<\/title>/i, '');
  html = html.replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+[^>]*property=["']og:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '');

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `    ${meta}\n  </head>`);
  } else {
    html = `${meta}\n${html}`;
  }
  return { html, status: 200 };
}
