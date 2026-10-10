/* Carga la simulación del juego (los mismos archivos que usa el navegador) dentro de Node, sin dibujo. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** Busca la carpeta del juego (con js/game.js): la de arriba del servidor o GAME_DIR. */
function gameDir() {
  const cands = [process.env.GAME_DIR, path.resolve(__dirname, '..'), path.resolve(__dirname, 'game')].filter(Boolean);
  for (const d of cands) if (fs.existsSync(path.join(d, 'js', 'game.js'))) return d;
  throw new Error('No encuentro los archivos del juego (js/game.js). Definí GAME_DIR.');
}

function load() {
  const root = gameDir();
  const noop = function () {};
  const store = {};
  const sandbox = {
    console: console, Math: Math, JSON: JSON, Date: Date, setTimeout: setTimeout, clearTimeout: clearTimeout,
    performance: { now: function () { return Number(process.hrtime.bigint() / 1000n) / 1000; } },
    localStorage: { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    document: { documentElement: { style: { setProperty: noop } }, body: null, addEventListener: noop, getElementById: function () { return null; }, querySelectorAll: function () { return []; }, hidden: false },
    location: { search: '', href: 'http://server/', protocol: 'http:' },
    navigator: { userAgent: 'node' },
    addEventListener: noop, removeEventListener: noop
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const champs = fs.readdirSync(path.join(root, 'js', 'champions')).filter(function (f) { return f.endsWith('.js'); }).sort().map(function (f) { return 'js/champions/' + f; });
  const files = ['js/core.js', 'js/settings.js'].concat(champs, ['js/items.js', 'js/map.js', 'js/entities.js', 'js/abilities.js', 'js/ai.js', 'js/game.js', 'js/net.js']);
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), 'utf8');
    vm.runInContext(code, sandbox, { filename: f });
  }
  const M = sandbox.MOBA;
  if (!M || !M.Game || !M.Net || !M.Net.snapshot) throw new Error('La simulación no cargó bien');
  return { M: M, root: root };
}
module.exports = { load: load, gameDir: gameDir };
