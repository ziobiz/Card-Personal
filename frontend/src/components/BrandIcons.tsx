/** Apple Pay / Google Pay brand icons (monochrome for dark UI) */

export function ApplePayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.2ZM14.7 6.5c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-1 2.6 1.1.1 2.1-.5 2.8-1.3Z" />
    </svg>
  );
}

export function GooglePayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-1 2.3-2.1 3v2.5h3.4c2-1.8 3-4.5 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.8 0 5.2-.9 7-2.5l-3.4-2.5c-.9.6-2.1 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.5v2.6C4.2 19.8 7.8 22 12 22Z" />
      <path fill="#FBBC05" d="M6 13.6c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7H2.5C1.8 8.4 1.4 10.1 1.4 11.6s.4 3.2 1.1 4.6L6 13.6Z" />
      <path fill="#EA4335" d="M12 5.6c1.5 0 2.9.5 4 1.5l3-3C17.2 2.2 14.8 1.2 12 1.2 7.8 1.2 4.2 3.4 2.5 7l3.5 2.6c.9-2.5 3.2-4 6-4Z" />
    </svg>
  );
}

export function DepositIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function LimitIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
}

export function FreezeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v18M5 7l14 10M19 7 5 17" />
    </svg>
  );
}

export function MenuIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export function FingerprintIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 11a3 3 0 0 0-3 3v2" />
      <path d="M12 7a7 7 0 0 0-7 7v1" />
      <path d="M12 7a7 7 0 0 1 7 7v3" />
      <path d="M9 16v1a3 3 0 0 0 6 0v-2" />
      <path d="M5.5 16.5V15a6.5 6.5 0 0 1 13 0v3" />
    </svg>
  );
}
