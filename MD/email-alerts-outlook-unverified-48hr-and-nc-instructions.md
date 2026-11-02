# Email Alerts via Outlook — Unverified Records (48hr) & NC Raised

**Date:** 2026-11-02  
**Raised by:** Michaela  
**Type:** Enhancement — Automated Email Notifications  
**Use in:** Claude Code (build)

---

## 1. Purpose

Two automated email alerts must fire via **Microsoft Outlook (SMTP)**:

| Trigger | When | Recipients |
|---------|------|------------|
| **Unverified record** | A submitted record has not been verified within 48 hours of submission | `ALERT_EMAIL_RECIPIENTS` env var |
| **NC raised** | Any new Non-Conformance is raised (POST `/api/nc`) | `NC_EMAIL_RECIPIENTS` env var |

Both emails are sent from the API server using **Nodemailer** configured against the Abagold Outlook/Microsoft 365 SMTP relay.

---

## 2. Outlook SMTP configuration

Microsoft 365 supports SMTP AUTH on port 587 (STARTTLS). Add the following to the API server's environment variables (Render dashboard + local `.env`):

```env
# Outlook / Microsoft 365 SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false          # STARTTLS — NOT SSL on 465
SMTP_USER=alerts@abagold.co.za          # the sending mailbox (must have SMTP AUTH enabled in M365)
SMTP_PASS=<app-password-or-account-password>
EMAIL_FROM="Abagold Processing Alerts <alerts@abagold.co.za>"

# Recipients
NC_EMAIL_RECIPIENTS=michaela@abagold.co.za
ALERT_EMAIL_RECIPIENTS=michaela@abagold.co.za
```

> **Microsoft 365 requirement:** The sending mailbox (`SMTP_USER`) must have SMTP AUTH enabled in the M365 Admin Centre:
> Admin → Users → Active users → select user → Mail tab → Manage email apps → tick **Authenticated SMTP**.

### Shared Nodemailer transporter (`src/email.js`)

Create or update `src/email.js` (shared utility — import from all route files that need email):

```javascript
// src/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',   // false = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',   // required by some M365 tenants
  },
});

/**
 * Send a plain-text + HTML email.
 * @param {object} opts
 * @param {string}   opts.to      – comma-separated recipients
 * @param {string}   opts.subject
 * @param {string}   opts.text    – plain-text body
 * @param {string}   [opts.html]  – HTML body (optional; plain text used as fallback)
 */
async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP credentials not set — skipping email send.');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif">${text}</pre>`,
    });
    console.log('[email] Sent:', info.messageId, '→', to);
  } catch (err) {
    console.error('[email] Failed to send:', err.message);
    // Do NOT throw — email failure must never crash the request
  }
}

module.exports = { sendEmail };
```

---

## 3. Trigger 1 — NC raised email

### 3a. Where to add

In the `POST /api/nc` route handler, **after a successful DB insert**, call `sendNCAlert`.

### 3b. Helper function (`src/email.js` or `src/nc-email.js`)

```javascript
const { sendEmail } = require('./email');

async function sendNCAlert(nc) {
  const recipients = process.env.NC_EMAIL_RECIPIENTS || '';
  if (!recipients) return;

  const subject = `⚠ NC Raised — ${nc.record_ref || 'Unknown record'} [Job: ${nc.job_number || 'N/A'}] — ${nc.nc_ref}`;

  const text = `
Non-Conformance raised.

NC Reference:  ${nc.nc_ref}
Record:        ${nc.record_ref || '—'}
Job number:    ${nc.job_number || '—'}
Date/Time:     ${new Date(nc.raised_at || Date.now()).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
Raised by:     ${nc.raised_by || '—'}
Category:      ${nc.category || '—'}
Severity:      ${nc.severity || '—'}

Description:
  ${nc.description || '(no description)'}

Corrective action logged:
  (none yet — update the NC log when resolved)

View the NC log: https://processing-department.onrender.com/pages/nc-log.html

---
Abagold Processing Facility — Automated Alert
`.trim();

  await sendEmail({ to: recipients, subject, text });
}

