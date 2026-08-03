/*
 * DOCUMENT SHELL -- the one boot path every controlled document goes through.
 *
 * Before this existed, each of the 146 record pages hand-listed its own 7-9 <script>
 * tags, its own stylesheet links and its own header boot block. Sixteen different
 * boot signatures had drifted apart, and a one-line change to a shared engine meant
 * editing every page to bump a ?v= cache string -- which is exactly how the printed
 * title block went missing on the form-record pages while the monitoring-log pages
 * kept working.
 *
 * A document now declares WHAT IT IS and nothing about how it loads:
 *
 *   <script src="../lib/shell.js?v=1"></script>
 *   <script>
 *     Shell.record({
 *       engine: 'form-record',          // or 'monitoring-log' | 'cleaning-register' | null
 *       recordKey: 'traceability',
 *       docCode: 'REC 8.1.5',
 *       title: 'Traceability Exercise',
 *       ...engine-specific config
 *     });
 *   </script>
 *
 * === WHY THE VERSION LIVES HERE ===
 * LIB_VERSION below is stamped onto every library this shell loads. Bumping ONE
 * number busts the cache for all of them, everywhere. No more 137-file commits to
 * change one line of CSS, and no more half-stale estate where one record picked up
 * a fix and its neighbour didn't.
 *
 * The shell's own ?v= is the single exception, and it only needs bumping when the
 * contract below changes -- which should be rare.
 *
 * === PATHS ===
 * Resolved from this script's own URL, not from the calling page, so a document can
 * sit at any depth (records/, procedures/, sops/) without knowing where lib/ is.
 */
(function () {
  /* Bump this when ANY file in lib/ or styles/ changes. It is the whole estate's
   * cache key -- see the header comment. */
  const LIB_VERSION = '2';

  // Where lib/ lives, derived from this script's own src.
  const SELF = document.currentScript && document.currentScript.src;
  const LIB_BASE = SELF ? SELF.replace(/\/[^/]*$/, '/') : '../lib/';
  const ROOT = LIB_BASE.replace(/lib\/$/, '');

  function url(rel) { return ROOT + rel + '?v=' + LIB_VERSION; }

  /* Every controlled document loads these, in this order. Order is load-bearing:
   * data-store before anything that reads storage, master-index-data before
   * doc-header (which reads the paper baseline off it). */
  const CORE = [
    'lib/palette-map.js',
    'lib/data-store.js',
    'lib/auth.js',
    'lib/login-ui.js',
    'lib/document-revision.js',
    'lib/master-index-data.js',
    'lib/doc-header.js'
  ];

  const STYLES = ['styles/record-theme.css', 'styles/responsive.css'];

  /* Engine name -> the extra libs it needs and the global it exposes. A document
   * names its engine; it never lists these itself. */
  const ENGINES = {
    'form-record':       { libs: ['lib/form-record.js'], global: 'FormRecord' },
    'monitoring-log':    { libs: ['lib/spec-registry.js', 'lib/monitoring-log.js'], global: 'MonitoringLog' },
    'cleaning-register': { libs: ['lib/cleaning-master-data.js', 'lib/cleaning-register.js'], global: 'CleaningRegister' }
  };

  /* Optional libs a document opts into by name, so the common case stays lean. */
  const OPTIONAL = {
    lookups: 'lib/lookups.js',
    traceability: 'lib/traceability.js',
    'cleaning-master': 'lib/cleaning-master-data.js',
    'permission-rules': 'lib/permission-rules.js'
  };

  function addStyle(rel) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url(rel);
    document.head.appendChild(l);
  }

  /* Scripts are appended with async=false, which keeps EXECUTION order even though
   * they download in parallel -- the ordering CORE depends on. */
  function addScript(rel) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url(rel);
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('shell: could not load ' + rel)); };
      document.head.appendChild(s);
    });
  }

  function domReady() {
    return new Promise(function (resolve) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else resolve();
    });
  }

  /* Boot a controlled document. Returns a promise so a bespoke page can await the
   * shell before running its own script. */
  async function boot(config) {
    config = config || {};
    const engine = config.engine ? ENGINES[config.engine] : null;
    if (config.engine && !engine) {
      throw new Error('shell: unknown engine "' + config.engine + '"');
    }

    await corePromise; // started at parse time, not here -- see the bottom of this file
    let libs = [];
    (config.uses || []).forEach(function (name) {
      if (OPTIONAL[name]) libs.push(OPTIONAL[name]);
      else console.warn('shell: unknown optional lib "' + name + '"');
    });
    if (engine) libs = libs.concat(engine.libs);

    if (libs.length) await Promise.all(libs.map(addScript));

    /* A record whose fields are BUILT by an optional lib -- Lookups.field(), say --
     * cannot state them in a literal, because the literal is evaluated before this
     * shell has loaded anything. Such a record passes config() instead, and it is
     * called here, once its libs are in. */
    if (typeof config.config === 'function') {
      config = Object.assign({}, config, config.config());
    }

    await domReady();

    /* An engine mounts the controlled-copy title block itself as part of init.
     * A document with no engine (the bespoke record pages, and every procedure and
     * SOP) gets it from the shell, so the block is never a per-page responsibility. */
    if (engine) {
      const api = window[engine.global];
      if (!api || typeof api.init !== 'function') {
        throw new Error('shell: engine "' + config.engine + '" exposed no init()');
      }
      api.init(config);
    } else if (config.recordKey && window.DocHeader) {
      await window.DocHeader.mountPrintHeader({
        recordKey: config.recordKey,
        defaults: { document: config.title, docNumber: config.docCode },
        logoSrc: ROOT + 'assets/abagold-logo.png'
      });
    }
    return config;
  }

  /* Failures are surfaced, not swallowed: a controlled document that booted wrong is
   * a document-control problem, and a silent one is worse than a visible one. */
  function record(config) {
    return boot(config).catch(function (e) {
      console.error(e);
      return Promise.reject(e);
    });
  }

  /* Stylesheets and the core libraries start loading the instant this file parses, in
   * <head>, rather than waiting for the Shell.record() call at the end of <body>.
   * Deferring them was a visible flash of unstyled record on every page, and it cost a
   * round trip -- the core does not depend on the config, so it need not wait for it. */
  STYLES.forEach(addStyle);
  const corePromise = Promise.all(CORE.map(addScript));

  window.Shell = { record: record, LIB_VERSION: LIB_VERSION, ROOT: ROOT };
})();
