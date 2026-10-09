/* Menú principal y sala multijugador (lobby).
 * El anfitrión crea la sala (código corto), los amigos se unen con el código, eligen campeón y equipo;
 * los lugares vacíos se llenan con bots al empezar. */
(function (M) {
  'use strict';
  /** Dirección pública del juego (GitHub Pages), para los links de las salas. */
  M.PUBLIC_URL = 'https://elulises15.github.io/multiverse-moba/';
  const Net = M.Net;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  const Lobby = M.Lobby = {
    role: null,          // 'host' | 'client'
    transport: null, state: null, myId: null, mode: 'peer', session: null,

    // ---------- Menú ----------
    initMenu: function () {
      const name = localStorage.getItem('mvmoba-name') || '';
      $('player-name').value = name;
      const params = new URLSearchParams(location.search);
      if (params.get('net') === 'local') $('local-mode').checked = true;
      if (params.get('sala')) { $('join-code').value = Net.cleanCode(params.get('sala')); }
      $('mode-solo').onclick = function () { Lobby.showTab('solo'); };
      $('mode-host').onclick = function () { Lobby.showTab('host'); };
      $('mode-join').onclick = function () { Lobby.showTab('join'); };
      $('create-room-btn').onclick = function () { Lobby.createRoom(); };
      $('join-room-btn').onclick = function () { Lobby.joinRoom($('join-code').value); };
      $('join-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') Lobby.joinRoom($('join-code').value); });
      $('lobby-leave').onclick = function () { Lobby.leave(); };
      $('lobby-start').onclick = function () { Lobby.hostStart(); };
      $('lobby-copy').onclick = function () {
        const t = $('lobby-link').textContent || (Lobby.state ? Lobby.state.code : '');
        if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () { /* nada */ });
        $('lobby-copy').textContent = '¡Copiado!'; setTimeout(function () { $('lobby-copy').textContent = 'Copiar'; }, 1200);
      };
      $('lobby-blue').onclick = function () { Lobby.request({ k: 'team', team: 0 }); };
      $('lobby-red').onclick = function () { Lobby.request({ k: 'team', team: 1 }); };
      if (!Net.peerAvailable()) $('net-note').textContent = 'PeerJS no está cargado: solo funciona el modo local.';
      this.showTab(params.get('sala') ? 'join' : 'solo');
    },
    showTab: function (tab) {
      ['solo', 'host', 'join'].forEach(function (t) { $('mode-' + t).classList.toggle('active', t === tab); $('tab-' + t).classList.toggle('hidden', t !== tab); });
      $('select-layout').classList.toggle('hidden', tab !== 'solo');
      $('role-filters').classList.toggle('hidden', tab !== 'solo');
      this.setMenuMsg('');
    },
    setMenuMsg: function (t, bad) { const el = $('menu-msg'); el.textContent = t || ''; el.style.color = bad ? '#ff8a8a' : '#9fd4ff'; },
    playerName: function () {
      const n = ($('player-name').value || '').trim().slice(0, 16) || 'Invocador';
      localStorage.setItem('mvmoba-name', n);
      return n;
    },
    netMode: function () { return $('local-mode').checked || !Net.peerAvailable() ? 'local' : 'peer'; },

    // ---------- Anfitrión ----------
    createRoom: function (retry) {
      const code = Net.makeCode(), self = this;
      this.mode = this.netMode();
      this.role = 'host'; this.myId = 'host';
      this.state = { code: code, mode: this.mode, players: [{ id: 'host', name: this.playerName(), team: 0, champ: (M.SelectScreen.selected || M.champions[0]).id }] };
      this.setMenuMsg(this.mode === 'local' ? 'Creando sala local…' : 'Conectando con el servidor de PeerJS…');
      this.handlers = {
        ready: function () { self.showLobby(); },
        join: function (id) { self.onJoin(id); },
        message: function (id, msg) { self.onHostMessage(id, msg); },
        leave: function (id) { self.onLeave(id); },
        error: function (text) {
          if (/en uso/.test(text) && !retry) { self.transport.close(); self.createRoom(true); return; }
          if (self.session) { if (M.App.notice) M.App.notice(text); return; }
          self.setMenuMsg(text, true); self.backToMenu();
        }
      };
      try { this.transport = Net.createHost(this.mode, code, this.handlers); }
      catch (e) { this.setMenuMsg('No se pudo crear la sala: ' + e.message, true); }
    },
    onJoin: function (id) {
      if (this.session) { this.transport.send(id, { k: 'full', text: 'La partida ya empezó.' }); return; }
      const st = this.state;
      if (st.players.length >= 10) { this.transport.send(id, { k: 'full', text: 'La sala está llena (10 jugadores).' }); return; }
      const blue = st.players.filter(function (p) { return p.team === 0; }).length;
      st.players.push({ id: id, name: 'Invocador', team: blue <= st.players.length - blue ? 0 : 1, champ: null });
      this.broadcastLobby();
    },
    onLeave: function (id) {
      if (this.session && this.session.onLeave) { this.session.onLeave(id); return; }
      if (!this.state) return;
      this.state.players = this.state.players.filter(function (p) { return p.id !== id; });
      this.broadcastLobby();
    },
    onHostMessage: function (id, msg) {
      if (this.session) { this.session.onMessage(id, msg); return; }
      const p = this.state && this.state.players.find(function (q) { return q.id === id; });
      if (!p || !msg) return;
      this.applyRequest(p, msg);
    },
    applyRequest: function (p, msg) {
      const st = this.state;
      if (msg.k === 'hello' || msg.k === 'name') p.name = String(msg.name || 'Invocador').slice(0, 16);
      else if (msg.k === 'team') {
        const t = msg.team === 1 ? 1 : 0;
        if (st.players.filter(function (q) { return q.team === t && q !== p; }).length < 5) p.team = t;
        if (p.champ && st.players.some(function (q) { return q !== p && q.team === p.team && q.champ === p.champ; })) p.champ = null;
      } else if (msg.k === 'pick') {
        const def = M.championById[msg.champ];
        if (def && !st.players.some(function (q) { return q !== p && q.team === p.team && q.champ === def.id; })) p.champ = def.id;
      }
      this.broadcastLobby();
    },
    broadcastLobby: function () {
      for (const p of this.state.players) if (p.id !== 'host') this.transport.send(p.id, { k: 'lobby', state: this.state, you: p.id });
      this.renderLobby();
    },
    /** Pedido del jugador local (anfitrión: se aplica directo; cliente: se manda al anfitrión). */
    request: function (msg) {
      if (this.role === 'host') { const me = this.state.players.find(function (q) { return q.id === 'host'; }); this.applyRequest(me, msg); }
      else if (this.transport) this.transport.send(msg);
    },
    hostStart: function () {
      if (this.role !== 'host') return;
      const st = this.state;
      const usedByTeam = [{}, {}];
      st.players.forEach(function (p) { if (p.champ) usedByTeam[p.team][p.champ] = true; });
      const roster = st.players.map(function (p) {
        let champ = p.champ;
        if (!champ) {
          const free = M.champions.filter(function (c) { return !usedByTeam[p.team][c.id]; });
          champ = (free[Math.floor(Math.random() * free.length)] || M.champions[0]).id;
          usedByTeam[p.team][champ] = true;
        }
        return { defId: champ, team: p.team, human: true, slot: p.id, name: p.name };
      });
      const full = M.Game.fillWithBots(roster);
      const game = new M.Game({ roster: full, localSlot: 'host' });
      const champs = game.champions.map(function (c) { return { i: c.id, df: c.def.id, tm: c.team, hu: c.human ? 1 : 0, nm: c.playerName, slot: c.slot }; });
      const clients = {};
      for (const p of st.players) {
        if (p.id === 'host') continue;
        clients[p.id] = { slot: p.id };
        this.transport.send(p.id, { k: 'start', slot: p.id, champs: champs, code: st.code });
      }
      this.session = M.App.startHosted(game, this.transport, clients);
    },

    // ---------- Cliente ----------
    joinRoom: function (codeRaw) {
      const code = Net.cleanCode(codeRaw), self = this;
      if (code.length < 4) { this.setMenuMsg('Escribí el código de la sala (5 letras).', true); return; }
      this.mode = this.netMode();
      this.role = 'client';
      this.setMenuMsg(this.mode === 'local' ? 'Buscando la sala local ' + code + '…' : 'Conectando con la sala ' + code + '…');
      this.handlers = {
        open: function () { self.transport.send({ k: 'hello', name: self.playerName() }); },
        message: function (msg) { self.onClientMessage(msg); },
        close: function () {
          if (self.session) { if (M.App.notice) M.App.notice('Se cortó la conexión con el anfitrión.'); }
          else { self.setMenuMsg('El anfitrión cerró la sala.', true); self.backToMenu(); }
        },
        error: function (text) {
          if (self.session) { if (M.App.notice) M.App.notice(text); return; }
          self.setMenuMsg(text, true); self.backToMenu();
        }
      };
      try { this.transport = Net.createClient(this.mode, code, this.handlers); }
      catch (e) { this.setMenuMsg('No se pudo conectar: ' + e.message, true); }
    },
    onClientMessage: function (msg) {
      if (!msg) return;
      if (this.session) { this.session.onMessage(msg); return; }
      if (msg.k === 'lobby') { this.state = msg.state; this.myId = msg.you; if ($('lobby-screen').classList.contains('hidden')) this.showLobby(); else this.renderLobby(); }
      else if (msg.k === 'full') { this.setMenuMsg(msg.text, true); this.transport.close(); this.backToMenu(); }
      else if (msg.k === 'start') { this.session = M.App.startClient(this.transport, msg); }
    },

    // ---------- Interfaz de la sala ----------
    showLobby: function () {
      $('select-screen').classList.add('hidden');
      $('lobby-screen').classList.remove('hidden');
      this.renderLobby();
      const me = this.state.players.find((q) => q.id === this.myId);
      const def = M.championById[(me && me.champ) || ''] || M.SelectScreen.selected || M.champions[0];
      M.SelectScreen.selected = def;
      this.pickerTaken = null;
      this.renderPicker();
    },
    renderPicker: function () {
      const st = this.state, me = st.players.find((q) => q.id === this.myId);
      const taken = {};
      st.players.forEach(function (q) { if (me && q !== me && q.team === me.team && q.champ) taken[q.champ] = true; });
      const key = JSON.stringify(taken);
      if (key === this.pickerTaken) return;
      this.pickerTaken = key;
      M.SelectScreen.init({ gridId: 'lobby-grid', detailId: 'lobby-detail', filtersId: null, taken: taken,
        button: 'Elegir a {name}', onPlay: (id) => { this.request({ k: 'pick', champ: id }); },
        onSelect: (id) => { if (!taken[id]) this.request({ k: 'pick', champ: id }); } });
    },
    renderLobby: function () {
      const st = this.state;
      if (!st) return;
      $('lobby-code').textContent = st.code;
      $('lobby-mode').textContent = st.mode === 'local' ? 'Sala local (pestañas de este navegador)' : 'Sala online (WebRTC P2P vía PeerJS)';
      // El link para compartir: la dirección actual, o la versión publicada si el juego se abrió como archivo local
      const here = location.href.split('?')[0].split('#')[0];
      const base = (location.protocol === 'file:' && st.mode !== 'local') ? M.PUBLIC_URL : here;
      const link = base + '?sala=' + st.code + (st.mode === 'local' ? '&net=local' : '');
      $('lobby-link').textContent = link;
      for (let t = 0; t < 2; t++) {
        const list = st.players.filter(function (p) { return p.team === t; });
        let html = '';
        for (let i = 0; i < 5; i++) {
          const p = list[i];
          if (p) {
            const def = M.championById[p.champ];
            html += '<div class="slot' + (p.id === this.myId ? ' me' : '') + '"><span class="pname">' + esc(p.name) + (p.id === 'host' ? ' 👑' : '') + '</span>' +
              '<span class="pchamp">' + (def ? esc(def.name) + ' · ' + def.role : 'eligiendo…') + '</span></div>';
          } else html += '<div class="slot empty"><span class="pname">Bot</span><span class="pchamp">lugar libre</span></div>';
        }
        $(t ? 'lobby-team-red' : 'lobby-team-blue').innerHTML = html;
      }
      const host = this.role === 'host';
      $('lobby-start').classList.toggle('hidden', !host);
      $('lobby-wait').classList.toggle('hidden', host);
      $('lobby-count').textContent = st.players.length + ' jugador' + (st.players.length === 1 ? '' : 'es') + ' · ' + (10 - st.players.length) + ' bots';
      if ($('lobby-screen').offsetParent !== null) this.renderPicker();
    },
    leave: function () {
      if (this.transport) this.transport.close();
      this.transport = null; this.state = null; this.session = null; this.role = null;
      this.backToMenu();
    },
    backToMenu: function () {
      $('lobby-screen').classList.add('hidden');
      if (!this.session) { $('select-screen').classList.remove('hidden'); M.App.showSelect(); }
    },
    reset: function () {
      if (this.transport) { try { this.transport.close(); } catch (e) { /* nada */ } }
      this.transport = null; this.state = null; this.session = null; this.role = null;
    }
  };
})(window.MOBA);