module.exports = { sendNCAlert };
```

### 3c. Wire into POST /api/nc

```javascript
const { sendNCAlert } = require('../src/nc-email'); // adjust path

// Inside POST /api/nc, after successful DB insert:
await sendNCAlert(newNC);
```

This replaces any earlier `TRIGGER_RECORDS` filter — **every** NC now triggers an email.

---

## 4. Trigger 2 — Unverified record 48-hour alert

### 4a. How it works

A background job runs on the API server every **hour**. It queries the database for submitted records that:

1. Have `submitted_at` more than 48 hours ago, AND
2. Are **not yet verified** (`verified_at IS NULL` or `status != 'verified'`), AND
3. Have **not already had a 48-hour alert sent** (tracked by a column `alert_48hr_sent_at`).

For each matching record it sends one email and stamps `alert_48hr_sent_at = NOW()` so the alert is not repeated.

### 4b. Database change — add column

Add to the submissions table (run in Neon SQL editor at `console.neon.tech`):

```sql
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS alert_48hr_sent_at TIMESTAMPTZ;
```

> If your verified status is stored differently (e.g. in a separate `verification_queue` table), adjust the query in 4c accordingly. The principle is the same: find unverified records older than 48hr that have not yet been alerted.

### 4c. Background job (`src/jobs/unverified-alert.js`)

Create the file:

```javascript
// src/jobs/unverified-alert.js
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../email');

const prisma = new PrismaClient();

async function runUnverifiedAlert() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  // Find submissions older than 48hr, not verified, alert not yet sent
  // Adjust the Prisma model name and field names to match your actual schema
  const unverified = await prisma.submission.findMany({
    where: {
      submittedAt: { lt: cutoff },
      verifiedAt: null,              // not yet verified
      alert48hrSentAt: null,         // alert not yet sent
    },
    orderBy: { submittedAt: 'asc' },
  });

  if (unverified.length === 0) return;

  const recipients = process.env.ALERT_EMAIL_RECIPIENTS || '';
  if (!recipients) {
    console.warn('[unverified-alert] ALERT_EMAIL_RECIPIENTS not set — skipping.');
    return;
  }

  for (const record of unverified) {
    const hoursOld = Math.floor((Date.now() - new Date(record.submittedAt).getTime()) / 3600000);
    const subject = `⚠ Unverified Record — ${record.recordRef || record.recordKey || 'Unknown'} [Job: ${record.jobNo || 'N/A'}] — ${hoursOld}hr outstanding`;

    const text = `
A submitted record has not been verified after ${hoursOld} hours.

Record:        ${record.recordRef || record.recordKey || '—'}
Job number:    ${record.jobNo || '—'}
Submitted:     ${new Date(record.submittedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
Submitted by:  ${record.submittedBy || '—'}
Status:        Awaiting verification

Please verify this record or contact the operator responsible.

View record: https://processing-department.onrender.com/records/${record.recordRef ? record.recordRef.toLowerCase().replace(/\s/g, '-') : ''}

---
Abagold Processing Facility — Automated Alert
`.trim();

    await sendEmail({ to: recipients, subject, text });

    // Stamp the alert so it is not sent again
    await prisma.submission.update({
      where: { id: record.id },
      data: { alert48hrSentAt: new Date() },
    });

    console.log(`[unverified-alert] Alert sent for submission ${record.id} (${record.recordRef || record.recordKey})`);
  }
}

module.exports = { runUnverifiedAlert };
```

> **Adjust model/field names** to match the actual Prisma schema — e.g. the model may be `RecordSubmission` instead of `submission`, and `submittedAt` may be `createdAt`. Check `prisma/schema.prisma` for the correct names.

### 4d. Start the job in server entry point (`src/index.js` or `server.js`)

```javascript
const { runUnverifiedAlert } = require('./jobs/unverified-alert');

