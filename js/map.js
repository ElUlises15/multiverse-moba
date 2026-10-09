/* Mapa "Grieta Multiversal": 14.000 × 14.000 unidades de LoL (la Grieta del Invocador mide ~14.800).
 * 3 carriles, río, 4 cuadrantes de jungla con paredes y arbustos, y una grilla de navegación para esquivar paredes.
 * Carril central ≈ 14.700 u de nexo a nexo (≈43 s a 340), laterales ≈ 21.300 u (≈63 s);
 * al salir de la base hay un impulso de velocidad (como las Botas del Hogar) que acorta las caminatas. */
(function (M) {
  'use strict';
  const U = M.util;
  const W = 14000, H = 14000;
  const N0 = { x: 1800, y: 12200 }, N1 = { x: 12200, y: 1800 };

  const lanes = {
    top: [N0, { x: 1250, y: 10600 }, { x: 1250, y: 2600 }, { x: 2600, y: 1250 }, { x: 10600, y: 1250 }, N1],
    mid: [N0, N1],
    bot: [N0, { x: 3400, y: 12750 }, { x: 11400, y: 12750 }, { x: 12750, y: 11400 }, { x: 12750, y: 3400 }, N1]
  };
  const river = [{ x: 600, y: 600 }, { x: 3200, y: 3000 }, { x: 7000, y: 7000 }, { x: 10800, y: 11000 }, { x: 13400, y: 13400 }];

  function pathLength(path) { let l = 0; for (let i = 1; i < path.length; i++) l += U.dist(path[i - 1], path[i]); return l; }
  function pointAt(path, d) {
    if (d <= 0) return { x: path[0].x, y: path[0].y };
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], seg = U.dist(a, b);
      if (d <= seg) { const t = d / seg; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
      d -= seg;
    }
    const last = path[path.length - 1];
    return { x: last.x, y: last.y };
  }
  /** Distancia recorrida a lo largo del camino hasta el punto más cercano a pos. */
  function progress(path, pos) {
    let best = Infinity, bestD = 0, acc = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, seg = Math.sqrt(l2);
      let t = ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / l2;
      t = U.clamp(t, 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      const d = Math.hypot(pos.x - px, pos.y - py);
      if (d < best) { best = d; bestD = acc + seg * t; }
      acc += seg;
    }
    return bestD;
  }

  // ---------- Paredes y arbustos (se definen en el cuadrante izquierdo y se reflejan) ----------
  function rect(cx, cy, w, h, ang) {
    const c = Math.cos(ang || 0), s = Math.sin(ang || 0), pts = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) {
      const x = k[0] * w / 2, y = k[1] * h / 2;
      pts.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
    });
    return pts;
  }
  function blob(cx, cy, r, n, seed) {
    const rnd = U.seeded(seed), pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, rr = r * (0.8 + rnd() * 0.35);
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    return pts;
  }
  const D45 = Math.PI / 4;
  const baseWalls = [
    rect(2600, 5600, 600, 1800, 0),
    rect(4300, 7600, 1600, 550, -D45),
    blob(2700, 9600, 450, 9, 11),
    rect(4000, 5600, 1200, 500, D45),
    blob(5300, 6900, 360, 8, 23)
  ];
  const baseBrush = [
    { x: 1950, y: 7400, rx: 170, ry: 520, rot: 0 },
    { x: 4900, y: 8450, rx: 460, ry: 160, rot: -D45 },
    { x: 5950, y: 6850, rx: 420, ry: 150, rot: D45 },
    { x: 3300, y: 7950, rx: 300, ry: 170, rot: 0.3 },
    { x: 2000, y: 3300, rx: 170, ry: 450, rot: 0 }
  ];
  const baseCamps = [{ x: 3500, y: 6700, kind: 'golem' }, { x: 3050, y: 8450, kind: 'wolf' }];
  // Reflejo por la diagonal del carril central (cuadrante izquierdo -> inferior) y simetría central (lado rojo)
  const mirrorD = function (p) { return { x: W - p.y, y: H - p.x }; };
  const rot180 = function (p) { return { x: W - p.x, y: H - p.y }; };
  const walls = [], brush = [], camps = [];
  baseWalls.forEach(function (poly) {
    const m = poly.map(mirrorD).reverse();
    walls.push(poly, m, poly.map(rot180), m.map(rot180));
  });
  baseBrush.forEach(function (b) {
    const p = mirrorD(b), ang = Math.atan2(-Math.cos(b.rot), -Math.sin(b.rot));
    const list = [b, { x: p.x, y: p.y, rx: b.rx, ry: b.ry, rot: ang }];
    list.forEach(function (o) { brush.push(o); const q = rot180(o); brush.push({ x: q.x, y: q.y, rx: o.rx, ry: o.ry, rot: o.rot }); });
  });
  baseCamps.forEach(function (c) {
    const m = mirrorD(c);
    [c, { x: m.x, y: m.y, kind: c.kind }].forEach(function (o) {
      camps.push({ x: o.x, y: o.y, kind: o.kind, side: 0 });
      const q = rot180(o); camps.push({ x: q.x, y: q.y, kind: o.kind, side: 1 });
    });
  });

  // ---------- Grilla de navegación ----------
  const CELL = 100, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
  const grid = new Uint8Array(GW * GH);       // 1 = bloqueado
  const brushGrid = new Int16Array(GW * GH).fill(-1);
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function distToPoly(x, y, poly) {
    if (pointInPoly(x, y, poly)) return 0;
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, U.pointSegDist(x, y, poly[j].x, poly[j].y, poly[i].x, poly[i].y));
    return best;
  }
  const INFLATE = 55;   // radio de los campeones aprox., para que no se "metan" en la pared
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL, i = gy * GW + gx;
      if (x < 120 || y < 120 || x > W - 120 || y > H - 120) { grid[i] = 1; continue; }
      for (const poly of walls) { if (distToPoly(x, y, poly) < INFLATE) { grid[i] = 1; break; } }
      for (let b = 0; b < brush.length; b++) {
        const o = brush[b], c = Math.cos(-o.rot), s = Math.sin(-o.rot);
        const dx = x - o.x, dy = y - o.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
        if ((lx * lx) / (o.rx * o.rx) + (ly * ly) / (o.ry * o.ry) <= 1) { brushGrid[i] = b; break; }
      }
    }
  }
  function cellOf(x, y) { return { gx: U.clamp(Math.floor(x / CELL), 0, GW - 1), gy: U.clamp(Math.floor(y / CELL), 0, GH - 1) }; }
  function blockedCell(gx, gy) { return gx < 0 || gy < 0 || gx >= GW || gy >= GH || grid[gy * GW + gx] === 1; }
  function blocked(x, y) { const c = cellOf(x, y); return grid[c.gy * GW + c.gx] === 1; }
  function brushAt(x, y) { const c = cellOf(x, y); return brushGrid[c.gy * GW + c.gx]; }
  function lineClear(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 45);
    for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
    return true;
  }
  function nearestFree(x, y) {
    if (!blocked(x, y)) return { x: x, y: y };
    const c = cellOf(x, y);
    for (let r = 1; r < 30; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || blockedCell(c.gx + dx, c.gy + dy)) continue;
        const px = (c.gx + dx + 0.5) * CELL, py = (c.gy + dy + 0.5) * CELL, d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = { x: px, y: py }; }
      }
      if (best) return best;
    }
    return { x: x, y: y };
  }
  // A* con montículo binario sobre la grilla (8 vecinos) + suavizado por línea de visión
  const gScore = new Float32Array(GW * GH), came = new Int32Array(GW * GH), stamp = new Uint32Array(GW * GH), closed = new Uint32Array(GW * GH);
  let curStamp = 0;
  function findPath(x1, y1, x2, y2) {
    const s0 = nearestFree(x1, y1), g0 = nearestFree(x2, y2);
    const s = cellOf(s0.x, s0.y), g = cellOf(g0.x, g0.y);
    const start = s.gy * GW + s.gx, goal = g.gy * GW + g.gx;
    curStamp++;
    const heap = [], hf = [];
    const push = function (node, f) {
      heap.push(node); hf.push(f);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; }
    };
    const pop = function () {
      const top = heap[0], ln = heap.pop(), lf = hf.pop();
      if (heap.length) {
        heap[0] = ln; hf[0] = lf; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && hf[l] < hf[m]) m = l;
          if (r < heap.length && hf[r] < hf[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
        }
      }
      return top;
    };
    const h = function (n) { const dx = Math.abs((n % GW) - g.gx), dy = Math.abs(((n / GW) | 0) - g.gy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    gScore[start] = 0; stamp[start] = curStamp; came[start] = -1;
    push(start, h(start));
    let found = false, iter = 0;
    while (heap.length && iter++ < 25000) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur] === curStamp) continue;
      closed[cur] = curStamp;
      const cx = cur % GW, cy = (cur / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (blockedCell(nx, ny)) continue;
        if (dx && dy && (blockedCell(cx + dx, cy) || blockedCell(cx, cy + dy))) continue;
        const n = ny * GW + nx;
        if (closed[n] === curStamp) continue;
        const ng = gScore[cur] + (dx && dy ? 1.4142 : 1);
        if (stamp[n] !== curStamp || ng < gScore[n]) {
          stamp[n] = curStamp; gScore[n] = ng; came[n] = cur;
          push(n, ng + h(n));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(n);
    cells.reverse();
    const raw = cells.map(function (n) { return { x: (n % GW + 0.5) * CELL, y: (((n / GW) | 0) + 0.5) * CELL }; });
    if (raw.length) raw[raw.length - 1] = { x: g0.x, y: g0.y }; else raw.push({ x: g0.x, y: g0.y });
    // suavizado: saltear puntos con línea de visión directa
    const out = [];
    let from = { x: x1, y: y1 }, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !lineClear(from.x, from.y, raw[j].x, raw[j].y)) j--;
      out.push(raw[j]); from = raw[j]; i = j + 1;
    }
    return out;
  }

  const paths = {};
  Object.keys(lanes).forEach(function (k) { paths[k] = [lanes[k], lanes[k].slice().reverse()]; });

  M.MAP = {
    width: W, height: H,
    nexus: [N0, N1],
    fountains: [{ x: 600, y: 13400 }, { x: 13400, y: 600 }],
    fountainRadius: 800,
    baseRadius: 3200,     // zona de la base (para el impulso de velocidad al salir)
    scale: W / 4000,
    lanes: lanes, river: river, riverWidth: 900,
    laneLength: { top: pathLength(lanes.top), mid: pathLength(lanes.mid), bot: pathLength(lanes.bot) },
    pathFor: function (lane, team) { return paths[lane][team === 1 ? 1 : 0]; },
    pointAt: pointAt, progress: progress, pathLength: pathLength,
    // Distancias de las torres desde el propio nexo, a lo largo de cada carril
    towerDistances: {
      top: { inner: 3600, outer: 7400 }, mid: { inner: 2900, outer: 5000 }, bot: { inner: 3600, outer: 7400 }
    },
    camps: camps, walls: walls, brush: brush,
    nav: { CELL: CELL, GW: GW, GH: GH, grid: grid, blocked: blocked, lineClear: lineClear, findPath: findPath, nearestFree: nearestFree },
    brushAt: brushAt
  };
})(window.MOBA);
