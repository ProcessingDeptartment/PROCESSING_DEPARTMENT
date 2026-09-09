// Compute registry -- the ~15 named formulas that computed/derived record fields use, moved
// out of inline page JS so a RecordFieldDef row can name one (computeFn) plus its inputs
// (computeArgs) instead of carrying a function. Consolidated Plan Section 6.1.
//
// Loaded on the client as window.ComputeRegistry, and required by src/compute-registry.js on
// the server, so a live form preview and the stored value are computed by the exact same code.
//
// A function takes (values, args): `values` is the record's current field values, `args` names
// which of them to read. It returns the computed value, or '' when inputs are missing/invalid.

(function () {
  function num(v) { const n = parseFloat(v); return (v === '' || v == null || isNaN(n)) ? null : n; }
  function round(n, dp) { const f = Math.pow(10, dp == null ? 2 : dp); return Math.round(n * f) / f; }

  var FN = {
    // args {a, b, dp=2}  ->  round(a - b)
    // REC 7.10.3 coldDeviation / hotDeviation, REC 7.10.4 difference
    subtract: function (v, a) {
      var x = num(v[a.a]), y = num(v[a.b]);
      return (x === null || y === null) ? '' : round(x - y, a.dp);
    },

    // args {x, y, dp=2}  ->  round(x / y * 100)
    // REC 7.2.4 cookoutPct
    ratioPct: function (v, a) {
      var x = num(v[a.x]), y = num(v[a.y]);
      return (x === null || y === null || y === 0) ? '' : round(x / y * 100, a.dp);
    },

    // args {spec, x, y}  ->  ceil( spec / (x / y) )
    // REC 7.2.4 newMinIngo / newMaxIngo
    specOverRatio: function (v, a) {
      var x = num(v[a.x]), y = num(v[a.y]), s = num(v[a.spec]);
      if (x === null || y === null || s === null || x === 0 || y === 0) return '';
      var r = s / (x / y);
      return isFinite(r) ? Math.ceil(r) : '';
    },

    // args {from, to}  ->  whole days between two dates
    // REC 7.5.1 purgeDays
    dayCount: function (v, a) {
      var t0 = Date.parse(v[a.from]), t1 = Date.parse(v[a.to]);
      return (isNaN(t0) || isNaN(t1)) ? '' : Math.round((t1 - t0) / 86400000);
    },

    // args {into, outOf, dp=1}  ->  round((into - outOf) / into * 100)
    // REC 7.5.1 purgeLoss
    lossPct: function (v, a) {
      var i = num(v[a.into]), o = num(v[a.outOf]);
      return (i === null || o === null || i <= 0) ? '' : round((i - o) / i * 100, a.dp == null ? 1 : a.dp);
    }
  };

  function run(name, args, values) {
    var fn = FN[name];
    if (!fn) { try { console.error('ComputeRegistry: unknown function "' + name + '"'); } catch (e) {} return ''; }
    try { return fn(values || {}, args || {}); }
    catch (e) { try { console.error('ComputeRegistry ' + name + ' failed', e); } catch (e2) {} return ''; }
  }

  var api = { run: run, has: function (n) { return !!FN[n]; }, names: function () { return Object.keys(FN); } };
  if (typeof window !== 'undefined') window.ComputeRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
