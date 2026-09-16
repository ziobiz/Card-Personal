import { platformStore } from '../data/platformStore.js';

export async function sendMemberMail(
  to: string,
  subject: string,
  text: string
): Promise<{ sent: boolean; reason?: string }> {
  const cfg = platformStore.get();
  const host = cfg.smtpHost || process.env.SMTP_HOST || '';
  const port = cfg.smtpPort || Number(process.env.SMTP_PORT || 587);
  const user = cfg.smtpUser || process.env.SMTP_USER || '';
  const pass =
    (cfg.smtpPassword && cfg.smtpPassword !== '********' ? cfg.smtpPassword : '') ||
    process.env.SMTP_PASSWORD ||
    '';
  const fromAddr = cfg.smtpFrom || process.env.SMTP_FROM || user || 'noreply@icocard.net';
  const fromName = (cfg.smtpFromName || '').replace(/"/g, '').trim();
  const from = fromName ? `"${fromName}" <${fromAddr}>` : fromAddr;
  if (!host) return { sent: false, reason: 'smtp_not_configured' };

  try {
    const nodemailer = await import('nodemailer');
    const createTransport =
      (nodemailer as { createTransport?: typeof import('nodemailer').createTransport }).createTransport ||
      (nodemailer as { default?: { createTransport: typeof import('nodemailer').createTransport } }).default
        ?.createTransport;
    if (!createTransport) return { sent: false, reason: 'smtp_module' };
    const transport = createTransport({
      host,
      port,
      secure: cfg.smtpSecure || port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transport.sendMail({ from, to, subject, text });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'smtp_failed' };
  }
}
