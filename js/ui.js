/* Pantalla de selección de campeón (partida solo o elección dentro de una sala) */
(function (M) {
  'use strict';
  const U = M.util;
  const $ = function (id) { return document.getElementById(id); };
  const CAST_NAMES = { skillshot: 'Proyectil', line: 'Línea', area: 'Área', self: 'Propia', dash: 'Desplazamiento', target: 'Objetivo' };

  M.SelectScreen = {
    selected: null, filter: 'Todos', opts: null, preview: null, loopOn: false,

    /** opts: { gridId, detailId, filtersId, button: texto, onPlay(defId), taken: { defId: true } } */
    init: function (opts) {
      if (typeof opts === 'function') opts = { onPlay: opts };
      this.opts = Object.assign({ gridId: 'champ-grid', detailId: 'champ-detail', filtersId: 'role-filters', button: null }, opts || {});
      const filters = $(this.opts.filtersId);
      if (filters) {
        filters.innerHTML = '';
        ['Todos'].concat(M.ROLES).forEach((r) => {
          const b = document.createElement('button');
          b.className = 'role-btn' + (r === this.filter ? ' active' : '');
          b.textContent = r; b.dataset.role = r;
          b.onclick = () => { this.filter = r; this.init(this.opts); };
          filters.appendChild(b);
        });
      }
      if (!this.selected) this.selected = M.champions[0];
      this.renderGrid();
      this.renderDetail();
      this.startLoop();
    },
    startLoop: function () {
      if (this.loopOn) return;
      this.loopOn = true;
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const scr = $(this.opts.detailId);
        if (!scr || scr.offsetParent === null) { this.loopOn = false; return; }
        if (this.preview) this.preview.render(dt);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    renderGrid: function () {
      const grid = $(this.opts.gridId);
      grid.innerHTML = '';
      const taken = this.opts.taken || {};
      M.champions.filter((c) => this.filter === 'Todos' || c.role === this.filter).forEach((def) => {
        const card = document.createElement('div');
        card.className = 'champ-card' + (this.selected === def ? ' selected' : '') + (taken[def.id] ? ' taken' : '');
        card.dataset.id = def.id;
        const cv = document.createElement('canvas');
        cv.width = 84; cv.height = 84;
        M.Portraits.draw(cv.getContext('2d'), def, 84, true);
        card.appendChild(cv);
        const info = document.createElement('div');
        info.innerHTML = '<div class="cname">' + def.name + '</div><span class="role-tag" style="background:' + (M.ROLE_COLORS[def.role] || '#ccc') + '">' + def.role + '</span>' +
          (taken[def.id] ? '<div class="cdesc" style="color:#ff9a9a">Elegido por un compañero</div>' : '<div class="cdesc">' + def.title + '</div>');
        card.appendChild(info);
        card.onclick = () => { this.selected = def; this.renderGrid(); this.renderDetail(); if (this.opts.onSelect) this.opts.onSelect(def.id); };
        card.ondblclick = () => { this.selected = def; this.play(); };
        grid.appendChild(card);
      });
    },

    renderDetail: function () {
      const def = this.selected, el = $(this.opts.detailId);
      if (!def || !el) return;
      const s = def.stats, art = M.Art.champions[def.id] || {};
      const stat = function (label, v, max) {
        return '<div class="stat-row"><label>' + label + '</label><div class="sbar"><div style="width:' + Math.min(100, v / max * 100) + '%"></div></div></div>';
      };
      let html = '<div class="detail-head"><div class="detail-preview-slot"></div><div class="detail-info">' +
        '<h2>' + def.name + '</h2><div class="ctitle">' + def.title + '</div>' +
        '<span class="role-tag" style="background:' + (M.ROLE_COLORS[def.role] || '#ccc') + '">' + def.role + '</span> ' +
        '<span style="font-size:12px;color:#9fb0d0">' + (def.ranged ? 'A distancia' : 'Cuerpo a cuerpo') + '</span>' +
        (art.lore ? '<div class="lore">' + art.lore + '</div>' : '<div class="detail-desc">' + def.description + '</div>') +
        (art.quote ? '<div class="quote">«' + art.quote + '»</div>' : '') +
        '</div></div>' +
        '<div class="stat-grid">' +
        stat('Vida (' + s.hp + ')', s.hp, 700) + stat('Daño (' + s.ad + ')', s.ad, 75) + stat('Armadura (' + s.armor + ')', s.armor, 45) +
        stat('Alcance (' + s.attackRange + ')', s.attackRange, 600) + stat('Velocidad (' + s.moveSpeed + ')', s.moveSpeed - 300, 50) +
        stat('Vel. ataque (' + s.attackSpeed + ')', s.attackSpeed, 0.75) + '</div>' +
        '<div class="ability-list">';
      def.abilities.forEach(function (ab) {
        html += '<div class="ability-item"><div class="key" style="background:' + ab.color + '">' + ab.key + '</div><div>' +
          '<div class="aname">' + ab.name + '<span class="ameta">' + (CAST_NAMES[ab.cast] || ab.cast) + (ab.key === 'R' ? ' · niveles 6/11/16' : '') + '</span></div>' +
          '<div class="adesc">' + ab.desc + '</div>' +
          '<div class="adesc" style="color:#8fa0c0;font-size:11.5px">' + M.Abilities.statsText(ab).join(' · ') + '</div></div></div>';
      });
      const label = this.opts.button ? this.opts.button.replace('{name}', def.name) : '¡Jugar con ' + def.name + '!';
      html += '</div>' + (this.opts.onPlay ? '<button class="play-btn">' + label + '</button>' : '');
      el.innerHTML = html;
      // un único canvas/renderer 3D por pantalla (los navegadores limitan los contextos WebGL)
      this.previews = this.previews || {};
      let pv = this.previews[this.opts.detailId];
      if (!pv) {
        const cv = document.createElement('canvas'); cv.width = 230; cv.height = 230; cv.className = 'detail-preview';
        pv = this.previews[this.opts.detailId] = new M.Preview(cv);
        pv.canvasEl = cv;
      }
      el.querySelector('.detail-preview-slot').appendChild(pv.canvasEl);
      this.preview = pv;
      if (pv.ok) pv.set(def);
      else { const c2 = pv.canvasEl.getContext('2d'); if (c2) { c2.clearRect(0, 0, 230, 230); U.drawPortrait(c2, def, 230); } }
      const btn = el.querySelector('.play-btn');
      if (btn) btn.onclick = () => this.play();
    },

    play: function () {
      if (this.selected && this.opts.onPlay) this.opts.onPlay(this.selected.id);
    }
  };
})(window.MOBA);
