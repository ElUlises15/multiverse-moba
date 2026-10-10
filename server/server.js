/* Servidor dedicado de Browser Multiverse MOBA.
 * - Simula las partidas (la misma lógica que el navegador, cargada con sim.js) a ritmo fijo y manda "fotos" por equipo
 *   (con niebla de guerra) a cada jugador por WebSocket.
 * - Salas: lista pública, crear, unirse, elegir equipo y campeón, empezar, volver a la sala (revancha).
 * - Partidas en curso: cualquiera puede entrar tomando un campeón manejado por un bot. Si alguien se va, vuelve el bot.
 *   La partida sigue aunque se vayan todos (se cierra a los 2 minutos sin humanos).
 * - Reconexión: con el token guardado en el navegador, en menos de 60 s recuperás tu campeón.
 * - Robusto: mensajes JSON con tamaño máximo, try/catch en todo, latido ping/pong, cada partida aislada. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { load } = require('./sim.js');

const { M, root: GAME_ROOT } = load();
const Net = M.Net;

const PORT = parseInt(process.env.PORT, 10) || 8080;
const TICK_HZ = 30;                 // ritmo de la simulación (cada tick = 2 pasos de 1/60 s, como en el navegador)
const STEP = 1 / 60;
const SNAP_HZ = 20;                 // fotos por segundo
const RECONNECT_S = 60;             // tiempo para volver con el mismo campeón
const EMPTY_MATCH_S = 120;          // partida sin humanos: se cierra
const ENDED_ROOM_S = 600;           // sala terminada sin que nadie vuelva
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS, 10) || 30;
const MAX_MSG = 32 * 1024;          // tamaño máximo de un mensaje recibido
const MAX_MSGS_PER_SEC = 80;
const SERVE_STATIC = process.env.SERVE_STATIC !== '0';
const DEFAULT_ORIGINS = ['https://elulises15.github.io'];
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).concat(DEFAULT_ORIGINS);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const now = () => Date.now();
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

// ======================================================================= estado
const players = new Map();          // id -> jugador
const tokens = new Map();           // token -> jugador
const rooms = new Map();            // código -> sala

function newId() { return 'p' + crypto.randomBytes(5).toString('hex'); }
function newToken() { return crypto.randomBytes(18).toString('base64url'); }
function newCode() { for (let i = 0; i < 50; i++) { const c = Net.makeCode(); if (!rooms.has(c)) return c; } return Net.makeCode() + Math.floor(Math.random() * 9); }

function send(p, msg) {
  if (!p || !p.ws || p.ws.readyState !== 1) return false;
  let str;
  try { str = JSON.stringify(msg); } catch (e) { log('mensaje no serializable', e.message); return false; }
  try { p.ws.send(str); return true; } catch (e) { log('envío fallido', e.message); return false; }
}
function sendError(p, text) { send(p, { k: 'error', text: text }); }

// ======================================================================= salas
function roomSummary(r) {
  const teams = [{ humans: 0, bots: 0 }, { humans: 0, bots: 0 }];
  if (r.game) for (const c of r.game.champions) teams[c.team][c.human ? 'humans' : 'bots']++;
  else { for (const q of r.players) teams[q.team].humans++; teams[0].bots = 5 - teams[0].humans; teams[1].bots = 5 - teams[1].humans; }
  const owner = players.get(r.owner);
  return { code: r.code, name: r.name, owner: owner ? owner.name : (r.ownerName || ''), status: r.status, teams: teams,
    elapsed: r.game ? Math.floor(r.game.time) : 0, score: r.game ? r.game.score : [0, 0],
    free: r.game && r.status === 'playing' ? freeBots(r).length : 0 };
}
function roomList() { return Array.from(rooms.values()).map(roomSummary); }
function lobbyState(r) { return { code: r.code, name: r.name, mode: 'server', owner: r.owner, status: r.status, players: r.players.map((q) => ({ id: q.id, name: q.name, team: q.team, champ: q.champ })) }; }
function broadcastLobby(r) { for (const q of r.players) { const p = players.get(q.id); if (p && p.room === r.code) send(p, { k: 'lobby', state: lobbyState(r), you: q.id }); } }

function createRoom(p, name) {
  if (rooms.size >= MAX_ROOMS) return sendError(p, 'El servidor está lleno (' + MAX_ROOMS + ' salas). Probá en un rato.');
  leaveRoom(p, true);
  const code = newCode();
  const r = { code: code, name: clean(name, 28) || ('Sala de ' + p.name), owner: p.id, ownerName: p.name, status: 'lobby', players: [], game: null,
    clients: {}, reserved: {}, createdAt: now(), startedAt: 0, emptySince: 0, endedAt: 0, acc: 0, snapAcc: 0, lastTick: 0, errors: 0 };
  rooms.set(code, r);
  log('sala creada', code, 'por', p.name);
  joinLobby(p, r);
}
function joinLobby(p, r, team, champ) {
  if (r.status !== 'lobby') return sendError(p, 'Esa partida ya empezó: podés entrar tomando un bot.');
  if (r.players.length >= 10) return sendError(p, 'La sala está llena (10 jugadores).');
  if (p.room && p.room !== r.code) leaveRoom(p, true);
  if (!r.players.some((q) => q.id === p.id)) {
    const blue = r.players.filter((q) => q.team === 0).length;
    const t = team === 0 || team === 1 ? team : (blue <= r.players.length - blue ? 0 : 1);
    const q = { id: p.id, name: p.name, team: t, champ: null };
    if (champ && M.championById[champ] && !r.players.some((o) => o.team === t && o.champ === champ)) q.champ = champ;
    r.players.push(q);
  }
  p.room = r.code; p.champId = 0;
  if (!players.get(r.owner) || !r.players.some((q) => q.id === r.owner)) { r.owner = p.id; r.ownerName = p.name; }
  broadcastLobby(r);
}
function lobbyRequest(p, r, msg) {
  const q = r.players.find((o) => o.id === p.id);
  if (!q || r.status !== 'lobby') return;
  if (msg.k === 'team') {
    const t = msg.team === 1 ? 1 : 0;
    if (r.players.filter((o) => o.team === t && o !== q).length < 5) q.team = t;
    if (q.champ && r.players.some((o) => o !== q && o.team === q.team && o.champ === q.champ)) q.champ = null;
  } else if (msg.k === 'pick') {
    const def = M.championById[msg.champ];
    if (def && !r.players.some((o) => o !== q && o.team === q.team && o.champ === def.id)) q.champ = def.id;
  } else if (msg.k === 'name') { q.name = p.name; }
  broadcastLobby(r);
}

function champsList(g) { return g.champions.map((c) => ({ i: c.id, df: c.def.id, tm: c.team, hu: c.human ? 1 : 0, nm: c.playerName || '', slot: c.human ? c.slot : null })); }
function startMsg(r, p) { return { k: 'start', slot: p.id, champs: champsList(r.game), code: r.code, name: r.name, server: true, inProgress: r.game.time > 1 }; }

function startMatch(p, r) {
  if (r.owner !== p.id) return sendError(p, 'Solo quien creó la sala puede empezar.');
  if (r.status !== 'lobby') return;
  const used = [{}, {}];
  r.players.forEach((q) => { if (q.champ) used[q.team][q.champ] = true; });
  const roster = r.players.map((q) => {
    let champ = q.champ;
    if (!champ) {
      const free = M.champions.filter((c) => !used[q.team][c.id]);
      champ = (free[Math.floor(Math.random() * free.length)] || M.champions[0]).id;
      used[q.team][champ] = true;
    }
    return { defId: champ, team: q.team, human: true, slot: q.id, name: q.name };
  });
  const game = new M.Game({ roster: M.Game.fillWithBots(roster), localSlot: '__servidor__' });
  game.onGameOver = function (winner) { r.status = 'ended'; r.endedAt = now(); log('partida terminada', r.code, 'ganó', winner); };
  r.game = game; r.status = 'playing'; r.startedAt = now(); r.acc = 0; r.snapAcc = 0; r.lastTick = now(); r.errors = 0; r.reserved = {}; r.clients = {}; r.emptySince = 0;
  for (const q of r.players) {
    const pl = players.get(q.id);
    const c = game.humans[q.id];
    if (!c) continue;
    if (!pl || pl.room !== r.code || !pl.ws) { toBot(r, c, pl ? pl.id : q.id, true); continue; }
    attach(r, pl, c);
  }
  log('partida empezada', r.code, r.players.length, 'humanos');
}
/** El jugador p maneja al campeón c (que tiene que estar libre). */
function attach(r, p, c) {
  const g = r.game;
  for (const s in g.humans) if (g.humans[s] === c && s !== p.id) delete g.humans[s];
  c.human = true; c.isPlayer = true; c.ai = null; c.slot = p.id; c.playerName = p.name;
  c.target = null; c.moveTarget = null; c.attackMove = false; c.autoTarget = false;
  g.humans[p.id] = c;
  delete r.reserved[c.id];
  r.clients[p.id] = { champId: c.id, team: c.team, since: { fx: g.seq, tx: g.seq, fd: g.seq } };
  p.room = r.code; p.champId = c.id;
  send(p, startMsg(r, p));
}
/** Un bot vuelve a manejar al campeón c. reserveFor: el jugador que puede volver en 60 s. */
function toBot(r, c, reserveFor, silent) {
  const g = r.game;
  if (!c) return;
  if (c.human) {
    if (!silent) g.addFeed((c.playerName || 'Un jugador') + (reserveFor ? ' se desconectó: lo maneja un bot hasta que vuelva' : ' salió: lo reemplaza un bot'), '#ffb070');
    for (const s in g.humans) if (g.humans[s] === c) delete g.humans[s];
    c.human = false; c.isPlayer = false; c.slot = null;
    c.ai = new M.BotAI(c); M.BotAI.levelUp(c);
  }
  if (reserveFor) r.reserved[c.id] = { player: reserveFor, until: now() + RECONNECT_S * 1000 };
}
function freeBots(r) {
  const g = r.game, t = now();
  if (!g) return [];
  return g.champions.filter((c) => !c.human && !(r.reserved[c.id] && r.reserved[c.id].until > t))
    .map((c) => ({ i: c.id, df: c.def.id, name: c.def.name, tm: c.team, lv: c.level, k: c.kills, d: c.deaths, a: c.assists, dead: c.dead ? 1 : 0 }));
}
function takeBot(p, r, champId) {
  if (!r.game || r.status !== 'playing') return sendError(p, 'Esa partida no está en curso.');
  const c = r.game.champions.find((x) => x.id === (champId | 0));
  const res = c && r.reserved[c.id];
  if (!c || c.human || (res && res.until > now() && res.player !== p.id)) return sendError(p, 'Ese campeón ya no está libre. Elegí otro.');
  if (p.room && p.room !== r.code) leaveRoom(p, true);
  if (p.room === r.code && p.champId) { const old = r.game.champions.find((x) => x.id === p.champId); if (old && old !== c) toBot(r, old, null); }
  attach(r, p, c);
  r.game.addFeed(p.name + ' entró a la partida con ' + c.def.name, '#8fd3ff');
  log('entró a partida en curso', r.code, p.name, c.def.id);
}
/** El jugador sale de su sala o partida. */
function leaveRoom(p, quiet) {
  const r = p.room && rooms.get(p.room);
  p.room = null;
  if (!r) return;
  const champId = p.champId; p.champId = 0;
  r.players = r.players.filter((q) => q.id !== p.id);
  delete r.clients[p.id];
  if (r.game) {
    const c = r.game.champions.find((x) => x.id === champId);
    if (c && c.human && c.slot === p.id) toBot(r, c, null);
    for (const id in r.reserved) if (r.reserved[id].player === p.id) delete r.reserved[id];
  }
  if (r.owner === p.id) { const nx = r.players[0]; if (nx) { r.owner = nx.id; r.ownerName = nx.name; } }
  if (r.status === 'lobby') { if (!r.players.length) closeRoom(r, null); else broadcastLobby(r); }
}
function closeRoom(r, text) {
  rooms.delete(r.code);
  for (const p of players.values()) if (p.room === r.code) { p.room = null; p.champId = 0; if (text) send(p, { k: 'closed', text: text }); }
  log('sala cerrada', r.code, text || '');
}
/** Revancha: volver a la sala después de la partida. */
function backToRoom(p) {
  const r = p.room && rooms.get(p.room);
  if (!r) return sendError(p, 'La sala ya no existe.');
  if (r.status === 'playing') return;
  if (r.status === 'ended') {
    const old = r.game;
    r.status = 'lobby'; r.game = null; r.clients = {}; r.reserved = {};
    const prev = old && old.champions.find((c) => c.id === p.champId);
    r.lastTeams = {};
    if (old) for (const c of old.champions) if (c.human) r.lastTeams[c.slot] = { team: c.team, champ: c.def.id };
    if (prev) r.lastTeams[p.id] = { team: prev.team, champ: prev.def.id };
    r.players = []; r.owner = p.id; r.ownerName = p.name;
  }
  const last = (r.lastTeams && r.lastTeams[p.id]) || {};
  p.room = null;
  joinLobby(p, r, last.team, last.champ);
}

