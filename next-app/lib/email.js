// Server-only SMTP email helper. No credentials exposed to client.

import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Checks whether SMTP configuration is present.
 * @returns {{ configured: boolean, missing: string[] }}
 */
export function getSmtpStatus() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const missing = required.filter((k) => !process.env[k]);
  return { configured: missing.length === 0, missing };
}

/**
 * Send an email via SMTP. Returns { success, messageId } or throws.
 * @param {{ to: string[], cc: string[], subject: string, text: string }} opts
 */
export async function sendEmail({ to, cc, subject, text }) {
  const { configured, missing } = getSmtpStatus();
  if (!configured) {
    const err = new Error('SMTP not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    err.missing = missing;
    throw err;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER && process.env.SMTP_PASS
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
  });

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: to.join(', '),
    cc: cc.length > 0 ? cc.join(', ') : undefined,
    subject,
    text,
  });

  return { success: true, messageId: info.messageId };
}
