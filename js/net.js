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

  // ======================= Servidores ICE (STUN / TURN) =======================
  /* WebRTC intenta primero una conexión DIRECTA entre los navegadores (con ayuda de STUN).
   * Si los routers no lo permiten (NAT simétrico, CGNAT de muchos proveedores, redes de oficina),
   * hace falta un RELÉ (TURN) que pase los datos. El TURN que traía PeerJS por defecto
   * (eu-0/us-0.turn.peerjs.com) ya no existe, por eso sin esto muchas conexiones no arrancaban nunca.
   *
   * ¿Querés usar tu propio TURN (recomendado si lo publicás en serio)? Agregalo en `servers`, por ejemplo:
   *   { urls: ['turn:mi-turn.example.com:3478', 'turns:mi-turn.example.com:443?transport=tcp'], username: 'yo', credential: 'clave' }
   * Servicios con plan gratis que te dan usuario y clave fijos: Metered, ExpressTURN, Twilio (de pago), o tu propio coturn. */
  Net.ICE = {
    servers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
      // TURN público gratuito (turn.evan-brass.net, sin registro): UDP, TCP y TLS por el puerto 443
      { urls: ['turn:turn.evan-brass.net:3478', 'turn:turn.evan-brass.net:3478?transport=tcp', 'turns:turn.evan-brass.net:443?transport=tcp'],
        username: 'user', credential: 'password' }
    ],
    // Servicios que entregan credenciales TURN temporales sin cuenta (se piden al conectar; si fallan, se sigue sin ellos)
    credentialUrls: ['https://turn.elixir-webrtc.org/?service=turn&username=mvmoba'],
    fetchTimeoutMs: 3500
  };
  let iceCache = null;
  /** Arma la configuración ICE: servidores fijos + credenciales temporales. Con ?relay=1 fuerza usar solo el relé (para probar TURN). */
  Net.iceConfig = function () {
    const relayOnly = /[?&]relay=1\b/.test(location.search);
    if (iceCache && iceCache.until > Date.now()) return Promise.resolve({ iceServers: iceCache.servers, iceTransportPolicy: relayOnly ? 'relay' : 'all' });
    const fetchOne = function (url) {
      if (typeof fetch !== 'function' || typeof AbortController === 'undefined') return Promise.resolve(null);
      const ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, Net.ICE.fetchTimeoutMs);
      return fetch(url, { method: 'POST', signal: ctl.signal }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { clearTimeout(t); return j && j.uris && j.username ? { urls: j.uris, username: j.username, credential: j.password, ttl: j.ttl || 600 } : null; })
        .catch(function () { clearTimeout(t); return null; });
    };
    return Promise.all(Net.ICE.credentialUrls.map(fetchOne)).then(function (extra) {
      const got = extra.filter(Boolean);
      const servers = Net.ICE.servers.concat(got.map(function (e) { return { urls: e.urls, username: e.username, credential: e.credential }; }));
      const ttl = got.length ? Math.min.apply(null, got.map(function (e) { return e.ttl; })) : 600;
      iceCache = { servers: servers, until: Date.now() + Math.max(60, ttl - 60) * 1000 };
      return { iceServers: servers, iceTransportPolicy: relayOnly ? 'relay' : 'all' };
    });
  };
  /** Qué tipo de conexión quedó: 'relé TURN' o 'directa'. Devuelve una promesa con { kind, text }. */
  Net.describeConnection = function (pc) {
    if (!pc || !pc.getStats) return Promise.resolve(null);
    return pc.getStats().then(function (stats) {
      let pair = null; const byId = {};
      stats.forEach(function (s) { byId[s.id] = s; });
      stats.forEach(function (s) { if (s.type === 'transport' && s.selectedCandidatePairId) pair = byId[s.selectedCandidatePairId]; });
      if (!pair) stats.forEach(function (s) { if (s.type === 'candidate-pair' && (s.selected || s.nominated) && s.state === 'succeeded') pair = pair || s; });
      if (!pair) return null;
      const l = byId[pair.localCandidateId] || {}, r = byId[pair.remoteCandidateId] || {};
      const relay = l.candidateType === 'relay' || r.candidateType === 'relay';
      const rtt = pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) + ' ms' : '';
      return { kind: relay ? 'relay' : 'direct', text: (relay ? 'por relé TURN' : 'directa P2P') + (rtt ? ' · ' + rtt : ''), local: l.candidateType, remote: r.candidateType };
    }).catch(function () { return null; });
  };

  // ======================= Envío seguro =======================
  /** Tope por mensaje: algunos navegadores aceptan como máximo 64 KB por mensaje del canal de datos, y si un envío
   *  falla PeerJS cierra la conexión entera. Nos quedamos bastante por debajo. */
  Net.MAX_MSG = 60000;
  let warnAt = {};
  Net.warn = function (where, e) {
    const now = Date.now();
    if (now - (warnAt[where] || 0) < 5000) return;          // sin inundar la consola
    warnAt[where] = now;
    console.warn('[red] ' + where + ': ' + (e && e.message ? e.message : e));
  };
  /** Convierte un mensaje en texto sin que nunca tire una excepción: si no se puede (objetos circulares) o es
   *  demasiado grande, saca primero los eventos y después avisa y no manda nada (devuelve null). */
  Net.encode = function (msg) {
    let str = null;
    try { str = JSON.stringify(msg); } catch (e) { Net.warn('mensaje no serializable', e); }
    if (str != null && str.length <= Net.MAX_MSG) return str;
    if (msg && msg.k === 's' && msg.e) {
      // primero se descartan efectos y textos (son cosméticos); los avisos del feed se conservan sin el resumen de muerte
      const fd = (msg.e.fd || []).map(function (f) { return { text: String(f.text || ''), color: String(f.color || '#fff'), time: +f.time || 0, ann: null }; });
      try { str = JSON.stringify({ k: 's', s: msg.s, e: { fx: [], tx: [], fd: fd } }); } catch (e) { str = null; Net.warn('foto no serializable', e); }
      if (str != null && str.length <= Net.MAX_MSG) { Net.warn('mensaje grande', 'se recortaron los efectos (' + (str.length) + ' bytes)'); return str; }
    }
    Net.warn('mensaje descartado', str == null ? 'no se pudo convertir' : 'demasiado grande (' + str.length + ' bytes)');
    return null;
  };
  /** Lee un mensaje recibido; si viene roto, avisa y lo ignora. */
  Net.decode = function (d) {
    if (typeof d !== 'string') return d;
    try { return JSON.parse(d); } catch (e) { Net.warn('mensaje ilegible', e); return null; }
  };
  /** Llama a un manejador sin que una excepción corte la conexión ni el resto de los mensajes. */
  Net.safeCall = function (where, fn, a, b) {
    try { return fn(a, b); } catch (e) { Net.warn(where, e); console.warn(e); return undefined; }
  };

  // ======================= Transportes =======================
  /** Anfitrión con PeerJS. handlers: { ready(code), join(id), message(id, msg), leave(id), error(text), status(text) } */
  function PeerHost(code, h) {
    const self = this;
    this.conns = {}; this.kind = 'peer'; this.closed = false; this.code = code;
    Net.iceConfig().then(function (cfg) {
      if (self.closed) return;
      const peer = self.peer = new window.peerjs.Peer(Net.PREFIX + code, { debug: 0, config: cfg });
      let wasOpen = false;
      peer.on('open', function () { if (!wasOpen) { wasOpen = true; h.ready(code); } else if (h.status) h.status('Reconectado con el servidor. La sala sigue abierta.'); });
      peer.on('connection', function (conn) {
        conn.on('open', function () { self.conns[conn.peer] = conn; h.join(conn.peer); });
        conn.on('data', function (d) { const m = Net.decode(d); if (m) Net.safeCall('mensaje del jugador', h.message, conn.peer, m); });
        conn.on('close', function () { if (self.conns[conn.peer]) { delete self.conns[conn.peer]; h.leave(conn.peer); } });
        conn.on('error', function () { if (self.conns[conn.peer]) { delete self.conns[conn.peer]; h.leave(conn.peer); } });
      });
      // Si se corta la conexión con el servidor de señalización, la sala deja de ser "encontrable": reconectar
      peer.on('disconnected', function () {
        if (self.closed || peer.destroyed) return;
        if (h.status) h.status('Se cortó la conexión con el servidor de salas. Reconectando…');
        let tries = 0;
        const again = function () { if (self.closed || peer.destroyed || !peer.disconnected) return; tries++; try { peer.reconnect(); } catch (e) { /* nada */ } if (tries < 20) setTimeout(again, Math.min(15000, 1500 * tries)); };
        setTimeout(again, 500);
      });
      peer.on('error', function (e) {
        const t = e && e.type;
        if (t === 'peer-unavailable') return;                                 // no aplica al anfitrión
        if ((t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') && wasOpen) return;   // lo maneja 'disconnected'
        h.error(Net.peerError(e));
      });
    });
    window.addEventListener('pagehide', function () { self.close(); });
  }
  PeerHost.prototype.send = function (id, msg) {
    if (this.closed) return;
    const c = this.conns[id];
    if (!c || !c.open) return;
    const str = Net.encode(msg);
    if (str == null) return;
    try { c.send(str); } catch (e) { Net.warn('envío al jugador', e); }
  };
  PeerHost.prototype.close = function () { this.closed = true; try { if (this.peer) this.peer.destroy(); } catch (e) { /* nada */ } };
  PeerHost.prototype.diag = function (id) { const c = this.conns[id]; return Net.describeConnection(c && c.peerConnection); };

  Net.JOIN_TIMEOUT = 15000;
  /** Cliente con PeerJS. handlers: { open(), message(msg), close(), error(text, opts), stage(text) } */
  function PeerClient(code, h) {
    const self = this;
    this.kind = 'peer'; this.closed = false;
    let opened = false, failed = false;
    const stage = function (t) { if (!opened && !failed && h.stage) h.stage(t); };
    const fail = function (text) {
      if (opened || failed || self.closed) return;
      failed = true; clearTimeout(self.timer);
      self.close();
      h.error(text, { retry: true });
    };
    stage('1/3 · Contactando el servidor de salas…');
    this.timer = setTimeout(function () {
      fail('No se pudo conectar con la sala ' + code + ' en ' + Math.round(Net.JOIN_TIMEOUT / 1000) + ' s. Puede ser que el anfitrión haya cerrado la pestaña o ' +
        'se haya quedado sin internet, o que alguna de las dos redes bloquee las conexiones entre navegadores (WebRTC). Probá de nuevo; si sigue igual, que el anfitrión cree una sala nueva.');
    }, Net.JOIN_TIMEOUT);
    Net.iceConfig().then(function (cfg) {
      if (self.closed) return;
      const peer = self.peer = new window.peerjs.Peer({ debug: 0, config: cfg });
      peer.on('open', function () {
        stage('2/3 · Buscando la sala ' + code + '…');
        const conn = self.conn = peer.connect(Net.PREFIX + code, { reliable: true, serialization: 'raw' });
        const pc = conn.peerConnection;
        if (pc && pc.addEventListener) {
          pc.addEventListener('signalingstatechange', function () { if (pc.signalingState === 'stable' && pc.remoteDescription) stage('3/3 · Sala encontrada: estableciendo la conexión con el anfitrión…'); });
          pc.addEventListener('iceconnectionstatechange', function () {
            if (pc.iceConnectionState === 'failed') fail('Se encontró la sala, pero no se pudo establecer la conexión entre los dos navegadores (ni directa ni por relé). Alguna de las redes bloquea WebRTC. Probá con otra red (por ejemplo, datos del celular) o de nuevo en un rato.');
          });
        }
        conn.on('open', function () {
          opened = true; clearTimeout(self.timer); h.open();
        });
        conn.on('data', function (d) { const m = Net.decode(d); if (m) Net.safeCall('mensaje del anfitrión', h.message, m); });
        conn.on('close', function () { if (opened) h.close(); });
        conn.on('error', function (e) { if (opened) h.error(Net.peerError(e)); else fail(Net.peerError(e)); });
      });
      peer.on('disconnected', function () { if (opened && !self.closed && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* nada */ } } });
      peer.on('error', function (e) {
        const t = e && e.type;
        if (t === 'peer-unavailable') { fail('La sala ' + code + ' no existe o el anfitrión cerró la pestaña. Revisá el código o pedile un link nuevo.'); return; }
        if (opened) { if (t !== 'network' && t !== 'socket-error' && t !== 'socket-closed' && t !== 'server-error') h.error(Net.peerError(e)); return; }
        fail(Net.peerError(e));
      });
    });
    window.addEventListener('pagehide', function () { self.close(); });
  }
  PeerClient.prototype.send = function (msg) {
    if (this.closed || !this.conn || !this.conn.open) return;
    const str = Net.encode(msg);
    if (str == null) return;
    try { this.conn.send(str); } catch (e) { Net.warn('envío al anfitrión', e); }
  };
  PeerClient.prototype.close = function () { this.closed = true; clearTimeout(this.timer); try { if (this.peer) this.peer.destroy(); } catch (e) { /* nada */ } };
  PeerClient.prototype.diag = function () { return Net.describeConnection(this.conn && this.conn.peerConnection); };
  Net.peerError = function (e) {
    const t = e && e.type;
    if (t === 'unavailable-id') return 'Ese código de sala ya está en uso. Probá de nuevo.';
    if (t === 'peer-unavailable') return 'La sala no existe o el anfitrión cerró la pestaña.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo conectar con el servidor de salas (PeerJS). ¿Hay internet? Podés probar el modo local (misma compu).';
    if (t === 'browser-incompatible') return 'Este navegador no soporta WebRTC.';
    if (t === 'webrtc' || t === 'negotiation-failed') return 'No se pudo establecer la conexión WebRTC (alguna red la bloquea).';
    return 'Error de conexión: ' + (t || (e && e.message) || e);
  };

  /** Transporte local con BroadcastChannel (pestañas del mismo navegador). */
  function LocalHost(code, h) {
    const self = this;
    this.kind = 'local'; this.peers = {}; this.conns = this.peers;
    const ch = this.ch = new BroadcastChannel(Net.PREFIX + code);
    ch.onmessage = function (ev) {
      const m = ev.data;
      if (!m || m.to !== 'host') return;
      if (m.type === 'hello') { self.peers[m.from] = performance.now(); ch.postMessage({ to: m.from, type: 'welcome' }); h.join(m.from); }
      else if (m.type === 'bye') { if (self.peers[m.from]) { delete self.peers[m.from]; h.leave(m.from); } }
      else if (self.peers[m.from]) { self.peers[m.from] = performance.now(); if (m.type === 'data') { const d = Net.decode(m.data); if (d) Net.safeCall('mensaje del jugador', h.message, m.from, d); } }
      else if (m.type === 'ping' || m.type === 'data') ch.postMessage({ to: m.from, type: 'closed' });   // lo habíamos dado por ido: que se entere
    };
    // sin noticias de una pestaña en 6 s = se fue (por si se cerró sin avisar)
    let lastWatch = performance.now();
    this.watch = setInterval(function () {
      const now = performance.now();
      // si fue ESTA pestaña la que estuvo trabada (o en segundo plano), no es culpa de los demás
      if (now - lastWatch > 3000) for (const id in self.peers) self.peers[id] = now;
      lastWatch = now;
      for (const id in self.peers) if (now - self.peers[id] > 8000) { delete self.peers[id]; h.leave(id); }
    }, 1000);
    this.onHide = function () { self.close(); };
    window.addEventListener('pagehide', this.onHide);
    setTimeout(function () { h.ready(code); }, 0);
  }
  LocalHost.prototype.send = function (id, msg) {
    if (this.closed) return;
    const str = Net.encode(msg);       // mismas reglas que en línea: solo datos simples
    if (str == null) return;
    try { this.ch.postMessage({ to: id, type: 'data', data: str }); } catch (e) { Net.warn('envío local', e); }
  };
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
      else if (m.type === 'data') { const d = Net.decode(m.data); if (d) Net.safeCall('mensaje del anfitrión', h.message, d); }
      else if (m.type === 'closed') h.close();
    };
    ch.postMessage({ to: 'host', from: this.id, type: 'hello' });
    this.ping = setInterval(function () { if (open) ch.postMessage({ to: 'host', from: self.id, type: 'ping' }); }, 1000);
    this.onHide = function () { self.close(); };
    window.addEventListener('pagehide', this.onHide);
    setTimeout(function () { if (!open && !self.closed) h.error('No existe una sala local con ese código (abrila en otra pestaña de este navegador).', { retry: true }); }, 2500);
  }
  LocalClient.prototype.send = function (msg) {
    if (this.closed) return;
    const str = Net.encode(msg);
    if (str == null) return;
    try { this.ch.postMessage({ to: 'host', from: this.id, type: 'data', data: str }); } catch (e) { Net.warn('envío local', e); }
  };
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
      o.g = r1(u.gold); o.it = u.items; o.ud = u.undo ? u.undo.length : 0; o.hu = u.human ? 1 : 0; o.nm = u.playerName || '';
      o.rt = r2(u.respawnTimer);
      if (hidden) { o.hid = 1; return o; }
      o.mn = r1(u.mana); o.MM = r1(u.maxMana); o.xp = r1(u.xp); o.rk = u.ranks; o.sp = u.skillPoints;
      o.cd = u.cds.map(r2); o.rc = u.recalling ? r2(u.recalling.t) : 0;
      o.ad = r1(u.ad); o.ap = r1(u.ap); o.ar = r1(u.getArmor()); o.mr = r1(u.getMr()); o.as = r2(u.getAttackSpeed());
      o.ms = r1(u.getMoveSpeed()); o.cr = r2(u.critChance); o.hs = r1(u.haste); o.ls = r2(u.getLifesteal()); o.rg = u.attackRange;
      o.bf = u.buffs.filter(function (b) { return b.remaining > 0 && b.remaining < 600; }).slice(0, 10).map(function (b) { const am = typeof b.amount === 'number' && isFinite(b.amount) ? b.amount : 0, du = typeof b.duration === 'number' && isFinite(b.duration) ? b.duration : b.remaining;
        return [String(b.type || ''), r2(b.remaining), r2(du), r2(am)]; });
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
    if (u.buffs.length) {
      if (u.hasBuff('stealth')) o.sg = 1;
      if (u.hasBuff('undying')) o.un = 1;
      const g = u.buffMax('grow'); if (g) o.gr = r2(g);
      if (u.knock && u.knock.fear) o.fr = 1;
    }
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
  /** Solo datos simples (números, textos, booleanos y listas/objetos de eso), sin referencias a unidades. */
  function plain(v, depth) {
    if (v == null) return null;
    const t = typeof v;
    if (t === 'number') return isFinite(v) ? v : 0;
    if (t === 'string') return v.length > 300 ? v.slice(0, 300) : v;
    if (t === 'boolean') return v;
    if (t !== 'object' || depth > 3) return null;
    if (v.type && v.id != null && (v.hp != null || v.buffs)) return v.id;         // una unidad: se manda solo su id
    if (Array.isArray(v)) { const out = []; for (let i = 0; i < v.length && i < 40; i++) out.push(plain(v[i], depth + 1)); return out; }
    const o = {};
    for (const k in v) { if (k === 'to' || k === 'seenAnn') continue; const x = plain(v[k], depth + 1); if (x !== null || v[k] === null) o[k] = x; }
    return o;
  }
  Net.plain = function (v) { return plain(v, 0); };
  /** Anuncio (asesinato, torre, nexo, as) con solo ids, textos y números. */
  Net.packAnn = function (a) {
    if (!a || typeof a !== 'object') return null;
    const id = function (x) { return x && typeof x === 'object' ? (x.id | 0) : (+x || 0); };
    const out = { k: String(a.k || '') };
    if (a.team != null) out.team = a.team | 0;
    if (a.k === 'kill') {
      out.killer = id(a.killer); out.victim = id(a.victim); out.by = String(a.by || '');
      out.assists = Array.isArray(a.assists) ? a.assists.slice(0, 5).map(id) : [];
      out.first = !!a.first; out.multi = a.multi | 0; out.spree = a.spree | 0; out.shutdown = a.shutdown | 0;
      const r = a.recap;
      if (r && Array.isArray(r.rows)) {
        out.recap = { total: +r.total || 0, rows: r.rows.slice(0, 6).map(function (row) {
          return { id: id(row.id), name: String(row.name || ''), type: String(row.type || ''), df: String(row.df || ''), team: row.team | 0, total: +row.total || 0,
            parts: (Array.isArray(row.parts) ? row.parts : []).slice(0, 5).map(function (pt) { return { l: String(pt.l || ''), k: String(pt.k || ''), a: +pt.a || 0 }; }) };
        }) };
      }
    }
    if (a.lane != null) out.lane = String(a.lane);
    return out;
  };
  Net.events = function (g, champId, since) {
    const fx = [], tx = [], fd = [];
    for (const f of g.fx) if (f.id > since.fx && (!f.to || f.to.indexOf(champId) >= 0)) { const o = plain(f, 0); if (o) fx.push(o); }
    for (const t of g.texts) if (t.id > since.tx && (!t.to || t.to.indexOf(champId) >= 0)) tx.push({ x: r1(t.x), y: r1(t.y), text: String(t.text), color: String(t.color || '#fff'), big: !!t.big, life: +t.life || 1, max: +t.max || 1 });
    for (const f of g.feed) if (f.id > since.fd && (!f.to || f.to.indexOf(champId) >= 0)) {
      let ann = null;
      try { ann = Net.packAnn(f.ann); } catch (e) { Net.warn('anuncio', e); }
      fd.push({ text: String(f.text), color: String(f.color || '#fff'), time: +f.time || 0, ann: ann });
    }
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
    buyItem(c, id) { return M.canBuy(c, id, this.canShop(c)); }
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
          u.level = o.lv; u.kills = o.K; u.deaths = o.D; u.assists = o.A; u.cs = o.cs; u.gold = o.g; u.items = o.it; u.undoCount = o.ud || 0;
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
        if (o.sg) u.buffs.push({ type: 'stealth', amount: 1, remaining: 1 });
        if (o.un) u.buffs.push({ type: 'undying', amount: 1, remaining: 1 });
        if (o.gr) u.buffs.push({ type: 'grow', amount: o.gr, remaining: 1 });
        if (Array.isArray(o.bf)) {
          // los efectos detallados (para el panel del objetivo) se suman a las marcas de arriba sin duplicarlas
          const flags = u.buffs;
          u.buffs = o.bf.filter(function (a) { return Array.isArray(a); }).map(function (a) { return { type: String(a[0]), remaining: +a[1] || 0, duration: +a[2] || 0, amount: +a[3] || 0 }; });
          for (const fl of flags) if (!u.buffs.some(function (b) { return b.type === fl.type; })) u.buffs.push(fl);
        }
        u.feared = !!o.fr;
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
        // un evento raro nunca corta la sesión: se avisa por consola y se sigue con el resto
        for (const f of ev.fx || []) { try { if (f && typeof f === 'object') { f.life = f.max; this.fx.push(f); } } catch (e) { Net.warn('efecto', e); } }
        for (const x of ev.tx || []) { if (x && typeof x === 'object') this.texts.push(x); }
        for (const f of ev.fd || []) { if (f && typeof f === 'object') this.feed.push(f); }
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
      if (msg.k === 'cmd' && msg.c && typeof msg.c === 'object') {
        const c = this.game.humans[cl.slot];
        let err = null;
        try { err = this.game.command(c, msg.c); } catch (e) { Net.warn('orden del jugador (' + msg.c.t + ')', e); console.warn(e); return; }
        if (err && err !== 'no' && (msg.c.t === 'buy' || msg.c.t === 'sell' || msg.c.t === 'buyPartial')) this.transport.send(id, { k: 'msg', text: err, shop: msg.c.t === 'buyPartial' });
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
      if (this.closed) return;
      this.sendTimer -= dt;
      if (this.sendTimer > 0) return;
      this.sendTimer = 1 / Net.SNAPSHOT_HZ;
      const g = this.game;
      const snaps = {};
      for (const id in this.clients) {
        const cl = this.clients[id];
        // si algo falla armando la foto de un jugador, se avisa y se sigue: nunca se corta la sesión
        try {
          const s = snaps[cl.team] || (snaps[cl.team] = Net.snapshot(g, cl.team));
          let ev;
          try { ev = Net.events(g, cl.champId, cl.since); } catch (e) { Net.warn('eventos', e); ev = { fx: [], tx: [], fd: [] }; }
          cl.since = { fx: this.game.seq, tx: this.game.seq, fd: this.game.seq };
          this.transport.send(id, { k: 's', s: s, e: ev });
        } catch (e) { Net.warn('foto para ' + id, e); console.warn(e); }
      }
    }
    close() { this.closed = true; this.transport.close(); }
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
      if (!msg) return;
      try {
        if (msg.k === 's' && msg.s) this.world.applySnapshot(msg.s, msg.e, performance.now() / 1000);
        else if (msg.k === 'msg' && this.onNotice) this.onNotice(String(msg.text || ''));
      } catch (e) { Net.warn('foto del anfitrión', e); console.warn(e); }
    }
    step(dt) { this.world.interpolate(performance.now() / 1000, dt); }
    close() { this.transport.close(); }
  }
  Net.LocalSession = LocalSession; Net.HostSession = HostSession; Net.ClientSession = ClientSession;
})(window.MOBA);