// ======================================================================= simulación
function tickRoom(r, t) {
  const g = r.game;
  if (!g) return;
  const dt = Math.min(0.25, (t - (r.lastTick || t)) / 1000);
  r.lastTick = t;
  if (!g.over) {
    r.acc += dt;
    let n = 0;
    while (r.acc >= STEP && n < 20) { g.update(STEP); r.acc -= STEP; n++; }
    if (n >= 20) r.acc = 0;
  }
  r.snapAcc += dt;
  if (r.snapAcc >= 1 / SNAP_HZ) {
    r.snapAcc = 0;
    const snaps = {};
    for (const pid in r.clients) {
      const cl = r.clients[pid], p = players.get(pid);
      if (!p || !p.ws || p.ws.readyState !== 1 || p.room !== r.code) continue;
      try {
        const s = snaps[cl.team] || (snaps[cl.team] = Net.snapshot(g, cl.team));
        let ev;
        try { ev = Net.events(g, cl.champId, cl.since); } catch (e) { ev = { fx: [], tx: [], fd: [] }; }
        cl.since = { fx: g.seq, tx: g.seq, fd: g.seq };
        if (p.ws.bufferedAmount > 2e6) continue;          // conexión lenta: se saltea esta foto
        const str = Net.encode({ k: 's', s: s, e: ev });
        if (str) p.ws.send(str);
      } catch (e) { log('foto fallida', r.code, pid, e.message); }
    }
  }
}
function housekeeping(t) {
  for (const r of rooms.values()) {
    // reservas vencidas: el jugador ya no vuelve
    for (const id in r.reserved) if (r.reserved[id].until <= t) {
      const pl = players.get(r.reserved[id].player);
      if (pl && pl.room === r.code && (!pl.ws || pl.ws.readyState !== 1)) { pl.room = null; pl.champId = 0; }
      delete r.reserved[id];
    }
    if (r.status === 'lobby') {
      // jugadores desconectados hace más de 60 s salen de la sala
      for (const q of r.players.slice()) { const pl = players.get(q.id); if (!pl || (!pl.ws && t - pl.lostAt > RECONNECT_S * 1000)) { r.players = r.players.filter((o) => o !== q); if (pl) pl.room = null; } }
      if (!r.players.length) { closeRoom(r, null); continue; }
      if (!r.players.some((q) => q.id === r.owner)) { r.owner = r.players[0].id; r.ownerName = r.players[0].name; broadcastLobby(r); }
    }
    if (r.status === 'playing') {
      const humans = r.game.champions.some((c) => c.human) || Object.keys(r.reserved).length > 0;
      if (humans) r.emptySince = 0;
      else if (!r.emptySince) r.emptySince = t;
      else if (t - r.emptySince > EMPTY_MATCH_S * 1000) closeRoom(r, 'La partida se cerró porque no quedaban jugadores.');
    }
    if (r.status === 'ended' && t - r.endedAt > ENDED_ROOM_S * 1000) closeRoom(r, null);
  }
  // jugadores sin conexión hace mucho: se olvidan
  for (const p of players.values()) if (!p.ws && !p.room && t - p.lostAt > RECONNECT_S * 1000 * 2) { players.delete(p.id); tokens.delete(p.token); }
}
let lastHouse = 0;
setInterval(function () {
  const t = now();
  for (const r of Array.from(rooms.values())) {
    try { tickRoom(r, t); r.errors = 0; }
    catch (e) {
      // una partida rota no frena a las demás; si falla seguido, se cierra
      r.errors++;
      if (r.errors === 1 || r.errors % 30 === 0) log('error en la partida', r.code, e && e.stack || e);
      if (r.errors > 90) closeRoom(r, 'La partida tuvo un error y se cerró. Perdón.');
    }
  }
  if (t - lastHouse > 1000) { lastHouse = t; try { housekeeping(t); } catch (e) { log('error de mantenimiento', e && e.stack || e); } }
}, 1000 / TICK_HZ);

