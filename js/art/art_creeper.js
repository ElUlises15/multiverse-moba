/* Arte procedural: Creeper — El Silencio Antes del Boom */
(function () {
  'use strict';

  // ---------- utilidades ----------
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function hash(n) { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
  function bell(x) { x = clamp01(x); return Math.sin(Math.PI * x); }

  // paleta: verdes del campeón + negro de cara + pólvora + celeste eléctrico
  const GREENS = [0x4caf3a, 0x4caf3a, 0x4caf3a, 0x3e9a2e, 0x5cc447, 0x2f7d24, 0x6fd658, 0x8fe07a, 0x38892b, 0x6b8f5a, 0xb4e89a];
  const FACE = 0x13200e;
  const ACCENT = 0xe8ffd0;
  const POWDER = 0x4a4a4a;
  const ELECTRIC = 0x7fd8ff;

  // Caja "pixelada": cada cuadradito de cada cara con un verde distinto (colores por vértice)
  function pixelBox(THREE, w, h, d, px, seed) {
    const g = new THREE.BoxGeometry(w, h, d,
      Math.max(1, Math.round(w / px)), Math.max(1, Math.round(h / px)), Math.max(1, Math.round(d / px))).toNonIndexed();
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const r = rng(seed), c = new THREE.Color();
    for (let i = 0; i < n; i += 6) {
      c.setHex(GREENS[Math.floor(r() * GREENS.length)]);
      for (let k = 0; k < 6 && i + k < n; k++) {
        col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  // Rayo: cinta en zigzag (dos planos cruzados) que crece hacia +Y
  function boltGeo(THREE, len, n, jag, w, seed) {
    const r = rng(seed), pts = [];
    for (let i = 0; i <= n; i++) {
      const edge = i === 0 || i === n;
      pts.push([edge ? 0 : (r() - 0.5) * 2 * jag, (i / n) * len, edge ? 0 : (r() - 0.5) * 2 * jag]);
    }
    const pos = [], hw = w / 2;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1];
      const wa = hw * (1 - (i / n) * 0.6), wb = hw * (1 - ((i + 1) / n) * 0.6);
      // plano X
      pos.push(a[0] - wa, a[1], a[2], a[0] + wa, a[1], a[2], b[0] + wb, b[1], b[2]);
      pos.push(a[0] - wa, a[1], a[2], b[0] + wb, b[1], b[2], b[0] - wb, b[1], b[2]);
      // plano Z
      pos.push(a[0], a[1], a[2] - wa, a[0], a[1], a[2] + wa, b[0], b[1], b[2] + wb);
      pos.push(a[0], a[1], a[2] - wa, b[0], b[1], b[2] + wb, b[0], b[1], b[2] - wb);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    return g;
  }

  // ---------- helpers de efectos ----------
  function fxMat(THREE, color, additive) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
  }
  function solidFxMat(THREE, color) {
    return new THREE.MeshStandardMaterial({ color: color, flatShading: true, roughness: 0.9, transparent: true, opacity: 1 });
  }
  // huella en el suelo según el tipo de lanzamiento
  function footprint(info, defR) {
    info = info || {};
    const kind = info.kind || 'self';
    if (kind === 'line') {
      const L = Math.max(100, num(info.length, 800)), W = Math.max(40, num(info.width, 120));
      return { kind: kind, cx: 0, cz: L / 2, rx: W / 2, rz: L / 2 };
    }
    if (kind === 'cone') {
      const L = Math.max(100, num(info.length, 600)), A = num(info.angle, 50) * Math.PI / 180;
      return { kind: kind, cx: 0, cz: L / 2, rx: Math.max(50, Math.tan(A / 2) * L * 0.75), rz: L / 2 };
    }
    if (kind === 'projectile') {
      const W = Math.max(60, num(info.width, 100) * 0.7);
      return { kind: kind, cx: 0, cz: 0, rx: W, rz: W };
    }
    const r = Math.max(40, num(info.radius, defR));
    return { kind: kind, cx: 0, cz: 0, rx: r, rz: r };
  }
  function groundRing(THREE, mat, inner, segs) {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, 1, segs || 48), mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  function groundDisc(THREE, mat) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  function placeFoot(m, fp, k, y) { m.position.set(fp.cx, y, fp.cz); m.scale.set(fp.rx * k, fp.rz * k, 1); }

  // ---------- modelo ----------
  const LEG = 46, TW = 74, TH = 112, TD = 52, HD = 106;

  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache;
    const teamColor = num(ctx.teamColor, 0x38a3ff);
    const root = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0,
      emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, transparent: true, opacity: 1
    });
    const faceMat = new THREE.MeshStandardMaterial({ color: FACE, flatShading: true, roughness: 0.95, transparent: true, opacity: 1 });
    const glintMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 1 });
    const sparkMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const shellMat = new THREE.MeshBasicMaterial({ color: ELECTRIC, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xc8f2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

    // anillo de equipo en el suelo
    const ring = new THREE.Mesh(cache.geo('creeper_ring', () => new THREE.RingGeometry(78, 92, 4, 1, Math.PI / 4)),
      cache.basic(teamColor, { transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 1.5;
    root.add(ring);

    const rig = new THREE.Group();
    root.add(rig);

    // patitas
    const legGeo = cache.geo('creeper_leg', () => pixelBox(THREE, 38, LEG, 36, 12, 11));
    const legs = [];
    const legPos = [[-20, 28], [20, 28], [-20, -28], [20, -28]];
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group();
      piv.position.set(legPos[i][0], LEG, legPos[i][1]);
      const m = new THREE.Mesh(legGeo, bodyMat);
      m.position.y = -LEG / 2;
      piv.add(m);
      rig.add(piv);
      legs.push(piv);
    }

    // torso
    const torso = new THREE.Group();
    torso.position.y = LEG;
    const torsoMesh = new THREE.Mesh(cache.geo('creeper_torso', () => pixelBox(THREE, TW, TH, TD, 13, 22)), bodyMat);
    torsoMesh.position.y = TH / 2;
    torso.add(torsoMesh);
    rig.add(torso);

    // cabeza (cabezona, chibi)
    const head = new THREE.Group();
    head.position.y = LEG + TH;
    const headMesh = new THREE.Mesh(cache.geo('creeper_head', () => pixelBox(THREE, HD, HD, HD, 13, 33)), bodyMat);
    headMesh.position.y = HD / 2;
    head.add(headMesh);
    const fz = HD / 2 + 1.5;
    const eyeGeo = cache.geo('creeper_eye', () => new THREE.BoxGeometry(30, 28, 5));
    const eyes = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, faceMat);
      e.position.set(sx * 24, 68, fz);
      head.add(e);
      eyes.push(e);
      const g = new THREE.Mesh(cache.geo('creeper_glint', () => new THREE.BoxGeometry(9, 9, 3)), glintMat);
      g.position.set(sx * 24 - sx * 8, 76, fz + 2.5);
      head.add(g);
      eyes.push(g);
    }
    const mouthC = new THREE.Mesh(cache.geo('creeper_mouthc', () => new THREE.BoxGeometry(24, 30, 5)), faceMat);
    mouthC.position.set(0, 40, fz);
    head.add(mouthC);
    for (const sx of [-1, 1]) {
      const pr = new THREE.Mesh(cache.geo('creeper_mouthp', () => new THREE.BoxGeometry(12, 28, 5)), faceMat);
      pr.position.set(sx * 18, 22, fz);
      head.add(pr);
    }
    rig.add(head);

    // aura eléctrica (R)
    const aura = new THREE.Group();
    aura.visible = false;
    const shellH = LEG + TH + HD + 30;
    const shell = new THREE.Mesh(cache.geo('creeper_shell', () => new THREE.BoxGeometry(HD + 30, shellH, HD + 30)), shellMat);
    shell.position.y = shellH / 2;
    aura.add(shell);
    const bolts = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(cache.geo('creeper_bolt' + i, () => boltGeo(THREE, 140 + i * 12, 6, 16, 10, 101 + i)), boltMat);
      aura.add(b);
      bolts.push(b);
    }
    rig.add(aura);

    // chispitas / píxeles sueltos
    const sparks = [];
    const sparkGeo = cache.geo('creeper_spark', () => new THREE.BoxGeometry(12, 12, 12));
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(sparkGeo, sparkMat);
      s.visible = false;
      s.position.y = 20;
      root.add(s);
      sparks.push(s);
    }

    const white = new THREE.Color(0xffffff), cyan = new THREE.Color(ELECTRIC), green = new THREE.Color(0x8dff6a);
    const sparkCols = { fade: 0x8fe07a, powder: 0xffa83a, recall: 0xb4ff9a, charge: 0x9fe6ff, hiss: 0xffffff };

    function update(state) {
      state = state || {};
      const anim = state.anim || 'idle';
      const t = num(state.t, 0), time = num(state.time, 0), p = clamp01(num(state.progress, 0));
      const slot = num(state.slot, 0) | 0;
      const speed = num(state.speed, 340);

      let rigX = 0, rigY = 0, rigZ = 0, rigRX = 0, rigRY = 0, rigRZ = 0, sx = 1, sy = 1, sz = 1;
      let torsoRX = 0, torsoRZ = 0, torsoY = LEG;
      let headX = 0, headY = LEG + TH, headZ = 0, headRX = 0, headRY = 0, headRZ = 0;
      const legRX = [0, 0, 0, 0], legRZ = [0, 0, 0, 0], legY = [LEG, LEG, LEG, LEG];
      let flash = 0, flashCol = white, opacity = 1, shade = 1, aur = 0, sparkMode = null, sparkT = t;
      // parpadeo de ojos
      const bt = (time + 0.37) % 3.9;
      let eyeSY = bt < 0.13 ? 0.15 : 1;

      if (anim === 'walk') {
        const ph = time * Math.PI * 2 * 2.3 * Math.max(0.4, speed / 340);
        const s = Math.sin(ph);
        // pasitos arrastrados: pares diagonales
        legRX[0] = legRX[3] = 0.42 * s;
        legRX[1] = legRX[2] = -0.42 * s;
        rigY = 3 * Math.abs(Math.cos(ph));
        rigRZ = 0.08 * s;
        rigRY = 0.05 * Math.sin(ph * 0.5);
        torsoRX = 0.07;
        headRX = -0.05 + 0.03 * Math.sin(ph * 2);
        headRZ = -0.06 * s;
        headZ = 6;
        sy = 1 - 0.03 * Math.abs(Math.sin(ph));
      } else if (anim === 'attack') {
        // anticipación (se echa atrás e infla) -> cabezazo -> vuelve
        const k1 = ease(seg(p, 0, 0.42)), k2 = ease(seg(p, 0.42, 0.56)), k3 = ease(seg(p, 0.62, 1));
        rigZ = -18 * k1 + 80 * k2 - 62 * k3;
        rigRX = -0.24 * k1 + 0.62 * k2 - 0.38 * k3;
        headRX = -0.32 * k1 + 0.82 * k2 - 0.5 * k3;
        sy = 1 - 0.12 * k1 + 0.2 * k2 - 0.08 * k3;
        sx = sz = 1 + 0.09 * k1 - 0.12 * k2 + 0.03 * k3;
        legRX[0] = legRX[1] = -0.25 * k1 + 0.55 * k2 - 0.3 * k3;
        legRX[2] = legRX[3] = 0.15 * k1 + 0.35 * k2 - 0.5 * k3;
        flash = 0.25 * k1 * (1 - k2) * (Math.sin(time * 40) > 0 ? 1 : 0.3) + 0.9 * k2 * (1 - k3);
        if (k1 > 0 && k2 < 1) { sparkMode = 'hiss'; sparkT = p * 2; }
      } else if (anim === 'cast') {
        if (slot === 0) {
          // sigilo: se agacha, mira para todos lados y se desvanece
          const e = ease(seg(p, 0, 0.3));
          sy = 1 - 0.12 * e; sx = sz = 1 + 0.05 * e;
          headRY = 0.45 * Math.sin(t * 13) * (1 - p);
          headRX = 0.12 * e;
          opacity = 1 - 0.72 * ease(seg(p, 0.15, 0.9));
          flash = 0.5 * (1 - seg(p, 0, 0.15)); flashCol = green;
          legRX[0] = legRX[1] = 0.25 * e; legRX[2] = legRX[3] = -0.25 * e;
          sparkMode = 'fade';
        } else if (slot === 1) {
          // ¡Ssss... BUM!: se hincha parpadeando cada vez más rápido y revienta
          const s = ease(seg(p, 0, 0.72)), pop = seg(p, 0.72, 0.82), back = ease(seg(p, 0.82, 1));
          const trem = 0.05 * s * Math.sin(time * 55);
          const sc = 1 + 0.34 * s + trem + 0.12 * bell(pop) - 0.46 * back;
          sx = sz = sc; sy = sc * (1 - 0.06 * s);
          const blinkF = Math.sin(time * (10 + 46 * p)) > 0 ? 1 : 0;
          flash = p < 0.72 ? blinkF * (0.35 + 0.65 * s) : 1 - back;
          headRX = -0.16 * s * (1 - back);
          rigX = trem * 40;
          legRZ[0] = legRZ[2] = -0.3 * s * (1 - back); legRZ[1] = legRZ[3] = 0.3 * s * (1 - back);
          sparkMode = 'hiss'; sparkT = t * 1.6;
          eyeSY = 1;
        } else if (slot === 2) {
          // Salto de Pólvora: se agacha, salta con las patas recogidas, aterriza aplastado
          const c = ease(seg(p, 0, 0.25)), j = seg(p, 0.25, 0.82), land = bell(seg(p, 0.82, 1));
          const air = j > 0 && j < 1;
          rigY = 150 * Math.sin(Math.PI * j);
          rigRX = air ? 0.35 * Math.sin(Math.PI * j) - 0.15 * (1 - j) : 0;
          sy = 1 - 0.18 * c * (1 - j) + (air ? 0.14 * bell(j * 2) : 0) - 0.2 * land;
          sx = sz = 1 + 0.1 * c * (1 - j) + 0.15 * land;
          const tuck = air ? bell(j) : 0;
          legRX[0] = legRX[1] = -0.8 * tuck; legRX[2] = legRX[3] = 0.8 * tuck;
          headRX = -0.2 * tuck + 0.15 * land;
          flash = 0.4 * c * (1 - j) * (Math.sin(time * 30) > 0 ? 1 : 0) + 0.6 * land;
          flashCol = white;
          sparkMode = 'powder';
        } else {
          // Creeper Cargado: electricidad celeste, se infla enorme, levita y ¡BOOM!
          const ch = ease(seg(p, 0, 0.72)), boom = seg(p, 0.72, 0.84), back = ease(seg(p, 0.84, 1));
          const trem = Math.sin(time * 70) * (0.03 + 0.05 * ch);
          const sc = 1 + 0.6 * ch + 0.2 * bell(boom) - 0.6 * back + trem;
          sx = sz = sc; sy = sc;
          rigY = 34 * ch * (1 - back) + 6 * Math.sin(time * 9) * ch * (1 - back);
          rigX = Math.sin(time * 83) * 6 * ch * (1 - back);
          rigRZ = Math.sin(time * 61) * 0.05 * ch;
          headRX = -0.38 * ch * (1 - back);
          headRZ = Math.sin(time * 47) * 0.08 * ch;
          legRZ[0] = legRZ[2] = -0.5 * ch * (1 - back); legRZ[1] = legRZ[3] = 0.5 * ch * (1 - back);
          legRX[0] = legRX[1] = -0.3 * ch * (1 - back); legRX[2] = legRX[3] = 0.3 * ch * (1 - back);
          const fl = hash(Math.floor(time * 24)) > 0.45 ? 1 : 0.25;
          flash = p < 0.72 ? (0.3 + 0.7 * ch) * fl : (p < 0.84 ? 1.6 : 1.2 * (1 - back));
          flashCol = p < 0.72 && fl < 1 ? cyan : (p < 0.72 ? cyan : white);
          aur = p < 0.84 ? Math.max(0.25, ch) : 1 - back;
          sparkMode = 'charge'; sparkT = t * 2.4;
          eyeSY = 1;
        }
      } else if (anim === 'recall') {
        // se sienta, vibra suavecito, brilla verde y mira al cielo
        const e = ease(seg(t, 0, 0.5));
        sy = 1 - 0.08 * e; sx = sz = 1 + 0.04 * e;
        headRX = -0.18 * e + 0.05 * Math.sin(time * 2);
        headRY = 0.6 * Math.sin(time * 0.9) * e;
        legRZ[0] = legRZ[2] = -0.2 * e; legRZ[1] = legRZ[3] = 0.2 * e;
        flash = (0.2 + 0.18 * Math.sin(time * 5)) * e; flashCol = green;
        sparkMode = 'recall';
        eyeSY = 0.55 + 0.45 * (bt < 0.13 ? 0.3 : 1);
      } else if (anim === 'dead') {
        // se desarma: el torso cae de espaldas, la cabeza rueda al costado, las patas se abren
        const d = ease(seg(t, 0, 0.45));
        torsoRX = -1.5708 * d;
        torsoY = LEG + (TD / 2 - LEG) * d;
        const h = seg(t, 0.05, 0.75), he = ease(h);
        headX = 112 * he;
        headZ = -30 * he;
        headY = (LEG + TH) * (1 - he) + (HD / 2) * he + 50 * bell(seg(t, 0.5, 0.75)) * (1 - seg(t, 0.75, 0.8));
        headRZ = 1.5708 * he;
        headRY = -0.4 * he;
        for (let i = 0; i < 4; i++) {
          const side = legPos[i][0] < 0 ? 1 : -1;
          legRZ[i] = side * -1.45 * d;
          legY[i] = LEG + (19 - LEG) * d;
        }
        shade = 1 - 0.4 * d;
        eyeSY = 0.25;
      } else {
        // idle: respira y mira de reojo para los costados (con mala intención)
        const br = Math.sin(time * 2.2);
        sy = 1 + 0.025 * br; sx = sz = 1 - 0.012 * br;
        headRY = 0.38 * Math.tanh(3 * Math.sin(time * 0.55));
        headRX = 0.04 * Math.sin(time * 1.1);
        if ((time % 5.3) < 0.3) { rigRZ = 0.04 * Math.sin(time * 70); flash = 0.25; }
      }

      // aplicar
      rig.position.set(rigX, rigY, rigZ);
      rig.rotation.set(rigRX, rigRY, rigRZ);
      rig.scale.set(sx, sy, sz);
      torso.position.y = torsoY;
      torso.rotation.set(torsoRX, 0, torsoRZ);
      head.position.set(headX, headY, headZ);
      head.rotation.set(headRX, headRY, headRZ);
      for (let i = 0; i < 4; i++) {
        legs[i].position.y = legY[i];
        legs[i].rotation.set(legRX[i], 0, legRZ[i]);
      }
      eyes[0].scale.y = eyes[2].scale.y = eyeSY;
      eyes[1].visible = eyes[3].visible = eyeSY > 0.5;

      bodyMat.emissive.copy(flashCol);
      bodyMat.emissiveIntensity = Math.max(0, flash);
      bodyMat.color.setScalar(shade);
      bodyMat.opacity = opacity;
      faceMat.opacity = opacity;
      glintMat.opacity = opacity;
      glintMat.color.setHex(aur > 0 ? 0xbff0ff : ACCENT);

      // aura de electricidad
      aura.visible = aur > 0.01;
      if (aura.visible) {
        shellMat.opacity = 0.12 * aur + 0.08 * aur * Math.sin(time * 31);
        const fr = Math.floor(time * 22);
        for (let i = 0; i < bolts.length; i++) {
          const b = bolts[i];
          const on = hash(fr * 7 + i * 13) < 0.35 + 0.5 * aur;
          b.visible = on;
          const a = i * 1.047 + hash(fr + i) * 0.8;
          const rr = 72 + 22 * hash(fr * 3 + i);
          b.position.set(Math.cos(a) * rr, 20 + 140 * hash(fr * 5 + i * 3), Math.sin(a) * rr);
          b.rotation.set((hash(fr + i * 2) - 0.5) * 1.6, a, (hash(fr * 2 + i) - 0.5) * 1.6);
        }
        boltMat.opacity = 0.95 * Math.min(1, aur * 1.3);
      }

      // chispas
      if (sparkMode) {
        sparkMat.color.setHex(sparkCols[sparkMode]);
        for (let i = 0; i < sparks.length; i++) {
          const s = sparks[i];
          s.visible = true;
          const fr = (sparkT * 0.9 + i / sparks.length) % 1;
          const a = i * 0.785 + hash(i) * 2;
          let x = 0, y = 0, z = 0, sc = 1, op = 0;
          if (sparkMode === 'fade') {
            const r = 50 + 50 * fr;
            x = Math.cos(a + t * 1.5) * r; z = Math.sin(a + t * 1.5) * r; y = 40 + 230 * fr;
            sc = 1.3 - fr; op = (1 - fr) * 0.9;
          } else if (sparkMode === 'powder') {
            const f2 = (sparkT * 2.2 + i / sparks.length) % 1;
            const r = 25 + 110 * f2;
            x = Math.cos(a) * r; z = Math.sin(a) * r; y = rigY + 8 + 160 * f2 * (1 - f2);
            sc = 0.6 + 0.6 * (1 - f2); op = (1 - f2) * (hash(Math.floor(time * 30) + i) > 0.3 ? 1 : 0.3);
          } else if (sparkMode === 'recall') {
            const r = 85 - 30 * fr;
            x = Math.cos(a + time * 2.5) * r; z = Math.sin(a + time * 2.5) * r; y = 10 + 260 * fr;
            sc = 0.9; op = bell(fr) * 0.9;
          } else if (sparkMode === 'charge') {
            const r = 90 + 30 * Math.sin(time * 6 + i);
            x = Math.cos(a + time * 7) * r * sx; z = Math.sin(a + time * 7) * r * sx; y = rigY + (30 + 250 * fr) * sy;
            sc = 1.2; op = 0.5 + 0.5 * hash(Math.floor(time * 30) + i * 5);
          } else {
            // hiss: puntitos blancos chisporroteando sobre el cuerpo
            const fl = Math.floor(time * 18) + i * 7;
            x = (hash(fl) - 0.5) * 120 * sx; y = rigY + (LEG + hash(fl + 1) * (TH + HD)) * sy; z = rigZ + 60 * sz;
            sc = 0.6 + 0.6 * hash(fl + 2); op = hash(fl + 3) > 0.4 ? 0.9 : 0;
          }
          s.position.set(x, y, z);
          s.rotation.set(time * 3 + i, time * 2 + i, 0);
          s.scale.setScalar(Math.max(0.05, sc));
          if (i === 0) sparkMat.opacity = 1;
          s.visible = op > 0.05;
        }
      } else {
        for (let i = 0; i < sparks.length; i++) sparks[i].visible = false;
      }
    }

    update({ anim: 'idle', t: 0, time: 0 });
    return { object: root, update: update };
  }

  // ---------- FX ----------

  // Q — Siseo Sigiloso: un fantasma verde que se borra en píxeles + humito
  function fxQ(THREE, ctx, info) {
    const fp = footprint(info, 150);
    const self = fp.kind !== 'line' && fp.kind !== 'cone';
    const S = self ? Math.min(fp.rx, 160) / 150 : 1;
    const root = new THREE.Group();
    const r = rng(1234);

    const ghostMat = fxMat(THREE, 0x6fd658, true);
    const ghost = new THREE.Group();
    const gT = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), ghostMat);
    gT.position.y = LEG + TH / 2;
    const gH = new THREE.Mesh(new THREE.BoxGeometry(HD, HD, HD), ghostMat);
    gH.position.y = LEG + TH + HD / 2;
    ghost.add(gT); ghost.add(gH);
    if (!self) ghost.position.z = fp.cz * 0.3;
    root.add(ghost);

    const scanMat = fxMat(THREE, ACCENT, true);
    const scan = new THREE.Mesh(new THREE.TorusGeometry(85, 5, 6, 4), scanMat);
    scan.rotation.x = Math.PI / 2; scan.rotation.z = Math.PI / 4;
    ghost.add(scan);

    const smokeRingMat = fxMat(THREE, 0x9aa39a, false);
    const smokeRing = groundRing(THREE, smokeRingMat, 0.6);
    root.add(smokeRing);

    const pixMats = [fxMat(THREE, 0x8fe07a, true), fxMat(THREE, 0x4caf3a, false), fxMat(THREE, ACCENT, true)];
    const pixGeo = new THREE.BoxGeometry(16, 16, 16);
    const pix = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(pixGeo, pixMats[i % 3]);
      let sx, sz;
      if (self) { sx = (r() - 0.5) * 100 * S; sz = (r() - 0.5) * 80 * S; }
      else { sx = fp.cx + (r() - 0.5) * 2 * fp.rx * 0.8; sz = fp.cz + (r() - 0.5) * 2 * fp.rz * 0.9; }
      m.userData = { x: sx, y: 30 + r() * 230 * S, z: sz, dx: (r() - 0.5) * 2, dz: (r() - 0.5) * 2, sp: 0.6 + r() * 0.8, rot: r() * 6 };
      root.add(m);
      pix.push(m);
    }
    const puffMat = fxMat(THREE, 0xbfc7bf, false);
    const puffGeo = new THREE.DodecahedronGeometry(1, 0);
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(puffGeo, puffMat);
      const a = i * Math.PI / 2 + 0.4;
      m.userData = { a: a };
      root.add(m);
      puffs.push(m);
    }

    function update(p) {
      p = clamp01(num(p, 0));
      const fade = 1 - ease(seg(p, 0.55, 1));
      ghostMat.opacity = 0.45 * (1 - ease(seg(p, 0.05, 0.75))) * (0.75 + 0.25 * Math.sin(p * 60));
      ghost.position.y = 70 * ease(p);
      ghost.scale.set(S * (1 + 0.25 * p), S * (1 + 0.1 * p), S * (1 + 0.25 * p));
      scanMat.opacity = 0.9 * bell(seg(p, 0, 0.7));
      scan.position.y = (LEG + TH + HD + 20) * ease(seg(p, 0, 0.7));
      placeFoot(smokeRing, fp, (self ? S * 0.6 : 1) * (0.5 + 0.7 * ease(p)), 2);
      if (self) smokeRing.scale.set(150 * S * (0.5 + 0.7 * ease(p)), 150 * S * (0.5 + 0.7 * ease(p)), 1);
      smokeRingMat.opacity = 0.45 * bell(seg(p, 0, 0.9));
      for (let i = 0; i < 3; i++) pixMats[i].opacity = 0.95 * fade * ease(seg(p, 0, 0.08));
      for (let i = 0; i < pix.length; i++) {
        const m = pix[i], u = m.userData, q = ease(p) * u.sp;
        m.position.set(u.x + u.dx * 90 * q, u.y + 110 * q, u.z + u.dz * 90 * q);
        m.rotation.set(u.rot + p * 5, u.rot * 2 + p * 4, 0);
        m.scale.setScalar(Math.max(0.05, 1.1 - 0.9 * p));
      }
      puffMat.opacity = 0.5 * bell(seg(p, 0, 0.85));
      for (let i = 0; i < puffs.length; i++) {
        const m = puffs[i], k = 60 + 70 * ease(p);
        m.position.set(fp.cx * (self ? 0 : 1) + Math.cos(m.userData.a) * k * S, 20 + 40 * p, (self ? 0 : fp.cz) + Math.sin(m.userData.a) * k * S);
        m.scale.setScalar(S * (25 + 35 * ease(p)));
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // explosión genérica (W y R comparten la receta: destello, onda, humo, bloques volando)
  function makeBoom(THREE, root, fp, opts) {
    const r = rng(opts.seed || 7);
    const parts = {};
    parts.coreMat = fxMat(THREE, 0xffffff, true);
    parts.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), parts.coreMat);
    root.add(parts.core);
    parts.ringMat = fxMat(THREE, opts.ringColor || 0xffffff, true);
    parts.ring = groundRing(THREE, parts.ringMat, 0.86, 56);
    root.add(parts.ring);
    parts.scorchMat = fxMat(THREE, 0x2a2a26, false);
    parts.scorch = groundDisc(THREE, parts.scorchMat);
    root.add(parts.scorch);
    parts.smokeMats = [fxMat(THREE, 0xe6e6e6, false), fxMat(THREE, 0x8c8c8c, false)];
    const puffGeo = new THREE.DodecahedronGeometry(1, 0);
    parts.puffs = [];
    for (let i = 0; i < opts.puffs; i++) {
      const m = new THREE.Mesh(puffGeo, parts.smokeMats[i % 2]);
      m.userData = { a: (i / opts.puffs) * Math.PI * 2 + r() * 0.5, k: 0.35 + r() * 0.45, s: 0.8 + r() * 0.5 };
      root.add(m);
      parts.puffs.push(m);
    }
    parts.debMats = [solidFxMat(THREE, 0x4caf3a), solidFxMat(THREE, 0x7a5636), solidFxMat(THREE, 0x8a8a8a)];
    const debGeo = new THREE.BoxGeometry(1, 1, 1);
    parts.debris = [];
    for (let i = 0; i < opts.debris; i++) {
      const m = new THREE.Mesh(debGeo, parts.debMats[i % 3]);
      m.userData = { a: r() * Math.PI * 2, d: 0.45 + r() * 0.7, vy: 0.6 + r() * 0.8, s: 0.7 + r() * 0.6, rx: r() * 8, ry: r() * 8 };
      root.add(m);
      parts.debris.push(m);
    }
    parts.update = function (q) {
      // q: 0..1 vida de la explosión (q<0 = todavía no explotó)
      const vis = q >= 0;
      parts.core.visible = parts.ring.visible = parts.scorch.visible = vis;
      for (const m of parts.puffs) m.visible = vis;
      for (const m of parts.debris) m.visible = vis;
      if (!vis) return;
      const R = Math.max(fp.rx, fp.rz), cs = opts.blockSize;
      const g = ease(seg(q, 0, 0.18));
      parts.core.position.set(fp.cx, 50, fp.cz);
      parts.core.scale.set(fp.rx * 0.6 * (0.2 + 0.8 * g), Math.min(fp.rx, fp.rz, 260) * 0.7 * (0.2 + 0.8 * g), fp.rz * 0.6 * (0.2 + 0.8 * g));
      parts.coreMat.opacity = 1 - ease(seg(q, 0.08, 0.4));
      placeFoot(parts.ring, fp, 0.15 + 0.95 * ease(seg(q, 0, 0.4)), 4);
      parts.ringMat.opacity = 0.95 * (1 - ease(seg(q, 0.2, 0.55)));
      placeFoot(parts.scorch, fp, 0.75, 2);
      parts.scorchMat.opacity = 0.5 * ease(seg(q, 0, 0.1)) * (1 - ease(seg(q, 0.6, 1)));
      parts.smokeMats[0].opacity = 0.8 * ease(seg(q, 0.02, 0.15)) * (1 - ease(seg(q, 0.35, 1)));
      parts.smokeMats[1].opacity = 0.7 * ease(seg(q, 0.05, 0.2)) * (1 - ease(seg(q, 0.45, 1)));
      for (const m of parts.puffs) {
        const u = m.userData, k = u.k * (0.3 + 0.7 * ease(seg(q, 0, 0.6)));
        const ps = R * 0.16 * u.s * (0.5 + 0.9 * ease(seg(q, 0, 0.7)));
        m.position.set(fp.cx + Math.cos(u.a) * fp.rx * k, ps * 0.5 + R * 0.35 * ease(q) * u.s, fp.cz + Math.sin(u.a) * fp.rz * k);
        m.scale.setScalar(ps);
        m.rotation.set(q * 2 + u.a, q * 3, 0);
      }
      const fadeD = 1 - ease(seg(q, 0.75, 1));
      for (const mt of parts.debMats) mt.opacity = fadeD;
      for (const m of parts.debris) {
        const u = m.userData, tt = Math.min(q * 1.4, 1);
        const y = Math.max(cs * 0.5 * u.s, R * 0.9 * u.vy * (tt - tt * tt) * 2 + 30 * (1 - tt));
        m.position.set(fp.cx + Math.cos(u.a) * fp.rx * u.d * ease(tt), y, fp.cz + Math.sin(u.a) * fp.rz * u.d * ease(tt));
        m.rotation.set(u.rx * tt, u.ry * tt, 0);
        m.scale.setScalar(cs * u.s);
      }
    };
    return parts;
  }

  // W — ¡Ssss... BUM!: explosión blanca con humo gris y bloques volando
  function fxW(THREE, ctx, info) {
    const fp = footprint(info, 325);
    const root = new THREE.Group();
    const boom = makeBoom(THREE, root, fp, { seed: 77, puffs: 8, debris: 10, blockSize: 30, ringColor: 0xffffff });
    // rayos blancos del estallido
    const rayMat = fxMat(THREE, 0xffffff, true);
    const rayGeo = new THREE.BoxGeometry(14, 6, 1);
    const rays = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(rayGeo, rayMat);
      m.userData = { a: i * Math.PI / 3 + 0.3 };
      root.add(m);
      rays.push(m);
    }
    function update(p) {
      p = clamp01(num(p, 0));
      boom.update(p);
      rayMat.opacity = 0.9 * (1 - ease(seg(p, 0.05, 0.35)));
      const k = ease(seg(p, 0, 0.3));
      for (const m of rays) {
        const a = m.userData.a, len = Math.max(fp.rx, fp.rz) * 0.9 * k + 10;
        m.position.set(fp.cx + Math.cos(a) * fp.rx * 0.5 * k, 40, fp.cz + Math.sin(a) * fp.rz * 0.5 * k);
        m.rotation.set(0, -a, 0);
        m.scale.set(1, 1, 1);
        m.scale.x = len / 14 * (1 - 0.5 * k);
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // E — Salto de Pólvora: manchas de pólvora, chispas naranjas y polvareda
  function fxE(THREE, ctx, info) {
    const fp = footprint(info, 200);
    const root = new THREE.Group();
    const r = rng(4242);
    const powderMat = fxMat(THREE, 0x2e2e2c, false);
    const powder = groundDisc(THREE, powderMat);
    root.add(powder);
    const grainMat = fxMat(THREE, 0x55544f, false);
    const grainGeo = new THREE.PlaneGeometry(1, 1);
    const grains = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(grainGeo, grainMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = r() * Math.PI;
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.7;
      m.position.set(fp.cx + Math.cos(a) * fp.rx * d, 3, fp.cz + Math.sin(a) * fp.rz * d);
      m.userData = { s: 26 + r() * 30 };
      root.add(m);
      grains.push(m);
    }
    const dustMat = fxMat(THREE, 0xd8d0b8, false);
    const dust = groundRing(THREE, dustMat, 0.7);
    root.add(dust);
    const sparkMats = [fxMat(THREE, 0xffa83a, true), fxMat(THREE, 0xffe36a, true)];
    const sparkGeo = new THREE.BoxGeometry(12, 12, 12);
    const sparks = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMats[i % 2]);
      m.userData = { a: r() * Math.PI * 2, d: 0.3 + r() * 0.8, vy: 120 + r() * 200, del: r() * 0.25, ph: r() * 10 };
      root.add(m);
      sparks.push(m);
    }
    const puffMat = fxMat(THREE, 0x9a9a92, false);
    const puffGeo = new THREE.DodecahedronGeometry(1, 0);
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(puffGeo, puffMat);
      m.userData = { a: i * Math.PI / 2 + r() };
      root.add(m);
      puffs.push(m);
    }
    function update(p) {
      p = clamp01(num(p, 0));
      placeFoot(powder, fp, 0.35 + 0.55 * ease(seg(p, 0, 0.25)), 2);
      powderMat.opacity = 0.55 * ease(seg(p, 0, 0.1)) * (1 - ease(seg(p, 0.75, 1)));
      grainMat.opacity = 0.8 * ease(seg(p, 0.05, 0.2)) * (1 - ease(seg(p, 0.7, 1)));
      for (const m of grains) { const s = m.userData.s * (0.4 + 0.6 * ease(seg(p, 0, 0.3))); m.scale.set(s, s, 1); }
      placeFoot(dust, fp, 0.2 + 0.95 * ease(seg(p, 0, 0.45)), 5);
      dustMat.opacity = 0.6 * (1 - ease(seg(p, 0.1, 0.55)));
      for (let i = 0; i < 2; i++) sparkMats[i].opacity = 1 - ease(seg(p, 0.6, 1));
      for (const m of sparks) {
        const u = m.userData, q = clamp01((p - u.del) / 0.6);
        m.visible = q > 0 && q < 1;
        const y = Math.max(4, u.vy * (q * 2 - q * q * 2.2) + 8);
        m.position.set(fp.cx + Math.cos(u.a) * fp.rx * u.d * ease(q), y, fp.cz + Math.sin(u.a) * fp.rz * u.d * ease(q));
        const fl = hash(Math.floor(p * 40) + u.ph) > 0.3 ? 1 : 0.4;
        m.scale.setScalar(Math.max(0.05, (1 - q) * fl * 1.2));
        m.rotation.set(q * 9, q * 7, 0);
      }
      puffMat.opacity = 0.55 * bell(seg(p, 0, 0.8));
      for (const m of puffs) {
        const k = 0.2 + 0.5 * ease(p);
        m.position.set(fp.cx + Math.cos(m.userData.a) * fp.rx * k, 20 + 50 * p, fp.cz + Math.sin(m.userData.a) * fp.rz * k);
        m.scale.setScalar(Math.max(fp.rx, 60) * 0.18 * (0.5 + ease(p)));
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // R — Creeper Cargado: zona celeste con cuenta regresiva y rayos, después explosión enorme
  function fxR(THREE, ctx, info) {
    const fp = footprint(info, 550);
    const root = new THREE.Group();
    const instant = fp.kind === 'projectile' || fp.kind === 'target' || fp.kind === 'burst';
    const BOOM = instant ? 0.12 : 0.55;

    const warnMat = fxMat(THREE, ELECTRIC, true);
    const warn = groundDisc(THREE, warnMat);
    root.add(warn);
    const edgeMat = fxMat(THREE, 0xbfeeff, true);
    const edge = groundRing(THREE, edgeMat, 0.95, 64);
    root.add(edge);
    const countMat = fxMat(THREE, 0xffffff, true);
    const count = groundRing(THREE, countMat, 0.9, 64);
    root.add(count);

    const boltMat = fxMat(THREE, 0xd8f6ff, true);
    const bolts = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(boltGeo(THREE, 420, 8, 30, 18, 900 + i), boltMat);
      root.add(b);
      bolts.push(b);
    }
    const domeMat = fxMat(THREE, 0xe8fbff, true);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    root.add(dome);
    const boom = makeBoom(THREE, root, fp, { seed: 555, puffs: 6, debris: 9, blockSize: 40, ringColor: ELECTRIC });

    function update(p) {
      p = clamp01(num(p, 0));
      const w = seg(p, 0, BOOM);
      const pre = p < BOOM;
      const after = pre ? -1 : (p - BOOM) / (1 - BOOM);
      // advertencia
      placeFoot(warn, fp, 1, 2);
      warnMat.opacity = pre ? (0.12 + 0.12 * w + 0.06 * Math.sin(p * 90)) : 0.25 * (1 - ease(seg(after, 0, 0.2)));
      placeFoot(edge, fp, 1, 3);
      edgeMat.opacity = pre ? 0.55 + 0.35 * (hash(Math.floor(p * 50)) > 0.5 ? 1 : 0.4) : 0.8 * (1 - ease(seg(after, 0, 0.25)));
      placeFoot(count, fp, Math.max(0.02, 1 - w), 3.5);
      countMat.opacity = pre ? 0.8 * ease(seg(p, 0, 0.1)) : 0;
      // rayos que caen del cielo, cada vez más seguido
      const fr = Math.floor(p * 45);
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i];
        const rate = pre ? 0.15 + 0.6 * w : 0.7 * (1 - seg(after, 0, 0.3));
        b.visible = hash(fr * 11 + i * 3) < rate;
        const a = hash(fr * 3 + i * 7) * Math.PI * 2, d = 0.25 + 0.75 * hash(fr * 5 + i);
        b.position.set(fp.cx + Math.cos(a) * fp.rx * d, 0, fp.cz + Math.sin(a) * fp.rz * d);
        b.rotation.set(0, a, 0);
      }
      boltMat.opacity = 0.95;
      // ¡BOOM!
      const g = ease(seg(after, 0, 0.18));
      dome.visible = !pre;
      dome.position.set(fp.cx, 0, fp.cz);
      dome.scale.set(fp.rx * (0.2 + 0.85 * g), Math.min(fp.rx, fp.rz, 420) * 0.8 * (0.25 + 0.75 * g), fp.rz * (0.2 + 0.85 * g));
      domeMat.opacity = pre ? 0 : 0.85 * (1 - ease(seg(after, 0.1, 0.55)));
      boom.update(after);
    }
    update(0);
    return { object: root, update: update };
  }

  MOBA.defineChampionArt('creeper', {
    lore: 'Nadie lo oye llegar: solo un "ssss" a tus espaldas y, un segundo después, el mapa tiene un pozo nuevo. Total, él reaparece rapidito.',
    quote: '¿Escuchaste eso? No te des vuelta... ssssss.',
    build: build,
    fx: { Q: fxQ, W: fxW, E: fxE, R: fxR }
  });
})();
