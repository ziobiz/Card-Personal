import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../brand/BrandContext';
import './AdminAuthChrome.css';

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
          appearance?: 'always' | 'execute' | 'interaction-only';
          size?: 'normal' | 'compact' | 'flexible';
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
  theme?: 'light' | 'dark' | 'auto';
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

export default function TurnstileWidget({ onToken, onExpire, resetKey = 0, theme = 'auto' }: Props) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const enabled = Boolean(brand.turnstileEnabled && brand.turnstileSiteKey);
  const siteKey = brand.turnstileSiteKey || '';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [challenge, setChallenge] = useState(false);

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
        setReady(false);
        setChallenge(false);
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => {
            setReady(true);
            setChallenge(false);
            setErr('');
            onToken(token);
          },
          'expired-callback': () => {
            setReady(false);
            setChallenge(false);
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
  }, [enabled, siteKey, resetKey, theme]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || ready) return;
    const ro = new ResizeObserver(() => {
      if ((el.getBoundingClientRect().height || 0) > 24) setChallenge(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, resetKey]);

  useEffect(() => {
    if (!resetKey || !widgetIdRef.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetIdRef.current);
      onToken('');
      setReady(false);
      setChallenge(false);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!enabled) return null;

  const state = err ? 'is-err' : ready ? 'is-ok' : challenge ? 'is-challenge' : 'is-wait';

  return (
    <div className={`ac-turnstile ${state}`}>
      {!ready && !err ? <p className="ac-turnstile-banner">{t('auth.turnstileWait')}</p> : null}
      {err ? <p className="ac-turnstile-banner is-err">{t('auth.turnstileFail')}</p> : null}
      <div className="ac-turnstile-host" ref={hostRef} />
    </div>
  );
}