// ======================================================================= mensajes
function onMessage(p, raw) {
  if (raw.length > MAX_MSG) return;
  const t = now();
  if (t - p.rateAt > 1000) { p.rateAt = t; p.rateN = 0; }
  if (++p.rateN > MAX_MSGS_PER_SEC) return;
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  if (!msg || typeof msg !== 'object' || typeof msg.k !== 'string') return;
  p.lastSeen = t;
  const r = p.room ? rooms.get(p.room) : null;
  switch (msg.k) {
    case 'ping': send(p, { k: 'pong', t: msg.t }); return;
    case 'name': p.name = clean(msg.name, 16) || p.name; if (r && r.status === 'lobby') lobbyRequest(p, r, msg); return;
    case 'list': send(p, { k: 'rooms', rooms: roomList() }); return;
    case 'create': createRoom(p, msg.name); return;
    case 'join': { const rr = rooms.get(Net.cleanCode(msg.room)); if (!rr) return sendError(p, 'Esa sala ya no existe.'); joinLobby(p, rr); return; }
    case 'bots': { const rr = rooms.get(Net.cleanCode(msg.room)); send(p, { k: 'bots', room: msg.room, list: rr ? freeBots(rr) : [], status: rr ? rr.status : 'gone' }); return; }
    case 'take': { const rr = rooms.get(Net.cleanCode(msg.room)); if (!rr) return sendError(p, 'Esa sala ya no existe.'); takeBot(p, rr, msg.champ); return; }
    case 'team': case 'pick': if (r) lobbyRequest(p, r, msg); return;
    case 'start': if (r) startMatch(p, r); return;
    case 'leave': leaveRoom(p); return;
    case 'back': backToRoom(p); return;
    case 'debug': {
      // solo para los tests automáticos (DEBUG_TEST=1): ejecuta código en la partida del jugador
      if (process.env.DEBUG_TEST !== '1' || !r || !r.game) return;
      try {
        const fn = new Function('r', 'g', 'c', 'M', String(msg.code || ''));
        const out = fn(r, r.game, r.game.humans[p.id] || null, M);
        send(p, { k: 'debug', id: msg.id, out: out === undefined ? null : out });
      } catch (e) { send(p, { k: 'debug', id: msg.id, error: e.message }); }
      return;
    }
    case 'cmd': {
      if (!r || !r.game || !msg.c || typeof msg.c !== 'object') return;
      const c = r.game.humans[p.id];
      if (!c) return;
      let err = null;
      try { err = r.game.command(c, msg.c); } catch (e) { log('orden fallida', r.code, msg.c.t, e.message); return; }
      if (err && err !== 'no' && (msg.c.t === 'buy' || msg.c.t === 'sell' || msg.c.t === 'buyPartial')) send(p, { k: 'msg', text: String(err), shop: msg.c.t === 'buyPartial' });
      return;
    }
  }
}
/** Primer mensaje: nombre y token (para reconectar). */
function onHello(ws, msg, req) {
  let p = null, resumed = false;
  const tok = typeof msg.token === 'string' ? msg.token : '';
  const old = tok && tokens.get(tok);
  if (old && (!old.ws || old.ws.readyState !== 1 || now() - old.lastSeen > 15000)) {
    // reconexión: mismo jugador
    if (old.ws && old.ws !== ws) { try { old.ws.terminate(); } catch (e) { /* nada */ } }
    p = old; resumed = true;
  } else {
    p = { id: newId(), token: newToken(), name: 'Invocador', ws: null, room: null, champId: 0, lastSeen: now(), lostAt: 0, rateAt: 0, rateN: 0 };
    players.set(p.id, p); tokens.set(p.token, p);
  }
  p.ws = ws; ws.player = p; p.lostAt = 0; p.lastSeen = now();
  p.name = clean(msg.name, 16) || p.name;
  send(p, { k: 'welcome', id: p.id, token: p.token, resumed: resumed, rooms: roomList() });
  if (!resumed || !p.room) return;
  const r = rooms.get(p.room);
  if (!r) { p.room = null; return; }
  if (r.status === 'lobby') { broadcastLobby(r); return; }
  if (r.game && (r.status === 'playing' || r.status === 'ended')) {
    const c = r.game.champions.find((x) => x.id === p.champId);
    const res = c && r.reserved[c.id];
    if (c && !c.human && res && res.player === p.id) { attach(r, p, c); r.game.addFeed(p.name + ' volvió a la partida', '#8fd3ff'); log('reconectó', r.code, p.name); }
    else if (c && c.human && c.slot === p.id) attach(r, p, c);
    else { p.room = null; p.champId = 0; send(p, { k: 'closed', text: 'Tardaste más de 60 s en volver: tu campeón ya lo maneja un bot o lo tomó otro jugador. Podés entrar de nuevo desde la lista.' }); }
  }
}
function onClose(p) {
  if (!p) return;
  p.ws = null; p.lostAt = now();
  const r = p.room && rooms.get(p.room);
  if (!r) return;
  if (r.game && r.status === 'playing' && p.champId) {
    const c = r.game.champions.find((x) => x.id === p.champId);
    if (c && c.human && c.slot === p.id) toBot(r, c, p.id);
    delete r.clients[p.id];
  } else if (r.status === 'lobby') broadcastLobby(r);
}