// Run immediately on startup, then every hour
runUnverifiedAlert().catch(console.error);
setInterval(() => {
  runUnverifiedAlert().catch(console.error);
}, 60 * 60 * 1000);  // every 60 minutes
```

The job runs silently. It only logs to the Render console — it does not block any request handling.

---

## 5. Environment variables summary

Add all of these to the **Render API service** environment (Settings → Environment):

| Variable | Example value | Notes |
|----------|---------------|-------|
| `SMTP_HOST` | `smtp.office365.com` | Outlook/M365 |
| `SMTP_PORT` | `587` | STARTTLS port |
| `SMTP_SECURE` | `false` | Leave false for port 587 |
| `SMTP_USER` | `alerts@abagold.co.za` | Sending mailbox |
| `SMTP_PASS` | `<password>` | Account password or App Password |
| `EMAIL_FROM` | `Abagold Processing Alerts <alerts@abagold.co.za>` | Display name |
| `NC_EMAIL_RECIPIENTS` | `michaela@abagold.co.za` | Comma-separated for multiple |
| `ALERT_EMAIL_RECIPIENTS` | `michaela@abagold.co.za` | Comma-separated for multiple |

Also add to local `.env` for testing.

---

## 6. Files to create / edit

| File | Action |
|------|--------|
| `src/email.js` | **Create** — shared Nodemailer transporter + `sendEmail()` |
| `src/nc-email.js` | **Create** (or add to `email.js`) — `sendNCAlert()` helper |
| `src/jobs/unverified-alert.js` | **Create** — 48-hour check job |
| `src/index.js` or `server.js` | **Edit** — start the interval job on server boot |
| Route that handles `POST /api/nc` | **Edit** — call `sendNCAlert(newNC)` after DB insert |
| `prisma/schema.prisma` | **Edit** — add `alert48hrSentAt DateTime?` to the submission model |
| Neon DB | **Run SQL** — `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS alert_48hr_sent_at TIMESTAMPTZ;` |

---

## 7. Prisma schema change

In `prisma/schema.prisma`, find the submission model and add:

```prisma
model Submission {
  // ... existing fields ...
  alert48hrSentAt   DateTime?   @map("alert_48hr_sent_at")
}
```

Then run:

```bash
npx prisma generate
```

No migration needed if you added the column directly in Neon SQL — Prisma just needs `generate` to pick up the new field.

---

## 8. Testing checklist

**SMTP connection:**
- [ ] Nodemailer connects to `smtp.office365.com:587` without TLS errors
- [ ] Test email arrives in inbox from `alerts@abagold.co.za`
- [ ] If using a shared mailbox, confirm SMTP AUTH is enabled in M365 Admin

**NC email:**
- [ ] Raise an NC via the NC log page → email arrives within 30 seconds
- [ ] Email subject contains `nc_ref` and job number
- [ ] Email body contains category, severity, description, and link to NC log
- [ ] Multiple NC_EMAIL_RECIPIENTS all receive the email

**48-hour unverified alert:**
- [ ] Submit a test record, manually set `submitted_at = NOW() - INTERVAL '49 hours'` in Neon SQL editor, ensure `verified_at IS NULL`
- [ ] Trigger the job manually (call `runUnverifiedAlert()` from a test endpoint or console)
- [ ] Alert email arrives with correct record details
- [ ] `alert_48hr_sent_at` is stamped on that submission row in Neon
- [ ] Running the job a second time does **not** send a duplicate email for the same record
- [ ] A record submitted 47 hours ago is **not** alerted yet
- [ ] A verified record (`verified_at IS NOT NULL`) is **not** alerted

**Edge cases:**
- [ ] If `SMTP_USER` / `SMTP_PASS` are missing, a warning is logged but the server does not crash
- [ ] If the email send fails (bad password, etc.), the NC or submission save still succeeds — error is logged, not thrown

---

## 9. Adding more recipients later

To add more people to either alert, edit the Render environment variable and redeploy:

```
NC_EMAIL_RECIPIENTS=michaela@abagold.co.za,qc@abagold.co.za,manager@abagold.co.za
ALERT_EMAIL_RECIPIENTS=michaela@abagold.co.za,supervisor@abagold.co.za
```

No code changes required.
