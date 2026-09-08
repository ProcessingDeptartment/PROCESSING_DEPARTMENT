(function () {

  const LIB_VERSION = '2';


  const SELF = document.currentScript && document.currentScript.src;
  const LIB_BASE = SELF ? SELF.replace(/\/[^/]*$/, '/') : '../lib/';
  const ROOT = LIB_BASE.replace(/lib\/$/, '');

  function url(rel) { return ROOT + rel + '?v=' + LIB_VERSION; }


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


  const ENGINES = {
    'form-record':       { libs: ['lib/form-record.js'], global: 'FormRecord' },
    'monitoring-log':    { libs: ['lib/spec-registry.js', 'lib/monitoring-log.js'], global: 'MonitoringLog' },
    'cleaning-register': { libs: ['lib/cleaning-master-data.js', 'lib/cleaning-register.js'], global: 'CleaningRegister' }
  };


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


  async function boot(config) {
    config = config || {};
    const engine = config.engine ? ENGINES[config.engine] : null;
    if (config.engine && !engine) {
      throw new Error('shell: unknown engine "' + config.engine + '"');
    }

    await corePromise;
    let libs = [];
    (config.uses || []).forEach(function (name) {
      if (OPTIONAL[name]) libs.push(OPTIONAL[name]);
      else console.warn('shell: unknown optional lib "' + name + '"');
    });
    if (engine) libs = libs.concat(engine.libs);

    if (libs.length) await Promise.all(libs.map(addScript));


    if (typeof config.config === 'function') {
      config = Object.assign({}, config, config.config());
    }

    await domReady();


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


  function record(config) {
    return boot(config).catch(function (e) {
      console.error(e);
      return Promise.reject(e);
    });
  }


  STYLES.forEach(addStyle);
  const corePromise = Promise.all(CORE.map(addScript));

  window.Shell = { record: record, LIB_VERSION: LIB_VERSION, ROOT: ROOT };
})();
