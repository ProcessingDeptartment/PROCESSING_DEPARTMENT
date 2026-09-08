(function () {
  'use strict';

  var BY_RECORD = {

  };

  function baseVerifierRoles() {
    var rules = window.PermissionRules && window.PermissionRules.RULES;

    return (rules && rules.verifyRecord) ||
      ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER'];
  }

  function rolesFor(recordKey) {
    return BY_RECORD[recordKey] || baseVerifierRoles();
  }

  function indexByKey() {
    var out = {};
    ((window.MasterIndexData && window.MasterIndexData.rows) || []).forEach(function (row) {
      if (row.recordKey) out[row.recordKey] = { name: row.name, docNo: row.docNo, href: row.href };
    });
    return out;
  }

  function isAwaiting(entry) {
    if (!entry) return false;
    var submitted = entry.status == null || entry.status === 'submitted';
    return submitted && !entry.verification;
  }

  function whenOf(entry) {
    return entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
  }

  async function forRole(role) {
    var empty = { total: 0, records: [], canVerify: false, role: role || null };
    if (!role) return empty;

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

        var recordKey = key.slice(prefix.length).split(':')[0];
        if (!recordKey) return;

        var allowed = rolesFor(recordKey);
        if (allowed.indexOf(role) === -1) return;
        anyVerifiable = true;

        var parsed;
        try { parsed = JSON.parse(rows[key]); } catch (e) { return; }
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

  var flagShown = false;

  async function flagOnLogin(opts) {
    if (flagShown || typeof document === 'undefined') return null;
    var o = opts || {};
    var q;
    try { q = await forCurrentUser(); }
    catch (e) { console.error('verification queue failed', e); return null; }

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
