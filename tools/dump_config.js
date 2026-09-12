/*
 * Dumps the web build's CONFIG to android/harness/golden/config.json.
 * This file is the reference the Kotlin `config_parity` gate measures against:
 * changing a Kotlin constant without changing src/ must fail the build.
 *
 * Numbers are stored as raw float64 hex. Decimal formatting throws away the bits
 * the gate exists to compare.
 *
 *   node tools/dump_config.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Same order as src/build_order.json: core first, then each package's extension.
const FILES = [
  'src/core/CONFIG.js',
  'src/audio/audio.config.js',
  'src/units/units.config.js',
  'src/game/game.config.js',
  'src/fx/fx.config.js',
];

// Evaluated cumulatively so each key can be attributed to the file that first
// defined it. That attribution is what lets the Kotlin side split CONFIG into
// one owner-tagged TOML per package without guessing.
function evalUpTo(n) {
  const source =
    FILES.slice(0, n).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') +
    '\n;globalThis.__CONFIG = CONFIG;';
  const c = { Math, console };
  vm.createContext(c);
  vm.runInContext(source, c, { filename: 'config-chain.js' });
  return c.__CONFIG;
}

const ctx = { __CONFIG: evalUpTo(FILES.length) };

const buf = new DataView(new ArrayBuffer(8));
function f64hex(n) {
  buf.setFloat64(0, n);
  let hex = '';
  for (let i = 0; i < 8; i++) hex += buf.getUint8(i).toString(16).padStart(2, '0');
  return 'f64:0x' + hex;
}

function encode(v) {
  if (typeof v === 'number') return f64hex(v);
  if (typeof v === 'string') return 's:' + v;
  if (typeof v === 'boolean') return 'b:' + v;
  if (v === null) return 'null';
  throw new Error('unsupported config value type: ' + typeof v);
}

function flatten(obj, prefix, out) {
  for (const key of Object.keys(obj)) {
    const dotted = prefix ? prefix + '.' + key : key;
    const v = obj[key];
    if (Array.isArray(v)) {
      out[dotted + '.length'] = 'i:' + v.length;
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') flatten(item, dotted + '.' + i, out);
        else out[dotted + '.' + i] = encode(item);
      });
    } else if (v !== null && typeof v === 'object') {
      flatten(v, dotted, out);
    } else {
      out[dotted] = encode(v);
    }
  }
}

const flat = {};
flatten(ctx.__CONFIG, '', flat);

// Owner = the first file in build order whose cumulative evaluation contains the key.
const owner = {};
let seen = new Set();
for (let n = 1; n <= FILES.length; n++) {
  const partial = {};
  flatten(evalUpTo(n), '', partial);
  for (const k of Object.keys(partial)) {
    if (!seen.has(k)) {
      owner[k] = FILES[n - 1];
      seen.add(k);
    }
  }
}

const keys = Object.keys(flat).sort();
const out = {
  schema: 1,
  source: FILES,
  webSha: require('child_process')
    .execSync('git rev-parse HEAD', { cwd: ROOT })
    .toString()
    .trim(),
  count: keys.length,
  values: Object.fromEntries(keys.map((k) => [k, flat[k]])),
  owners: Object.fromEntries(keys.map((k) => [k, owner[k]])),
};

const dest = path.join(ROOT, 'android/harness/golden/config.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${keys.length} config keys to ${path.relative(ROOT, dest)}`);
