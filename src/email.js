// src/email.js — shared Nodemailer transporter for automated alerts.
// SMTP is configured via env vars; when SMTP_HOST is unset all sends are skipped silently.
const nodemailer = require('nodemailer');

let _transport = null;

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      tls: { ciphers: 'SSLv3' },
    });
  }
  return _transport;
}

/**
 * Send a plain-text + optional HTML email.
 * Never throws — email failure is logged but must not crash the caller.
 */
async function sendEmail({ to, subject, text, html }) {
  const t = getTransport();
  if (!t) {
    console.warn('[email] SMTP_HOST not set — skipping send:', subject);
    return;
  }
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  if (!recipients) { console.warn('[email] No recipients for:', subject); return; }
  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: recipients,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
    });
    console.log('[email] Sent:', info.messageId, '→', recipients);
  } catch (err) {
    console.error('[email] Failed to send:', subject, err.message);
  }
}

module.exports = { sendEmail };
