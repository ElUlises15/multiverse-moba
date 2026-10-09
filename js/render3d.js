/* Renderizado 3D con Three.js (cámara isométrica en ángulo, estilo LoL).
 * Solo LEE el estado del mundo (M.Game local o M.Net.ReplicaWorld en red): no modifica la simulación.
 * Los modelos procedurales vienen de js/art/*.js (MOBA.Art); si falta alguno se usa un modelo simple de respaldo. */
(function (M) {
  'use strict';
  const U = M.util;
  let T = null;
  const VIEW_WIDTH = 2300;          // ancho visible (en unidades del mundo) con zoom 1
  const PITCH = 56 * Math.PI / 180; // ángulo de la cámara respecto del suelo
  const FOV = 30;
  const toHex = function (c) { try { return new T.Color(c).getHex(); } catch (e) { return 0xffffff; } };
  const SLOT_KEYS = ['Q', 'W', 'E', 'R'];

  function seeded(seed) { let s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  class Renderer {
    constructor(canvas, overlay, world, opts) {
      T = window.THREE;
      opts = opts || {};
      this.canvas = canvas; this.overlay = overlay; this.octx = overlay.getContext('2d');
      this.game = world;
      this.cam = { x: 0, y: 0, zoom: 1 };
      this.userZoom = 1; this.camLocked = true; this.time = 0; this.clickMarker = null;
      this.hoverTarget = null; this.attackArmed = false; this.mouseWorld = null; this.aimPoint = null; this.aim = null; this.showRange = false;
      this.low = !!opts.low;
      this.gl = new T.WebGLRenderer({ canvas: canvas, antialias: !this.low, powerPreference: 'high-performance' });
      this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 1.5));
      this.gl.outputColorSpace = T.SRGBColorSpace;
      this.gl.toneMapping = T.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.05;
      this.gl.shadowMap.enabled = !this.low; this.gl.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x0a1420);
      this.camera = new T.PerspectiveCamera(FOV, 1, 100, 40000);
      this.cache = M.Art.makeCache(T);
      this.views = new Map(); this.projViews = new Map(); this.zoneViews = new Map(); this.fxViews = []; this.pools = {};
      this.lastFx = 0; this.animated = []; this.artErrors = {};
      this.ray = new T.Raycaster(); this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      this.tmpV = new T.Vector3();
      this.buildLights(); this.buildWorld(); this.buildIndicators();
      const p = world.player;
      if (p) { this.cam.x = p.x; this.cam.y = p.y; }
    }
    setWorld(w) { this.game = w; }

    // ================= Escena estática =================
    buildLights() {
      this.scene.add(new T.HemisphereLight(0xcfe3ff, 0x3d4a2a, 1.25));
      const sun = this.sun = new T.DirectionalLight(0xfff1d6, 2.1);
      sun.castShadow = !this.low;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -2400; sc.right = 2400; sc.top = 2400; sc.bottom = -2400; sc.near = 100; sc.far = 9000;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 2;
      this.scene.add(sun); this.scene.add(sun.target);
    }

    mapInfo() {
      const map = M.MAP, W = map.width, H = map.height;
      const n = function (p) { return [p.x / W, p.y / H]; };
      return {
        lanes: { top: map.lanes.top.map(n), mid: map.lanes.mid.map(n), bot: map.lanes.bot.map(n) },
        laneWidth: 620 / W, river: map.river.map(n), riverWidth: map.riverWidth / W,
        bases: map.fountains.map(function (f, t) { return { x: (f.x + (t ? -900 : 900)) / W, y: (f.y + (t ? 900 : -900)) / H, r: 2900 / W, team: t }; }),
        walls: map.walls.map(function (poly) { return poly.map(n); }),
        brush: map.brush.map(function (b) { return { x: b.x / W, y: b.y / H, rx: b.rx / W, ry: b.ry / H, rot: b.rot }; })
      };
    }

    buildGroundTexture() {
      const size = this.low ? 1024 : 2048;
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      const info = this.mapInfo();
      let ok = false;
      if (M.Art.ground) { try { M.Art.ground(ctx, size, info); ok = true; } catch (e) { console.warn('Pintor de suelo falló', e); } }
      if (!ok) this.fallbackGround(ctx, size, info);
      const tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.gl.capabilities.getMaxAnisotropy());
      this.groundCanvas = cv;
      return tex;
    }
    fallbackGround(ctx, S, m) {
      ctx.fillStyle = '#3f7a3a'; ctx.fillRect(0, 0, S, S);
      const rnd = seeded(5);
      for (let i = 0; i < 2500; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(30,70,30,0.25)' : 'rgba(90,140,60,0.2)'; ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 4 + rnd() * 30, 0, 6.283); ctx.fill(); }
      const line = function (pts, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0] * S, p[1] * S); else ctx.moveTo(p[0] * S, p[1] * S); }); ctx.stroke(); };
      line(m.river, m.riverWidth * 1.15, '#6b5d3f'); line(m.river, m.riverWidth, '#2c8fb0');
      for (const k in m.lanes) { line(m.lanes[k], m.laneWidth * 1.15, '#6d5a3a'); line(m.lanes[k], m.laneWidth, '#a08660'); }
      for (const b of m.bases) { ctx.fillStyle = b.team ? 'rgba(150,80,80,0.5)' : 'rgba(80,110,160,0.5)'; ctx.beginPath(); ctx.arc(b.x * S, b.y * S, b.r * S, 0, 6.283); ctx.fill(); }
      for (const b of m.brush) { ctx.save(); ctx.translate(b.x * S, b.y * S); ctx.rotate(b.rot); ctx.fillStyle = '#255a26'; ctx.beginPath(); ctx.ellipse(0, 0, b.rx * S, b.ry * S, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
    }

    buildWorld() {
      const map = M.MAP, W = map.width, H = map.height, scene = this.scene;
      // Suelo pintado
      const ground = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ map: this.buildGroundTexture(), roughness: 0.95, metalness: 0 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
      scene.add(ground);
      const outer = new T.Mesh(new T.PlaneGeometry(W * 4, H * 4), new T.MeshStandardMaterial({ color: 0x1d3a22, roughness: 1 }));
      outer.rotation.x = -Math.PI / 2; outer.position.set(W / 2, -6, H / 2); scene.add(outer);
      // Río (superficie de agua animada)
      const curve = new T.CatmullRomCurve3(map.river.map(function (p) { return new T.Vector3(p.x, 0, p.y); }));
      const pts = curve.getSpacedPoints(120), rw = map.riverWidth * 0.5;
      const pos = [], idx = [];
      pts.forEach(function (p, i) {
        const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        pos.push(p.x + nx * rw, 7, p.z + nz * rw, p.x - nx * rw, 7, p.z - nz * rw);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
      this.water = new T.Mesh(rg, new T.MeshStandardMaterial({ color: 0x3fc6e0, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.2, emissive: 0x0d4a66, emissiveIntensity: 0.4, side: T.DoubleSide, depthWrite: false }));
      scene.add(this.water);
      // Paredes de terreno (acantilados extruidos)
      let wallMat = null;
      if (M.Art.wallMaterial) { try { wallMat = M.Art.wallMaterial(T, { THREE: T, cache: this.cache }); } catch (e) { console.warn(e); } }
      if (!wallMat) wallMat = new T.MeshStandardMaterial({ color: 0x5d6b52, flatShading: true, roughness: 0.9 });
      const depth = 260;
      const self = this;
      map.walls.forEach(function (poly, wi) {
        const shape = new T.Shape(poly.map(function (p) { return new T.Vector2(p.x, p.y); }));
        const g = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: 60, bevelSize: 55, bevelSegments: 2, steps: 2, curveSegments: 6 });
        g.rotateX(Math.PI / 2); g.translate(0, depth, 0);
        // irregularidad determinista (los vértices compartidos se mueven igual: sin grietas)
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const h = Math.sin(x * 0.013 + z * 0.007) * Math.cos(z * 0.011 - x * 0.005);
          pa.setXYZ(i, x + h * 28, Math.max(0, y + (y > 30 ? h * 45 : 0)), z + Math.sin(x * 0.009 + wi) * 22);
        }
        g.computeVertexNormals();
        const mesh = new T.Mesh(g, wallMat); mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
      });
      this.buildProps();
    }

    /** Escenografía instanciada (árboles, pasto de arbustos, rocas, flores…) para que sean pocos draw calls. */
    instance(id, seed, list, opts) {
      if (!list.length) return;
      const spec = M.Art.props[id];
      let obj = null;
      if (spec) { try { obj = spec.build(T, { THREE: T, cache: this.cache, seed: seed, team: 0, teamColor: 0x38a3ff }).object; } catch (e) { console.warn('prop ' + id, e); } }
      if (!obj) obj = this.fallbackProp(id);
      obj.updateMatrixWorld(true);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), pv = new T.Vector3(), up = new T.Vector3(0, 1, 0);
      const self = this;
      obj.traverse(function (o) {
        if (!o.isMesh) return;
        const inst = new T.InstancedMesh(o.geometry, o.material, list.length);
        list.forEach(function (p, i) {
          q.setFromAxisAngle(up, p.rot || 0); s.setScalar(p.scale || 1); pv.set(p.x, p.h || 0, p.y);
          m4.compose(pv, q, s).multiply(o.matrixWorld);
          inst.setMatrixAt(i, m4);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = !!(opts && opts.shadow); inst.receiveShadow = !!(opts && opts.receive);
        inst.computeBoundingSphere();
        self.scene.add(inst);
      });
    }
    fallbackProp(id) {
      const g = new T.Group();
      if (id === 'tree') {
        const tr = new T.Mesh(new T.CylinderGeometry(25, 35, 160, 6), this.cache.mat(0x6b4a2b)); tr.position.y = 80; g.add(tr);
        const c = new T.Mesh(new T.ConeGeometry(160, 380, 7), this.cache.mat(0x2f6b35)); c.position.y = 330; g.add(c);
      } else if (id === 'grassTuft') {
        const c = new T.Mesh(new T.ConeGeometry(60, 120, 5), this.cache.mat(0x2e7d32)); c.position.y = 60; g.add(c);
      } else {
        const c = new T.Mesh(new T.DodecahedronGeometry(80), this.cache.mat(0x8a8f99)); c.position.y = 40; g.add(c);
      }
      return g;
    }
    buildProps() {
      const map = M.MAP, W = map.width, H = map.height, rnd = seeded(1234);
      const lanePts = [];
      for (const k in map.lanes) { const p = map.lanes[k], L = map.laneLength[k]; for (let d = 0; d < L; d += 200) lanePts.push(map.pointAt(p, d)); }
      const riverPts = [];
      for (let i = 1; i < map.river.length; i++) { const a = map.river[i - 1], b = map.river[i], n = Math.ceil(U.dist(a, b) / 200); for (let k = 0; k < n; k++) riverPts.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }); }
      const near = function (list, x, y, r) { for (const p of list) if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r && Math.hypot(p.x - x, p.y - y) < r) return true; return false; };
      const inBase = function (x, y, r) { return map.fountains.some(function (f) { return Math.hypot(f.x - x, f.y - y) < r; }); };
      const free = function (x, y, laneR, riverR) {
        return !near(lanePts, x, y, laneR) && !near(riverPts, x, y, riverR) && !inBase(x, y, 2700) &&
          !map.camps.some(function (c) { return Math.hypot(c.x - x, c.y - y) < 450; }) && map.brushAt(x, y) < 0;
      };
      // Árboles: borde del mapa + sobre las paredes + rincones de la jungla
      const trees = [[], [], [], []];
      const addTree = function (x, y, s) { trees[Math.floor(rnd() * 4)].push({ x: x, y: y, rot: rnd() * 6.28, scale: s || (0.8 + rnd() * 0.5), h: 0 }); };
      for (let x = -600; x < W + 600; x += 380) for (let y = -600; y < H + 600; y += 380) {
        const jx = x + (rnd() - 0.5) * 260, jy = y + (rnd() - 0.5) * 260;
        const edge = Math.min(jx, jy, W - jx, H - jy);
        if (edge < 650 && free(jx, jy, 650, 700)) addTree(jx, jy, 0.9 + rnd() * 0.6);
      }
      for (const poly of map.walls) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        poly.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
        for (let x = minX; x < maxX; x += 230) for (let y = minY; y < maxY; y += 230) {
          const jx = x + rnd() * 120, jy = y + rnd() * 120;
          if (map.nav.blocked(jx, jy) && pip(jx, jy, poly)) trees[Math.floor(rnd() * 4)].push({ x: jx, y: jy, rot: rnd() * 6.28, scale: 0.55 + rnd() * 0.35, h: 250 });
        }
      }
      for (let i = 0; i < 4; i++) this.instance('tree', i + 1, trees[i], { shadow: true });
      // Pasto alto de los arbustos
      const tufts = [];
      for (const b of map.brush) {
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        for (let lx = -b.rx; lx <= b.rx; lx += 85) for (let ly = -b.ry; ly <= b.ry; ly += 85) {
          const ex = lx + (rnd() - 0.5) * 50, ey = ly + (rnd() - 0.5) * 50;
          if ((ex * ex) / (b.rx * b.rx) + (ey * ey) / (b.ry * b.ry) > 1.05) continue;
          tufts.push({ x: b.x + ex * c - ey * s, y: b.y + ex * s + ey * c, rot: rnd() * 6.28, scale: 0.9 + rnd() * 0.5 });
        }
      }
      this.instance('grassTuft', 3, tufts);
      // Decoración de la jungla
      const scatter = function (n, laneR, riverR) {
        const out = [];
        for (let i = 0; i < n * 8 && out.length < n; i++) {
          const x = 1600 + rnd() * (W - 3200), y = 1600 + rnd() * (H - 3200);
          if (map.nav.blocked(x, y) || !free(x, y, laneR, riverR)) continue;
          out.push({ x: x, y: y, rot: rnd() * 6.28, scale: 0.7 + rnd() * 0.6 });
        }
        return out;
      };
      this.instance('rock', 2, scatter(70, 520, 600), { shadow: true });
      this.instance('rock', 9, scatter(50, 520, 600), { shadow: true });
      this.instance('bush', 4, scatter(60, 480, 600));
      this.instance('flowers', 5, scatter(140, 420, 520));
      this.instance('mushroom', 6, scatter(60, 520, 600));
      this.instance('crystal', 7, scatter(26, 600, 700));
      // Juncos en las orillas del río
      const reeds = [];
      for (const p of riverPts) {
        if (near(lanePts, p.x, p.y, 700) || inBase(p.x, p.y, 1200)) continue;
        for (const side of [-1, 1]) if (rnd() < 0.6) {
          const o = map.riverWidth * 0.5 * (0.85 + rnd() * 0.3);
          reeds.push({ x: p.x + side * o * 0.7071, y: p.y - side * o * 0.7071, rot: rnd() * 6.28, scale: 0.8 + rnd() * 0.5 });
        }
      }
      this.instance('reed', 8, reeds);
      // Faroles a los costados de los carriles
      const lamps = [];
      for (const k in map.lanes) {
        const p = map.lanes[k], L = map.laneLength[k];
        for (let d = 1500; d < L - 1500; d += 2100) {
          const a = map.pointAt(p, d), b = map.pointAt(p, d + 10), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
          const side = (Math.floor(d / 2100) % 2) ? 1 : -1, x = a.x - dy / l * 420 * side, y = a.y + dx / l * 420 * side;
          if (!map.nav.blocked(x, y) && map.brushAt(x, y) < 0) lamps.push({ x: x, y: y, rot: rnd() * 6.28, scale: 1 });
        }
      }
      this.instance('lamp', 10, lamps, { shadow: true });
      // Fuentes y estandartes (animados, no instanciados)
      const self = this;
      map.fountains.forEach(function (f, t) {
        self.addAnimatedProp('fountain', f.x, f.y, t, 0);
        const nx = map.nexus[t];
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          self.addAnimatedProp('banner', nx.x + Math.cos(a) * 520, nx.y + Math.sin(a) * 520, t, a);
        }
      });
      function pip(x, y, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i], b = poly[j];
          if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
        }
        return inside;
      }
    }
    addAnimatedProp(id, x, y, team, rot) {
      const spec = M.Art.props[id];
      if (!spec) return;
      try {
        const b = spec.build(T, { THREE: T, cache: this.cache, seed: 1, team: team, teamColor: toHex(M.TEAM_COLORS[team]) });
        b.object.position.set(x, 0, y); b.object.rotation.y = rot || 0;
        b.object.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
        this.scene.add(b.object);
        if (b.update) this.animated.push(b);
      } catch (e) { console.warn('prop ' + id, e); }
    }

    // ================= Indicadores en el suelo =================
    flatMat(color, opacity) {
      return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    }
    buildIndicators() {
      const mk = (geo, color, op, order) => { const m = new T.Mesh(geo, this.flatMat(color, op)); m.rotation.x = -Math.PI / 2; m.renderOrder = order || 5; m.visible = false; this.scene.add(m); return m; };
      const ring = new T.RingGeometry(0.975, 1, 96);
      this.ind = {
        range: mk(ring, 0xff5050, 0.55), abRange: mk(ring, 0x78c8ff, 0.6), towerRange: mk(new T.RingGeometry(0.985, 1, 128), 0xff4040, 0.5),
        hover: mk(new T.RingGeometry(0.82, 1, 48), 0xff3030, 0.9, 7), rect: mk(new T.PlaneGeometry(1, 1), 0x78c8ff, 0.25), rectEdge: mk(new T.RingGeometry(0.97, 1, 4, 1, Math.PI / 4), 0x78c8ff, 0.7),
        circle: mk(new T.CircleGeometry(1, 48), 0x78c8ff, 0.22), circleEdge: mk(new T.RingGeometry(0.96, 1, 64), 0x78c8ff, 0.8),
        click: mk(new T.RingGeometry(0.6, 1, 24), 0x6eff8c, 0.9, 8)
      };
      this.arrows = [];
      const ag = new T.ConeGeometry(18, 46, 3);
      for (let i = 0; i < 4; i++) { const a = new T.Mesh(ag, new T.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.9, depthWrite: false })); a.visible = false; a.renderOrder = 8; this.scene.add(a); this.arrows.push(a); }
    }
    setFlat(m, x, y, r, h) { m.visible = true; m.position.set(x, h || 4, y); m.scale.set(r, r, r); }

    // ================= Cámara =================
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.gl.setSize(w, h, false);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.overlay.width = w; this.overlay.height = h;
      this.W = w; this.H = h;
      this.camera.aspect = w / h;
      this.updateZoom();
    }
    updateZoom() {
      this.viewWidth = VIEW_WIDTH / this.userZoom;
      this.cam.zoom = (this.W || 1280) / this.viewWidth;
      const visH = this.viewWidth / this.camera.aspect;
      this.camDist = visH / (2 * Math.tan(FOV * Math.PI / 360)) * Math.sin(PITCH) * 1.0;
      this.camera.updateProjectionMatrix();
    }
    zoomBy(f) { this.userZoom = U.clamp(this.userZoom * f, 0.6, 1.5); this.updateZoom(); }
    clampCam() {
      this.cam.x = U.clamp(this.cam.x, 600, M.MAP.width - 600);
      this.cam.y = U.clamp(this.cam.y, 800, M.MAP.height - 300);
    }
    placeCamera() {
      const d = this.camDist / Math.sin(PITCH);
      let sx = 0, sy = 0;
      const shake = this.game.shake || 0;
      if (shake > 0) { sx = (Math.random() - 0.5) * shake * 6; sy = (Math.random() - 0.5) * shake * 6; }
      const tx = this.cam.x + sx, tz = this.cam.y + sy;
      this.camera.position.set(tx, Math.sin(PITCH) * d, tz + Math.cos(PITCH) * d);
      this.camera.lookAt(tx, 0, tz);
      this.camera.updateMatrixWorld();
      this.sun.position.set(tx - 1600, 3800, tz + 900); this.sun.target.position.set(tx, 0, tz);
      this.placedX = this.cam.x; this.placedY = this.cam.y;
    }
    /** Si la cámara lógica se movió desde el último cuadro, actualiza la de Three.js (para conversiones exactas). */
    syncCamera() { if (this.placedX !== this.cam.x || this.placedY !== this.cam.y) { const sh = this.game.shake; this.game.shake = 0; this.placeCamera(); this.game.shake = sh; } }
    screenToWorld(sx, sy) {
      this.syncCamera();
      const v = new T.Vector2((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
      this.ray.setFromCamera(v, this.camera);
      const out = new T.Vector3();
      if (!this.ray.ray.intersectPlane(this.plane, out)) return { x: this.cam.x, y: this.cam.y };
      return { x: out.x, y: out.z };
    }
    worldToScreen(x, y, h) {
      this.syncCamera();
      const v = this.tmpV.set(x, h || 0, y).project(this.camera);
      return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, behind: v.z > 1 };
    }

    // ================= Modelos =================
    artCtx(team, def) {
      return { THREE: T, cache: this.cache, team: team, teamColor: toHex(M.TEAM_COLORS[team]),
        color: def ? toHex(def.color) : 0xcccccc, accent: def ? toHex(def.accent) : 0xffffff };
    }
    buildModel(artId, spec, ctx, fallback) {
      if (spec && !this.artErrors[artId]) {
        try {
          const m = spec.build(T, ctx);
          if (m && m.object) return m;
        } catch (e) { console.warn('Arte ' + artId + ' falló; uso respaldo', e); this.artErrors[artId] = true; }
      }
      return fallback.call(this, ctx);
    }
    unitArtId(u) {
      if (u.type === 'champion') return 'champ:' + u.def.id;
      if (u.type === 'minion') return 'minion_' + (u.kind || 'melee');
      if (u.type === 'monster') return u.kind === 'golem' ? 'golem' : 'wolf';
      return u.type;
    }
    createView(u) {
      const artId = this.unitArtId(u);
      const poolKey = artId + ':' + u.team;
      let model = null;
      if (u.type === 'minion' || u.type === 'monster') { const pool = this.pools[poolKey]; if (pool && pool.length) model = pool.pop(); }
      if (!model) {
        if (u.type === 'champion') model = this.buildModel(artId, M.Art.champions[u.def.id], this.artCtx(u.team, u.def), this.fallbackChampion);
        else model = this.buildModel(artId, M.Art.units[artId], this.artCtx(u.team), this.fallbackUnit(u));
        model.object.traverse(function (o) { if (o.isMesh) { o.castShadow = u.type !== 'minion'; o.receiveShadow = false; } });
        const box = new T.Box3().setFromObject(model.object), sz = new T.Vector3(); box.getSize(sz);
        model.height = isFinite(sz.y) && sz.y > 0 ? Math.min(sz.y, u.type === 'tower' ? 700 : 420) : 200;
      }
      if (u.kind === 'wolf_small') model.object.scale.setScalar(0.7); else model.object.scale.setScalar(1);
      const root = new T.Group();
      root.add(model.object);
      // aro del equipo en el suelo
      const tc = u.team === 2 ? 0xe0b44a : toHex(M.TEAM_COLORS[u.team]);
      const r = u.radius;
      const ringMat = new T.MeshBasicMaterial({ color: tc, transparent: true, opacity: u.type === 'champion' ? 0.85 : 0.5, depthWrite: false, side: T.DoubleSide });
      const ring = new T.Mesh(new T.RingGeometry(r * 0.92, r * 1.08, 40), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 3; ring.renderOrder = 3;
      if (u.type !== 'nexus') root.add(ring);
      this.scene.add(root);
      const v = { u: u, root: root, model: model, ring: ring, artId: artId, poolKey: poolKey, anim: 'idle', animT: 0, face: u.facing || 0, deadT: 0, gone: 0 };
      if (u.type === 'champion' && u === this.game.player) {
        const me = new T.Mesh(new T.RingGeometry(r * 1.12, r * 1.24, 48), new T.MeshBasicMaterial({ color: 0xffe45a, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide }));
        me.rotation.x = -Math.PI / 2; me.position.y = 3; root.add(me); v.meRing = me;
      }
      return v;
    }
    releaseView(v) {
      this.scene.remove(v.root);
      v.root.remove(v.model.object);
      v.ring.geometry.dispose(); v.ring.material.dispose();
      if (v.u.type === 'minion' || v.u.type === 'monster') (this.pools[v.poolKey] = this.pools[v.poolKey] || []).push(v.model);
    }
    fallbackChampion(ctx) {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const b = new T.Mesh(new T.CapsuleGeometry(45, 90, 4, 8), this.cache.mat(ctx.color)); b.position.y = 100; body.add(b);
      const h = new T.Mesh(new T.SphereGeometry(38, 10, 8), this.cache.mat(ctx.accent)); h.position.y = 200; body.add(h);
      return { object: g, update: function (s) { body.position.y = s.anim === 'walk' ? Math.abs(Math.sin(s.time * 10)) * 12 : Math.sin(s.time * 2) * 4; body.rotation.x = s.anim === 'attack' ? Math.sin(s.progress * Math.PI) * 0.5 : 0; } };
    }
    fallbackUnit(u) {
      return function (ctx) {
        const g = new T.Group(), body = new T.Group(); g.add(body);
        let geo, y = 60, col = ctx.teamColor;
        if (u.type === 'tower') { geo = new T.CylinderGeometry(60, 90, 420, 8); y = 210; col = 0x8a867c; const o = new T.Mesh(new T.SphereGeometry(50, 12, 10), this.cache.mat(ctx.teamColor, { emissive: ctx.teamColor, emissiveIntensity: 0.6 })); o.position.y = 470; body.add(o); }
        else if (u.type === 'nexus') { geo = new T.OctahedronGeometry(140); y = 220; }
        else if (u.type === 'monster') { geo = new T.DodecahedronGeometry(u.radius); y = u.radius; col = 0x6b5a8e; }
        else geo = u.kind === 'cannon' ? new T.BoxGeometry(90, 70, 110) : new T.ConeGeometry(42, 110, 6);
        const m = new T.Mesh(geo, this.cache.mat(col)); m.position.y = y; body.add(m);
        return { object: g, update: function (s) { body.position.y = s.anim === 'walk' ? Math.abs(Math.sin(s.time * 12)) * 8 : 0; if (u.type === 'nexus') m.rotation.y = s.time * 0.5; } };
      };
    }
    animOf(v, u, now) {
      let anim = 'idle', progress = 0, slot = 0;
      if (u.dead) anim = 'dead';
      else if (u.recalling) anim = 'recall';
      else if (u.castAt != null && now - u.castAt >= 0 && now - u.castAt < 0.55) { anim = 'cast'; progress = (now - u.castAt) / 0.55; slot = u.castSlot || 0; }
      else if (u.attackStart != null && now - u.attackStart >= 0 && now - u.attackStart < Math.min(u.attackPeriod || 1, 0.9)) {
        anim = 'attack'; progress = (now - u.attackStart) / Math.min(u.attackPeriod || 1, 0.9);
      } else if (Math.hypot(u.vx || 0, u.vy || 0) > 40) anim = 'walk';
      if (anim !== v.anim) { v.anim = anim; v.animT = 0; }
      return { anim: anim, t: v.animT, progress: U.clamp(progress, 0, 1), time: this.time, slot: slot, speed: Math.hypot(u.vx || 0, u.vy || 0), dt: this.dt,
        hpFrac: u.maxHp ? U.clamp(u.hp / u.maxHp, 0, 1) : 1, heat: u.heat || 0 };
    }
    syncUnits(dt) {
      const w = this.game, me = w.player, myTeam = me ? me.team : 0, now = w.time;
      const seen = new Set();
      const consider = w.units.slice();
      for (const c of w.champions) if (consider.indexOf(c) < 0) consider.push(c);
      for (const u of consider) {
        seen.add(u.id);
        let v = this.views.get(u.id);
        if (!v) { v = this.createView(u); this.views.set(u.id, v); }
        v.u = u; v.gone = 0;
        const hidden = (u.hiddenLocal) || (w.isVisibleTo && !w.isVisibleTo(myTeam, u));
        if (u.dead) v.deadT += dt; else v.deadT = 0;
        const showDead = u.type === 'tower' || u.type === 'nexus' || v.deadT < 2.5;
        v.root.visible = !hidden && showDead;
        if (!v.root.visible) continue;
        v.root.position.set(u.x, 0, u.y);
        if (u.dead && u.type === 'champion') v.root.position.y = -Math.max(0, v.deadT - 1.2) * 120;
        // girar suavemente hacia donde mira
        let target = Math.PI / 2 - (u.facing || 0);
        let diff = target - v.face; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.face += diff * Math.min(1, dt * 14);
        if (!u.isStatic) v.model.object.rotation.y = v.face;
        v.animT += dt;
        const st = this.animOf(v, u, now);
        if (v.model.update && !v.broken) { try { v.model.update(st); } catch (e) { v.broken = true; console.warn('update de ' + v.artId + ' falló', e); } }
        v.ring.visible = !u.dead;
        const hov = this.hoverTarget === u;
        v.ring.material.opacity = hov ? 1 : (u.type === 'champion' ? 0.85 : 0.5);
        v.ring.material.color.setHex(hov ? 0xff3030 : (u.team === 2 ? 0xe0b44a : toHex(M.TEAM_COLORS[u.team])));
      }
      // unidades que ya no están: animación de muerte breve y se devuelven al pool
      for (const [id, v] of this.views) {
        if (seen.has(id)) continue;
        v.gone += dt;
        if (v.gone === dt) { v.anim = 'dead'; v.animT = 0; }
        if (v.gone > 0.9 || !v.root.visible) { this.releaseView(v); this.views.delete(id); continue; }
        v.animT += dt;
        try { v.model.update && v.model.update({ anim: 'dead', t: v.animT, progress: 1, time: this.time, slot: 0, speed: 0, dt: dt, hpFrac: 0, heat: 0 }); } catch (e) { /* nada */ }
        v.root.position.y = -v.gone * 60; v.ring.visible = false;
      }
    }

    // ================= Efectos =================
    makeFx(def, slot, info) {
      const spec = def && M.Art.champions[def];
      const f = spec && spec.fx && spec.fx[SLOT_KEYS[slot]];
      if (f && !this.artErrors['fx:' + def + slot]) {
        try { const e = f(T, { THREE: T, cache: this.cache, team: info.team || 0, teamColor: toHex(M.TEAM_COLORS[info.team || 0]) }, info); if (e && e.object) return e; }
        catch (err) { console.warn('fx ' + def + ' ' + slot, err); this.artErrors['fx:' + def + slot] = true; }
      }
      return null;
    }
    genericRing(color, r0, r1, fill) {
      const mat = new T.MeshBasicMaterial({ color: toHex(color || '#ffffff'), transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
      const m = new T.Mesh(fill ? new T.CircleGeometry(1, 48) : new T.RingGeometry(0.9, 1, 48), mat);
      m.rotation.x = -Math.PI / 2;
      const g = new T.Group(); g.add(m);
      return { object: g, update: function (p) { const r = r0 + (r1 - r0) * Math.min(1, p * 1.6); m.scale.set(r, r, r); mat.opacity = (1 - p) * (fill ? 0.35 : 0.9); } };
    }
    genericBeam(color, len, width) {
      const mat = new T.MeshBasicMaterial({ color: toHex(color || '#ffffff'), transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending });
      const m = new T.Mesh(new T.BoxGeometry(width, 40, len), mat); m.position.set(0, 60, len / 2);
      const core = new T.Mesh(new T.BoxGeometry(width * 0.3, 30, len), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending })); core.position.copy(m.position);
      const g = new T.Group(); g.add(m); g.add(core);
      return { object: g, update: function (p) { mat.opacity = 0.8 * (1 - p); core.material.opacity = 0.9 * (1 - p); } };
    }
    burstFx(color, n, speed) {
      n = Math.min(40, Math.max(3, n | 0));
      const pos = new Float32Array(n * 3), vel = [];
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random() * 0.7) * Math.max(120, speed); vel.push([Math.cos(a) * s, 150 + Math.random() * 350, Math.sin(a) * s]); pos[i * 3 + 1] = 60; }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const mat = new T.PointsMaterial({ color: toHex(color || '#ffffff'), size: 22, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending });
      const pts = new T.Points(geo, mat);
      const g = new T.Group(); g.add(pts);
      return { object: g, update: function (p, dt) {
        for (let i = 0; i < n; i++) { pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] = Math.max(5, pos[i * 3 + 1] + vel[i][1] * dt); pos[i * 3 + 2] += vel[i][2] * dt; vel[i][1] -= 900 * dt; vel[i][0] *= 0.96; vel[i][2] *= 0.96; }
        geo.attributes.position.needsUpdate = true; mat.opacity = 1 - p;
      } };
    }
    addFx(e, x, y, rot, life, h) {
      e.object.position.set(x, h || 0, y);
      if (rot != null) e.object.rotation.y = rot;
      this.scene.add(e.object);
      this.fxViews.push({ e: e, age: 0, life: Math.max(0.1, life) });
    }
    disposeObj(o) {
      const cache = this.cache;
      o.traverse(function (c) {
        if (c.geometry && !c.geometry.__shared) c.geometry.dispose();
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { if (!m.__cached) m.dispose(); }); }
      });
    }
    dirRot(dx, dy) { return Math.atan2(dx, dy); }   // +Z del modelo hacia (dx, dy) del mapa
    processFx() {
      const w = this.game;
      for (const f of w.fx) {
        if (f.id <= this.lastFx) continue;
        this.lastFx = Math.max(this.lastFx, f.id);
        const caster = f.uid ? (this.views.get(f.uid) || {}).u : null;
        const team = caster ? caster.team : 0;
        if (f.type === 'burst') this.addFx(this.burstFx(f.color, f.n, f.speed), f.x, f.y, null, 0.8);
        else if (f.type === 'ring') {
          let e = null;
          if (f.def) e = this.makeFx(f.def, f.slot, { kind: f.ally ? 'self' : 'burst', radius: f.r1, width: 0, length: 0, duration: f.max, slot: f.slot, team: team });
          this.addFx(e || this.genericRing(f.color, f.r0, f.r1, f.fill), f.x, f.y, null, (f.max || 0.5) + (e ? 0.25 : 0));
        } else if (f.type === 'beam') {
          const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
          let e = null;
          if (f.def) e = this.makeFx(f.def, f.slot, { kind: 'line', radius: f.width / 2, width: f.width, length: len, duration: f.max, slot: f.slot });
          this.addFx(e || this.genericBeam(f.color, len, f.width), f.x1, f.y1, this.dirRot(f.x2 - f.x1, f.y2 - f.y1), (f.max || 0.3) + (e ? 0.25 : 0));
        } else if (f.type === 'swing') {
          this.addFx(this.genericRing(f.color, f.r * 0.6, f.r, false), f.x, f.y, null, 0.18);
        } else if (f.type === 'cast') {
          if (f.cast === 'self' || f.cast === 'dash') {
            const e = this.makeFx(f.def, f.slot, { kind: f.cast === 'dash' ? 'dash' : 'self', radius: f.radius || 160, width: f.width, length: f.range, duration: 0.6, slot: f.slot, team: team });
            if (e) this.addFx(e, f.x, f.y, this.dirRot(f.tx - f.x, f.ty - f.y), 0.8);
          } else if (f.cast === 'target') {
            const e = this.makeFx(f.def, f.slot, { kind: 'target', radius: 150, width: 60, length: 0, duration: 0.6, slot: f.slot, team: team });
            if (e) this.addFx(e, f.tx, f.ty, null, 0.7);
          }
        }
      }
    }
    syncProjectiles() {
      const seen = new Set();
      for (const p of this.game.projectiles) {
        seen.add(p.id);
        let v = this.projViews.get(p.id);
        if (!v) {
          let e = null;
          const def = p.def || (p.source && p.source.def && p.source.def.id) || null;
          const slot = p.slot != null ? p.slot : (p.ability ? p.ability.slot : 0);
          if (p.kind === 'skill') e = this.makeFx(def, slot, { kind: 'projectile', radius: (p.width || 80) / 2, width: p.width || 80, length: 0, duration: 1, slot: slot });
          if (!e) e = this.orb(p.color, p.kind === 'skill' ? (p.width || 80) * 0.4 : (p.size || 12) * 1.5);
          this.scene.add(e.object);
          v = { e: e, age: 0 }; this.projViews.set(p.id, v);
        }
        v.age += this.dt;
        const h = p.kind === 'homing' ? 110 : 100;
        v.e.object.position.set(p.x, h, p.y);
        let dx = p.vx || 0, dy = p.vy || 0;
        if (!dx && !dy && v.lx != null) { dx = p.x - v.lx; dy = p.y - v.ly; }
        if (dx || dy) v.e.object.rotation.y = this.dirRot(dx, dy);
        v.lx = p.x; v.ly = p.y;
        try { v.e.update && v.e.update(Math.min(1, v.age / 1.2), this.dt); } catch (err) { /* nada */ }
      }
      for (const [id, v] of this.projViews) if (!seen.has(id)) { this.scene.remove(v.e.object); this.disposeObj(v.e.object); this.projViews.delete(id); }
    }
    orb(color, r) {
      const col = toHex(color || '#ffffff');
      const g = new T.Group();
      const core = new T.Mesh(this.cache.geo('orb', function () { return new T.SphereGeometry(1, 10, 8); }), this.cache.basic(col));
      core.scale.setScalar(r); core.geometry.__shared = true; core.material.__cached = true;
      const glow = new T.Mesh(core.geometry, this.cache.basic(col, { transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }));
      glow.scale.setScalar(r * 2); glow.material.__cached = true;
      g.add(core); g.add(glow);
      return { object: g, update: null };
    }
    syncZones() {
      const seen = new Set(), me = this.game.player;
      for (const z of this.game.zones) {
        seen.add(z.id);
        let v = this.zoneViews.get(z.id);
        const def = z.def || (z.caster && z.caster.def && z.caster.def.id);
        const slot = z.slot != null ? z.slot : (z.ab ? z.ab.slot : 0);
        const enemy = me && z.team !== me.team;
        if (!v) {
          const col = toHex(z.color || '#ffffff');
          const g = new T.Group();
          const decal = z.shape === 'line'
            ? new T.Mesh(new T.PlaneGeometry(1, 1), this.flatMat(col, 0.22))
            : new T.Mesh(new T.CircleGeometry(1, 48), this.flatMat(col, 0.18));
          const fillM = z.shape === 'line' ? null : new T.Mesh(new T.CircleGeometry(1, 48), this.flatMat(col, 0.3));
          const edge = z.shape === 'line' ? null : new T.Mesh(new T.RingGeometry(0.95, 1, 64), this.flatMat(enemy ? 0xff5050 : col, 0.85));
          [decal, fillM, edge].forEach(function (m) { if (m) { m.rotation.x = -Math.PI / 2; m.position.y = 5; m.renderOrder = 4; g.add(m); } });
          this.scene.add(g);
          const life = (z.maxDelay || 0) + Math.max(z.duration || 0, 0.5);
          const info = z.shape === 'line'
            ? { kind: 'line', radius: z.width / 2, width: z.width, length: Math.hypot(z.x2 - z.x, z.y2 - z.y), duration: life, slot: slot }
            : { kind: 'area', radius: z.radius, width: z.radius * 2, length: 0, duration: life, slot: slot };
          const e = this.makeFx(def, slot, info);
          if (e) { if (z.shape === 'line') { e.object.position.set(z.x, 0, z.y); e.object.rotation.y = this.dirRot(z.x2 - z.x, z.y2 - z.y); } else e.object.position.set(z.x, 0, z.y); this.scene.add(e.object); }
          v = { g: g, decal: decal, fill: fillM, edge: edge, e: e, age: 0, life: life };
          this.zoneViews.set(z.id, v);
        }
        v.age += this.dt;
        const pct = z.maxDelay ? U.clamp(1 - z.delay / z.maxDelay, 0, 1) : 1;
        if (z.shape === 'line') {
          const dx = z.x2 - z.x, dy = z.y2 - z.y, len = Math.hypot(dx, dy);
          v.decal.position.set((z.x + z.x2) / 2, 5, (z.y + z.y2) / 2);
          v.decal.rotation.set(-Math.PI / 2, 0, -Math.atan2(dy, dx));
          v.decal.scale.set(len, z.width, 1);
          v.decal.material.opacity = 0.12 + pct * 0.25;
        } else {
          v.decal.position.set(z.x, 5, z.y); v.decal.scale.setScalar(z.radius);
          v.edge.position.set(z.x, 5.5, z.y); v.edge.scale.setScalar(z.radius);
          v.fill.position.set(z.x, 5.2, z.y); v.fill.scale.setScalar(Math.max(1, z.radius * (z.delay > 0 ? pct : 1)));
          v.fill.material.opacity = z.delay > 0 ? 0.3 : 0.12 + Math.sin(this.time * 8) * 0.05;
        }
        if (v.e && v.e.update) { try { v.e.update(Math.min(1, v.age / v.life), this.dt); } catch (err) { /* nada */ } }
      }
      for (const [id, v] of this.zoneViews) if (!seen.has(id)) {
        this.scene.remove(v.g); this.disposeObj(v.g);
        if (v.e) {
          // dejar que el efecto termine su animación
          this.fxViews.push({ e: v.e, age: v.age, life: Math.max(v.age + 0.3, v.life), attached: true });
        }
        this.zoneViews.delete(id);
      }
    }
    updateFxViews(dt) {
      const keep = [];
      for (const f of this.fxViews) {
        f.age += dt;
        if (f.age >= f.life) { this.scene.remove(f.e.object); this.disposeObj(f.e.object); continue; }
        try { f.e.update && f.e.update(f.age / f.life, dt); } catch (e) { /* nada */ }
        keep.push(f);
      }
      this.fxViews = keep;
    }

    // ================= Indicadores =================
    updateIndicators(dt) {
      const ind = this.ind, p = this.game.player;
      for (const k in ind) ind[k].visible = false;
      this.arrows.forEach(function (a) { a.visible = false; });
      if (!p) return;
      const pulse = 0.6 + Math.sin(this.time * 10) * 0.4;
      const h = this.hoverTarget;
      if (h && !h.dead) { this.setFlat(ind.hover, h.x, h.y, h.radius + 28, 6); ind.hover.material.opacity = 0.55 + pulse * 0.45; }
      const t = p.target || (p.targetId && this.views.get(p.targetId) ? this.views.get(p.targetId).u : null);
      if (t && !t.dead && !p.dead) {
        const r = t.radius + 40 + pulse * 8;
        this.arrows.forEach(function (a, i) {
          const ang = i * Math.PI / 2 + Math.PI / 4;
          a.visible = true; a.position.set(t.x + Math.cos(ang) * r, 30, t.y + Math.sin(ang) * r);
          a.rotation.set(Math.PI / 2, 0, 0); a.rotation.z = -(ang + Math.PI / 2);
          a.material.opacity = p.autoTarget ? 0.55 : 0.95;
        });
      }
      if ((this.attackArmed || this.showRange) && !p.dead) this.setFlat(ind.range, p.x, p.y, p.attackRange + p.radius, 4);
      // torre enemiga cercana: mostrar su alcance
      if (!p.dead) {
        for (const tw of this.game.towers || []) {
          if (tw.dead || tw.team === p.team) continue;
          if (U.dist(p, tw) < 750 + 900) { this.setFlat(ind.towerRange, tw.x, tw.y, 750, 4); ind.towerRange.material.opacity = (tw.targetId === p.id || tw.target === p) ? 0.9 : 0.4; break; }
        }
      }
      if (this.aim != null && !p.dead && this.mouseWorld) {
        const ab = p.def.abilities[this.aim];
        const ready = p.abilityReady(this.aim);
        const col = ready ? 0x78c8ff : 0xff5a5a;
        [ind.abRange, ind.rect, ind.rectEdge, ind.circle, ind.circleEdge].forEach(function (m) { m.material.color.setHex(col); });
        const m = this.aimPoint || this.mouseWorld;
        let dx = m.x - p.x, dy = m.y - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const range = ab.range || ab.radius || ab.allyRadius || 0;
        if (range) this.setFlat(ind.abRange, p.x, p.y, range, 4.5);
        if (ab.cast === 'skillshot' || ab.cast === 'line') {
          const wdt = ab.width || 100;
          ind.rect.visible = true; ind.rect.position.set(p.x + dx * ab.range / 2, 5, p.y + dy * ab.range / 2);
          ind.rect.rotation.set(-Math.PI / 2, 0, -Math.atan2(dy, dx)); ind.rect.scale.set(ab.range, wdt, 1);
        } else if (ab.cast === 'area' || ab.cast === 'dash') {
          const r = Math.min(d, ab.range);
          const x = p.x + dx * r, y = p.y + dy * r, rr = ab.radius || 80;
          this.setFlat(ind.circle, x, y, rr, 5); this.setFlat(ind.circleEdge, x, y, rr, 5.5);
        } else if (ab.cast === 'self' && (ab.radius || ab.allyRadius)) {
          this.setFlat(ind.circle, p.x, p.y, ab.radius || ab.allyRadius, 5);
        } else if (ab.cast === 'target') {
          this.setFlat(ind.circleEdge, m.x, m.y, 90, 5.5);
        }
      }
      const cm = this.clickMarker;
      if (cm) {
        cm.life -= dt;
        if (cm.life <= 0) this.clickMarker = null;
        else { const a = cm.life / 0.5; this.setFlat(ind.click, cm.x, cm.y, 25 + a * 25, 6); ind.click.material.color.setHex(cm.attack ? 0xff5050 : 0x6eff8c); ind.click.material.opacity = a; }
      }
    }

    // ================= Cuadro =================
    draw(dt) {
      this.dt = dt; this.time += dt;
      this.placeCamera();
      this.syncUnits(dt);
      this.processFx();
      this.syncProjectiles();
      this.syncZones();
      this.updateFxViews(dt);
      this.updateIndicators(dt);
      for (const a of this.animated) { try { a.update({ time: this.time, dt: dt }); } catch (e) { /* nada */ } }
      if (this.water) this.water.material.emissiveIntensity = 0.35 + Math.sin(this.time * 1.3) * 0.08;
      this.gl.render(this.scene, this.camera);
      this.drawOverlay();
    }

    // ================= Capa 2D (barras, nombres, textos) =================
    barColor(u) {
      const me = this.game.player;
      if (u.team === 2) return '#e0b44a';
      if (u === me) return '#5ce06b';
      return me && u.team === me.team ? '#3fa0ff' : '#ff4f4f';
    }
    screenBar(ctx, x, y, w, h, pct, color) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * U.clamp(pct, 0, 1), h);
    }
    drawOverlay() {
      const ctx = this.octx, w = this.game;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      for (const [, v] of this.views) {
        const u = v.u;
        if (!v.root.visible || u.dead) continue;
        const s = this.worldToScreen(u.x, u.y, (v.model.height || 200) + 25);
        if (s.x < -100 || s.y < -100 || s.x > this.W + 100 || s.y > this.H + 100) continue;
        if (u.type === 'champion') this.drawChampionBar(ctx, u, s);
        else if (u.type === 'tower') this.screenBar(ctx, s.x, s.y - 6, 74, 7, u.hp / u.maxHp, this.barColor(u));
        else if (u.type === 'nexus') this.screenBar(ctx, s.x, s.y - 6, 110, 9, u.hp / u.maxHp, this.barColor(u));
        else if (u.hp < u.maxHp) this.screenBar(ctx, s.x, s.y, u.type === 'monster' ? 56 : (u.kind === 'cannon' ? 38 : 30), 4, u.hp / u.maxHp, this.barColor(u));
        if ((u.type === 'tower' || u.type === 'nexus') && u.vulnerable === false) {
          ctx.fillStyle = 'rgba(200,220,255,0.85)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('INVULNERABLE', s.x, s.y - 12);
        }
      }
      // tiempos de los campamentos
      for (const camp of w.camps || []) {
        if (!camp.respawnAt) continue;
        const left = Math.ceil(camp.respawnAt - w.time);
        if (left <= 0 || (camp.monster && !camp.monster.dead)) continue;
        const s = this.worldToScreen(camp.x, camp.y, 0);
        if (s.x < 0 || s.y < 0 || s.x > this.W || s.y > this.H) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(U.fmtTime(left), s.x, s.y + 6);
      }
      // textos flotantes
      ctx.textAlign = 'center';
      for (const t of w.texts) {
        const s = this.worldToScreen(t.x, t.y, 160);
        if (s.x < -50 || s.y < -50 || s.x > this.W + 50 || s.y > this.H + 50) continue;
        ctx.font = t.big ? 'bold 21px sans-serif' : 'bold 16px sans-serif';
        ctx.globalAlpha = U.clamp(t.life / t.max * 1.5, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(t.text, s.x + 1.5, s.y + 1.5);
        ctx.fillStyle = t.color; ctx.fillText(t.text, s.x, s.y);
      }
      ctx.globalAlpha = 1;
    }
    drawChampionBar(ctx, c, s) {
      const x = s.x, y = s.y - 8, w = 78;
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 15);
      const hpPct = U.clamp(c.hp / c.maxHp, 0, 1);
      ctx.fillStyle = this.barColor(c); ctx.fillRect(x - w / 2, y, w * hpPct, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let v = 100; v < c.maxHp; v += 100) ctx.fillRect(x - w / 2 + w * v / c.maxHp, y, 1, v % 1000 === 0 ? 7 : 4);
      const sh = c.shieldAmount();
      if (sh > 0) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x - w / 2 + w * hpPct, y, Math.min(w * (1 - hpPct), w * sh / c.maxHp), 7); }
      ctx.fillStyle = '#4a7dff'; ctx.fillRect(x - w / 2, y + 8, w * (c.maxMana ? U.clamp(c.mana / c.maxMana, 0, 1) : 0), 3);
      ctx.fillStyle = '#111'; ctx.fillRect(x - w / 2 - 20, y - 2, 18, 15);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(c.level, x - w / 2 - 11, y + 10);
      const label = c.playerName ? c.name + ' · ' + c.playerName : c.name;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(label, x + 1, y - 5);
      ctx.fillStyle = c === this.game.player ? '#ffe45a' : (c.human ? '#bfe6ff' : '#fff'); ctx.fillText(label, x, y - 6);
      if (c.recalling) {
        const pct = 1 - c.recalling.t / (c.recalling.max || 8);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2, y + 14, w, 5);
        ctx.fillStyle = '#9fe0ff'; ctx.fillRect(x - w / 2, y + 14, w * pct, 5);
      }
      if (c.isStunned()) { ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('✦ ✦ ✦', x, y - 20); }
    }

    // ================= Minimapa =================
    drawMinimap(mctx, size) {
      const g = this.game, map = M.MAP, s = size / map.width, me = g.player, myTeam = me ? me.team : 0;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.groundCanvas) mctx.drawImage(this.groundCanvas, 0, 0, size, size);
      else { mctx.fillStyle = '#1b3424'; mctx.fillRect(0, 0, size, size); }
      mctx.fillStyle = 'rgba(0,0,0,0.25)'; mctx.fillRect(0, 0, size, size);
      mctx.fillStyle = 'rgba(40,40,30,0.85)';
      for (const poly of map.walls) { mctx.beginPath(); poly.forEach(function (p, i) { if (i) mctx.lineTo(p.x * s, p.y * s); else mctx.moveTo(p.x * s, p.y * s); }); mctx.closePath(); mctx.fill(); }
      for (const camp of g.camps || []) {
        const alive = !camp.respawnAt || camp.respawnAt <= g.time;
        mctx.fillStyle = alive ? '#e0b44a' : '#3d5c39';
        mctx.beginPath(); mctx.arc(camp.x * s, camp.y * s, 3.5, 0, 6.283); mctx.fill();
      }
      for (const u of g.units) {
        if (u.dead && u.type !== 'tower' && u.type !== 'nexus') continue;
        if (u.hiddenLocal || (g.isVisibleTo && !g.isVisibleTo(myTeam, u))) continue;
        const x = u.x * s, y = u.y * s, tc = M.TEAM_COLORS[u.team];
        if (u.type === 'tower') { mctx.fillStyle = u.dead ? '#555' : tc; mctx.fillRect(x - 4, y - 4, 8, 8); mctx.strokeStyle = '#000'; mctx.lineWidth = 1; mctx.strokeRect(x - 4, y - 4, 8, 8); }
        else if (u.type === 'nexus') U.drawShape(mctx, 'diamond', x, y, 8, u.dead ? '#555' : tc, '#fff', 1.5);
        else if (u.type === 'minion') { mctx.fillStyle = tc; mctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      }
      for (const t of g.towers || []) if (t.dead) { mctx.fillStyle = '#555'; mctx.fillRect(t.x * s - 3, t.y * s - 3, 6, 6); }
      for (const c of g.champions) {
        if (c.dead || c.hiddenLocal || (g.isVisibleTo && !g.isVisibleTo(myTeam, c))) continue;
        U.drawShape(mctx, 'circle', c.x * s, c.y * s, c === me ? 7 : 5.5, c.def.color, c === me ? '#ffe45a' : M.TEAM_COLORS[c.team], 2.5);
      }
      // trapecio de lo que ve la cámara
      if (this.W) {
        const corners = [[0, 0], [this.W, 0], [this.W, this.H], [0, this.H]].map((q) => this.screenToWorld(q[0], q[1]));
        mctx.strokeStyle = 'rgba(255,255,255,0.85)'; mctx.lineWidth = 1.5;
        mctx.beginPath(); corners.forEach(function (p, i) { if (i) mctx.lineTo(p.x * s, p.y * s); else mctx.moveTo(p.x * s, p.y * s); }); mctx.closePath(); mctx.stroke();
      }
    }
    dispose() {
      try { this.gl.dispose(); this.gl.forceContextLoss(); } catch (e) { /* nada */ }
    }
  }

  M.Renderer = Renderer;
  M.webglAvailable = function () {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  };
})(window.MOBA);