// ======================================================================= HTTP (salud, lista, archivos del juego)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const STATIC_DIRS = ['js', 'css', 'assets', 'vendor', 'dist', 'screenshots'];
function originOk(origin, host) {
  if (!origin) return true;                                      // herramientas sin navegador
  if (ALLOWED.indexOf('*') >= 0 || ALLOWED.indexOf(origin) >= 0) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') return true;
    if (host && u.host === host) return true;                    // la misma dirección que sirve el juego
  } catch (e) { /* nada */ }
  return false;
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && originOk(o, req.headers.host)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
}
const server = http.createServer(function (req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    cors(req, res);
    if (p === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: Array.from(players.values()).filter((q) => q.ws).length, uptime: Math.round(process.uptime()) }));
      return;
    }
    if (p === '/rooms') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ rooms: roomList() })); return; }
    if (!SERVE_STATIC) { res.writeHead(404); res.end('Servidor de Browser Multiverse MOBA. Probá /health'); return; }
    // config.js: el juego servido desde acá usa este mismo servidor
    if (p === '/js/config.js') {
      const file = fs.readFileSync(path.join(GAME_ROOT, 'js', 'config.js'), 'utf8');
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
      res.end(file + '\nwindow.MOBA.CONFIG.SAME_ORIGIN_SERVER = true;\n');
      return;
    }
    let rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    if (rel === 'favicon.ico') rel = 'favicon.svg';
    const top = rel.split('/')[0];
    if (!(rel === 'index.html' || rel === 'favicon.svg' || STATIC_DIRS.indexOf(top) >= 0)) { res.writeHead(404); res.end('No encontrado'); return; }
    const file = path.resolve(GAME_ROOT, rel);
    if (!file.startsWith(path.resolve(GAME_ROOT) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': rel === 'index.html' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).on('error', function () { try { res.end(); } catch (e) { /* nada */ } }).pipe(res);
  } catch (e) {
    try { res.writeHead(500); res.end('Error'); } catch (x) { /* nada */ }
  }
});

