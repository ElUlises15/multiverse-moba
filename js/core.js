/* Browser Multiverse MOBA - núcleo: registro de campeones y utilidades */
window.MOBA = window.MOBA || {};
(function (M) {
  'use strict';
  M.VERSION = '0.1.0';
  M.champions = [];
  M.championById = {};
  M.ROLES = ['Tanque', 'Luchador', 'Mago', 'Tirador', 'Soporte'];
  M.ROLE_COLORS = { Tanque: '#8fa3c4', Luchador: '#e8823f', Mago: '#b07cff', Tirador: '#f2c14e', Soporte: '#4fd1a5' };
  M.ROLE_LANES = { Tanque: 'top', Luchador: 'top', Mago: 'mid', Tirador: 'bot', Soporte: 'bot' };
  M.LANE_NAMES = { top: 'superior', mid: 'central', bot: 'inferior' };
  M.TEAM_COLORS = ['#38a3ff', '#ff4a4a', '#d9b44a'];
  M.TEAM_NAMES = ['Azul', 'Rojo', 'Neutral'];
  // Ritmo global (1 = valores tipo LoL; las unidades del mundo son unidades de LoL)
  M.PACE = { move: 1, projectile: 1 };
  // Radio (en píxeles de pantalla) para apuntar con clic derecho / pasar el mouse sobre un enemigo
  M.TARGET_RADIUS_PX = 50;

  // Estadísticas por defecto (estilo LoL). Cualquier campo omitido en un campeón toma este valor.
  // Crecimiento por nivel con la fórmula de LoL: base + crec × (n−1) × (0.7025 + 0.0175 × (n−1)).
  M.DEFAULT_STATS = {
    hp: 620, hpPerLevel: 100, mana: 340, manaPerLevel: 45,
    ad: 60, adPerLevel: 3.2, ap: 0, armor: 30, armorPerLevel: 4.5, mr: 32, mrPerLevel: 1.3,
    attackRange: 125, attackSpeed: 0.65, attackSpeedPerLevel: 0.025, windup: 0.25,
    moveSpeed: 340, hpRegen: 1.5, hpRegenPerLevel: 0.12, manaRegen: 1.6, manaRegenPerLevel: 0.1,
    projectileSpeed: 1800
  };
  M.growth = function (base, growth, level) { return base + growth * (level - 1) * (0.7025 + 0.0175 * (level - 1)); };
  M.MAX_LEVEL = 18;
  M.R_LEVELS = [6, 11, 16];
  M.MAX_RANK = [5, 5, 5, 3];

  /** Registra un campeón. Ver README.md para el formato. */
  M.registerChampion = function (def) {
    if (!def || !def.id) throw new Error('Campeón sin id');
    if (M.championById[def.id]) { console.warn('Campeón duplicado: ' + def.id); return; }
    if (!def.abilities || def.abilities.length !== 4) {
      throw new Error('El campeón ' + def.id + ' necesita exactamente 4 habilidades (Q, W, E, R)');
    }
    if (M.ROLES.indexOf(def.role) < 0) console.warn('Rol desconocido para ' + def.id + ': ' + def.role);
    def.stats = Object.assign({}, M.DEFAULT_STATS, def.stats || {});
    def.shape = def.shape || 'circle';
    def.color = def.color || '#cccccc';
    def.accent = def.accent || '#ffffff';
    def.title = def.title || '';
    def.description = def.description || '';
    def.ranged = def.stats.attackRange > 300;
    ['Q', 'W', 'E', 'R'].forEach(function (k, i) {
      const ab = def.abilities[i];
      ab.key = k;
      ab.slot = i;
      ab.cd = ab.cd || 8;
      ab.mana = ab.mana || 0;
      ab.color = ab.color || def.accent;
    });
    M.champions.push(def);
    M.championById[def.id] = def;
  };

  const U = M.util = {};
  U.dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  U.distXY = function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); };
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.pointSegDist = function (px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = U.clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  /** Valor según el rango de la habilidad: si es un arreglo toma el elemento del rango (1..n). */
  U.rankVal = function (x, rank) {
    if (Array.isArray(x)) return x[Math.max(0, Math.min(x.length, rank || 1) - 1)];
    return x;
  };
  U.fmtArr = function (x, digits) {
    const f = function (v) { return typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : v; };
    return Array.isArray(x) ? x.map(f).join('/') : f(x);
  };
  U.seeded = function (seed) {
    let s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  };
  U.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  U.hexToRgba = function (hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  /** Dibuja una forma básica centrada en (x, y). */
  U.drawShape = function (ctx, shape, x, y, r, fill, stroke, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    const poly = function (n, off) {
      for (let i = 0; i < n; i++) {
        const a = off + i * 2 * Math.PI / n;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    switch (shape) {
      case 'square': ctx.rect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64); break;
      case 'triangle': poly(3, -Math.PI / 2); break;
      case 'diamond': poly(4, -Math.PI / 2); break;
      case 'pentagon': poly(5, -Math.PI / 2); break;
      case 'hexagon': poly(6, 0); break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        break;
      default: ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    ctx.restore();
  };

  /** Retrato simple de un campeón (usado en selección y HUD). */
  U.drawPortrait = function (ctx, def, size) {
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, U.hexToRgba(def.color, 0.55));
    g.addColorStop(1, 'rgba(10,14,24,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    U.drawShape(ctx, def.shape, size / 2, size / 2, size * 0.33, def.color, def.accent, Math.max(2, size / 24));
    U.drawShape(ctx, 'circle', size / 2, size / 2, size * 0.1, def.accent, null);
  };
})(window.MOBA);
