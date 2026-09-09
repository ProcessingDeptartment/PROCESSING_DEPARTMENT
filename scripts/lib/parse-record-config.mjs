// Shared by extract-definitions.mjs and verify-definitions.mjs: pull the object literal a
// record page passes to FormRecord.init / MonitoringLog.init and evaluate it to a plain object.
//
// The config literals call two real helpers inline -- Lookups.field({...}) and Thresholds.get()
// -- so those two libs are loaded for real from public/lib. Every other identifier is
// neutralised to an inert proxy (the configs don't depend on anything else at init time).

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const LIBDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'lib');

function loadHelpers() {
  const win = {};
  const sandbox = {
    window: win,
    document: { getElementById: () => null, createElement: () => ({ appendChild() {}, setAttribute() {} }) },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const f of ['lookups.js', 'thresholds.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(LIBDIR, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { console.warn(`warn: could not load ${f}: ${e.message}`); }
  }
  return { Lookups: win.Lookups, Thresholds: win.Thresholds, SizeRanges: win.SizeRanges, BatchValidation: win.BatchValidation };
}

const HELPERS = loadHelpers();

export function extractInitArg(src) {
  const m = src.match(/(FormRecord|MonitoringLog)\.init\s*\(/);
  if (!m) return null;
  const engine = m[1] === 'FormRecord' ? 'form-record' : 'monitoring-log';
  let i = m.index + m[0].length, depth = 1, str = null, prev = '';
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) { if (c === str && prev !== '\\') str = null; }
    else if (c === '"' || c === "'" || c === '`') str = c;
    else if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; }
    else if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e === -1 ? src.length : e + 1; }
    else if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { if (--depth === 0) return { engine, text: src.slice(start, i) }; }
    prev = c;
  }
  return null;
}

export function evalConfig(text) {
  const anything = new Proxy(function () {}, { get: () => anything, apply: () => anything, construct: () => anything });
  // real Lookups/Thresholds + real JS built-ins (Object.assign, Math, JSON, Date...);
  // every app-level identifier (FormRecord, Traceability, ...) falls through to the inert proxy.
  const scope = new Proxy({ ...HELPERS }, {
    has: () => true,
    get: (t, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in t) return t[k];
      if (typeof k === 'string' && Object.prototype.hasOwnProperty.call(globalThis, k)) return globalThis[k];
      return anything;
    },
  });
  return new Function('scope', 'with (scope) { return (' + text + '\n); }')(scope);
}

export function readPageConfig(file, recDir) {
  const parsed = extractInitArg(fs.readFileSync(path.join(recDir, file), 'utf8'));
  if (!parsed) return null;
  return { engine: parsed.engine, config: evalConfig(parsed.text) };
}