const wss = new WebSocketServer({
  server: server, path: '/ws', maxPayload: MAX_MSG, perMessageDeflate: false,
  verifyClient: function (info) { return originOk(info.origin, info.req.headers.host); }
});
wss.on('connection', function (ws, req) {
  ws.isAlive = true;
  ws.on('pong', function () { ws.isAlive = true; if (ws.player) ws.player.lastSeen = now(); });
  ws.on('message', function (data) {
    try {
      const raw = data.toString();
      if (!ws.player) {
        let msg = null;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        if (msg && msg.k === 'hello') onHello(ws, msg, req);
        return;
      }
      onMessage(ws.player, raw);
    } catch (e) { log('error con un mensaje', e && e.stack || e); }
  });
  ws.on('close', function () { try { if (ws.player && ws.player.ws === ws) onClose(ws.player); } catch (e) { log('error al cerrar', e && e.stack || e); } });
  ws.on('error', function () { /* lo maneja close */ });
});
// latido: conexiones muertas se cierran (y su campeón pasa a un bot)
setInterval(function () {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { try { ws.terminate(); } catch (e) { /* nada */ } continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* nada */ }
  }
}, 10000);
// lista de salas para quienes están mirando el menú
setInterval(function () {
  const list = roomList();
  for (const p of players.values()) if (p.ws && !p.room && p.ws.readyState === 1) send(p, { k: 'rooms', rooms: list });
}, 2000);

process.on('uncaughtException', function (e) { log('excepción no atrapada (el servidor sigue):', e && e.stack || e); });
process.on('unhandledRejection', function (e) { log('promesa rechazada (el servidor sigue):', e && e.stack || e); });

wss.on('error', function (e) { log('no se pudo abrir el puerto ' + PORT + ':', e.message); process.exit(1); });
server.on('error', function (e) { log('no se pudo abrir el puerto ' + PORT + ':', e.message); process.exit(1); });
server.listen(PORT, function () { log('Servidor de Browser Multiverse MOBA escuchando en el puerto ' + PORT + ' (juego en ' + GAME_ROOT + ')'); });
module.exports = { server: server, rooms: rooms, players: players };
