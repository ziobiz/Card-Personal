import { useEffect, useRef, useState } from 'react';
import { useBrand } from '../brand/BrandContext';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  resetKey?: number;
};

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cf-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile_script')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.cfTurnstile = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_script'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function TurnstileWidget({ onToken, onExpire, resetKey = 0 }: Props) {
  const { brand } = useBrand();
  const enabled = Boolean(brand.turnstileEnabled && brand.turnstileSiteKey);
  const siteKey = brand.turnstileSiteKey || '';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!enabled || !siteKey || !hostRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !hostRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore */
          }
          widgetIdRef.current = null;
          hostRef.current.innerHTML = '';
        }
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            setReady(true);
            setErr('');
            onToken(token);
          },
          'expired-callback': () => {
            setReady(false);
            onToken('');
            onExpire?.();
          },
          'error-callback': () => {
            setReady(false);
            setErr('turnstile');
            onToken('');
          },
        });
      } catch {
        if (!cancelled) setErr('turnstile');
      }
    })();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, siteKey, resetKey]);

  useEffect(() => {
    if (!resetKey || !widgetIdRef.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetIdRef.current);
      onToken('');
      setReady(false);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!enabled) return null;

  return (
    <div className="ac-turnstile">
      <div ref={hostRef} />
      {err ? <p className="ac-turnstile-err">Cloudflare verification failed. Refresh and try again.</p> : null}
      {!ready && !err ? <p className="ac-turnstile-hint">Verifying…</p> : null}
    </div>
  );
}
