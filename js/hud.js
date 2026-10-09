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

  class HUD {
    constructor(session, renderer) {
      this.session = session; this.game = session.world; this.renderer = renderer; this.p = session.world.player;
      this.slowTimer = 0;
      this.build();
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
        el.innerHTML = '<div class="ab-key">' + ab.key + '</div><div class="ab-mana"></div>' +
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
      ['scoreboard', 'shop', 'death-overlay', 'endscreen', 'pause', 'tooltip'].forEach(function (id) { $(id).classList.add('hidden'); });
      $('killfeed').innerHTML = '';
    }

    learn(slot) {
      if (!this.p.canLearn(slot)) return false;
      const err = this.session.cmd({ t: 'learn', s: slot });
      this.abEls.forEach(function (a) { a.last = ''; });
      return !err;
    }

    abilityTooltip(i) {
      const ab = this.p.def.abilities[i], rank = this.p.ranks[i];
      let html = '<b>[' + ab.key + '] ' + ab.name + '</b> <span style="color:#8fa0c0">Rango ' + rank + '/' + M.MAX_RANK[i] + '</span><br>' + ab.desc +
        '<br><span style="color:#cfe0ff">' + M.Abilities.statsText(ab).join('<br>') + '</span>';
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
      const spText = p.skillPoints > 0 ? 'Puntos de habilidad: ' + p.skillPoints + ' (botón + o Ctrl/Alt + Q W E R)' : '';
      if (sp.textContent !== spText) sp.textContent = spText;
      this.hpFill.style.width = (p.hp / p.maxHp * 100) + '%';
      const sh = p.shieldAmount();
      this.hpShield.style.left = (p.hp / p.maxHp * 100) + '%';
      this.hpShield.style.width = Math.min(100 - p.hp / p.maxHp * 100, sh / p.maxHp * 100) + '%';
      this.manaFill.style.width = (p.maxMana ? p.mana / p.maxMana * 100 : 0) + '%';
      this.xpFill.style.width = (p.level >= 18 ? 100 : p.xp / p.xpToNext() * 100) + '%';

      this.renderer.drawMinimap(this.mctx, 220);

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
      this.itemsKey = ikey;
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
      else if (!this.renderer.camLocked) status = 'Cámara libre (Y para fijar, Espacio para centrar)';
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

    renderShop(full) {
      const g = this.game, p = this.p, el = $('shop');
      const can = g.canShop(p);
      const key = Math.floor(p.gold) + '|' + p.items.join(',') + '|' + can + '|' + (this.shopMsg || '');
      if (!full && key === this.shopKey) return;
      this.shopKey = key;
      let html = '<button class="close-btn" data-close="1">Cerrar (P)</button><h2>Tienda</h2>' +
        '<div style="color:#ffd54a;font-weight:bold">Oro: ' + Math.floor(p.gold) + ' · Objetos: ' + p.items.length + '/' + M.MAX_ITEMS + '</div>' +
        '<div class="shop-note">' + (this.shopMsg || (can ? '' : 'Tenés que estar en la base (o muerto) para comprar.')) + '</div><div class="shop-grid">';
      for (const it of M.ITEMS) {
        const dis = !can || p.gold < it.cost || p.items.length >= M.MAX_ITEMS;
        html += '<div class="shop-item"><img class="icon" src="' + M.Portraits.itemIcon(it.id, 64) + '"><div class="iname">' + M.itemName(it.id) + '</div>' +
          '<div class="istats">' + it.desc + '</div><div class="iflavor">' + M.itemFlavor(it.id) + '</div><div class="icost">' + it.cost + ' oro</div>' +
          '<button data-buy="' + it.id + '"' + (dis ? ' disabled' : '') + '>Comprar</button></div>';
      }
      html += '</div>';
      if (p.items.length) {
        html += '<h3 style="margin:12px 0 6px">Tu inventario (vender al 70%)</h3><div class="shop-grid">';
        p.items.forEach(function (id, i) { html += '<div class="shop-item"><img class="icon" src="' + M.Portraits.itemIcon(id, 64) + '"><div class="iname">' + M.itemName(id) + '</div><button data-sell="' + i + '"' + (can ? '' : ' disabled') + '>Vender (' + Math.floor(M.itemById[id].cost * M.SELL_RATIO) + ')</button></div>'; });
        html += '</div>';
      }
      el.innerHTML = html;
      el.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.close) { this.toggleShop(false); return; }
        if (b.dataset.buy) this.shopMsg = this.session.cmd({ t: 'buy', item: b.dataset.buy }) || '';
        if (b.dataset.sell) this.shopMsg = this.session.cmd({ t: 'sell', i: +b.dataset.sell }) || '';
        this.renderShop(true);
      };
    }

    showEnd(winner, onRestart) {
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
        '<button id="restart-btn">Volver a la selección</button></div>';
      $('restart-btn').onclick = onRestart;
    }
  }

  M.HUD = HUD;
})(window.MOBA);
