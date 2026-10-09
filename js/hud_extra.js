/* HUD estilo LoL, parte 2: anuncios grandes (asesinatos, rachas, torres, as), feed con retratos,
 * panel del objetivo (arriba a la izquierda), marcos de aliados, K/D/A arriba a la derecha,
 * efectos activos sobre tus habilidades, resumen de muerte, viñeta de poca vida y destello al subir de nivel. */
(function (M) {
  'use strict';
  const U = M.util;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return U.escapeHtml(String(s == null ? '' : s)); };

  // ---------------------------------------------------------------- textos de los anuncios
  const MULTI = ['', '', '¡Asesinato doble!', '¡Asesinato triple!', '¡Cuadrakill!', '¡Pentakill!'];
  const SPREE = { 3: 'está en racha', 4: 'está descontrolado', 5: 'es imparable', 6: 'está dominando', 7: 'es divino' };
  function spreeText(n) { return n >= 8 ? 'es legendario' : SPREE[n] || ''; }
  const DMG_COL = { physical: '#ff9a4a', magic: '#b78cff', true: '#ffffff' };

  /** Arma el anuncio desde la perspectiva del jugador `me`. Devuelve { title, sub, tone: 'good'|'bad'|'neutral', sfx, killer, victim } o null. */
  M.announceText = function (ann, me, byId) {
    if (!ann || !me) return null;
    const find = byId || function () { return null; };
    if (ann.k === 'kill') {
      const k = ann.killer ? find(ann.killer) : null, v = find(ann.victim);
      const kName = k ? k.name : (ann.by || 'el entorno'), vName = v ? v.name : 'un campeón';
      const mine = ann.killer === me.id, died = ann.victim === me.id, allyKill = ann.team === me.team;
      const base = mine ? '¡Has asesinado a un enemigo!' : died ? '¡Has sido asesinado!' : allyKill ? '¡Un enemigo ha sido asesinado!' : '¡Un aliado ha sido asesinado!';
      let title = base, special = true, sfx = mine ? 'ann_kill' : died ? 'ann_death' : allyKill ? 'ann_good' : 'ann_bad';
      if (ann.multi >= 2) { title = MULTI[Math.min(5, ann.multi)]; sfx = 'ann_multi'; }
      else if (ann.first) { title = '¡Primera sangre!'; sfx = 'ann_first'; }
      else if (ann.shutdown) title = '¡Racha cortada!';
      else if (ann.spree >= 3 && k) title = '¡' + kName + ' ' + spreeText(ann.spree) + '!';
      else special = false;
      let line = k ? kName + ' eliminó a ' + vName : vName + ' fue ejecutado por ' + kName;
      if (ann.shutdown && !(ann.multi >= 2)) line += ' (cortó una racha de ' + ann.shutdown + ')';
      return { title: title, sub: (special ? base + ' · ' : '') + line, tone: allyKill ? 'good' : 'bad', sfx: sfx, killer: k, victim: v, team: ann.team };
    }
    if (ann.k === 'ace') {
      const good = ann.team !== me.team;
      return { title: '¡As!', sub: good ? 'Cayó todo el equipo enemigo' : 'Cayó todo tu equipo', tone: good ? 'good' : 'bad', sfx: 'ann_ace', team: 1 - ann.team };
    }
    if (ann.k === 'tower') {
      const own = ann.team === me.team;
      return { title: own ? '¡Destruyeron una de tus torres!' : '¡Tu equipo destruyó una torre!', sub: 'Carril ' + (M.LANE_NAMES[ann.lane] || ann.lane || ''), tone: own ? 'bad' : 'good', sfx: 'ann_tower', team: 1 - ann.team, tower: true };
    }
    if (ann.k === 'nexus') {
      if (ann.team !== me.team) return null;   // como en LoL: solo te avisan del tuyo
      return { title: '¡Tu nexo está bajo ataque!', sub: 'Volvé a defender', tone: 'bad', sfx: 'ann_alert', team: 1 - ann.team };
    }
    return null;
  };

  // ---------------------------------------------------------------- íconos
  const unitIconCache = {};
  /** Retrato para cualquier unidad: campeón = su retrato; el resto, un ícono simple con el color del equipo. */
  function unitIcon(u) {
    if (!u) return '';
    if (u.type === 'champion' && u.def) return M.Portraits.get(u.def, true) || '';
    const col = u.team === 2 ? '#c9a24a' : (M.TEAM_COLORS[u.team] || '#888');
    const key = u.type + (u.kind || '') + col;
    if (unitIconCache[key]) return unitIconCache[key];
    let shape;
    if (u.type === 'tower') shape = '<rect x="22" y="20" width="20" height="34" fill="' + col + '"/><rect x="18" y="12" width="28" height="10" fill="#ddd"/><circle cx="32" cy="9" r="5" fill="' + col + '"/>';
    else if (u.type === 'nexus') shape = '<path d="M32 6 L54 32 L32 58 L10 32Z" fill="' + col + '" stroke="#fff" stroke-width="2"/>';
    else if (u.type === 'monster') shape = u.kind === 'golem' ? '<rect x="14" y="16" width="36" height="34" rx="8" fill="#8a8f99"/><circle cx="26" cy="30" r="4" fill="#ffd54a"/><circle cx="38" cy="30" r="4" fill="#ffd54a"/>'
      : '<path d="M12 50 L20 14 L30 30 L34 30 L44 14 L52 50Z" fill="#7a6aa8"/><circle cx="26" cy="38" r="3" fill="#9ff"/><circle cx="38" cy="38" r="3" fill="#9ff"/>';
    else shape = '<circle cx="32" cy="24" r="11" fill="' + col + '"/><rect x="20" y="34" width="24" height="20" rx="6" fill="' + col + '"/>' + (u.kind === 'ranged' ? '<circle cx="48" cy="30" r="5" fill="#9cf"/>' : u.kind === 'cannon' ? '<rect x="40" y="36" width="16" height="7" fill="#555"/>' : '<rect x="44" y="18" width="4" height="26" fill="#ccc"/>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#101a2e"/>' + shape + '</svg>';
    return (unitIconCache[key] = 'data:image/svg+xml;base64,' + btoa(svg));
  }
  M.unitIcon = unitIcon;
  function unitName(u) {
    if (!u) return '';
    if (u.type === 'champion') return u.name + (u.playerName ? ' (' + u.playerName + ')' : '');
    if (u.type === 'minion') return 'Súbdito ' + ({ melee: 'cuerpo a cuerpo', ranged: 'a distancia', cannon: 'de asedio' }[u.kind] || '');
    if (u.type === 'tower') return 'Torre' + (u.lane ? ' (' + (M.LANE_NAMES[u.lane] || u.lane) + ')' : '');
    return u.name || u.type;
  }
  const BUFFS = {
    stun: ['Aturdido', '✶', 0], slow: ['Ralentizado', '↓', 0], fear: ['Aterrado', '!', 0], dot: ['Quemadura', '♨', 0], armorShred: ['Armadura rota', '⛉', 0],
    shield: ['Escudo', '⛨', 1], attackSpeed: ['Velocidad de ataque', '⚡', 1], moveSpeed: ['Velocidad', '»', 1], armor: ['Armadura', '◆', 1], mr: ['Resistencia mágica', '◇', 1],
    lifesteal: ['Robo de vida', '♥', 1], stealth: ['Invisible', '◌', 1], grow: ['Gigante', '▲', 1], undying: ['Inmortal', '✚', 1], ad: ['Daño', '⚔', 1], ap: ['Poder', '✦', 1]
  };
  /** Íconos de efectos activos con tiempo restante. */
  function buffsHtml(u, big) {
    if (!u || !u.buffs || !u.buffs.length) return '';
    return u.buffs.filter(function (b) { return b.remaining > 0 && b.remaining < 600; }).slice(0, 10).map(function (b) {
      const info = BUFFS[b.type] || [b.type, '•', (b.amount || 0) >= 0 ? 1 : 0];
      const good = info[2] && !(b.amount < 0);
      const pct = b.duration ? U.clamp(b.remaining / b.duration, 0, 1) : 1;
      const t = b.remaining >= 1 ? Math.ceil(b.remaining) : b.remaining.toFixed(1);
      return '<div class="buff ' + (good ? 'good' : 'bad') + (big ? ' big' : '') + '" title="' + info[0] + (b.amount && b.type !== 'stun' ? ' (' + (Math.abs(b.amount) < 1 ? Math.round(b.amount * 100) + '%' : Math.round(b.amount)) + ')' : '') + '">' +
        '<span class="bi">' + info[1] + '</span><span class="bt">' + t + '</span><i style="height:' + Math.round((1 - pct) * 100) + '%"></i></div>';
    }).join('');
  }
  M.buffsHtml = buffsHtml;

  // ---------------------------------------------------------------- clase principal
  class HudExtra {
    constructor(hud) {
      this.hud = hud; this.game = hud.game; this.p = hud.p;
      this.queue = []; this.cur = null; this.curT = 0;
      this.kills = [];         // feed de asesinatos con retratos
      this.selected = null;
      this.recapShown = false; this.lastLevel = this.p.level;
      this.wasDead = false;
      ['announce', 'target-panel', 'ally-frames', 'kda-box', 'my-buffs', 'death-recap', 'vignette', 'lvl-flash'].forEach(function (id) { const el = $(id); if (el) { el.innerHTML = ''; } });
      $('announce').className = 'hidden'; $('death-recap').className = 'hidden'; $('target-panel').className = 'hidden';
      for (const f of this.game.feed) f.seenAnn = true;    // lo viejo no se anuncia
    }
    byId(id) {
      const g = this.game;
      return g.champions.find(function (c) { return c.id === id; }) || (g.byId ? g.byId[id] : null) || g.units.find(function (u) { return u.id === id; }) || null;
    }
    // ---------- anuncios ----------
    pullFeed() {
      const g = this.game, me = this.p;
      for (const f of g.feed) {
        if (f.seenAnn) continue;
        f.seenAnn = true;
        if (!f.ann) continue;
        const a = M.announceText(f.ann, me, this.byId.bind(this));
        if (f.ann.k === 'kill') {
          this.kills.push({ t: g.time, ann: f.ann, k: a && a.killer, v: a && a.victim, team: f.ann.team, by: f.ann.by, n: f.ann.assists ? f.ann.assists.length : 0 });
          if (this.kills.length > 6) this.kills.shift();
          if (f.ann.victim === me.id) this.lastRecap = f.ann.recap;
        }
        if (!a) continue;
        a.prio = f.ann.k === 'kill' && (f.ann.multi >= 2 || f.ann.first) ? 3 : f.ann.k === 'ace' ? 3 : f.ann.killer === me.id || f.ann.victim === me.id ? 2 : 1;
        this.queue.push(a);
        // que no se acumulen: si hay muchos, se descartan los menos importantes
        while (this.queue.length > 4) {
          let low = 0; for (let i = 1; i < this.queue.length; i++) if (this.queue[i].prio < this.queue[low].prio) low = i;
          this.queue.splice(low, 1);
        }
      }
    }
    showBanner(a) {
      const el = $('announce');
      const col = M.TEAM_COLORS[a.team] || '#ffd54a';
      const pic = function (u, cls) { return u ? '<div class="ann-pic ' + cls + '" style="border-color:' + (M.TEAM_COLORS[u.team] || '#888') + '"><img src="' + unitIcon(u) + '"></div>' : ''; };
      el.innerHTML = '<div class="ann-row">' + pic(a.killer, 'k') + '<div class="ann-text"><div class="ann-title">' + esc(a.title) + '</div><div class="ann-sub">' + esc(a.sub) + '</div></div>' + pic(a.victim, 'v') + '</div>';
      el.className = 'ann ' + a.tone; el.style.setProperty('--ann-col', col);
      void el.offsetWidth; el.classList.add('show');
      if (M.Audio) M.Audio.sfx(a.sfx);
    }
    // ---------- cada cuadro ----------
    update(dt) {
      const g = this.game, p = this.p;
      this.pullFeed();
      if (this.cur) { this.curT -= dt; if (this.curT <= 0) { this.cur = null; $('announce').className = 'hidden'; this.gap = 0.25; } }
      if (this.gap > 0) this.gap -= dt;
      else if (!this.cur && this.queue.length) {
        let best = 0; for (let i = 1; i < this.queue.length; i++) if (this.queue[i].prio > this.queue[best].prio) best = i;
        this.cur = this.queue.splice(best, 1)[0]; this.curT = 2.6; this.showBanner(this.cur);
      }
      // viñeta de poca vida
      const frac = p.dead ? 0 : p.hp / p.maxHp;
      const v = $('vignette');
      const op = frac < 0.35 ? (0.35 - frac) / 0.35 * (0.75 + 0.25 * Math.sin(g.time * 6)) : 0;
      if (Math.abs((this.vigOp || 0) - op) > 0.02) { v.style.opacity = op.toFixed(2); this.vigOp = op; }
      // destello al subir de nivel
      if (p.level > this.lastLevel) { const f = $('lvl-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
      this.lastLevel = p.level;
    }
    // ---------- cada 0,2 s ----------
    slowUpdate() {
      const g = this.game, p = this.p;
      // K/D/A arriba a la derecha
      $('kda-box').innerHTML = '<span title="Asesinatos de tu equipo"><b style="color:' + M.TEAM_COLORS[p.team] + '">' + g.score[p.team] + '</b> vs <b style="color:' + M.TEAM_COLORS[1 - p.team] + '">' + g.score[1 - p.team] + '</b></span>' +
        '<span title="Asesinatos / Muertes / Asistencias">⚔ <b>' + p.kills + '/' + p.deaths + '/' + p.assists + '</b></span>' +
        '<span title="Súbditos y monstruos">CS <b>' + p.cs + '</b></span><span title="Tiempo de partida">⏱ <b>' + U.fmtTime(g.time) + '</b></span>';
      // feed de asesinatos con retratos
      const kills = this.kills.filter(function (k) { return g.time - k.t < 12; });
      const pic = function (u, team) { return u ? '<img src="' + unitIcon(u) + '" style="border-color:' + (M.TEAM_COLORS[u.team] || '#888') + '">' : '<span class="kf-env">' + esc(team) + '</span>'; };
      const kf = kills.map(function (k) {
        return '<div class="kf-item" style="border-color:' + M.TEAM_COLORS[k.team] + '">' + pic(k.k, k.by || '?') + (k.n ? '<span class="kf-ast">+' + k.n + '</span>' : '') +
          '<span class="kf-sw">⚔</span>' + pic(k.v, '') + '</div>';
      }).join('');
      if (kf !== this.kfHtml) { $('kill-portraits').innerHTML = kf; this.kfHtml = kf; }
      // marcos de aliados
      const allies = g.champions.filter(function (c) { return c.team === p.team && c !== p; });
      $('ally-frames').innerHTML = allies.map(function (c) {
        const hp = U.clamp(c.hp / c.maxHp, 0, 1), mn = c.maxMana ? U.clamp(c.mana / c.maxMana, 0, 1) : 0;
        const rReady = c.ranks && c.ranks[3] > 0 && c.cds && c.cds[3] <= 0;
        return '<div class="ally' + (c.dead ? ' dead' : '') + '" title="' + esc(c.name) + '"><div class="ap" style="border-color:' + M.TEAM_COLORS[c.team] + '"><img src="' + unitIcon(c) + '"><span class="alv">' + c.level + '</span>' +
          (c.dead ? '<span class="ard">' + Math.ceil(c.respawnTimer || 0) + '</span>' : '') + (rReady ? '<span class="ar" title="Definitiva lista">R</span>' : '') + '</div>' +
          '<div class="abars"><div class="ahp" style="width:' + (hp * 100).toFixed(1) + '%;background:' + (M.BAR_COLORS ? M.BAR_COLORS.ally : '#38a3ff') + '"></div><div class="amn" style="width:' + (mn * 100).toFixed(1) + '%"></div></div></div>';
      }).join('');
      // efectos activos sobre tus habilidades
      const mb = buffsHtml(p, false);
      if (mb !== this.mbHtml) { $('my-buffs').innerHTML = mb; this.mbHtml = mb; }
      this.renderTarget();
      this.renderRecap();
    }
    // ---------- panel del objetivo ----------
    targetUnit() {
      const p = this.p, g = this.game;
      let u = this.selected;
      if (u && (u.dead && u.type !== 'champion' || u.hiddenLocal || (g.units.indexOf(u) < 0 && g.champions.indexOf(u) < 0))) { u = this.selected = null; }
      if (!u) u = p.target || (p.targetId ? this.byId(p.targetId) : null);
      if (!u && this.hud.renderer.hoverTarget) u = this.hud.renderer.hoverTarget;
      return u && !u.dead ? u : (u && u.type === 'champion' ? u : null);
    }
    renderTarget() {
      const el = $('target-panel'), u = this.targetUnit();
      this.hud.renderer.selectedUnit = this.selected;
      if (!u || u === this.p && !this.selected) { if (!el.classList.contains('hidden')) el.className = 'hidden'; return; }
      el.className = '';
      const hp = U.clamp(u.hp / u.maxHp, 0, 1), mn = u.maxMana ? U.clamp(u.mana / u.maxMana, 0, 1) : 0;
      const ally = u.team === this.p.team;
      const num = function (f, d) { try { const v = f(); return isFinite(v) ? v : null; } catch (e) { return null; } };
      const stat = function (label, v, fmt) { return '<span title="' + label + '"><em>' + label + '</em> <b>' + (v == null ? '—' : fmt ? fmt(v) : Math.round(v)) + '</b></span>'; };
      const ad = num(function () { return u.ad; }), ap = num(function () { return u.ap; });
      const stats = stat('Daño', ad) + stat('Poder', ap) + stat('Armadura', num(function () { return u.getArmor(); })) + stat('Res. mág.', num(function () { return u.getMr(); })) +
        stat('Vel. at.', num(function () { return u.getAttackSpeed(); }), function (v) { return v.toFixed(2); }) + stat('Velocidad', num(function () { return u.getMoveSpeed(); })) +
        stat('Crítico', num(function () { return u.critChance; }), function (v) { return Math.round(v * 100) + '%'; }) + stat('Alcance', num(function () { return u.attackRange; }));
      let items = '';
      if (u.type === 'champion' && u.items) for (let i = 0; i < M.MAX_ITEMS; i++) items += '<div class="tslot">' + (u.items[i] ? '<img src="' + M.Portraits.itemIcon(u.items[i], 32) + '" title="' + esc(M.itemName(u.items[i])) + '">' : '') + '</div>';
      const html = '<div class="tp-head"><div class="tp-pic" style="border-color:' + (u.team === 2 ? '#c9a24a' : M.TEAM_COLORS[u.team]) + '"><img src="' + unitIcon(u) + '">' + (u.level ? '<span class="tp-lv">' + u.level + '</span>' : '') + '</div>' +
        '<div class="tp-main"><div class="tp-name">' + esc(unitName(u)) + (u.dead ? ' <span style="color:#ff8a8a">(muerto)</span>' : '') + '</div>' +
        '<div class="tp-bar hp"><i style="width:' + (hp * 100).toFixed(1) + '%;background:' + (ally ? (M.BAR_COLORS ? M.BAR_COLORS.ally : '#38a3ff') : (M.BAR_COLORS ? M.BAR_COLORS.enemy : '#ff4a4a')) + '"></i><span>' + Math.ceil(u.hp) + ' / ' + Math.round(u.maxHp) + '</span></div>' +
        (u.maxMana ? '<div class="tp-bar mn"><i style="width:' + (mn * 100).toFixed(1) + '%"></i><span>' + Math.floor(u.mana) + ' / ' + Math.round(u.maxMana) + '</span></div>' : '') + '</div></div>' +
        '<div class="tp-stats">' + stats + '</div>' + (items ? '<div class="tp-items">' + items + '</div>' : '') + '<div class="tp-buffs">' + buffsHtml(u, false) + '</div>';
      if (html !== this.tpHtml) { el.innerHTML = html; this.tpHtml = html; }
      el.dataset.unit = u.id;
    }
    select(u) { this.selected = u || null; this.tpHtml = ''; this.renderTarget(); }
    // ---------- resumen de muerte ----------
    renderRecap() {
      const p = this.p, el = $('death-recap'), g = this.game;
      if (!p.dead || g.over || !this.lastRecap) { if (!el.classList.contains('hidden')) el.className = 'hidden'; this.recapShown = false; return; }
      if (this.recapShown) return;
      this.recapShown = true;
      const r = this.lastRecap, self = this;
      const rows = r.rows.map(function (row) {
        const u = row.id ? self.byId(row.id) : null;
        const pct = r.total ? row.total / r.total * 100 : 0;
        const parts = row.parts.map(function (pt) { return '<div class="rc-part"><span>' + esc(pt.l) + '</span><b style="color:' + (DMG_COL[pt.k] || '#fff') + '">' + pt.a + '</b></div>'; }).join('');
        return '<div class="rc-row"><img src="' + (u ? unitIcon(u) : unitIcon({ type: 'tower', team: row.team })) + '"><div class="rc-body"><div class="rc-name">' + esc(row.name) +
          '<span>' + row.total + ' (' + Math.round(pct) + '%)</span></div><div class="rc-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' + parts + '</div></div>';
      }).join('');
      el.innerHTML = '<div class="rc-title">Resumen de muerte</div><div class="rc-total">Daño recibido en los últimos 15 s: <b>' + r.total + '</b> ' +
        '<span class="rc-key"><b style="color:' + DMG_COL.physical + '">físico</b> · <b style="color:' + DMG_COL.magic + '">mágico</b> · <b>verdadero</b></span></div>' + (rows || '<div>Sin datos</div>');
      el.className = '';
    }
  }
  M.HudExtra = HudExtra;
})(window.MOBA);
