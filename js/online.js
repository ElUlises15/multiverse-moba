/* Juego en línea con el servidor dedicado (WebSocket): lista de partidas, crear/unirse a salas,
 * entrar a una partida en curso tomando un bot, y reconexión automática (token guardado en el navegador). */
(function (M) {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const TOKEN_KEY = 'mvmoba-token', ACTIVE_KEY = 'mvmoba-active';
  const fmt = function (s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  const Online = M.Online = {
    ws: null, status: 'idle', id: null, rooms: [], picking: null, bots: null, lastMsgAt: 0, everOpen: false,
    lostAt: 0, retryTimer: 0, pingTimer: 0, connectTimer: 0, slowTimer: 0, pendingJoin: null, msg: '',

    /** Dirección del servidor: ?server=…, el mismo servidor que sirve la página, o la de config.js. */
    url: function () {
      const q = new URLSearchParams(location.search).get('server');
      let u = q || '';
      if (!u && M.CONFIG && M.CONFIG.SAME_ORIGIN_SERVER) u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      if (!u) u = (M.CONFIG && M.CONFIG.SERVER_URL) || '';
      u = u.trim().replace(/^http/, 'ws');
      if (u && !/^wss?:\/\//.test(u)) u = 'wss://' + u;
      if (u && !/\/ws\/?$/.test(u)) u = u.replace(/\/+$/, '') + '/ws';
      return u;
    },
    /** El transporte que usa la sala (Lobby) en modo servidor. */
    adapter: {
      kind: 'server',
      send: function (m) { Online.send(m); },
      close: function () { Online.send({ k: 'leave' }); try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* nada */ } }
    },
    inRoom: function () { return !!(M.Lobby && M.Lobby.mode === 'server' && M.Lobby.transport === this.adapter); },

    init: function () {
      $('online-create').onclick = function () { Online.create(); };
      $('online-refresh').onclick = function () { Online.send({ k: 'list' }); };
      $('online-retry').onclick = function () { Online.connect(true); };
      $('online-p2p').onclick = function () { M.Lobby.showTab('host'); };
      $('online-rooms').onclick = function (e) {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.join) Online.join(b.dataset.join);
        if (b.dataset.pick) Online.openPicker(b.dataset.pick);
      };
      $('online-bots').onclick = function (e) {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.take) Online.take(Online.picking, +b.dataset.take);
        if (b.dataset.close != null) Online.closePicker();
      };
      setInterval(function () { if (Online.picking && Online.status === 'online') Online.send({ k: 'bots', room: Online.picking }); }, 2000);
      const p = new URLSearchParams(location.search).get('partida');
      if (p) this.pendingJoin = M.Net.cleanCode(p);
      // si estabas en una partida y recargaste o cerraste la pestaña: volver solo
      let active = null;
      try { active = localStorage.getItem(ACTIVE_KEY) && localStorage.getItem(TOKEN_KEY); } catch (e) { /* nada */ }
      if (active || this.pendingJoin) this.connect();
    },
    /** Se abrió la pestaña "Jugar online". */
    open: function () { this.connect(); this.render(); if (this.status === 'online') this.send({ k: 'list' }); },

    connect: function (force) {
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
      clearTimeout(this.retryTimer);
      const url = this.url();
      if (!url) { this.setStatus('offline'); return; }
      this.setStatus('connecting');
      let ws;
      try { ws = new WebSocket(url); } catch (e) { this.setStatus('offline'); return; }
      this.ws = ws;
      const self = this;
      clearTimeout(this.connectTimer); clearTimeout(this.slowTimer);
      this.slowTimer = setTimeout(function () { if (self.status === 'connecting') self.setStatus('waking'); }, 4000);
      this.connectTimer = setTimeout(function () { if (ws.readyState === 0) { try { ws.close(); } catch (e) { /* nada */ } } }, (M.CONFIG && M.CONFIG.CONNECT_TIMEOUT_MS) || 70000);
      ws.onopen = function () {
        clearTimeout(self.connectTimer); clearTimeout(self.slowTimer);
        self.everOpen = true; self.lastMsgAt = Date.now();
        let token = null; try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* nada */ }
        ws.send(JSON.stringify({ k: 'hello', name: M.Lobby.playerName(), token: token }));
        clearInterval(self.pingTimer);
        self.pingTimer = setInterval(function () {
          if (ws.readyState !== 1) return;
          if (Date.now() - self.lastMsgAt > 15000) { try { ws.close(); } catch (e) { /* nada */ } return; }   // conexión muerta
          try { ws.send(JSON.stringify({ k: 'ping', t: Date.now() })); } catch (e) { /* nada */ }
        }, 4000);
      };
      ws.onmessage = function (ev) {
        self.lastMsgAt = Date.now();
        let msg = null;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (!msg) return;
        try { self.handle(msg); } catch (e) { console.warn('[servidor] mensaje ignorado:', e); }
      };
      ws.onclose = function () {
        clearInterval(self.pingTimer); clearTimeout(self.connectTimer); clearTimeout(self.slowTimer);
        if (self.ws !== ws) return;
        self.ws = null;
        self.onLost();
      };
      ws.onerror = function () { /* lo maneja onclose */ };
    },
    onLost: function () {
      const self = this;
      if (this.inRoom()) {
        // en una sala o partida: reintentar hasta 60 s (el servidor guarda tu campeón ese tiempo)
        if (!this.lostAt) this.lostAt = Date.now();
        if (Date.now() - this.lostAt > 60000) { this.lostAt = 0; M.Lobby.onHostGone('Se perdió la conexión con el servidor.'); this.setStatus('offline'); return; }
        if (M.App && M.App.notice) M.App.notice('Se cortó la conexión con el servidor. Reconectando…');
        this.setStatus('reconnecting');
        this.retryTimer = setTimeout(function () { self.connect(); }, 1500);
        return;
      }
      this.setStatus(this.everOpen ? 'reconnecting' : 'offline');
      if (this.everOpen) this.retryTimer = setTimeout(function () { self.connect(); }, 3000);
    },
    send: function (m) {
      if (!this.ws || this.ws.readyState !== 1) return false;
      let s; try { s = JSON.stringify(m); } catch (e) { return false; }
      try { this.ws.send(s); return true; } catch (e) { return false; }
    },
    /** La sala (Lobby) pasa a usar el servidor. */
    ensureLobby: function () {
      const L = M.Lobby;
      if (!this.inRoom()) {
        L.reset();
        L.mode = 'server'; L.role = 'client'; L.transport = this.adapter; L.hostGone = false;
      }
      try { localStorage.setItem(ACTIVE_KEY, '1'); } catch (e) { /* nada */ }
    },
    handle: function (msg) {
      switch (msg.k) {
        case 'pong': return;
        case 'debug': Online.lastDebug = msg; return;     // respuestas para los tests automáticos
        case 'welcome': {
          this.id = msg.id;
          try { localStorage.setItem(TOKEN_KEY, msg.token); } catch (e) { /* nada */ }
          this.setStatus('online');
          if (this.lostAt && M.App && M.App.notice) M.App.notice('Reconectado con el servidor.');
          const wasIn = this.inRoom();
          this.lostAt = 0;
          if (msg.rooms) { this.rooms = msg.rooms; this.render(); }
          if (wasIn && !msg.resumed) { M.Lobby.onHostGone('El servidor se reinició: la partida terminó.'); }
          if (!msg.resumed && !wasIn) { try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* nada */ } }
          if (this.pendingJoin) { const c = this.pendingJoin; this.pendingJoin = null; this.join(c); }
          return;
        }
        case 'rooms': this.rooms = msg.rooms || []; this.render(); return;
        case 'bots': if (this.picking && msg.room === this.picking) { this.bots = msg; this.renderPicker(); } return;
        case 'error':
          if (this.inRoom() && M.App && M.App.notice && M.Lobby.session) M.App.notice(msg.text);
          this.msg = msg.text; this.render();
          return;
        case 'closed':
          if (this.inRoom()) M.Lobby.onHostGone(msg.text || 'La sala se cerró.');
          else { this.msg = msg.text || ''; this.render(); }
          try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* nada */ }
          return;
        case 'lobby': case 'start':
          this.closePicker();
          this.ensureLobby();
          M.Lobby.onClientMessage(msg);
          return;
        case 's': case 'msg':
          if (this.inRoom()) M.Lobby.onClientMessage(msg);
          return;
      }
    },

    // ---------- acciones ----------
    create: function () {
      if (this.status !== 'online') { this.connect(); return; }
      this.send({ k: 'name', name: M.Lobby.playerName() });
      this.send({ k: 'create', name: ($('online-room-name').value || '').trim() });
    },
    join: function (code) {
      if (this.status !== 'online') { this.pendingJoin = code; this.connect(); return; }
      this.send({ k: 'name', name: M.Lobby.playerName() });
      this.send({ k: 'join', room: code });
    },
    openPicker: function (code) { this.picking = code; this.bots = null; this.renderPicker(); this.send({ k: 'bots', room: code }); },
    closePicker: function () { this.picking = null; this.bots = null; const el = $('online-bots'); if (el) { el.classList.add('hidden'); el.innerHTML = ''; } },
    take: function (code, champId) {
      this.send({ k: 'name', name: M.Lobby.playerName() });
      this.send({ k: 'take', room: code, champ: champId });
    },

    // ---------- interfaz ----------
    setStatus: function (s) { this.status = s; this.render(); },
    render: function () {
      const st = $('online-status');
      if (!st) return;
      const texts = {
        idle: '', connecting: 'Conectando con el servidor…',
        waking: 'Despertando el servidor… (si estaba dormido puede tardar hasta un minuto)',
        online: '● Conectado al servidor', reconnecting: 'Se cortó la conexión. Reconectando…',
        offline: 'Servidores fuera de línea. Podés jugar con tus amigos por P2P (Otros modos) o reintentar.'
      };
      st.textContent = texts[this.status] || '';
      st.className = 'online-status ' + this.status;
      $('online-offline').classList.toggle('hidden', this.status !== 'offline');
      $('online-main').classList.toggle('hidden', this.status !== 'online');
      $('online-msg').textContent = this.msg || '';
      if (this.status !== 'online') return;
      const rows = this.rooms.map(function (r) {
        const t = r.teams || [{}, {}];
        const status = r.status === 'lobby' ? '<span class="rs lobby">En la sala</span>' : r.status === 'playing' ? '<span class="rs play">En curso · ' + fmt(r.elapsed) + ' · ' + (r.score ? r.score[0] + '–' + r.score[1] : '') + '</span>' : '<span class="rs ended">Terminada</span>';
        const btn = r.status === 'lobby' ? '<button data-join="' + esc(r.code) + '">Unirse</button>'
          : r.status === 'playing' ? '<button data-pick="' + esc(r.code) + '"' + (r.free ? '' : ' disabled') + '>Unirse a partida en curso' + (r.free ? ' (' + r.free + ' bots libres)' : '') + '</button>' : '';
        return '<div class="room-row"><div class="rn"><b>' + esc(r.name) + '</b> <span class="rc">' + esc(r.code) + '</span><br><small>creada por ' + esc(r.owner) + '</small></div>' +
          '<div class="rt"><span class="tb">Azul: ' + (t[0].humans || 0) + ' 👤 ' + (t[0].bots || 0) + ' 🤖</span> <span class="tr">Rojo: ' + (t[1].humans || 0) + ' 👤 ' + (t[1].bots || 0) + ' 🤖</span></div>' +
          '<div class="rsw">' + status + '</div><div class="rb">' + btn + '</div></div>';
      }).join('');
      $('online-rooms').innerHTML = rows || '<div class="room-empty">No hay partidas ahora. ¡Creá una sala!</div>';
    },
    renderPicker: function () {
      const el = $('online-bots');
      if (!el || !this.picking) return;
      el.classList.remove('hidden');
      const room = this.rooms.find((r) => r.code === this.picking);
      let html = '<div class="bp-head"><b>Unirse a "' + esc(room ? room.name : this.picking) + '"</b> — elegí un campeón manejado por un bot (de cualquier equipo). Lo manejás al instante. <button data-close="1">Cerrar</button></div>';
      if (!this.bots) html += '<div class="bp-wait">Cargando…</div>';
      else if (this.bots.status !== 'playing') html += '<div class="bp-wait">Esa partida ya no está en curso.</div>';
      else if (!this.bots.list.length) html += '<div class="bp-wait">No quedan bots libres en esta partida.</div>';
      else html += this.bots.list.map(function (b) {
        const def = M.championById[b.df];
        const pic = def && M.Portraits ? M.Portraits.get(def, true) : '';
        return '<div class="bp-row ' + (b.tm ? 'red' : 'blue') + '">' + (pic ? '<img src="' + pic + '">' : '') + '<span class="bn">' + esc(b.name) + (b.dead ? ' <small>(muerto)</small>' : '') + '</span>' +
          '<span class="bt">' + (b.tm ? 'Rojo' : 'Azul') + '</span><span class="bl">Nv ' + b.lv + '</span><span class="bk">' + b.k + '/' + b.d + '/' + b.a + '</span>' +
          '<button data-take="' + b.i + '">Tomar</button></div>';
      }).join('');
      el.innerHTML = html;
    }
  };
})(window.MOBA);
