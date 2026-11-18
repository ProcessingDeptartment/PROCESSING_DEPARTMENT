/* Chiller Temperature Monitoring — Trend Graphs (REC 7.9.1)
 * Injects a collapsible "Trends" panel into the monitoring log's .ml-body.
 * Requires Chart.js (loaded before this script) and window.FacilityApi.
 */
(function () {
  'use strict';

  var mlBody = document.querySelector('#mlRoot .ml-body');
  if (!mlBody) return;

  var wrap = document.createElement('div');
  wrap.id = 'ml-trends-wrap';
  wrap.className = 'no-print';
  wrap.innerHTML =
    '<div class="ml-panel" id="ml-trends-panel">' +
      '<div class="ml-panel-head" id="ml-trends-head" style="cursor:pointer;" role="button" tabindex="0" aria-expanded="false">' +
        '<h2>Trends</h2>' +
        '<span class="ml-btn ml-btn-flat ml-btn-sm" id="ml-trends-btn" style="pointer-events:none;">▶ Show</span>' +
      '</div>' +
      '<div class="ml-panel-body" id="ml-trends-body" style="display:none;">' +
        '<div style="margin-bottom:12px;">' +
          '<label style="font-size:11.5px;color:var(--palette-label,#54606b);font-weight:600;display:inline-flex;align-items:center;gap:6px;">Range' +
            '<select id="ml-trends-range">' +
              '<option value="7">Last 7 days</option>' +
              '<option value="30" selected>Last 30 days</option>' +
              '<option value="90">Last 90 days</option>' +
              '<option value="0">All time</option>' +
            '</select>' +
          '</label>' +
        '</div>' +
        '<p id="ml-trends-loading" style="color:var(--palette-label,#54606b);font-size:12px;margin:0;">Loading trend data…</p>' +
        '<div id="ml-trends-charts" style="display:none;">' +
          '<div style="margin-bottom:28px;"><canvas id="ml-chiller-chart"></canvas></div>' +
          '<div><canvas id="ml-freezer-chart"></canvas></div>' +
        '</div>' +
        '<p id="ml-trends-error" style="display:none;color:var(--palette-fail,#a3352d);font-size:12px;margin:0;"></p>' +
      '</div>' +
    '</div>';
  mlBody.insertBefore(wrap, mlBody.firstChild);

  var loaded = false;
  var chillerChart = null, freezerChart = null;
  var head     = document.getElementById('ml-trends-head');
  var btn      = document.getElementById('ml-trends-btn');
  var panelBody = document.getElementById('ml-trends-body');

  function toggle() {
    var open = panelBody.style.display !== 'none';
    panelBody.style.display = open ? 'none' : '';
    btn.textContent = open ? '▶ Show' : '▾ Hide';
    head.setAttribute('aria-expanded', String(!open));
    if (!open && !loaded) { loaded = true; loadTrends(); }
  }
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  document.getElementById('ml-trends-range').addEventListener('change', function () {
    if (window._mlTrendsEntries) renderCharts(window._mlTrendsEntries, +this.value);
  });

  function fmtTs(ts) {
    var d = new Date(ts);
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return ('0'+d.getDate()).slice(-2)+' '+mon[d.getMonth()]+' '+
           ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  }

  async function loadTrends() {
    var loadEl   = document.getElementById('ml-trends-loading');
    var errEl    = document.getElementById('ml-trends-error');
    var chartsEl = document.getElementById('ml-trends-charts');
    try {
      if (!window.FacilityApi) throw new Error('API not ready');
      var res = await window.FacilityApi.fetch(
        '/api/storage/key/' + encodeURIComponent('monitoring_log:chiller-temperature-monitoring')
      );
      if (!res.ok) throw new Error('Server error ' + res.status);
      var blob = await res.json();
      var raw = blob && blob.value != null ? blob.value : null;
      if (!raw) { loadEl.textContent = 'No data yet.'; return; }
      var entries = JSON.parse(raw);
      window._mlTrendsEntries = entries;
      loadEl.style.display = 'none';
      chartsEl.style.display = '';
      renderCharts(entries, +document.getElementById('ml-trends-range').value);
    } catch (e) {
      loadEl.style.display = 'none';
      errEl.style.display = '';
      errEl.textContent = 'Could not load trends: ' + (e.message || 'unknown error');
    }
  }

  function ptColors(data, minV, maxV, color) {
    return data.map(function (v) {
      return v != null && (v < minV || v > maxV) ? '#dc2626' : color;
    });
  }
  function refLine(n, val, label, color) {
    return {
      label: label, data: Array(n).fill(val), borderColor: color,
      borderDash: [4, 4], pointRadius: 0, spanGaps: true, borderWidth: 1.5,
      backgroundColor: 'transparent'
    };
  }
  function toNum(v) { return v != null && v !== '' ? Number(v) : null; }

  function renderCharts(entries, rangeDays) {
    var now = Date.now();
    var cutoff = rangeDays > 0 ? now - rangeDays * 86400000 : 0;
    var filtered = entries
      .filter(function (e) {
        return (e.submittedAt || e.createdAt || 0) >= cutoff && e.values;
      })
      .sort(function (a, b) {
        return (a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0);
      });

    var xLabels = [], c1 = [], c2 = [], fzDial = [], fzProd = [];
    filtered.forEach(function (e) {
      xLabels.push(fmtTs(e.submittedAt || e.createdAt || 0));
      var r = Array.isArray((e.values || {}).readings) ? e.values.readings : [];
      var r1 = r.find(function (x) { return x.chillerUnit === 'Chiller 1'; });
      var r2 = r.find(function (x) { return x.chillerUnit === 'Chiller 2'; });
      var rf = r.find(function (x) { return x.chillerUnit === 'Freezer'; });
      c1.push(r1 ? toNum(r1.dialTemp) : null);
      c2.push(r2 ? toNum(r2.dialTemp) : null);
      fzDial.push(rf ? toNum(rf.dialTemp) : null);
      fzProd.push(rf ? toNum(rf.productTemp) : null);
    });

    var n = xLabels.length;
    var tooltipLabel = function (ctx) {
      return ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y + '°C' : '—');
    };
    var yAxis = { y: { title: { display: true, text: '°C' } } };

    if (chillerChart) { chillerChart.destroy(); chillerChart = null; }
    chillerChart = new Chart(document.getElementById('ml-chiller-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [
          { label: 'Chiller 1', data: c1, borderColor: '#2563eb', backgroundColor: 'transparent', spanGaps: true, tension: 0.3, pointBackgroundColor: ptColors(c1, 0, 10, '#2563eb'), pointRadius: 4 },
          { label: 'Chiller 2', data: c2, borderColor: '#16a34a', backgroundColor: 'transparent', spanGaps: true, tension: 0.3, pointBackgroundColor: ptColors(c2, 0, 10, '#16a34a'), pointRadius: 4 },
          refLine(n, 10, 'Max (10°C)', '#dc2626'),
          refLine(n,  0, 'Min (0°C)',  '#d97706'),
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Chiller Temperature Trend', font: { size: 13 } },
          tooltip: { callbacks: { label: tooltipLabel } }
        },
        scales: yAxis
      }
    });

    if (freezerChart) { freezerChart.destroy(); freezerChart = null; }
    freezerChart = new Chart(document.getElementById('ml-freezer-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [
          { label: 'Freezer dial',    data: fzDial, borderColor: '#7c3aed', backgroundColor: 'transparent', spanGaps: true, tension: 0.3, pointBackgroundColor: ptColors(fzDial, -28, 2, '#7c3aed'), pointRadius: 4 },
          { label: 'Freezer product', data: fzProd, borderColor: '#ea580c', backgroundColor: 'transparent', spanGaps: true, tension: 0.3, pointBackgroundColor: ptColors(fzProd, -28, 2, '#ea580c'), pointRadius: 4 },
          refLine(n,  2, 'Max (2°C)',   '#dc2626'),
          refLine(n, -28, 'Min (-28°C)', '#d97706'),
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Freezer Temperature Trend', font: { size: 13 } },
          tooltip: { callbacks: { label: tooltipLabel } }
        },
        scales: yAxis
      }
    });
  }
})();
