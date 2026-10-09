/* Multijugador P2P (anfitrión autoritativo).
 * - El anfitrión corre la simulación (M.Game) y manda "fotos" (snapshots) del mundo 20 veces por segundo.
 * - Los demás mandan solo órdenes (mover, atacar, lanzar, comprar…) y dibujan el mundo interpolado.
 * - Transporte: WebRTC con PeerJS (servidor público gratuito de PeerJS solo para el "apretón de manos"),
 *   o BroadcastChannel (pestañas del mismo navegador, sin internet) como alternativa local. */
(function (M) {
  'use strict';
  const U = M.util;
  const Net = M.Net = {};
  Net.PREFIX = 'mvmoba-r4-';
  Net.SNAPSHOT_HZ = 20;
  Net.INTERP = 0.1;          // segundos de retraso de interpolación en los clientes
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  Net.makeCode = function () { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
  Net.cleanCode = function (c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); };
  Net.peerAvailable = function () { return typeof window.peerjs !== 'undefined' && !!window.peerjs.Peer; };

  // ======================= Transportes =======================
  /** Anfitrión con PeerJS. handlers: { ready(code), join(id), message(id, msg), leave(id), error(text) } */
  function PeerHost(code, h) {
    const self = this;
    this.conns = {};
    this.kind = 'peer';
    const peer = this.peer = new window.peerjs.Peer(Net.PREFIX + code, { debug: 0 });
    peer.on('open', function () { h.ready(code); });
    peer.on('connection', function (conn) {
      conn.on('open', function () { self.conns[conn.peer] = conn; h.join(conn.peer); });
      conn.on('data', function (d) { h.message(conn.peer, typeof d === 'string' ? JSON.parse(d) : d); });
      conn.on('close', function () { delete self.conns[conn.peer]; h.leave(conn.peer); });
      conn.on('error', function () { delete self.conns[conn.peer]; h.leave(conn.peer); });
    });
    peer.on('error', function (e) { h.error(Net.peerError(e)); });
    window.addEventListener('pagehide', function () { self.close(); });
  }
  PeerHost.prototype.send = function (id, msg) { const c = this.conns[id]; if (c && c.open) c.send(JSON.stringify(msg)); };
  PeerHost.prototype.close = function () { try { this.peer.destroy(); } catch (e) { /* nada */ } };

  /** Cliente con PeerJS. handlers: { open(), message(msg), close(), error(text) } */
  function PeerClient(code, h) {
    const self = this;
    this.kind = 'peer';
    const peer = this.peer = new window.peerjs.Peer({ debug: 0 });
    let opened = false;
    peer.on('open', function () {
      const conn = self.conn = peer.connect(Net.PREFIX + code, { reliable: true, serialization: 'raw' });
      conn.on('open', function () { opened = true; h.open(); });
      conn.on('data', function (d) { h.message(typeof d === 'string' ? JSON.parse(d) : d); });
      conn.on('close', function () { h.close(); });
      conn.on('error', function (e) { h.error(Net.peerError(e)); });
    });
    window.addEventListener('pagehide', function () { self.close(); });
    peer.on('error', function (e) { h.error(opened ? Net.peerError(e) : (e && e.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : Net.peerError(e))); });
  }
  PeerClient.prototype.send = function (msg) { if (this.conn && this.conn.open) this.conn.send(JSON.stringify(msg)); };
  PeerClient.prototype.close = function () { try { this.peer.destroy(); } catch (e) { /* nada */ } };
  Net.peerError = function (e) {
    const t = e && e.type;
    if (t === 'unavailable-id') return 'Ese código de sala ya está en uso. Probá de nuevo.';
    if (t === 'peer-unavailable') return 'No existe una sala con ese código (o el anfitrión se fue).';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo conectar con el servidor de PeerJS. ¿Hay internet? Podés probar el modo local (misma compu).';
    if (t === 'browser-incompatible') return 'Este navegador no soporta WebRTC.';
    return 'Error de conexión: ' + (t || (e && e.message) || e);
  };

  /** Transporte local con BroadcastChannel (pestañas del mismo navegador). */
  function LocalHost(code, h) {
    const self = this;
    this.kind = 'local'; this.peers = {};
    const ch = this.ch = new BroadcastChannel(Net.PREFIX + code);
    ch.onmessage = function (ev) {
      const m = ev.data;
      if (!m || m.to !== 'host') return;
      if (m.type === 'hello') { self.peers[m.from] = performance.now(); ch.postMessage({ to: m.from, type: 'welcome' }); h.join(m.from); }
      else if (m.type === 'bye') { if (self.peers[m.from]) { delete self.peers[m.from]; h.leave(m.from); } }
      else if (self.peers[m.from]) { self.peers[m.from] = performance.now(); if (m.type === 'data') h.message(m.from, m.data); }
    };
    // sin noticias de una pestaña en 6 s = se fue (por si se cerró sin avisar)
    this.watch = setInterval(function () {
      const now = performance.now();
      for (const id in self.peers) if (now - self.peers[id] > 6000) { delete self.peers[id]; h.leave(id); }
    }, 1000);
    this.onHide = function () { self.close(); };
    window.addEventListener('pagehide', this.onHide);
    setTimeout(function () { h.ready(code); }, 0);
  }
  LocalHost.prototype.send = function (id, msg) { this.ch.postMessage({ to: id, type: 'data', data: msg }); };
  LocalHost.prototype.close = function () {
    if (this.closed) return;
    this.closed = true; clearInterval(this.watch); window.removeEventListener('pagehide', this.onHide);
    try { this.ch.postMessage({ to: '*', type: 'closed' }); this.ch.close(); } catch (e) { /* nada */ }
  };
  function LocalClient(code, h) {
    const self = this;
    this.kind = 'local';
    this.id = 'p' + Math.random().toString(36).slice(2, 9);
    const ch = this.ch = new BroadcastChannel(Net.PREFIX + code);
    let open = false;
    ch.onmessage = function (ev) {
      const m = ev.data;
      if (!m || (m.to !== self.id && m.to !== '*')) return;
      if (m.type === 'welcome' && !open) { open = true; h.open(); }
      else if (m.type === 'data') h.message(m.data);
      else if (m.type === 'closed') h.close();
    };
    ch.postMessage({ to: 'host', from: this.id, type: 'hello' });
    this.ping = setInterval(function () { if (open) ch.postMessage({ to: 'host', from: self.id, type: 'ping' }); }, 1000);
    this.onHide = function () { self.close(); };
    window.addEventListener('pagehide', this.onHide);
    setTimeout(function () { if (!open && !self.closed) h.error('No existe una sala local con ese código (abrila en otra pestaña de este navegador).'); }, 2500);
  }
  LocalClient.prototype.send = function (msg) { this.ch.postMessage({ to: 'host', from: this.id, type: 'data', data: msg }); };
  LocalClient.prototype.close = function () {
    if (this.closed) return;
    this.closed = true; clearInterval(this.ping); window.removeEventListener('pagehide', this.onHide);
    try { this.ch.postMessage({ to: 'host', from: this.id, type: 'bye' }); this.ch.close(); } catch (e) { /* nada */ }
  };

  Net.createHost = function (mode, code, h) { return mode === 'local' ? new LocalHost(code, h) : new PeerHost(code, h); };
  Net.createClient = function (mode, code, h) { return mode === 'local' ? new LocalClient(code, h) : new PeerClient(code, h); };

  // ======================= Fotos del mundo =======================
  const TYPE = { champion: 'c', minion: 'm', tower: 't', nexus: 'n', monster: 'j' };
  const TYPE_R = { c: 'champion', m: 'minion', t: 'tower', n: 'nexus', j: 'monster' };
  const r1 = function (v) { return Math.round(v); };
  const r2 = function (v) { return Math.round(v * 100) / 100; };

  function packUnit(g, u, team) {
    const o = { i: u.id, y: TYPE[u.type], tm: u.team, h: r1(u.hp), H: r1(u.maxHp), d: u.dead ? 1 : 0 };
    const hidden = u.hiddenFrom && u.hiddenFrom[team];
    if (u.type === 'champion') {
      o.df = u.def.id; o.lv = u.level; o.K = u.kills; o.D = u.deaths; o.A = u.assists; o.cs = u.cs;
      o.g = r1(u.gold); o.it = u.items; o.hu = u.human ? 1 : 0; o.nm = u.playerName || '';
      o.rt = r2(u.respawnTimer);
      if (hidden) { o.hid = 1; return o; }
      o.mn = r1(u.mana); o.MM = r1(u.maxMana); o.xp = r1(u.xp); o.rk = u.ranks; o.sp = u.skillPoints;
      o.cd = u.cds.map(r2); o.rc = u.recalling ? r2(u.recalling.t) : 0;
      o.ad = r1(u.ad); o.ap = r1(u.ap); o.ar = r1(u.getArmor()); o.mr = r1(u.getMr()); o.as = r2(u.getAttackSpeed());
      o.ms = r1(u.getMoveSpeed()); o.cr = r2(u.critChance); o.hs = r1(u.haste); o.ls = r2(u.getLifesteal()); o.rg = u.attackRange;
      o.sh = r1(u.shieldAmount()); o.ca = r2(u.castAt == null ? -9 : u.castAt); o.cS = u.castSlot || 0; o.co = u.championsOnly ? 1 : 0;
    } else if (hidden) return null;
    o.x = r1(u.x); o.yy = r1(u.y); o.f = r2(u.facing);
    if (u.type !== 'champion') { o.k = u.kind || u.tier || ''; o.r = u.radius; if (u.lane) o.ln = u.lane; }
    if (u.type === 'tower' || u.type === 'nexus') { o.v = u.vulnerable ? 1 : 0; if (u.type === 'tower') { o.ht = u.heat || 0; o.tg = u.target ? u.target.id : 0; } }
    if (u.attackStart != null) { o.at = r2(u.attackStart); o.aP = r2(u.attackPeriod || 1); }
    if (u.windup) o.w = 1;
    if (u.isStunned()) o.st = 1;
    if (u.buffMax('slow') > 0) o.sl = 1;
    if (u.dash) o.da = 1;
    return o;
  }

  /** Foto del mundo para un equipo (las unidades escondidas en arbustos no se mandan). */
  Net.snapshot = function (g, team, since) {
    const units = [];
    for (const u of g.units) { const o = packUnit(g, u, team); if (o) units.push(o); }
    for (const c of g.champions) if (g.units.indexOf(c) < 0) { const o = packUnit(g, c, team); if (o) units.push(o); }
    const proj = [];
    for (const p of g.projectiles) {
      if (p.kind === 'homing' && p.source && p.source.hiddenFrom && p.source.hiddenFrom[team] && p.target && p.target.team !== team) { /* se ve igual */ }
      proj.push(p.kind === 'homing'
        ? { i: p.id, k: 'h', x: r1(p.x), y: r1(p.y), c: p.color, s: p.size, tm: p.source ? p.source.team : 0, tg: p.target ? p.target.id : 0 }
        : { i: p.id, k: 's', x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), c: p.color, w: p.width, tm: p.source.team, df: p.source.def ? p.source.def.id : '', sl: p.ability ? p.ability.slot : 0 });
    }
    const zones = g.zones.map(function (z) {
      return { i: z.id, sh: z.shape, x: r1(z.x), y: r1(z.y), x2: r1(z.x2 || 0), y2: r1(z.y2 || 0), r: z.radius || 0, w: z.width || 0,
        dl: r2(z.delay), md: r2(z.maxDelay || 0), du: z.duration || 0, rm: r2(z.remaining || 0), c: z.color, tm: z.team,
        df: z.caster && z.caster.def ? z.caster.def.id : '', sl: z.ab ? z.ab.slot : 0 };
    });
    const out = { k: 's', t: r2(g.time), sc: g.score, ov: g.over ? 1 : 0, wn: g.winner, fw: g.firstWave, u: units, p: proj, z: zones,
      cp: g.camps.map(function (c) { return r1(c.respawnAt || 0); }) };
    return out;
  };
  /** Eventos nuevos (efectos, textos, avisos) desde la última foto que recibió ese cliente. */
  Net.events = function (g, champId, since) {
    const fx = [], tx = [], fd = [];
    for (const f of g.fx) if (f.id > since.fx) fx.push(f);
    for (const t of g.texts) if (t.id > since.tx && (!t.to || t.to.indexOf(champId) >= 0)) tx.push({ x: r1(t.x), y: r1(t.y), text: t.text, color: t.color, big: t.big, life: t.life, max: t.max });
    for (const f of g.feed) if (f.id > since.fd && (!f.to || f.to.indexOf(champId) >= 0)) fd.push({ text: f.text, color: f.color, time: f.time });
    return { fx: fx, tx: tx, fd: fd };
  };

  // ======================= Mundo réplica (clientes) =======================
  class ReplicaWorld {
    constructor(start) {
      this.map = M.MAP; this.time = 0; this.replica = true;
      this.units = []; this.champions = []; this.structures = []; this.towers = []; this.nexus = [];
      this.projectiles = []; this.zones = []; this.fx = []; this.texts = []; this.feed = [];
      this.score = [0, 0]; this.over = false; this.winner = -1; this.paused = false; this.firstWave = 30; this.shake = 0;
      this.byId = {}; this.mySlot = start.slot; this.mySlotChampId = null;
      this.camps = this.map.camps.map(function (c) { return { x: c.x, y: c.y, kind: c.kind, monster: null, respawnAt: 60 }; });
      this.snaps = []; this.clockOffset = null; this.player = null;
      this.roster = start.roster || [];
      // Crear los campeones desde el roster para que el HUD exista desde el primer cuadro
      const self = this;
      (start.champs || []).forEach(function (rc) {
        const def = M.championById[rc.df] || M.champions[0];
        const c = new M.Champion(def, rc.tm, !!rc.hu);
        c.id = rc.i; c.playerName = rc.nm || ''; c.slot = rc.slot || null;
        c.hiddenLocal = true; c.samples = [];
        self.byId[c.id] = c; self.champions.push(c);
        if (rc.slot && rc.slot === start.slot) self.player = c;
      });
      if (!this.player) this.player = this.champions[0];
    }
    addFeed(text, color) { this.feed.push({ text: text, color: color, time: this.time }); }
    atFountain(c) { return U.dist(c, this.map.fountains[c.team]) < this.map.fountainRadius + 150; }
    canShop(c) { return c.dead || this.atFountain(c); }
    isVisibleTo(team, u) { return !u.hiddenLocal; }
    validTarget(u, t) { return t && !t.dead && t.team !== u.team && t.isTargetable() && !t.hiddenLocal; }
    // Validaciones locales (la decisión final la toma el anfitrión)
    buyItem(c, id) {
      const item = M.itemById[id];
      if (!item) return 'Objeto inexistente';
      if (!this.canShop(c)) return 'Tenés que estar en la base para comprar';
      if (c.items.length >= M.MAX_ITEMS) return 'Inventario lleno';
      if (c.gold < item.cost) return 'No te alcanza el oro';
      return null;
    }
    sellItem(c, index) { if (!this.canShop(c)) return 'Tenés que estar en la base para vender'; if (!c.items[index]) return 'No hay objeto'; return null; }

    ensureUnit(o) {
      let u = this.byId[o.i];
      if (u) return u;
      const type = TYPE_R[o.y];
      if (type === 'champion') {
        const def = M.championById[o.df] || M.champions[0];
        u = new M.Champion(def, o.tm, !!o.hu); u.id = o.i; this.champions.push(u);
      } else {
        u = new M.Unit({ type: type, team: o.tm, kind: o.k, tier: o.k, radius: o.r || 48, lane: o.ln });
        u.id = o.i;
        if (type === 'tower') { u.isStatic = true; u.name = 'Torre'; this.towers.push(u); this.structures.push(u); }
        if (type === 'nexus') { u.isStatic = true; u.name = 'Nexo'; this.nexus[o.tm] = u; this.structures.push(u); }
        if (type === 'minion') { u.ranged = o.k !== 'melee'; }
        if (type === 'monster') u.name = o.k === 'golem' ? 'Gólem del Bosque' : 'Lobo Espectral';
      }
      u.samples = [];
      this.byId[o.i] = u;
      return u;
    }

    /** Aplica una foto recibida del anfitrión. */
    applySnapshot(s, ev, now) {
      const t = s.t;
      if (this.clockOffset == null) this.clockOffset = t - now;
      else this.clockOffset += ((t - now) - this.clockOffset) * 0.1;   // reloj del anfitrión suavizado
      this.score = s.sc; this.firstWave = s.fw;
      if (s.ov && !this.over) { this.over = true; this.winner = s.wn; if (this.onGameOver) this.onGameOver(s.wn); }
      const seen = {};
      const live = [];
      for (const o of s.u) {
        const u = this.ensureUnit(o);
        seen[u.id] = true;
        u.team = o.tm; u.hp = o.h; u.maxHp = o.H; u.dead = !!o.d;
        if (u.type === 'champion') {
          u.level = o.lv; u.kills = o.K; u.deaths = o.D; u.assists = o.A; u.cs = o.cs; u.gold = o.g; u.items = o.it;
          u.human = !!o.hu; u.isPlayer = u.human; u.playerName = o.nm; u.respawnTimer = o.rt;
          u.hiddenLocal = !!o.hid;
          if (o.hid) { continue; }
          u.mana = o.mn; u.maxMana = o.MM; u.xp = o.xp; u.ranks = o.rk; u.skillPoints = o.sp; u.cds = o.cd;
          u.recalling = o.rc ? { t: o.rc, max: 8 } : null;
          u.ad = o.ad; u.ap = o.ap; u.armor = o.ar; u.mr = o.mr; u.attackSpeed = o.as; u.bonusAS = 0; u.moveSpeed = o.ms; u.baseBoost = false;
          u.critChance = o.cr; u.haste = o.hs; u.lifesteal = o.ls; u.attackRange = o.rg; u.castAt = o.ca; u.castSlot = o.cS;
          u.championsOnly = !!o.co;
        }
        u.vulnerable = o.v == null ? true : !!o.v;
        if (o.ht != null) u.heat = o.ht;
        u.attackStart = o.at; u.attackPeriod = o.aP;
        u.windup = o.w ? {} : null;
        u.buffs = [];
        if (o.sh) u.buffs.push({ type: 'shield', amount: o.sh, remaining: 1 });
        if (o.st) u.buffs.push({ type: 'stun', amount: 1, remaining: 1 });
        u.slowed = !!o.sl; u.dash = o.da ? {} : null;
        u.targetId = o.tg || 0;
        u.facing = o.f;
        if (o.x != null) {
          if (!u.samples) u.samples = [];
          u.samples.push({ t: t, x: o.x, y: o.yy });
          if (u.samples.length > 4) u.samples.shift();
          if (u.samples.length === 1 || Math.hypot(u.x - o.x, u.y - o.yy) > 1500) { u.x = o.x; u.y = o.yy; u.px = u.x; u.py = u.y; }
        }
        if (!u.dead || u.type === 'tower' || u.type === 'nexus' || u.type === 'champion') live.push(u);
      }
      // unidades: las que vinieron en la foto (los campeones muertos u ocultos quedan en la lista de campeones)
      this.units = live;
      for (const id in this.byId) {
        const u = this.byId[id];
        if (!seen[id] && u.type !== 'champion' && u.type !== 'tower' && u.type !== 'nexus') delete this.byId[id];
        if (!seen[id] && u.type === 'champion') u.hiddenLocal = true;
      }
      for (const st of this.structures) if (!seen[st.id] && st.type === 'tower') st.dead = true;
      // proyectiles y zonas
      const oldP = {};
      for (const p of this.projectiles) oldP[p.id] = p;
      this.projectiles = s.p.map(function (q) {
        const p = oldP[q.i] || { id: q.i, x: q.x, y: q.y, samples: [] };
        p.kind = q.k === 'h' ? 'homing' : 'skill'; p.color = q.c; p.size = q.s; p.width = q.w; p.vx = q.vx || 0; p.vy = q.vy || 0;
        p.team = q.tm; p.def = q.df; p.slot = q.sl; p.targetId = q.tg;
        p.samples.push({ t: t, x: q.x, y: q.y }); if (p.samples.length > 3) p.samples.shift();
        return p;
      });
      this.zones = s.z.map(function (q) {
        return { id: q.i, shape: q.sh, x: q.x, y: q.y, x2: q.x2, y2: q.y2, radius: q.r, width: q.w, delay: q.dl, maxDelay: q.md,
          duration: q.du, remaining: q.rm, color: q.c, team: q.tm, def: q.df, slot: q.sl, fired: q.dl <= 0 };
      });
      if (s.cp) s.cp.forEach((v, i) => { if (this.camps[i]) this.camps[i].respawnAt = v; });
      if (ev) {
        for (const f of ev.fx) { f.life = f.max; this.fx.push(f); }
        for (const x of ev.tx) this.texts.push(x);
        for (const f of ev.fd) this.feed.push(f);
        if (this.feed.length > 30) this.feed.splice(0, this.feed.length - 30);
      }
    }

    /** Interpolación: dibuja el mundo ~100 ms en el pasado para que el movimiento sea suave. */
    interpolate(now, dt) {
      if (this.clockOffset == null) return;
      const rt = now + this.clockOffset - Net.INTERP;
      this.time = Math.max(this.time, now + this.clockOffset);
      const lerp = function (o) {
        const s = o.samples;
        if (!s || !s.length) return;
        let a = s[0], b = s[s.length - 1];
        for (let i = 0; i < s.length - 1; i++) if (s[i].t <= rt && s[i + 1].t >= rt) { a = s[i]; b = s[i + 1]; break; }
        if (rt >= b.t) { a = b; }
        const k = b.t > a.t ? U.clamp((rt - a.t) / (b.t - a.t), 0, 1) : 1;
        o.px = o.x; o.py = o.y;
        o.x = a.x + (b.x - a.x) * k; o.y = a.y + (b.y - a.y) * k;
        if (dt > 0) { o.vx = (o.x - o.px) / dt; o.vy = (o.y - o.py) / dt; }
      };
      for (const u of this.units) if (!u.isStatic) lerp(u);
      for (const p of this.projectiles) lerp(p);
      for (const z of this.zones) { if (z.delay > 0) z.delay -= dt; else if (z.remaining > 0) z.remaining -= dt; }
    }
    updateFx(dt) {
      for (const f of this.fx) f.life -= dt;
      this.fx = this.fx.filter(function (f) { return f.life > 0; });
      for (const t of this.texts) { t.life -= dt; t.y -= 90 * dt; }
      this.texts = this.texts.filter(function (t) { return t.life > 0; });
    }
  }
  ReplicaWorld.prototype.pickTarget = function () { return M.Game.prototype.pickTarget.apply(this, arguments); };
  Net.ReplicaWorld = ReplicaWorld;

  // ======================= Sesiones =======================
  /** Partida local (un jugador). */
  class LocalSession {
    constructor(game) { this.world = game; this.game = game; this.local = true; this.canPause = true; }
    get me() { return this.world.player; }
    cmd(c) { return this.game.command(this.game.player, c); }
    step(dt) { /* la simulación la avanza main.js */ }
    close() {}
  }
  /** Anfitrión: simula y manda fotos. clients: { connId: { slot, champId } } */
  class HostSession extends LocalSession {
    constructor(game, transport, clients) {
      super(game);
      this.canPause = false; this.transport = transport; this.clients = clients; this.sendTimer = 0;
      for (const id in clients) {
        const c = game.humans[clients[id].slot];
        clients[id].champId = c ? c.id : 0; clients[id].team = c ? c.team : 0;
        clients[id].since = { fx: 0, tx: 0, fd: 0 };
      }
    }
    onMessage(id, msg) {
      const cl = this.clients[id];
      if (!cl || !msg) return;
      if (msg.k === 'cmd') {
        const c = this.game.humans[cl.slot];
        const err = this.game.command(c, msg.c);
        if (err && err !== 'no' && (msg.c.t === 'buy' || msg.c.t === 'sell')) this.transport.send(id, { k: 'msg', text: err });
      }
    }
    onLeave(id) {
      const cl = this.clients[id];
      if (!cl) return;
      const c = this.game.humans[cl.slot];
      if (c && !c.ai) {
        // si alguien se desconecta, un bot toma su campeón
        c.human = false; c.isPlayer = false; c.ai = new M.BotAI(c); M.BotAI.levelUp(c);
        this.game.addFeed((c.playerName || 'Un jugador') + ' se desconectó: lo reemplaza un bot', '#ffb070');
      }
      delete this.clients[id];
    }
    step(dt) {
      this.sendTimer -= dt;
      if (this.sendTimer > 0) return;
      this.sendTimer = 1 / Net.SNAPSHOT_HZ;
      const g = this.game;
      const snaps = {};
      for (const id in this.clients) {
        const cl = this.clients[id];
        const s = snaps[cl.team] || (snaps[cl.team] = Net.snapshot(g, cl.team));
        const ev = Net.events(g, cl.champId, cl.since);
        cl.since = { fx: this.game.seq, tx: this.game.seq, fd: this.game.seq };
        this.transport.send(id, { k: 's', s: s, e: ev });
      }
    }
    close() { this.transport.close(); }
  }
  /** Cliente: manda órdenes y dibuja la réplica interpolada. */
  class ClientSession {
    constructor(transport, start) {
      this.transport = transport; this.local = false; this.canPause = false;
      this.world = new ReplicaWorld(start);
      this.lastMsg = performance.now();
    }
    get me() { return this.world.player; }
    cmd(c) {
      let err = null;
      if (c.t === 'buy') err = this.world.buyItem(this.world.player, c.item);
      if (c.t === 'sell') err = this.world.sellItem(this.world.player, c.i);
      if (c.t === 'learn' && !this.world.player.canLearn(c.s)) err = 'no';
      if (c.t === 'cast' && !this.world.player.abilityReady(c.s)) err = 'no';
      if (!err) this.transport.send({ k: 'cmd', c: c });
      if (c.t === 'learn' && !err) { const p = this.world.player; p.ranks = p.ranks.slice(); p.ranks[c.s]++; p.skillPoints--; }  // predicción
      return err;
    }
    onMessage(msg) {
      this.lastMsg = performance.now();
      if (msg.k === 's') this.world.applySnapshot(msg.s, msg.e, performance.now() / 1000);
      else if (msg.k === 'msg' && this.onNotice) this.onNotice(msg.text);
    }
    step(dt) { this.world.interpolate(performance.now() / 1000, dt); }
    close() { this.transport.close(); }
  }
  Net.LocalSession = LocalSession; Net.HostSession = HostSession; Net.ClientSession = ClientSession;
})(window.MOBA);
