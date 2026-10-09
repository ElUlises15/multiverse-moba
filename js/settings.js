/* Configuración del jugador (se guarda en localStorage) y su menú.
 * Todo se aplica en vivo: M.Settings.on(fn) avisa cada cambio. */
window.MOBA = window.MOBA || {};
(function (M) {
  'use strict';
  const KEY = 'mvmoba-settings-v1';
  const ACTIONS = [
    // [id, nombre visible, teclas por defecto]
    ['q', 'Habilidad Q', ['KeyQ']], ['w', 'Habilidad W', ['KeyW']], ['e', 'Habilidad E', ['KeyE']], ['r', 'Habilidad R (definitiva)', ['KeyR']],
    ['learnQ', 'Subir Q', ['Ctrl+KeyQ', 'Alt+KeyQ']], ['learnW', 'Subir W', ['Ctrl+KeyW', 'Alt+KeyW']],
    ['learnE', 'Subir E', ['Ctrl+KeyE', 'Alt+KeyE']], ['learnR', 'Subir R', ['Ctrl+KeyR', 'Alt+KeyR']],
    ['attackMove', 'Atacar-mover', ['KeyA']], ['stop', 'Frenar', ['KeyS']], ['recall', 'Volver a la base', ['KeyB']],
    ['shop', 'Tienda', ['KeyP']], ['camLock', 'Fijar/soltar cámara', ['KeyY']], ['center', 'Centrar cámara (mantener)', ['Space']],
    ['scoreboard', 'Marcador (mantener)', ['Tab']], ['range', 'Ver alcance (mantener)', ['KeyC']], ['ping', 'Señal / ping (+ clic)', ['KeyG']]
  ];
  const DEFAULTS = {
    keys: {},
    castMode: 'indicator',          // quick | indicator | normal
    colorblind: 'none',             // none | protanopia | deuteranopia | tritanopia
    teamShapes: false,
    teamColors: ['#38a3ff', '#ff4a4a'],
    camZoom: 1, camPitch: 56, edgePan: 1500, camLockDefault: true, camSmooth: 10,
    uiScale: 1, quality: 'high', shadows: true, anime: true, autoFullscreen: true,
    master: 80, music: 55, sfx: 80, mute: false,
    showFps: false, minionBars: 'damaged', lastHit: true, hpTicks: true, showNames: true, damageNumbers: true
  };
  ACTIONS.forEach(function (a) { DEFAULTS.keys[a[0]] = a[2].slice(); });

  // Paletas para daltonismo: [equipo azul, equipo rojo] y colores de barras (vos, aliado, enemigo)
  const PALETTES = {
    none: null,
    protanopia: { team: ['#2f8fff', '#ffa31a'], bars: { me: '#f0e442', ally: '#2f8fff', enemy: '#ffa31a' } },
    deuteranopia: { team: ['#3b7dff', '#ff9a1f'], bars: { me: '#f5e94a', ally: '#3b7dff', enemy: '#ff9a1f' } },
    tritanopia: { team: ['#16b8b0', '#ff3d6e'], bars: { me: '#ffffff', ally: '#16b8b0', enemy: '#ff3d6e' } }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  const S = M.Settings = {
    ACTIONS: ACTIONS, DEFAULTS: DEFAULTS, PALETTES: PALETTES,
    data: clone(DEFAULTS), listeners: [],
    load: function () {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
      this.data = clone(DEFAULTS);
      if (saved && typeof saved === 'object') {
        for (const k in saved) if (k in DEFAULTS && k !== 'keys') this.data[k] = saved[k];
        if (saved.keys) for (const a in saved.keys) if (a in DEFAULTS.keys && Array.isArray(saved.keys[a])) this.data.keys[a] = saved.keys[a].slice(0, 2);
      }
      this.apply();
    },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento */ } },
    get: function (k) { return this.data[k]; },
    set: function (k, v) { this.data[k] = v; this.save(); this.apply(); this.emit(k); },
    reset: function () { this.data = clone(DEFAULTS); this.save(); this.apply(); this.emit('*'); },
    on: function (fn) { this.listeners.push(fn); },
    emit: function (k) { for (const fn of this.listeners) { try { fn(k, this.data); } catch (e) { console.warn(e); } } },

    // ---------- Teclas ----------
    /** Texto de una combinación a partir de un evento: "Ctrl+KeyQ", "KeyA", "Space"… */
    comboOf: function (e) {
      const mods = (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.metaKey ? 'Meta+' : '');
      return mods + e.code;
    },
    /** Acción que corresponde a la tecla (null si ninguna). Shift no cuenta (se usa para apuntar solo a campeones). */
    actionFor: function (e) {
      const combo = this.comboOf(e);
      for (const a in this.data.keys) if (this.data.keys[a].indexOf(combo) >= 0) return a;
      return null;
    },
    /** Acción que se suelta con esta tecla (ignora modificadores; para keyup). */
    actionForCode: function (code) {
      for (const a in this.data.keys) if (this.data.keys[a].some(function (k) { return k === code; })) return a;
      return null;
    },
    bind: function (action, index, combo) {
      const keys = clone(this.data.keys);
      // si la tecla ya estaba en otra acción, se la saca de ahí
      if (combo) for (const a in keys) keys[a] = keys[a].map(function (k) { return k === combo ? '' : k; });
      const list = keys[action] || [];
      while (list.length <= index) list.push('');
      list[index] = combo || '';
      keys[action] = list.filter(function (k, i) { return k || i === 0; });
      if (!keys[action].length) keys[action] = [''];
      this.set('keys', keys);
    },
    keyLabel: function (combo) {
      if (!combo) return '—';
      return combo.split('+').map(function (p) {
        if (p === 'Ctrl' || p === 'Alt' || p === 'Meta') return p;
        if (p.indexOf('Key') === 0) return p.slice(3);
        if (p.indexOf('Digit') === 0) return p.slice(5);
        const names = { Space: 'Espacio', Tab: 'Tab', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', Semicolon: 'Ñ' };
        return names[p] || p.replace('Numpad', 'Num ');
      }).join(' + ');
    },
    label: function (action) { return this.keyLabel((this.data.keys[action] || [])[0]); },

    // ---------- Aplicar ----------
    apply: function () {
      const d = this.data, pal = PALETTES[d.colorblind];
      const team = pal ? pal.team : d.teamColors;
      if (M.TEAM_COLORS) { M.TEAM_COLORS[0] = team[0]; M.TEAM_COLORS[1] = team[1]; }
      M.BAR_COLORS = pal ? pal.bars : { me: '#5ce06b', ally: team[0], enemy: team[1] };
      const root = document.documentElement;
      if (root && root.style) {
        root.style.setProperty('--team0', team[0]); root.style.setProperty('--team1', team[1]);
        root.style.setProperty('--ui-scale', String(d.uiScale));
      }
      if (document.body) document.body.classList.toggle('team-shapes', !!d.teamShapes);
    }
  };
  // Paleta original (antes de cualquier ajuste), por si se resetea
  S.load();

  // ======================= Menú de configuración =======================
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const TABS = [['controles', 'Controles'], ['juego', 'Juego'], ['camara', 'Cámara'], ['graficos', 'Gráficos'], ['audio', 'Audio'], ['accesibilidad', 'Accesibilidad']];
  const UI = M.SettingsUI = {
    tab: 'controles', capturing: null, onClose: null,
    open: function (onClose) {
      this.onClose = onClose || null;
      let el = document.getElementById('settings');
      if (!el) { el = document.createElement('div'); el.id = 'settings'; el.className = 'modal'; document.body.appendChild(el); }
      el.classList.remove('hidden');
      this.render();
    },
    close: function () {
      const el = document.getElementById('settings');
      if (el) el.classList.add('hidden');
      this.capturing = null;
      if (this.onClose) { const f = this.onClose; this.onClose = null; f(); }
    },
    isOpen: function () { const el = document.getElementById('settings'); return !!el && !el.classList.contains('hidden'); },
    row: function (label, control, hint) {
      return '<div class="set-row"><label>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><div class="set-ctl">' + control + '</div></div>';
    },
    range: function (k, min, max, step, fmt) {
      const v = S.get(k);
      return '<input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"><span class="set-val" data-v="' + k + '">' + (fmt ? fmt(v) : v) + '</span>';
    },
    check: function (k) { return '<input type="checkbox" data-k="' + k + '"' + (S.get(k) ? ' checked' : '') + '>'; },
    select: function (k, opts) {
      return '<select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(S.get(k)) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    },
    fmts: {
      camZoom: function (v) { return Math.round(v * 100) + '%'; }, camPitch: function (v) { return v + '°'; },
      edgePan: function (v) { return +v === 0 ? 'apagado' : v; }, uiScale: function (v) { return Math.round(v * 100) + '%'; },
      master: function (v) { return v + '%'; }, music: function (v) { return v + '%'; }, sfx: function (v) { return v + '%'; }, camSmooth: function (v) { return v; }
    },
    body: function () {
      const f = this.fmts;
      switch (this.tab) {
        case 'controles': {
          let h = '<p class="set-help">Hacé clic en una tecla y apretá la nueva. <b>Esc</b> cancela, <b>Borrar</b> la deja vacía. Si la tecla ya estaba en otra acción, se saca de ahí.</p><table class="keys"><tr><th>Acción</th><th>Principal</th><th>Alternativa</th></tr>';
          for (const a of ACTIONS) {
            const ks = S.get('keys')[a[0]] || [];
            h += '<tr><td>' + a[1] + '</td>';
            for (let i = 0; i < 2; i++) {
              const cap = this.capturing && this.capturing.a === a[0] && this.capturing.i === i;
              h += '<td><button class="keybtn' + (cap ? ' capturing' : '') + '" data-bind="' + a[0] + '" data-i="' + i + '">' + (cap ? 'Apretá una tecla…' : esc(S.keyLabel(ks[i]))) + '</button></td>';
            }
            h += '</tr>';
          }
          h += '</table>';
          h += this.row('Modo de lanzamiento', this.select('castMode', [['quick', 'Rápido (lanza al apretar)'], ['indicator', 'Rápido con indicador (lanza al soltar)'], ['normal', 'Normal (apretás y confirmás con clic izquierdo)']]));
          return h;
        }
        case 'juego':
          return this.row('Números de daño', this.check('damageNumbers')) +
            this.row('Barras de vida de súbditos', this.select('minionBars', [['damaged', 'Solo si están dañados'], ['always', 'Siempre']])) +
            this.row('Indicador de último golpe', this.check('lastHit'), 'Marca en la barra del súbdito cuánto le saca tu ataque básico') +
            this.row('Marcas cada 100 de vida', this.check('hpTicks')) +
            this.row('Nombres sobre los campeones', this.check('showNames')) +
            this.row('Mostrar FPS', this.check('showFps'));
        case 'camara':
          return this.row('Zoom inicial', this.range('camZoom', 0.6, 1.5, 0.05, f.camZoom), 'La rueda del mouse también hace zoom') +
            this.row('Inclinación de la cámara', this.range('camPitch', 40, 75, 1, f.camPitch)) +
            this.row('Velocidad de paneo por bordes', this.range('edgePan', 0, 3000, 100, f.edgePan)) +
            this.row('Suavidad de la cámara', this.range('camSmooth', 3, 25, 1, f.camSmooth), 'Más alto = sigue más rápido a tu campeón') +
            this.row('Cámara fija al empezar', this.check('camLockDefault'));
        case 'graficos':
          return this.row('Calidad', this.select('quality', [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']]), 'Resolución interna del 3D') +
            this.row('Sombras', this.check('shadows')) +
            this.row('Estilo anime', this.check('anime'), 'Activado de fábrica: sombreado toon con contornos, colores más vivos y modelos hechos en Blender (por ahora: Ignis v2). Desactivalo para volver al estilo clásico. Se aplica en la próxima partida. También: ?anime=0 o ?anime=1') +
            this.row('Tamaño de la interfaz', this.range('uiScale', 0.75, 1.5, 0.05, f.uiScale)) +
            this.row('Pantalla completa', '<button class="fs-btn set-fs" data-label="1">' + (M.Fullscreen && M.Fullscreen.isOn() ? '⛶ Salir de pantalla completa' : '⛶ Pantalla completa') + '</button>', 'Con pantalla completa, Ctrl+W, Ctrl+T y otros atajos no cierran la pestaña (Chrome/Edge). Mantené Esc para salir.') +
            this.row('Pantalla completa al empezar la partida', this.check('autoFullscreen'));
        case 'audio':
          return this.row('Volumen general', this.range('master', 0, 100, 1, f.master)) +
            this.row('Música', this.range('music', 0, 100, 1, f.music)) +
            this.row('Efectos de sonido', this.range('sfx', 0, 100, 1, f.sfx)) +
            this.row('Silenciar todo', this.check('mute')) +
            '<p class="set-help">La música actual es una banda sonora provisoria generada por el juego. Si ponés archivos en <code>assets/music/</code> (ver <code>assets/music/tracks.js</code>), se usan esos.</p>';
        case 'accesibilidad': {
          const cb = S.get('colorblind') !== 'none';
          return this.row('Modo daltonismo', this.select('colorblind', [['none', 'Apagado'], ['protanopia', 'Protanopía (rojo)'], ['deuteranopia', 'Deuteranopía (verde)'], ['tritanopia', 'Tritanopía (azul)']]),
            'Cambia los colores de equipos, barras de vida y minimapa') +
            this.row('Formas por equipo', this.check('teamShapes'), 'Aliados con círculo, enemigos con triángulo (barras y minimapa), no solo color') +
            this.row('Color del equipo Azul', '<input type="color" data-team="0" value="' + S.get('teamColors')[0] + '"' + (cb ? ' disabled' : '') + '>') +
            this.row('Color del equipo Rojo', '<input type="color" data-team="1" value="' + S.get('teamColors')[1] + '"' + (cb ? ' disabled' : '') + '>', cb ? 'Desactivado mientras uses un modo daltonismo' : '') +
            '<div class="set-preview"><span style="background:' + M.TEAM_COLORS[0] + '">Azul</span><span style="background:' + M.TEAM_COLORS[1] + '">Rojo</span>' +
            '<span style="background:' + M.BAR_COLORS.me + '">Vos</span></div>';
        }
      }
      return '';
    },
    render: function () {
      const el = document.getElementById('settings');
      if (!el) return;
      el.innerHTML = '<div class="modal-box settings-box"><div class="set-head"><h2>⚙ Configuración</h2><button class="set-close" title="Cerrar">✕</button></div>' +
        '<div class="set-tabs">' + TABS.map((t) => '<button data-tab="' + t[0] + '" class="' + (t[0] === this.tab ? 'active' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
        '<div class="set-body">' + this.body() + '</div>' +
        '<div class="set-foot"><button class="set-reset">Restablecer todo</button><span>Se guarda solo, en este navegador.</span><button class="set-done big-btn">Listo</button></div></div>';
      const self = this;
      el.querySelector('.set-close').onclick = function () { self.close(); };
      el.querySelector('.set-done').onclick = function () { self.close(); };
      el.querySelector('.set-reset').onclick = function () { if (confirm('¿Restablecer toda la configuración?')) { S.reset(); self.render(); } };
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { self.tab = b.dataset.tab; self.capturing = null; self.render(); }; });
      el.querySelectorAll('input[type=range][data-k]').forEach(function (inp) {
        inp.oninput = function () { const k = inp.dataset.k, v = parseFloat(inp.value); S.set(k, v); const out = el.querySelector('[data-v="' + k + '"]'); if (out) out.textContent = self.fmts[k] ? self.fmts[k](v) : v; };
      });
      el.querySelectorAll('input[type=checkbox][data-k]').forEach(function (inp) { inp.onchange = function () { S.set(inp.dataset.k, inp.checked); }; });
      el.querySelectorAll('select[data-k]').forEach(function (sel) { sel.onchange = function () { S.set(sel.dataset.k, sel.value); if (sel.dataset.k === 'colorblind') self.render(); }; });
      el.querySelectorAll('input[type=color][data-team]').forEach(function (inp) {
        inp.oninput = function () { const tc = S.get('teamColors').slice(); tc[+inp.dataset.team] = inp.value; S.set('teamColors', tc); const pv = el.querySelector('.set-preview'); if (pv) pv.children[+inp.dataset.team].style.background = inp.value; };
      });
      el.querySelectorAll('[data-bind]').forEach(function (b) { b.onclick = function () { self.capturing = { a: b.dataset.bind, i: +b.dataset.i }; self.render(); }; });
    },
    /** Captura de tecla para reasignar (se llama desde el keydown global; devuelve true si la consumió). */
    handleKey: function (e) {
      if (!this.isOpen()) return false;
      if (!this.capturing) {
        if (e.code === 'Escape') { e.preventDefault(); this.close(); }
        return true;   // con el menú abierto, el juego no recibe teclas
      }
      e.preventDefault(); e.stopPropagation();
      if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].indexOf(e.code) >= 0) return true;
      const c = this.capturing;
      this.capturing = null;
      if (e.code === 'Escape') { this.render(); return true; }
      if (e.code === 'Backspace' || e.code === 'Delete') { S.bind(c.a, c.i, ''); this.render(); return true; }
      S.bind(c.a, c.i, S.comboOf(e));
      this.render();
      return true;
    }
  };
  // la captura va antes que cualquier otro manejador de teclado
  window.addEventListener('keydown', function (e) { if (UI.isOpen()) { UI.handleKey(e); e.stopPropagation(); } }, true);
})(window.MOBA);
