// src/jobs/unverified-alert.js
// Hourly background job: email ALERT_EMAIL_RECIPIENTS when a submission group
// has been awaiting verification for more than 48 hours.
//
// One email per overdue (record_type, submission_group_id) pair.
// Once alerted, the pair is recorded in unverified_alert_log so the email is
// not repeated, even if the group remains unverified on the next run.
//
// Needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / ALERT_EMAIL_RECIPIENTS.
const { sendEmail } = require('../email');

// Same sub_* tables as /api/verification/count-overdue.
const UNION_TABLES = [
  'sub_dry_export_pack_front_page',
  'sub_abalone_receiving',
  'sub_bleeding_and_salting',
  'sub_cans_produced',
  'sub_dry_cooking',
  'sub_drying_process',
];

const SITE_URL = (process.env.SITE_URL || 'https://processing-department.onrender.com').replace(/\/$/, '');

function toReadable(recordType) {
  return recordType
    ? recordType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown Record';
}

async function runUnverifiedAlert(prisma) {
  const recipients = (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) {
    console.warn('[unverified-alert] ALERT_EMAIL_RECIPIENTS not set — skipping.');
    return;
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Build the UNION of all sub_* tables (same logic as count-overdue).
  const unionSql = UNION_TABLES.map(
    (t) => `SELECT record_type, submission_group_id, submission_date FROM ${t} WHERE submission_group_id IS NOT NULL`,
  ).join('\nUNION ALL\n');

  try {
    // Find overdue groups not yet verified AND not yet alerted.
    const rows = await prisma.$queryRawUnsafe(`
      SELECT s.record_type, s.submission_group_id, s.submission_date
      FROM (
        SELECT DISTINCT record_type, submission_group_id, MIN(submission_date) AS submission_date
        FROM (${unionSql}) all_subs
        WHERE submission_date < $1
        GROUP BY record_type, submission_group_id
      ) s
      LEFT JOIN submissions_group_verification v
        ON v.record_type = s.record_type AND v.submission_group_id = s.submission_group_id
      LEFT JOIN unverified_alert_log a
        ON a.record_type = s.record_type AND a.submission_group_id = s.submission_group_id
      WHERE v.id IS NULL
        AND a.id IS NULL
      ORDER BY s.submission_date ASC
    `, cutoff);

    if (!rows.length) {
      console.log('[unverified-alert] No new overdue groups to alert.');
      return;
    }

    console.log(`[unverified-alert] Sending alerts for ${rows.length} overdue group(s).`);

    for (const row of rows) {
      const recordLabel = toReadable(row.record_type);
      const subDate = row.submission_date
        ? new Date(row.submission_date).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'long' })
        : '—';
      const hoursOld = row.submission_date
        ? Math.floor((Date.now() - new Date(row.submission_date).getTime()) / 3600000)
        : '?';

      const subject = `⚠ Unverified Record — ${recordLabel} (${subDate}) — ${hoursOld}hr outstanding`;
      const text = `
A submitted record group has not been verified after ${hoursOld} hours.

Record type:       ${recordLabel}
Submission date:   ${subDate}
Group ID:          ${row.submission_group_id}
Status:            Awaiting verification

Please verify these records or contact the responsible supervisor.

View verifications: ${SITE_URL}/pages/verification-preview.html

---
Abagold Processing Facility — Automated Alert
`.trim();

      await sendEmail({ to: recipients, subject, text });

      // Mark as alerted so this group is not emailed again.
      await prisma.unverifiedAlertLog.create({
        data: {
          recordType: row.record_type,
          submissionGroupId: row.submission_group_id,
        },
      });
    }
  } catch (err) {
    console.error('[unverified-alert] Job failed:', err.message);
  }
}

module.exports = { runUnverifiedAlert };
