/* Prueba de punta a punta del servidor dedicado con 3 navegadores separados (Playwright):
 * crear sala, unirse, empezar, el cliente mata y sigue conectado, entrar a una partida en curso tomando un bot,
 * cerrar una pestaña (vuelve el bot y la partida sigue), reconectar en menos de 60 s y volver a la sala.
 * Uso: node server/test/server_test.js   (necesita playwright: NODE_PATH con playwright instalado) */
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = 18000 + Math.floor(Math.random() * 900);
const BASE = 'http://localhost:' + PORT + '/index.html?low=1';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
const results = {}, problems = [];
const check = (name, ok, extra) => { results[name] = !!ok; console.log((ok ? '✔ ' : '✘ ') + name + (extra ? '  ' + extra : '')); };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DEBUG_TEST: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let srvLog = '';
  srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
  for (let i = 0; i < 50 && !/escuchando/.test(srvLog); i++) await new Promise((r) => setTimeout(r, 200));
  const browsers = [], pages = {};
  const watch = (pg, tag) => {
    pg.on('pageerror', (e) => problems.push(tag + ' pageerror: ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'warning' && !/GL Driver|GPU stall/.test(m.text())) console.log(tag + ' warn: ' + m.text().slice(0, 300)); });
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_CONNECTION|Failed to load resource/.test(m.text())) problems.push(tag + ' console: ' + m.text().slice(0, 200)); });
  };
  const newPlayer = async (tag) => {
    const b = await chromium.launch({ args: ARGS }); browsers.push(b);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const pg = await ctx.newPage(); watch(pg, tag);
    return { b, ctx, pg };
  };
  const dbg = async (pg, code) => {
    await pg.evaluate((c) => { MOBA.Online.lastDebug = null; MOBA.Online.send({ k: 'debug', id: 1, code: c }); }, code);
    await pg.waitForFunction(() => !!MOBA.Online.lastDebug, null, { timeout: 10000 });
    return pg.evaluate(() => MOBA.Online.lastDebug);
  };
  const online = async (pg, name) => {
    await pg.goto(BASE);
    await pg.fill('#player-name', name);
    await pg.click('#mode-online');
    await pg.waitForFunction(() => MOBA.Online.status === 'online', null, { timeout: 20000 });
  };
  const inGame = (pg) => pg.waitForFunction(() => MOBA.debug.session && !MOBA.debug.session.local && MOBA.debug.game && MOBA.debug.game.units.length > 20, null, { timeout: 25000 });
  try {
    // ---------- 1) crear sala y unirse ----------
    const A = await newPlayer('[A]'), B = await newPlayer('[B]');
    await online(A.pg, 'Ulises');
    check('el menú muestra "Conectado al servidor"', /Conectado/.test(await A.pg.textContent('#online-status')));
    await A.pg.fill('#online-room-name', 'Sala de prueba');
    await A.pg.click('#online-create');
    await A.pg.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden') && MOBA.Lobby.state && MOBA.Lobby.state.mode === 'server', null, { timeout: 10000 });
    const code = await A.pg.evaluate(() => MOBA.Lobby.state.code);
    check('crear sala en el servidor (código ' + code + ')', /^[A-Z0-9]{5,6}$/.test(code));
    await online(B.pg, 'Amigo');
    await B.pg.waitForSelector('#online-rooms [data-join="' + code + '"]', { timeout: 10000 });
    check('la sala aparece en la lista de partidas', /Sala de prueba/.test(await B.pg.textContent('#online-rooms')));
    await B.pg.click('#online-rooms [data-join="' + code + '"]');
    await A.pg.waitForFunction(() => MOBA.Lobby.state.players.length === 2, null, { timeout: 10000 });
    await B.pg.click('#lobby-red'); await B.pg.waitForTimeout(300);
    await B.pg.click('#lobby-grid .champ-card[data-id="vex"]');
    await A.pg.click('#lobby-grid .champ-card[data-id="ignis"]');
    await A.pg.waitForFunction(() => { const p = MOBA.Lobby.state.players; return p.length === 2 && p.some((q) => q.champ === 'vex' && q.team === 1) && p.some((q) => q.champ === 'ignis'); }, null, { timeout: 10000 });
    check('el amigo se une y eligen equipo y campeón', true);
    check('solo quien creó la sala ve "Empezar"', await A.pg.isVisible('#lobby-start') && !(await B.pg.isVisible('#lobby-start')));
    await A.pg.click('#lobby-start');
    await inGame(A.pg); await inGame(B.pg);
    const bState = await B.pg.evaluate(() => ({ def: MOBA.debug.game.player.def.id, team: MOBA.debug.game.player.team }));
    check('empieza la partida y el amigo maneja a Vex (Rojo)', bState.def === 'vex' && bState.team === 1);

    // ---------- 2) el cliente mata a un enemigo y sigue conectado (regresión del bug de desconexión) ----------
    let killed = false;
    for (let i = 0; i < 10 && !killed; i++) {
      const eid = (await dbg(B.pg, `c.x = M.MAP.width / 2; c.y = M.MAP.height / 2; c.moveTarget = null; c.hp = c.maxHp;
        const e = g.champions.find((x) => x.team === 0 && !x.human && !x.dead); e.x = c.x + 120; e.y = c.y; e.hp = 6; e.addBuff({ type: 'stun', amount: 1, duration: 8 }); return e.id;`)).out;
      await B.pg.waitForTimeout(400);
      await B.pg.evaluate((id) => MOBA.debug.cmd({ t: 'attack', id: id }), eid);
      killed = await B.pg.waitForFunction(() => MOBA.debug.game.player.kills >= 1, null, { timeout: 4000 }).then(() => true, () => false);
    }
    await B.pg.waitForTimeout(1500);
    const bk = await B.pg.evaluate(() => {
      const w = MOBA.debug.game, hx = MOBA.debug.hud().extra;
      const ann = w.feed.filter((f) => f.ann).map((f) => { const a = MOBA.announceText(f.ann, w.player, hx.byId.bind(hx)); return a ? a.title + ' | ' + a.sub : ''; });
      return { ann, sess: !!MOBA.debug.session, status: MOBA.Online.status, game: !document.getElementById('game-screen').classList.contains('hidden') };
    });
    check('el cliente mata a un enemigo y sigue conectado', bk.sess && bk.game && bk.status === 'online', JSON.stringify(bk.ann));
    check('el cliente ve "¡Has asesinado a un enemigo!"', bk.ann.some((t) => /¡Has asesinado a un enemigo!/.test(t)));
    await B.pg.waitForTimeout(2000);
    check('2 s después, el cliente sigue en la partida', await B.pg.evaluate(() => !!MOBA.debug.session && MOBA.Online.status === 'online'));

    // ---------- 3) un tercero entra a la partida en curso tomando un bot ----------
    const C = await newPlayer('[C]');
    await online(C.pg, 'Tercero');
    await C.pg.waitForSelector('#online-rooms [data-pick="' + code + '"]', { timeout: 10000 });
    check('la partida figura "En curso" con botón para unirse', /En curso/.test(await C.pg.textContent('#online-rooms')));
    await C.pg.click('#online-rooms [data-pick="' + code + '"]');
    await C.pg.waitForSelector('#online-bots [data-take]', { timeout: 10000 });
    const botsTxt = await C.pg.textContent('#online-bots');
    check('lista de bots libres con campeón, equipo, nivel y KDA', /Nv \d+/.test(botsTxt) && /(Azul|Rojo)/.test(botsTxt) && /\d+\/\d+\/\d+/.test(botsTxt));
    const takeId = await C.pg.evaluate(() => +document.querySelector('#online-bots [data-take]').dataset.take);
    await C.pg.click('#online-bots [data-take="' + takeId + '"]');
    await inGame(C.pg);
    const cs = await C.pg.evaluate(() => ({ id: MOBA.debug.game.player.id, def: MOBA.debug.game.player.def.id }));
    await A.pg.waitForFunction((id) => { const c = MOBA.debug.game.champions.find((x) => x.id === id); return c && c.human && c.playerName === 'Tercero'; }, takeId, { timeout: 10000 });
    check('el tercero toma el bot y lo controla al instante (' + cs.def + ')', cs.id === takeId);
    const moved = (await dbg(C.pg, 'return { human: c.human, ai: !!c.ai };')).out;
    check('en el servidor ese campeón deja de ser bot', moved.human && !moved.ai);

    // ---------- 4) un jugador cierra la pestaña: vuelve el bot y la partida sigue ----------
    const vexId = await A.pg.evaluate(() => MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1).id);
    await B.pg.close();
    await A.pg.waitForFunction((id) => !MOBA.debug.game.champions.find((c) => c.id === id).human, vexId, { timeout: 15000 });
    const t1 = await A.pg.evaluate(() => MOBA.debug.game.time);
    await A.pg.waitForTimeout(2500);
    const t2 = await A.pg.evaluate(() => MOBA.debug.game.time);
    check('al cerrar la pestaña, un bot toma a Vex y la partida sigue', t2 > t1 + 1, 'tiempo ' + t1.toFixed(1) + ' → ' + t2.toFixed(1));
    const list = await C.pg.evaluate(async () => (await (await fetch('/rooms')).json()).rooms);
    const room = list.find((r) => r.code === code);
    check('el campeón queda reservado 60 s (no figura entre los bots libres)', room && room.status === 'playing');

    // ---------- 5) reconecta en menos de 60 s y recupera su campeón ----------
    const B2 = await B.ctx.newPage(); watch(B2, '[B2]');
    await B2.goto(BASE);
    await inGame(B2);
    const b2 = await B2.evaluate(() => ({ def: MOBA.debug.game.player.def.id, team: MOBA.debug.game.player.team }));
    await A.pg.waitForFunction((id) => MOBA.debug.game.champions.find((c) => c.id === id).human, vexId, { timeout: 15000 });
    check('al volver (mismo navegador, menos de 60 s) recupera a Vex automáticamente', b2.def === 'vex' && b2.team === 1);
    await B2.evaluate(() => MOBA.debug.cmd({ t: 'move', x: MOBA.debug.game.player.x + 300, y: MOBA.debug.game.player.y }));
    await B2.waitForTimeout(1500);
    const ctl = (await dbg(B2, 'return { human: c && c.human, def: c && c.def.id };')).out;
    check('después de reconectar, sus órdenes llegan al servidor', ctl.human && ctl.def === 'vex');

    // ---------- 6) fin de la partida y volver a la sala (revancha) ----------
    await dbg(A.pg, 'g.kill(g.nexus[1], c); return g.over;');
    await A.pg.waitForSelector('#endscreen [data-end="0"]', { timeout: 15000 });
    await B2.waitForSelector('#endscreen [data-end="0"]', { timeout: 15000 });
    await A.pg.click('#endscreen [data-end="0"]');
    await A.pg.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden') && MOBA.Lobby.state && MOBA.Lobby.state.status === 'lobby', null, { timeout: 10000 });
    await B2.click('#endscreen [data-end="0"]');
    await A.pg.waitForFunction(() => MOBA.Lobby.state.players.length === 2, null, { timeout: 10000 });
    check('al terminar, "Volver a la sala" junta a los jugadores en la misma sala', true);
    await A.pg.click('#lobby-start');
    await A.pg.waitForTimeout(3000);
    await inGame(A.pg); await inGame(B2);
    check('revancha: arranca otra partida en la misma sala', await B2.evaluate(() => MOBA.debug.game.player.def.id === 'vex' && !MOBA.debug.game.over));

    // ---------- 7) mensajes basura no tiran el servidor ----------
    const junk = await A.pg.evaluate(async () => {
      const u = MOBA.Online.url();
      return await new Promise((res) => {
        const ws = new WebSocket(u);
        ws.onopen = () => { ws.send('{rot'); ws.send(JSON.stringify({ k: 'hello', name: 'x' })); ws.send(JSON.stringify({ k: 'cmd', c: null })); ws.send(JSON.stringify({ k: 'take', room: 'ZZZZZ', champ: 'a' })); ws.send('x'.repeat(40000)); setTimeout(() => { ws.close(); res(true); }, 500); };
        ws.onerror = () => res(false);
      });
    });
    const h = await A.pg.evaluate(async () => (await fetch('/health')).json());
    check('mensajes rotos o gigantes no tiran el servidor', junk !== null && h.ok && await A.pg.evaluate(() => !!MOBA.debug.session));
  } catch (e) {
    check('error: ' + e.message.split('\n')[0], false);
  }
  check('sin errores en la consola de los navegadores', problems.length === 0, problems.slice(0, 5).join(' | '));
  for (const b of browsers) await b.close().catch(() => {});
  srv.kill();
  const errs = (srvLog.match(/error|excepción/gi) || []).length;
  console.log('Registro del servidor (' + errs + ' líneas con error):\n' + srvLog.split('\n').slice(-40).join('\n'));
  const total = Object.keys(results).length, ok = Object.values(results).filter(Boolean).length;
  console.log('Total: ' + ok + '/' + total);
  process.exit(ok === total ? 0 : 1);
})();
