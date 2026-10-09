/* HUD: barras, habilidades, minimapa, marcador, tienda y feed de eventos */
(function (M) {
  'use strict';
  const U = M.util;
  const $ = function (id) { return document.getElementById(id); };
  const STAT_LABELS = { ad: 'Daño', ap: 'Poder', armor: 'Armadura', mr: 'Res. mág.', attackSpeed: 'Vel. ataque', moveSpeed: 'Velocidad' };

  function abilityMeta(ab) {
    return M.Abilities.statsText(ab).join(' · ');
  }
  M.abilityMeta = abilityMeta;
  /** Resalta el valor del rango actual en textos tipo "60/90/120/150/180". */
  function highlightRank(text, rank) {
    if (!rank) return text;
    return text.replace(/\d+(?:[.,]\d+)?%?(?:\/\d+(?:[.,]\d+)?%?){2,}/g, function (m) {
      return m.split('/').map(function (v, i) { return i === rank - 1 ? '<b class="rank-now">' + v + '</b>' : v; }).join('/');
    });
  }
  M.highlightRank = highlightRank;
  const SHOP_TABS = [['rec', 'Recomendados'], ['all', 'Todos'], ['1', 'Básicos'], ['2', 'Intermedios'], ['3', 'Legendarios'], ['boots', 'Botas']];

  class HUD {
    constructor(session, renderer) {
      this.session = session; this.game = session.world; this.renderer = renderer; this.p = session.world.player;
      this.slowTimer = 0;
      this.shopTab = 'rec'; this.shopSel = null;
      this.lastLevel = session.world.player.level; this.lastGold = session.world.player.gold;
      this.build();
      this.settingsFn = (k) => { if (k === 'keys' || k === '*') this.refreshKeys(); };
      M.Settings.on(this.settingsFn);
    }

    build() {
      const p = this.p, def = p.def;
      M.Portraits.draw($('portrait-canvas').getContext('2d'), def, 84, true);
      const wrap = $('abilities');
      wrap.innerHTML = '';
      this.abEls = def.abilities.map((ab, i) => {
        const box = document.createElement('div');
        box.className = 'ability-wrap';
        const up = document.createElement('button');
        up.className = 'skill-up hidden';
        up.dataset.slot = i;
        up.title = 'Aprender / subir ' + ab.name + ' (Ctrl o Alt + ' + ab.key + ')';
        up.textContent = '+';
        up.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); this.learn(i); });
        const el = document.createElement('div');
        el.className = 'ability';
        el.style.background = 'linear-gradient(160deg, ' + U.hexToRgba(def.color, 0.85) + ', ' + U.hexToRgba(ab.color, 0.35) + ')';
        el.innerHTML = '<div class="ab-key">' + M.Settings.label(['q', 'w', 'e', 'r'][i]) + '</div><div class="ab-mana"></div>' +
          '<div class="ab-name">' + ab.name + '</div><div class="ab-cd"></div><div class="ab-cdtext"></div>';
        const pips = document.createElement('div');
        pips.className = 'rank-pips';
        for (let r = 0; r < M.MAX_RANK[i]; r++) pips.appendChild(document.createElement('span'));
        el.addEventListener('mouseenter', () => this.showTooltip(el, this.abilityTooltip(i)));
        el.addEventListener('mouseleave', () => this.hideTooltip());
        box.appendChild(up); box.appendChild(el); box.appendChild(pips);
        wrap.appendChild(box);
        return { el: el, up: up, pips: pips, mana: el.querySelector('.ab-mana'), cd: el.querySelector('.ab-cd'), txt: el.querySelector('.ab-cdtext'), last: '' };
      });
      this.hpFill = document.querySelector('.bar.hp .fill');
      this.hpShield = document.querySelector('.bar.hp .shield');
      this.hpText = document.querySelector('.bar.hp span');
      this.manaFill = document.querySelector('.bar.mana .fill');
      this.manaText = document.querySelector('.bar.mana span');
      this.xpFill = document.querySelector('.bar.xp .fill');
      this.mctx = $('minimap').getContext('2d');
      $('shop-btn').onclick = () => this.toggleShop();
      if (!$('fps')) { const f = document.createElement('div'); f.id = 'fps'; $('hud').appendChild(f); }
      ['scoreboard', 'shop', 'death-overlay', 'endscreen', 'pause', 'tooltip'].forEach(function (id) { $(id).classList.add('hidden'); });
      $('killfeed').innerHTML = '';
    }

    refreshKeys() {
      const acts = ['q', 'w', 'e', 'r'];
      this.abEls.forEach(function (a, i) { const k = a.el.querySelector('.ab-key'); if (k) k.textContent = M.Settings.label(acts[i]); });
      $('shop-btn').title = 'Tienda (' + M.Settings.label('shop') + ')';
    }
    destroy() { const fn = this.settingsFn; M.Settings.listeners = M.Settings.listeners.filter(function (f) { return f !== fn; }); }

    learn(slot) {
      if (!this.p.canLearn(slot)) return false;
      const err = this.session.cmd({ t: 'learn', s: slot });
      this.abEls.forEach(function (a) { a.last = ''; });
      return !err;
    }

    abilityTooltip(i) {
      const ab = this.p.def.abilities[i], rank = this.p.ranks[i];
      const key = M.Settings.label(['q', 'w', 'e', 'r'][i]);
      let html = '<b>[' + key + '] ' + ab.name + '</b> <span style="color:#8fa0c0">Rango ' + rank + '/' + M.MAX_RANK[i] + '</span><br>' + ab.desc +
        '<br><span style="color:#cfe0ff">' + highlightRank(M.Abilities.statsText(ab).join('<br>'), rank) + '</span>';
      if (rank) {
        const cost = Math.round(this.p.manaCost(i)), cd = this.p.cooldown(i);
        html += '<br><span style="color:#9fe0ff">Ahora: ' + (cost ? cost + ' de maná · ' : '') + 'enfriamiento ' + cd.toFixed(1) + ' s (con tu aceleración)</span>';
      }
      if (i === 3) html += '<br><span style="color:#8fa0c0">Se aprende en los niveles 6, 11 y 16</span>';
      else html += '<br><span style="color:#8fa0c0">Rango máximo: 5 (como mucho ⌈nivel/2⌉)</span>';
      return html;
    }

    showNotice(text) { this.notice = text; this.noticeUntil = this.game.time + 6; }
    showTooltip(el, html) {
      const t = $('tooltip');
      t.innerHTML = html; t.classList.remove('hidden');
      const r = el.getBoundingClientRect();
      t.style.left = Math.max(8, r.left) + 'px';
      t.style.top = (r.top - t.offsetHeight - 10) + 'px';
    }
    hideTooltip() { $('tooltip').classList.add('hidden'); }

    update(dt) {
      const g = this.game, p = this.p;
      // habilidades
      p.def.abilities.forEach((ab, i) => {
        const a = this.abEls[i];
        const rank = p.ranks[i];
        const locked = rank === 0;
        const cost = locked ? U.rankVal(ab.mana, 1) : p.manaCost(i);
        const cd = p.cds[i], maxCd = locked ? 1 : p.cooldown(i);
        const canUp = p.canLearn(i);
        const state = rank + '|' + (canUp ? 1 : 0) + '|' + (p.mana < cost ? 'M' : '') + (cd > 0 ? Math.ceil(cd * 10) : 'R') + '|' + p.level;
        if (state === a.last) return;
        a.last = state;
        a.el.classList.toggle('locked', locked);
        a.el.classList.toggle('nomana', !locked && p.mana < cost);
        a.el.classList.toggle('ready', !locked && cd <= 0 && p.mana >= cost);
        a.up.classList.toggle('hidden', !canUp);
        a.mana.textContent = cost ? Math.round(cost) : '';
        Array.prototype.forEach.call(a.pips.children, function (sp, r) { sp.className = r < rank ? 'on' : ''; });
        a.cd.style.height = (!locked && cd > 0 ? (cd / maxCd) * 100 : 0) + '%';
        a.txt.textContent = locked ? (i === 3 && p.level < 6 ? 'Nv 6' : '') : (cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '');
      });
      const sp = $('skill-points');
      const spText = p.skillPoints > 0 ? 'Puntos de habilidad: ' + p.skillPoints + ' (botón + o ' + M.Settings.label('learnQ') + ' / ' + M.Settings.label('learnW') + ' …)' : '';
      if (sp.textContent !== spText) sp.textContent = spText;
      this.hpFill.style.width = (p.hp / p.maxHp * 100) + '%';
      const sh = p.shieldAmount();
      this.hpShield.style.left = (p.hp / p.maxHp * 100) + '%';
      this.hpShield.style.width = Math.min(100 - p.hp / p.maxHp * 100, sh / p.maxHp * 100) + '%';
      this.manaFill.style.width = (p.maxMana ? p.mana / p.maxMana * 100 : 0) + '%';
      this.xpFill.style.width = (p.level >= 18 ? 100 : p.xp / p.xpToNext() * 100) + '%';

      this.renderer.drawMinimap(this.mctx, 220);
      // sonidos de la interfaz: subir de nivel, comprar/vender
      if (p.level > this.lastLevel && M.Audio) M.Audio.sfx('levelup');
      this.lastLevel = p.level;

      this.slowTimer -= dt;
      if (this.slowTimer > 0) return;
      this.slowTimer = 0.2;
      this.hpText.textContent = Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp) + (sh > 0 ? ' (+' + Math.round(sh) + ')' : '');
      this.manaText.textContent = Math.floor(p.mana) + ' / ' + Math.round(p.maxMana);
      $('level-badge').textContent = p.level;
      $('score-blue').textContent = g.score[0];
      $('score-red').textContent = g.score[1];
      $('timer').textContent = U.fmtTime(g.time);
      $('gold').textContent = Math.floor(p.gold);
      const fps = $('fps');
      if (fps) { const on = !!M.Settings.get('showFps'); fps.style.display = on ? '' : 'none'; if (on) fps.textContent = Math.round(this.renderer.fps) + ' FPS'; }
      $('stats').innerHTML =
        '<span>Daño <b>' + Math.round(p.ad) + '</b></span><span>Poder <b>' + Math.round(p.ap) + '</b></span>' +
        '<span>Armadura <b>' + Math.round(p.getArmor()) + '</b></span><span>Res. mág. <b>' + Math.round(p.getMr()) + '</b></span>' +
        '<span>Vel. at. <b>' + p.getAttackSpeed().toFixed(2) + '</b></span><span>Velocidad <b>' + Math.round(p.getMoveSpeed()) + '</b></span>' +
        '<span>Crítico <b>' + Math.round(p.critChance * 100) + '%</b></span><span>Aceleración <b>' + Math.round(p.haste) + '</b></span>' +
        '<span>Robo vida <b>' + Math.round(p.getLifesteal() * 100) + '%</b></span><span>Alcance <b>' + p.attackRange + '</b></span>' +
        '<span>Asesinatos <b>' + p.kills + '/' + p.deaths + '/' + p.assists + '</b></span><span>Súbditos <b>' + p.cs + '</b></span>';
      let items = '';
      const ikey = p.items.join(',');
      if (ikey === this.itemsKey) items = null;
      else if (this.itemsKey != null && M.Audio) M.Audio.sfx(p.gold < this.lastGold ? 'buy' : 'sell');
      this.itemsKey = ikey; this.lastGold = p.gold;
      if (items !== null) {
        for (let i = 0; i < M.MAX_ITEMS; i++) {
          const it = p.items[i] ? M.itemById[p.items[i]] : null;
          items += '<div class="item-slot" title="' + (it ? M.itemName(it.id) + ': ' + it.desc : 'Vacío') + '">' + (it ? '<img src="' + M.Portraits.itemIcon(it.id, 64) + '">' : '') + '</div>';
        }
        $('items').innerHTML = items;
      }
      // feed
      const feed = g.feed.filter(function (f) { return g.time - f.time < 9; }).slice(-6);
      $('killfeed').innerHTML = feed.map(function (f) { return '<div class="feed-item" style="border-color:' + f.color + '">' + f.text + '</div>'; }).join('');
      // muerte
      const d = $('death-overlay');
      if (p.dead && !g.over) { d.classList.remove('hidden'); d.innerHTML = 'Reaparecés en ' + Math.ceil(p.respawnTimer) + ' s<br><span style="font-size:14px;color:#ffd0d0">Podés usar la tienda (P) mientras tanto</span>'; }
      else d.classList.add('hidden');
      // estado
      let status = '';
      if (p.recalling) status = 'Volviendo a la base… ' + p.recalling.t.toFixed(1) + ' s';
      else if (g.time < g.firstWave) status = 'Los súbditos aparecen en ' + Math.ceil(g.firstWave - g.time) + ' s · Clic derecho: moverte/atacar · A: atacar-mover';
      else if (!this.renderer.camLocked) status = 'Cámara libre (' + M.Settings.label('camLock') + ' para fijar, ' + M.Settings.label('center') + ' para centrar)';
      if (this.notice && g.time < this.noticeUntil) status = this.notice;
      $('status-line').textContent = status;
      if (!$('scoreboard').classList.contains('hidden')) this.renderScoreboard();
      if (!$('shop').classList.contains('hidden')) this.renderShop(false);
    }

    renderScoreboard() {
      const g = this.game, p = this.p;
      let html = '<table><tr><th>Campeón</th><th>Rol</th><th>Nivel</th><th>A/M/As</th><th>Súbditos</th><th>Oro</th><th>Objetos</th></tr>';
      for (const c of g.champions) {
        html += '<tr class="t' + c.team + (c === p ? ' me' : '') + '"><td>' + c.name + (c.human ? ' <span class="pn">(' + (c.playerName || 'jugador') + ')</span>' : ' <span class="pn">(bot)</span>') + (c.dead ? ' ☠' : '') + '</td><td>' + c.def.role + '</td><td>' + c.level +
          '</td><td>' + c.kills + '/' + c.deaths + '/' + c.assists + '</td><td>' + c.cs + '</td><td>' + Math.floor(c.gold) + '</td><td>' + c.items.length + '</td></tr>';
      }
      html += '</table><div style="text-align:center;margin-top:8px;color:#9fb0d0;font-size:12px">Azul ' + g.score[0] + ' — ' + g.score[1] + ' Rojo · ' + U.fmtTime(g.time) + '</div>';
      $('scoreboard').innerHTML = html;
    }

    toggleScoreboard(show) {
      $('scoreboard').classList.toggle('hidden', !show);
      if (show) this.renderScoreboard();
    }

    toggleShop(force) {
      const el = $('shop');
      const show = force != null ? force : el.classList.contains('hidden');
      el.classList.toggle('hidden', !show);
      if (show) this.renderShop(true);
    }

    /** Árbol de construcción: marca como "tuyos" los componentes que ya tenés (se consumen al comprar). */
    treeHtml(id, pool, depth) {
      const it = M.itemById[id];
      let owned = false;
      if (depth > 0) { const o = pool.find(function (q) { return !q.used && q.id === id; }); if (o) { o.used = true; owned = true; } }
      let html = '<div class="tnode d' + depth + (owned ? ' owned' : '') + '"><div class="tcard" data-sel="' + id + '" title="' + U.escapeHtml(M.itemName(id)) + '">' +
        '<img src="' + M.Portraits.itemIcon(id, 48) + '"><span>' + (owned ? '✔' : it.cost) + '</span></div>';
      if (!owned && it.from && it.from.length) {
        html += '<div class="tkids">';
        for (const f of it.from) html += this.treeHtml(f, pool, depth + 1);
        html += '</div>';
      }
      return html + '</div>';
    }

    renderShop(full) {
      const g = this.game, p = this.p, el = $('shop');
      const can = g.canShop(p);
      const undoN = p.undo ? p.undo.length : (p.undoCount || 0);
      const key = Math.floor(p.gold) + '|' + p.items.join(',') + '|' + can + '|' + (this.shopMsg || '') + '|' + this.shopTab + '|' + this.shopSel + '|' + undoN;
      if (!full && key === this.shopKey) return;
      this.shopKey = key;
      const role = p.def.role, rec = M.RECOMMENDED[role] || [];
      let list;
      if (this.shopTab === 'rec') {
        // recomendados del rol + sus componentes, en orden de compra
        const seen = {}; list = [];
        const add = function (id) { if (seen[id]) return; seen[id] = 1; list.push(M.itemById[id]); };
        rec.forEach(function (id) { (M.itemById[id].from || []).forEach(function (f) { (M.itemById[f].from || []).forEach(add); add(f); }); add(id); });
      } else if (this.shopTab === 'boots') list = M.ITEMS.filter(function (it) { return M.isBoots(it.id); });
      else if (this.shopTab === 'all') list = M.ITEMS.slice();
      else list = M.ITEMS.filter((it) => String(it.tier) === this.shopTab && !M.isBoots(it.id));
      if (!this.shopSel || !M.itemById[this.shopSel]) this.shopSel = rec[0] || M.ITEMS[0].id;
      const card = (it) => {
        const plan = M.purchasePlan(p.items, it.id), err = M.canBuy(p, it.id, can);
        const disc = plan.cost < it.cost;
        return '<div class="scard' + (it.id === this.shopSel ? ' sel' : '') + (err ? ' cant' : '') + (rec.indexOf(it.id) >= 0 ? ' rec' : '') + '" data-sel="' + it.id + '" title="Clic: ver · Clic derecho: comprar">' +
          '<img src="' + M.Portraits.itemIcon(it.id, 64) + '"><div class="sname">' + M.itemName(it.id) + '</div>' +
          '<div class="scost' + (disc ? ' disc' : '') + '">' + (disc ? '<s>' + it.cost + '</s> ' : '') + plan.cost + '</div></div>';
      };
      let html = '<div class="shop-head"><h2>Tienda</h2><div class="shop-gold">🪙 ' + Math.floor(p.gold) + ' oro · ' + p.items.length + '/' + M.MAX_ITEMS + ' objetos</div>' +
        '<button data-undo="1"' + (undoN && can ? '' : ' disabled') + ' title="Deshace tu última compra o venta (mientras sigas en la base)">↶ Deshacer</button>' +
        '<button class="close-btn" data-close="1">Cerrar (' + M.Settings.label('shop') + ')</button></div>' +
        '<div class="shop-note">' + U.escapeHtml(this.shopMsg || (can ? 'Clic derecho sobre un objeto para comprarlo. Los componentes que ya tenés se descuentan del precio.' : 'Tenés que estar en la base (o muerto) para comprar.')) + '</div>' +
        '<div class="shop-tabs">' + SHOP_TABS.map((t) => '<button data-tab="' + t[0] + '" class="' + (t[0] === this.shopTab ? 'active' : '') + '">' + t[1] + (t[0] === 'rec' ? ' (' + role + ')' : '') + '</button>').join('') + '</div>' +
        '<div class="shop-body"><div class="shop-list">';
      if (this.shopTab === 'rec') {
        html += '<div class="shop-sec">Ruta sugerida para ' + role + '</div><div class="shop-cards">' + rec.map(function (id) { return card(M.itemById[id]); }).join('') + '</div>' +
          '<div class="shop-sec">Componentes</div><div class="shop-cards">' + list.filter(function (it) { return rec.indexOf(it.id) < 0; }).map(card).join('') + '</div>';
      } else html += '<div class="shop-cards">' + list.map(card).join('') + '</div>';
      html += '</div>';
      // detalle del objeto elegido
      const it = M.itemById[this.shopSel], plan = M.purchasePlan(p.items, it.id), err = M.canBuy(p, it.id, can);
      const pool = p.items.map(function (x) { return { id: x, used: false }; });
      html += '<div class="shop-detail"><div class="dhead"><img src="' + M.Portraits.itemIcon(it.id, 64) + '"><div><div class="dname">' + M.itemName(it.id) + '</div>' +
        (M.itemName(it.id) !== it.name ? '<div class="dclassic">' + it.name + '</div>' : '') +
        '<div class="dtier">' + (M.isBoots(it.id) ? 'Botas' : ['', 'Básico', 'Intermedio', 'Legendario'][it.tier]) + '</div></div></div>' +
        '<div class="dstats">' + U.escapeHtml(M.itemStatsText(it)) + '</div>' +
        (it.passive ? '<div class="dpassive"><b>Pasiva única</b> — ' + U.escapeHtml(it.passive.text) + '</div>' : '') +
        (M.itemFlavor(it.id) ? '<div class="iflavor">' + M.itemFlavor(it.id) + '</div>' : '') +
        (it.from ? '<div class="shop-sec">Se arma con</div><div class="tree">' + this.treeHtml(it.id, pool, 0) + '</div>' : '') +
        (it.into.length ? '<div class="shop-sec">Sirve para</div><div class="into">' + it.into.map(function (x) { return '<div class="tcard" data-sel="' + x + '" title="' + U.escapeHtml(M.itemName(x)) + '"><img src="' + M.Portraits.itemIcon(x, 48) + '"><span>' + M.itemById[x].cost + '</span></div>'; }).join('') + '</div>' : '') +
        '<div class="dprice">Costo total ' + it.cost + (plan.cost < it.cost ? ' · <b>a vos te sale ' + plan.cost + '</b> (usa ' + plan.consume.length + ' componente' + (plan.consume.length === 1 ? '' : 's') + ' tuyo' + (plan.consume.length === 1 ? '' : 's') + ')' : '') + '</div>' +
        '<button class="buy-btn" data-buy="' + it.id + '"' + (err ? ' disabled title="' + U.escapeHtml(err) + '"' : '') + '>Comprar (' + plan.cost + ')</button>' +
        (err && can ? '<div class="derr">' + U.escapeHtml(err) + '</div>' : '') + '</div></div>';
      // inventario
      html += '<div class="shop-inv"><span>Inventario (vender al ' + Math.round(M.SELL_RATIO * 100) + '%):</span>';
      for (let i = 0; i < M.MAX_ITEMS; i++) {
        const id = p.items[i];
        html += '<div class="inv-slot">' + (id ? '<img src="' + M.Portraits.itemIcon(id, 48) + '" data-sel="' + id + '" title="' + U.escapeHtml(M.itemName(id)) + '"><button data-sell="' + i + '"' + (can ? '' : ' disabled') + '>' + Math.floor(M.itemById[id].cost * M.SELL_RATIO) + '</button>' : '') + '</div>';
      }
      html += '</div>';
      const scroll = el.querySelector('.shop-list') ? el.querySelector('.shop-list').scrollTop : 0;
      el.innerHTML = html;
      if (el.querySelector('.shop-list')) el.querySelector('.shop-list').scrollTop = scroll;
      const act = (b) => {
        if (b.dataset.close) { this.toggleShop(false); return; }
        if (b.dataset.tab) { this.shopTab = b.dataset.tab; }
        if (b.dataset.buy) this.shopMsg = this.session.cmd({ t: 'buy', item: b.dataset.buy }) || '';
        if (b.dataset.sell) this.shopMsg = this.session.cmd({ t: 'sell', i: +b.dataset.sell }) || '';
        if (b.dataset.undo) this.shopMsg = this.session.cmd({ t: 'undo' }) || '';
        if (this.shopMsg && M.Audio) M.Audio.sfx('error');
        this.renderShop(true);
      };
      el.onclick = (e) => {
        const b = e.target.closest('button');
        if (b) { act(b); return; }
        const sel = e.target.closest('[data-sel]');
        if (sel) { this.shopSel = sel.dataset.sel; this.shopMsg = ''; if (M.Audio) M.Audio.sfx('click'); this.renderShop(true); }
      };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        const sel = e.target.closest('[data-sel]');
        if (sel) { this.shopSel = sel.dataset.sel; this.shopMsg = this.session.cmd({ t: 'buy', item: sel.dataset.sel }) || ''; if (this.shopMsg && M.Audio) M.Audio.sfx('error'); this.renderShop(true); }
      };
    }

    showEnd(winner, buttons) {
      if (typeof buttons === 'function') buttons = [{ text: 'Menú principal', fn: buttons }];
      const g = this.game, win = winner === this.p.team;
      const el = $('endscreen');
      el.classList.remove('hidden');
      let rows = '';
      for (const c of g.champions) {
        rows += '<tr class="t' + c.team + (c === this.p ? ' me' : '') + '"><td style="color:' + M.TEAM_COLORS[c.team] + '">' + c.name + (c.human && c.playerName ? ' (' + c.playerName + ')' : '') + '</td><td>' + c.def.role + '</td><td>' + c.level + '</td><td>' + c.kills + '/' + c.deaths + '/' + c.assists + '</td><td>' + c.cs + '</td></tr>';
      }
      el.innerHTML = '<div class="panel"><h1 class="' + (win ? 'win' : 'lose') + '">' + (win ? '¡VICTORIA!' : 'DERROTA') + '</h1>' +
        '<div style="margin-bottom:10px;color:#9fb0d0">Duración: ' + U.fmtTime(g.time) + ' · Azul ' + g.score[0] + ' — ' + g.score[1] + ' Rojo</div>' +
        '<table style="margin:0 auto 14px;font-size:13px;border-collapse:collapse"><tr style="color:#9fb0d0"><td>Campeón</td><td>Rol</td><td>Nivel</td><td>A/M/As</td><td>Súbditos</td></tr>' + rows + '</table>' +
        '<div id="end-note" class="end-note"></div><div class="end-btns">' + buttons.map(function (b, i) { return '<button data-end="' + i + '"' + (i === 0 ? ' id="restart-btn"' : '') + '>' + b.text + '</button>'; }).join('') + '</div></div>';
      el.querySelectorAll('[data-end]').forEach(function (btn) { btn.onclick = function () { buttons[+btn.dataset.end].fn(); }; });
    }
  }

  M.HUD = HUD;
})(window.MOBA);
