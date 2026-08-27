/**
 * Verification queue — what is waiting for THIS role to verify.
 *
 * A record entry is awaiting verification when it has been submitted and carries no
 * verification block. That is the same test both engines already use on their own pages
 * (form-record.js `isSubmitted(s) && !s.verification`); this lib does it across every
 * record at once so a person can see their whole queue in one place.
 *
 * Usage
 *   const q = await VerificationQueue.forCurrentUser();   // [] when not logged in
 *   q.total          -> number awaiting this role
 *   q.records        -> [{ recordKey, name, docNo, href, count, oldest }]
 *   q.canVerify      -> false when this role never verifies anything
 *
 *   VerificationQueue.flagOnLogin();   // call after LoginUI.ensureAuthenticated()
 *
 * Requires (in this order): master-index-data.js, data-store.js, api-backend.js,
 * permission-rules.js, auth.js.
 *
 * === WHAT THIS IS AND ISN'T ===
 * This is a WORK QUEUE, not an access control and not an audit trail. auth.js holds
 * eight in-memory users, one per role, all with the password "test", and
 * permission-rules.js runs with ENFORCE_ROLES = false. So "different users see different
 * flags" today means "different ROLES see different flags" — it cannot tell two people
 * holding the same role apart, and nothing stops someone selecting another role.
 * For a QA verification sign-off that an auditor will scrutinise, real per-person
 * identity is required (Entra ID). Until then, treat this as a prompt, and keep the
 * signed verification record itself as the evidence.
 */
(function () {
  'use strict';

  /* ----------------------------------------------------------- who verifies what
   * FIRST PASS — edit freely as the real policy is defined; this is the only place
   * that needs changing.
   *
   * Base set: whoever permission-rules.js says may perform 'verifyRecord'. Narrow a
   * specific record by adding it below, so (for example) a production role sees the
   * production records it owns and the QA Manager is not shown all 148.
   *
   *   'retorting-control-sheet': ['QA_MANAGER', 'QUALITY_SUPERVISOR'],
   *
   * A record not listed here falls back to the base set. */
  var BY_RECORD = {
    // intentionally empty until the verification policy is confirmed
  };

  function baseVerifierRoles() {
    var rules = window.PermissionRules && window.PermissionRules.RULES;
    // Fall back to the quality/management roles if permission-rules.js is absent, rather
    // than to "everyone" — over-showing a QA queue is worse than showing nothing.
    return (rules && rules.verifyRecord) ||
      ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER'];
  }

  function rolesFor(recordKey) {
    return BY_RECORD[recordKey] || baseVerifierRoles();
  }

  /* --------------------------------------------------------------------- helpers */

  // recordKey -> { name, docNo, href } from the Master Index.
  function indexByKey() {
    var out = {};
    ((window.MasterIndexData && window.MasterIndexData.rows) || []).forEach(function (row) {
      if (row.recordKey) out[row.recordKey] = { name: row.name, docNo: row.docNo, href: row.href };
    });
    return out;
  }

  // Older entries predate the draft/submitted lifecycle and carry no status — those count
  // as submitted, matching both engines.
  function isAwaiting(entry) {
    if (!entry) return false;
    var submitted = entry.status == null || entry.status === 'submitted';
    return submitted && !entry.verification;
  }

  function whenOf(entry) {
    return entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
  }

  /* ------------------------------------------------------------------ the queue */

  async function forRole(role) {
    var empty = { total: 0, records: [], canVerify: false, role: role || null };
    if (!role) return empty;

    // Two round trips total, never one per record — see data-store.js on getByPrefix.
    // (After the per-submission migration these return one key per entry rather than one
    // per record type; the shape below already handles both.)
    var pair = await Promise.all([
      window.storage.getByPrefix('formrecord:', true),
      window.storage.getByPrefix('monitoring_log:', true)
    ]);

    var meta = indexByKey();
    var byRecord = {};
    var anyVerifiable = false;

    pair.forEach(function (rows, i) {
      var prefix = i === 0 ? 'formrecord:' : 'monitoring_log:';
      Object.keys(rows || {}).forEach(function (key) {
        // Tolerates both shapes: 'formrecord:<record>' (array) and, after the migration,
        // 'formrecord:<record>:<id>' (single entry).
        var recordKey = key.slice(prefix.length).split(':')[0];
        if (!recordKey) return;

        var allowed = rolesFor(recordKey);
        if (allowed.indexOf(role) === -1) return;
        anyVerifiable = true;

        var parsed;
        try { parsed = JSON.parse(rows[key]); } catch (e) { return; }  // don't die on one bad row
        var entries = Array.isArray(parsed) ? parsed : [parsed];

        entries.forEach(function (entry) {
          if (!isAwaiting(entry)) return;
          var m = meta[recordKey] || {};
          var bucket = byRecord[recordKey] || (byRecord[recordKey] = {
            recordKey: recordKey,
            name: m.name || recordKey,
            docNo: m.docNo || '',
            href: m.href ? '../records/' + m.href : null,
            count: 0,
            oldest: 0
          });
          bucket.count++;
          var w = whenOf(entry);
          if (w && (!bucket.oldest || w < bucket.oldest)) bucket.oldest = w;
        });
      });
    });

    var records = Object.keys(byRecord).map(function (k) { return byRecord[k]; })
      // Oldest waiting first — that is the one at risk of being missed.
      .sort(function (a, b) { return (a.oldest || Infinity) - (b.oldest || Infinity); });

    return {
      total: records.reduce(function (n, r) { return n + r.count; }, 0),
      records: records,
      canVerify: anyVerifiable || baseVerifierRoles().indexOf(role) !== -1,
      role: role
    };
  }

  async function forCurrentUser() {
    var role = window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() : null;
    return forRole(role);
  }

  /* ------------------------------------------------------------ the login flag
   * Call after LoginUI.ensureAuthenticated(). Renders a dismissible bar naming the
   * count and linking to the queue. Silent when there is nothing waiting — a flag
   * that appears every login stops being read. */
  var flagShown = false;

  async function flagOnLogin(opts) {
    if (flagShown || typeof document === 'undefined') return null;
    var o = opts || {};
    var q;
    try { q = await forCurrentUser(); }
    catch (e) { console.error('verification queue failed', e); return null; }   // never break a page

    if (!q.total) return q;
    flagShown = true;

    var bar = document.createElement('div');
    bar.id = 'vq-flag';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9998;background:#8a5a10;' +
      'color:#fff;font:600 14px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;' +
      'padding:11px 16px;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;';
    bar.innerHTML =
      '<span>' + q.total + (q.total === 1 ? ' record is' : ' records are') +
      ' waiting for your verification</span>' +
      '<a href="' + (o.queueHref || 'pages/verification-queue.html') + '" ' +
      'style="color:#fff;text-decoration:underline;">Open the queue</a>' +
      '<button type="button" style="background:transparent;border:1px solid #d8c39a;color:#fff;' +
      'border-radius:3px;padding:3px 9px;font:inherit;cursor:pointer;">Dismiss</button>';
    bar.querySelector('button').addEventListener('click', function () { bar.remove(); });
    (document.body || document.documentElement).appendChild(bar);
    return q;
  }

  window.VerificationQueue = { forRole: forRole, forCurrentUser: forCurrentUser, flagOnLogin: flagOnLogin, BY_RECORD: BY_RECORD };
})();
