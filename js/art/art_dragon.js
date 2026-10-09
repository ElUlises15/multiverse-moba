/* Arte procedural: Dragón, La Llama de los Cielos (Mago) */
(function () {
  'use strict';

  const C = {
    body: 0xb8322a, dark: 0x7c1d18, accent: 0xffb347, belly: 0xffe2b0, horn: 0xf4e6c8,
    wing: 0x6e1a2a, fire: 0xff7a1a, gold: 0xffcf4a, ember: 0xff4a1a, eye: 0xfff27a
  };
  const PI = Math.PI, TAU = Math.PI * 2;

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smooth(e0, e1, x) { const k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); }
  function easeInOut(x) { return smooth(0, 1, x); }
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Membrana del ala (lado derecho, +X hacia afuera, -Z hacia atrás). Bordes festoneados de murciélago.
  const WING = {
    S: [0, 0, 0], W: [90, 42, 4], F1: [205, 62, -18], F2: [190, 18, -92], F3: [118, -2, -136],
    B: [14, -6, -78], s12: [150, 36, -50], s23: [134, 12, -92], s3B: [62, -2, -86]
  };
  function membraneGeo(THREE) {
    const P = WING;
    const ring = [P.F1, P.s12, P.F2, P.s23, P.F3, P.s3B, P.B, P.S];
    const pos = [];
    for (let i = 0; i < ring.length - 1; i++) pos.push.apply(pos, P.W.concat(ring[i], ring[i + 1]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  function fxMat(THREE, list, color, additive) {
    const m = new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      blending: additive === false ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    list.push(m);
    return m;
  }
  function envelope(p, a, b) { return smooth(0, a, p) * (1 - smooth(b, 1, p)); }

  // ---------------------------------------------------------------- MODELO
  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache;
    const M = function (c, o) { return cache.mat(c, o); };
    const teamColor = ctx.teamColor != null ? ctx.teamColor : 0xffffff;

    const root = new THREE.Group();
    const hover = new THREE.Group(); root.add(hover);
    const rig = new THREE.Group(); rig.position.y = 78; hover.add(rig);

    const sph = cache.geo('dr_sph', function () { return new THREE.SphereGeometry(1, 14, 10); });
    const box = cache.geo('dr_box', function () { return new THREE.BoxGeometry(1, 1, 1); });
    const plateGeo = cache.geo('dr_plate', function () { const g = new THREE.ConeGeometry(1, 1, 4); g.translate(0, 0.5, 0); return g; });
    const hornGeo = cache.geo('dr_horn', function () { const g = new THREE.ConeGeometry(1, 1, 6); g.translate(0, 0.5, 0); return g; });
    const boneGeo = cache.geo('dr_bone', function () { const g = new THREE.CylinderGeometry(0.6, 1, 1, 5); g.translate(0, 0.5, 0); return g; });

    function mesh(geo, mat, parent, x, y, z, sx, sy, sz) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.scale.set(sx || 1, sy == null ? (sx || 1) : sy, sz == null ? (sx || 1) : sz);
      parent.add(m);
      return m;
    }

    // Material propio: placas ígneas que se encienden (E, R, ataque)
    const glowMat = new THREE.MeshStandardMaterial({
      color: C.accent, emissive: 0xff6a00, emissiveIntensity: 0.3, flatShading: true, roughness: 0.55, metalness: 0.1
    });

    // Torso + panza
    const torso = mesh(sph, M(C.body), rig, 0, 40, -4, 52, 48, 64);
    torso.rotation.x = -0.2;
    const belly = mesh(sph, M(C.belly), rig, 0, 36, 26, 40, 40, 32);
    belly.rotation.x = -0.3;

    // Placas dorsales
    [[0, 86, -10, -0.3, 38], [0, 72, -38, -0.75, 32], [0, 50, -60, -1.15, 26]].forEach(function (d) {
      const pl = mesh(plateGeo, glowMat, rig, d[0], d[1], d[2], 6, d[4], 17);
      pl.rotation.x = d[3];
    });

    // Bracitos
    const armGeo = cache.geo('dr_arm', function () { return new THREE.CapsuleGeometry(1, 2.5, 3, 8); });
    const arms = [];
    [1, -1].forEach(function (s) {
      const a = mesh(armGeo, M(C.body), rig, s * 26, 18, 40, 8, 8, 8);
      a.rotation.x = 0.5; arms.push(a);
    });

    // Cuello largo
    const neck = new THREE.Group(); neck.position.set(0, 72, 36); neck.rotation.order = 'YXZ'; rig.add(neck);
    mesh(cache.geo('dr_neck1', function () { const g = new THREE.CylinderGeometry(16, 24, 62, 8); g.translate(0, 31, 0); return g; }), M(C.body), neck);
    const collar = mesh(cache.geo('dr_collar', function () { return new THREE.TorusGeometry(1, 0.28, 6, 18); }),
      M(teamColor, { emissive: teamColor, emissiveIntensity: 0.35 }), neck, 0, 6, 0, 24, 24, 24);
    collar.rotation.x = PI / 2;
    mesh(plateGeo, glowMat, neck, 0, 32, -17, 5, 26, 14).rotation.x = -0.4;
    const neckMid = new THREE.Group(); neckMid.position.set(0, 56, 0); neck.add(neckMid);
    mesh(cache.geo('dr_neck2', function () { const g = new THREE.CylinderGeometry(13, 16, 52, 8); g.translate(0, 26, 0); return g; }), M(C.body), neckMid);
    mesh(plateGeo, glowMat, neckMid, 0, 26, -13, 5, 22, 12).rotation.x = -0.4;

    // Cabeza
    const head = new THREE.Group(); head.position.set(0, 50, 0); head.rotation.order = 'YXZ'; neckMid.add(head);
    mesh(sph, M(C.body), head, 0, 6, -2, 30, 27, 32);
    mesh(box, M(C.body), head, 0, 2, 30, 34, 22, 44);
    const jaw = new THREE.Group(); jaw.position.set(0, -10, 8); head.add(jaw);
    mesh(box, M(C.belly), jaw, 0, -3, 22, 28, 10, 42);
    const eyes = [];
    [1, -1].forEach(function (s) {
      eyes.push(mesh(sph, cache.basic(C.eye), head, s * 17, 13, 20, 8, 9, 8));
      const h = mesh(hornGeo, M(C.horn), head, s * 13, 24, -6, 9, 56, 9);
      h.rotation.x = -0.9; h.rotation.z = -s * 0.35;
    });

    // Bola de fuego del ataque básico (en la boca)
    const ballMat = new THREE.MeshBasicMaterial({ color: 0xffa43a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const ball = mesh(cache.geo('dr_ico1', function () { return new THREE.IcosahedronGeometry(1, 1); }), ballMat, head, 0, 0, 56, 0.01, 0.01, 0.01);
    ball.visible = false;
    // Chorro de fuego (Q)
    const breathMat = new THREE.MeshBasicMaterial({ color: C.fire, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const breathGeo = cache.geo('dr_breath', function () {
      const g = new THREE.ConeGeometry(1, 1, 12, 1, true); g.translate(0, -0.5, 0); g.rotateX(-PI / 2); return g;
    });
    const breath = mesh(breathGeo, breathMat, head, 0, -4, 52, 0.01, 0.01, 0.01);
    breath.visible = false;

    // Alas de murciélago
    const membMat = M(C.wing, { side: THREE.DoubleSide });
    const membGeo = cache.geo('dr_memb', function () { return membraneGeo(THREE); });
    const wings = [];
    function bone(parent, a, b, r) {
      const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
      const d = vb.clone().sub(va); const len = d.length();
      const m = mesh(boneGeo, M(C.body), parent, a[0], a[1], a[2], r, len, r);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      return m;
    }
    [1, -1].forEach(function (s) {
      const side = new THREE.Group(); side.position.set(s * 22, 76, -14); side.scale.x = s; rig.add(side);
      const flapG = new THREE.Group(); side.add(flapG);
      mesh(membGeo, membMat, flapG);
      bone(flapG, WING.S, WING.W, 8);
      bone(flapG, WING.W, WING.F1, 5);
      bone(flapG, WING.W, WING.F2, 4);
      bone(flapG, WING.W, WING.F3, 4);
      const claw = mesh(hornGeo, M(C.horn), flapG, WING.W[0], WING.W[1], WING.W[2], 5, 20, 5);
      claw.rotation.z = -0.5;
      wings.push(flapG);
    });

    // Cola con punta de pala
    const tailGeo = function (key, rt, rb, h) {
      return cache.geo(key, function () { const g = new THREE.CylinderGeometry(rt, rb, h, 7); g.translate(0, h / 2, 0); g.rotateX(-PI / 2); return g; });
    };
    const t1 = new THREE.Group(); t1.position.set(0, 28, -58); rig.add(t1);
    mesh(tailGeo('dr_t1', 11, 21, 72), M(C.body), t1);
    const t2 = new THREE.Group(); t2.position.set(0, 0, -66); t1.add(t2);
    mesh(tailGeo('dr_t2', 6, 12, 62), M(C.body), t2);
    const t3 = new THREE.Group(); t3.position.set(0, 0, -58); t2.add(t3);
    mesh(tailGeo('dr_t3', 3, 7, 52), M(C.body), t3);
    mesh(cache.geo('dr_oct', function () { return new THREE.OctahedronGeometry(1, 0); }), glowMat, t3, 0, 0, -58, 22, 6, 30);

    // Patas traseras
    const legs = [];
    [1, -1].forEach(function (s) {
      const lg = new THREE.Group(); lg.position.set(s * 32, 78, -6); hover.add(lg);
      mesh(sph, M(C.body), lg, 0, -26, 0, 22, 34, 27);
      mesh(box, M(C.dark), lg, 0, -69, 10, 26, 18, 40);
      legs.push({ g: lg, s: s });
    });

    // Escudo ígneo (E), anillo de recall, orbe de meteoro (R)
    const shellMat = new THREE.MeshBasicMaterial({ color: C.fire, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true });
    const shell = mesh(cache.geo('dr_ico1', function () { return new THREE.IcosahedronGeometry(1, 1); }), shellMat, rig, 0, 50, 0, 0.01, 0.01, 0.01);
    shell.visible = false;
    const ringMat = new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = mesh(cache.geo('dr_ring', function () { return new THREE.TorusGeometry(1, 0.06, 6, 40); }), ringMat, root, 0, 4, 0, 90, 90, 90);
    ring.rotation.x = PI / 2; ring.visible = false;
    const orbMat = new THREE.MeshBasicMaterial({ color: C.ember, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const orb = mesh(cache.geo('dr_ico2', function () { return new THREE.IcosahedronGeometry(1, 2); }), orbMat, hover, 0, 150, 0, 0.01, 0.01, 0.01);
    orb.visible = false;

    const cur = {};
    let first = true;

    function update(s) {
      s = s || {};
      const anim = s.anim || 'idle';
      const time = +s.time || 0;
      const p = clamp(+s.progress || 0, 0, 1);
      const slot = s.slot | 0;
      const dt = clamp(+s.dt || 1 / 60, 0, 0.1);
      const T = {
        hoverY: 0, rigPitch: 0, rigRoll: 0, neck: 0.35, neckMid: -0.2, head: -0.15, headYaw: 0, jaw: 0.05,
        flap: 0.3, sweep: 0.55, legPitch: 0, legSplay: 0, legAlt: 0, tailYaw: 0, tailPitch: 0, tailWave: 0.15,
        glow: 0.3, breathe: 0, eyeY: 1, shell: 0, ring: 0, armPitch: 0.5
      };
      let ballS = 0, ballZ = 0, breathS = 0, orbS = 0, orbY = 150, orbZ = 0, shake = 0, legPh = 0;
      let rate = 14;

      if (anim === 'idle') {
        T.breathe = Math.sin(time * 2.2) * 0.035;
        T.neck += Math.sin(time * 1.3) * 0.05;
        T.headYaw = Math.sin(time * 0.6) * 0.3;
        T.flap = 0.3 + Math.sin(time * 1.6) * 0.07;
        T.tailYaw = Math.sin(time * 0.9) * 0.3;
        // resoplido ocasional con chispa en la boca
        const snort = Math.pow(Math.max(0, Math.sin(time * 0.55)), 10);
        T.jaw = 0.05 + snort * 0.35;
        T.head -= snort * 0.25;
        ballS = snort * 0.45;
        T.eyeY = (time % 3.7) < 0.12 ? 0.15 : 1;
      } else if (anim === 'walk') {
        const k = clamp((+s.speed || 340) / 340, 0.3, 1.6);
        const ph = time * (8 + 5 * k);
        T.flap = 0.25 + Math.sin(ph) * 0.7;
        T.sweep = 0.12;
        T.hoverY = 24 + (-Math.cos(ph)) * 9 * k;
        T.rigPitch = 0.22;
        T.neck = 0.6; T.neckMid = -0.1; T.head = -0.5;
        T.legPitch = 0.7; T.legAlt = 0.15; legPh = ph;
        T.tailPitch = 0.2; T.tailYaw = Math.sin(time * 3) * 0.15; T.tailWave = 0.25;
        T.armPitch = 1.1;
        T.eyeY = (time % 4.1) < 0.1 ? 0.15 : 1;
        rate = 25;
      } else if (anim === 'attack') {
        rate = 24;
        if (p < 0.45) {
          const k = easeInOut(p / 0.45);
          T.neck = 0.35 - 0.65 * k; T.head = -0.15 - 0.35 * k; T.jaw = 0.15 + 0.35 * k;
          T.flap = 0.3 + 0.45 * k; T.rigPitch = -0.15 * k; T.glow = 0.3 + 0.9 * k;
          ballS = 0.3 + 0.7 * k;
        } else if (p < 0.78) {
          const k = (p - 0.45) / 0.33;
          T.neck = 0.9; T.neckMid = -0.15; T.head = -0.65; T.jaw = 0.9; T.flap = -0.25; T.rigPitch = 0.2; T.glow = 1.2;
          ballS = 1.35 * (1 - k * 0.5); ballZ = 20 + 380 * easeOut(k);
        } else {
          T.neck = 0.5; T.head = -0.3; T.jaw = 0.3; T.glow = 0.6;
        }
      } else if (anim === 'cast') {
        rate = 20;
        if (slot === 0) { // Aliento de Fuego
          if (p < 0.22) {
            const k = easeInOut(p / 0.22);
            T.neck = 0.35 - 0.4 * k; T.head = -0.15 - 0.3 * k; T.jaw = 0.4 * k; T.rigPitch = -0.2 * k;
            T.flap = 0.3 + 0.45 * k; T.glow = 0.3 + 1.2 * k; ballS = 0.8 * k;
          } else if (p < 0.85) {
            const q = (p - 0.22) / 0.63;
            T.neck = 0.8; T.neckMid = -0.1; T.head = -0.35; T.jaw = 1.0; T.rigPitch = 0.12; T.flap = 0.55;
            T.headYaw = Math.sin(q * TAU * 1.2) * 0.45; T.glow = 1.6;
            breathS = smooth(0, 0.1, q) * (1 - smooth(0.85, 1, q)) * (0.9 + 0.1 * Math.sin(time * 45));
          } else { T.neck = 0.45; T.head = -0.25; T.jaw = 0.25; T.glow = 0.8; ballS = 0.3; }
        } else if (slot === 1) { // Vuelo
          rate = 26;
          if (p < 0.3) {
            const k = easeInOut(p / 0.3);
            T.hoverY = -14 * k; T.flap = 0.3 + 0.85 * k; T.sweep = 0.2; T.legPitch = -0.25 * k; T.rigPitch = 0.12 * k;
            T.neck = 0.2; T.head = 0.0;
          } else if (p < 0.7) {
            const k = (p - 0.3) / 0.4;
            T.hoverY = 90 * Math.sin(k * PI * 0.5 + 0.2); T.flap = -0.6; T.sweep = 0.05; T.legPitch = 0.9;
            T.rigPitch = 0.4; T.neck = 0.75; T.head = -0.55; T.tailPitch = 0.35; T.glow = 0.8; T.armPitch = 1.3;
          } else {
            const k = (p - 0.7) / 0.3;
            T.hoverY = 70 * (1 - k); T.flap = 0.25 + Math.sin(time * 18) * 0.6; T.sweep = 0.15;
            T.legPitch = 0.5 * (1 - k); T.rigPitch = 0.2; T.neck = 0.55; T.head = -0.4;
          }
        } else if (slot === 2) { // Escamas Ígneas
          T.glow = 2.4; T.shell = 1;
          if (p < 0.45) {
            const k = easeInOut(p / 0.45);
            T.sweep = 0.55 - 1.25 * k; T.flap = 0.1; T.neck = 0.2; T.head = 0.1; T.rigPitch = 0.1 * k;
            T.tailYaw = 0.9 * k; T.jaw = 0.1; T.eyeY = 0.4;
          } else {
            const k = (p - 0.45) / 0.55;
            T.sweep = 0.25; T.flap = 0.9 - 0.4 * k; T.neck = 0.05; T.head = -0.5; T.jaw = 0.85 * (1 - k * 0.6);
            T.rigPitch = -0.25; T.tailYaw = 0.3;
          }
        } else { // R: Lluvia de Meteoros (pose épica)
          rate = 18;
          if (p < 0.58) {
            const k = easeInOut(p / 0.4);
            T.rigPitch = -0.75 * k; T.hoverY = 12 * k; T.flap = 0.3 + 0.65 * k; T.sweep = 0.55 - 0.55 * k;
            T.neck = 0.35 - 0.6 * k; T.neckMid = -0.2; T.head = -0.15 - 0.5 * k; T.jaw = 1.05 * k;
            T.legPitch = -0.2 * k; T.legSplay = 0.2 * k; T.tailPitch = -0.2; T.tailWave = 0.35;
            T.glow = 0.3 + 2.4 * k; T.armPitch = -0.6;
            shake = Math.sin(time * 55) * 0.05 * k;
            orbS = easeOut(p / 0.58) * (1 + 0.12 * Math.sin(time * 30));
            orbY = 240 + 80 * easeOut(p / 0.58); orbZ = -10;
          } else if (p < 0.8) {
            const k = easeOut((p - 0.58) / 0.22);
            T.rigPitch = 0.35; T.hoverY = 0; T.flap = -0.55; T.sweep = 0.1; T.neck = 0.95; T.neckMid = -0.1;
            T.head = -0.55; T.jaw = 0.9; T.glow = 2.2; T.armPitch = 1.2; T.tailPitch = 0.3;
            orbS = 1.2 * (1 - k); orbY = 320 - 220 * k; orbZ = -10 + 380 * k;
          } else {
            T.neck = 0.55; T.head = -0.35; T.jaw = 0.3; T.glow = 1.0; T.flap = 0.4;
          }
        }
      } else if (anim === 'recall') {
        T.sweep = -0.7; T.flap = 0.05; T.neck = 0.65; T.neckMid = 0.0; T.head = 0.25; T.jaw = 0;
        T.hoverY = 6 + Math.sin(time * 2) * 4; T.tailYaw = 1.0; T.tailWave = 0.05;
        T.glow = 0.9 + 0.6 * Math.sin(time * 4); T.ring = 1; T.eyeY = 0.2; T.shell = 0.25;
        rate = 6;
      } else if (anim === 'dead') {
        T.hoverY = -50; T.rigRoll = 0.25; T.rigPitch = 0.25; T.neck = 1.9; T.neckMid = 0.3; T.head = 0.2;
        T.headYaw = 0.5; T.jaw = 0.55; T.eyeY = 0.12; T.flap = -0.12; T.sweep = 0.25;
        T.legPitch = 0.6; T.legSplay = 1.25; T.tailPitch = -0.15; T.tailYaw = 0.6; T.tailWave = 0;
        T.glow = 0; T.armPitch = 1.4;
        rate = 8;
      }

      const a = first ? 1 : 1 - Math.exp(-dt * rate);
      first = false;
      for (const k in T) cur[k] = (cur[k] === undefined) ? T[k] : cur[k] + (T[k] - cur[k]) * a;

      hover.position.y = cur.hoverY;
      rig.rotation.set(cur.rigPitch, 0, cur.rigRoll + shake);
      const br = 1 + cur.breathe;
      torso.scale.set(52 * br, 48 * br, 64);
      belly.scale.set(40 * br, 40 * br, 32 * (1 + cur.breathe * 1.5));
      neck.rotation.set(cur.neck, cur.headYaw * 0.6, 0);
      neckMid.rotation.x = cur.neckMid;
      head.rotation.set(cur.head, cur.headYaw * 0.5, 0);
      jaw.rotation.x = cur.jaw;
      for (let i = 0; i < eyes.length; i++) eyes[i].scale.y = 9 * clamp(cur.eyeY, 0.1, 1);
      for (let i = 0; i < arms.length; i++) arms[i].rotation.x = cur.armPitch;
      for (let i = 0; i < wings.length; i++) wings[i].rotation.set(0, cur.sweep, cur.flap);
      for (let i = 0; i < legs.length; i++) {
        const L = legs[i];
        L.g.rotation.set(cur.legPitch + Math.sin(legPh + (L.s > 0 ? 0 : PI)) * cur.legAlt, 0, L.s * cur.legSplay);
      }
      const w = cur.tailWave;
      t1.rotation.set(-0.35 + cur.tailPitch, cur.tailYaw * 0.4 + Math.sin(time * 2.4) * w, 0);
      t2.rotation.set(0.3 + cur.tailPitch * 0.5, cur.tailYaw * 0.5 + Math.sin(time * 2.4 - 0.9) * w * 1.3, 0);
      t3.rotation.set(0.45, cur.tailYaw * 0.5 + Math.sin(time * 2.4 - 1.8) * w * 1.6, 0);
      glowMat.emissiveIntensity = cur.glow;

      ball.visible = ballS > 0.01;
      const bs = Math.max(0.01, 18 * ballS * (1 + 0.1 * Math.sin(time * 40)));
      ball.scale.set(bs, bs, bs * (ballZ > 30 ? 1.5 : 1));
      ball.position.z = 56 + ballZ;
      breath.visible = breathS > 0.01;
      const bw = Math.max(0.01, 70 * breathS);
      breath.scale.set(bw, bw, Math.max(0.01, 240 * breathS));
      breathMat.opacity = 0.7 * breathS;

      shell.visible = cur.shell > 0.02;
      const ss = Math.max(0.01, 115 * cur.shell * (1 + 0.06 * Math.sin(time * 9)));
      shell.scale.set(ss, ss * 1.15, ss);
      shell.rotation.y = time * 1.5;
      shellMat.opacity = 0.5 * cur.shell;

      ring.visible = cur.ring > 0.02;
      const rs = 85 + Math.sin(time * 3) * 8;
      ring.scale.set(rs, rs, rs);
      ring.rotation.z = time * 1.2;
      ringMat.opacity = 0.85 * cur.ring;

      orb.visible = orbS > 0.01;
      const os = Math.max(0.01, 38 * orbS);
      orb.scale.set(os, os, os);
      orb.position.set(0, orbY, orbZ);
      orb.rotation.y = time * 3;
    }

    update({ anim: 'idle', time: 0, dt: 1 / 60 });
    return { object: root, update: update };
  }

  // ---------------------------------------------------------------- FX helpers
  function fireballFx(THREE, info, palette) {
    const g = new THREE.Group(); const mats = [];
    const w = clamp((info.width || 140) / 140, 0.4, 3);
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const core = new THREE.Mesh(ico, fxMat(THREE, mats, palette[1])); g.add(core);
    const outer = new THREE.Mesh(ico, fxMat(THREE, mats, palette[0])); g.add(outer);
    const trail = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(ico, fxMat(THREE, mats, palette[i % palette.length])); g.add(m); trail.push(m);
    }
    return {
      object: g,
      update: function (p) {
        const e = envelope(p, 0.08, 0.85);
        core.scale.setScalar(26 * w); core.material.opacity = 0.95 * e;
        outer.scale.setScalar(44 * w * (1 + 0.1 * Math.sin(p * 80))); outer.material.opacity = 0.55 * e;
        core.position.y = outer.position.y = 60;
        for (let i = 0; i < trail.length; i++) {
          const q = ((p * 6 + i / trail.length) % 1);
          const m = trail[i];
          m.position.set(Math.sin(i * 2.3 + p * 20) * 12 * w, 60 + q * 20, -q * 160 * w);
          m.scale.setScalar((30 - 22 * q) * w);
          m.material.opacity = 0.6 * (1 - q) * e;
        }
      }
    };
  }

  // Q: Aliento de Fuego (cono)
  function fxQ(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'cone';
    if (kind === 'projectile') return fireballFx(THREE, info, [C.fire, C.gold, C.ember]);
    const g = new THREE.Group(); const mats = [];
    let L, ang;
    if (kind === 'cone') { L = info.length || 650; ang = clamp((info.angle || 50) * PI / 180, 0.2, TAU); }
    else if (kind === 'line') { L = info.length || 800; ang = clamp(2 * Math.atan((info.width || 120) / L), 0.1, 0.6); }
    else { L = info.radius || 250; ang = TAU; }
    const full = ang >= TAU - 0.01;
    const start = -PI / 2 - ang / 2;
    const base = new THREE.Mesh(new THREE.CircleGeometry(1, 40, start, ang).rotateX(-PI / 2), fxMat(THREE, mats, C.ember));
    base.position.y = 2; g.add(base);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 32, start, ang).rotateX(-PI / 2), fxMat(THREE, mats, C.gold));
    inner.position.y = 3; g.add(inner);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40, 1, start, ang).rotateX(-PI / 2), fxMat(THREE, mats, C.accent));
    rim.position.y = 4; g.add(rim);
    const rnd = prng(7);
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const pal = [C.fire, C.gold, C.ember];
    const sz = clamp(L / 650, 0.5, 1.6);
    const puffs = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(ico, fxMat(THREE, mats, pal[i % 3]));
      g.add(m);
      puffs.push({
        m: m, a: full ? rnd() * TAU : (rnd() - 0.5) * ang * 0.9, delay: (i / 18) * 0.45,
        dist: L * (0.55 + 0.45 * rnd()), size: (16 + rnd() * 14) * sz, spin: rnd() * 6
      });
    }
    return {
      object: g,
      update: function (p) {
        const grow = easeOut(p / 0.3), fade = 1 - smooth(0.7, 1, p);
        base.scale.set(L * grow, 1, L * grow); base.material.opacity = 0.32 * fade;
        inner.scale.set(0.6 * L * grow, 1, 0.6 * L * grow); inner.material.opacity = 0.3 * fade * (0.8 + 0.2 * Math.sin(p * 50));
        rim.scale.set(L * grow, 1, L * grow); rim.material.opacity = 0.65 * fade;
        for (let i = 0; i < puffs.length; i++) {
          const P = puffs[i];
          const q = clamp((p - P.delay) / 0.5, 0, 1);
          const r = 20 + P.dist * easeOut(q);
          P.m.position.set(Math.sin(P.a) * r, 20 + 70 * q, Math.cos(P.a) * r);
          P.m.scale.setScalar(Math.max(0.01, P.size * (0.5 + 2 * q) * (1 - 0.35 * q)));
          P.m.rotation.set(q * P.spin, q * P.spin * 0.7, 0);
          P.m.material.opacity = (q > 0 && q < 1) ? 0.85 * Math.sin(q * PI) : 0;
        }
      }
    };
  }

  // W: Vuelo (ráfaga de alas)
  function fxW(THREE, ctx, info) {
    info = info || {};
    const R = Math.max(160, info.radius || 220);
    const g = new THREE.Group(); const mats = [];
    const ringM = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-PI / 2), fxMat(THREE, mats, C.belly));
    ringM.position.y = 3; g.add(ringM);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-PI / 2), fxMat(THREE, mats, C.fire));
    disc.position.y = 2; g.add(disc);
    const memb = membraneGeo(THREE);
    const ghosts = [];
    [1, -1].forEach(function (s) {
      const side = new THREE.Group(); side.scale.x = s; side.position.x = s * 20; g.add(side);
      const m = new THREE.Mesh(memb, fxMat(THREE, mats, 0xff8a3a)); side.add(m);
      ghosts.push({ side: side, m: m });
    });
    const boxG = new THREE.BoxGeometry(1, 1, 1);
    const streaks = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(boxG, fxMat(THREE, mats, i % 2 ? C.belly : C.accent)); g.add(m);
      streaks.push({ m: m, a: i / 10 * TAU + 0.3, y: 25 + (i % 3) * 25 });
    }
    const oct = new THREE.OctahedronGeometry(1, 0);
    const embers = [];
    const rnd = prng(19);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(oct, fxMat(THREE, mats, i % 2 ? C.gold : C.ember)); g.add(m);
      embers.push({ m: m, a: i / 8 * TAU, h: 0.6 + 0.4 * rnd() });
    }
    return {
      object: g,
      update: function (p) {
        const e = smooth(0, 0.06, p) * (1 - smooth(0.55, 1, p));
        const ep = easeOut(p);
        ringM.scale.set(R * (0.25 + ep), 1, R * (0.25 + ep)); ringM.material.opacity = 0.75 * (1 - p);
        const dsc = R * 0.8 * easeOut(p * 2);
        disc.scale.set(Math.max(0.01, dsc), 1, Math.max(0.01, dsc)); disc.material.opacity = 0.25 * (1 - p);
        for (let i = 0; i < ghosts.length; i++) {
          const G = ghosts[i];
          G.side.position.y = 120 + 80 * p;
          G.m.rotation.set(0, 0.1, 1.1 - 1.8 * easeOut(p * 1.6));
          G.m.scale.setScalar(1.1 + 0.5 * p);
          G.m.material.opacity = 0.5 * e;
        }
        for (let i = 0; i < streaks.length; i++) {
          const S = streaks[i];
          const r = R * (0.2 + 0.9 * ep);
          S.m.position.set(Math.sin(S.a) * r, S.y, Math.cos(S.a) * r);
          S.m.rotation.y = S.a;
          S.m.scale.set(5, 5, 40 + 140 * p);
          S.m.material.opacity = 0.6 * (1 - p) * smooth(0, 0.05, p);
        }
        for (let i = 0; i < embers.length; i++) {
          const E = embers[i];
          const a = E.a + p * 4, r = 60 + 90 * p;
          E.m.position.set(Math.sin(a) * r, 20 + 260 * p * E.h, Math.cos(a) * r);
          E.m.scale.setScalar(Math.max(0.01, 9 * (1 - p) + 2));
          E.m.rotation.y = p * 10;
          E.m.material.opacity = 0.9 * e;
        }
      }
    };
  }

  // E: Escamas Ígneas (escudo de fuego)
  function fxE(THREE, ctx, info) {
    info = info || {};
    const R = info.radius || 300;
    const g = new THREE.Group(); const mats = [];
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, PI / 2), fxMat(THREE, mats, C.fire));
    g.add(dome);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-PI / 2), fxMat(THREE, mats, C.ember));
    glow.position.y = 2; glow.scale.set(150, 1, 150); g.add(glow);
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56).rotateX(-PI / 2), fxMat(THREE, mats, C.gold));
    pulse.position.y = 3; g.add(pulse);
    const edge = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 56).rotateX(-PI / 2), fxMat(THREE, mats, C.fire));
    edge.position.y = 3; edge.scale.set(R, 1, R); g.add(edge);
    const hexG = new THREE.CylinderGeometry(1, 1, 0.18, 6).rotateX(PI / 2);
    const plates = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(hexG, fxMat(THREE, mats, i % 2 ? C.gold : C.accent)); g.add(m); plates.push(m);
    }
    const coneG = new THREE.ConeGeometry(1, 1, 6); coneG.translate(0, 0.5, 0);
    const flames = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(coneG, fxMat(THREE, mats, i % 2 ? C.ember : C.fire)); g.add(m);
      const a = i / 10 * TAU;
      m.position.set(Math.sin(a) * 135, 0, Math.cos(a) * 135);
      flames.push(m);
    }
    return {
      object: g,
      update: function (p) {
        const e = envelope(p, 0.08, 0.8);
        const pul = 1 + 0.05 * Math.sin(p * 60);
        dome.scale.set(125 * pul, 150 * pul, 125 * pul); dome.material.opacity = 0.2 * e;
        glow.material.opacity = 0.25 * e;
        const q = clamp((p - 0.02) / 0.3, 0, 1);
        const ps = R * (0.2 + 0.8 * easeOut(q));
        pulse.scale.set(ps, 1, ps); pulse.material.opacity = 0.85 * (1 - q) * smooth(0, 0.02, p + 0.001);
        edge.material.opacity = 0.3 * e;
        for (let i = 0; i < plates.length; i++) {
          const a = i / 8 * TAU + p * 5;
          const m = plates[i];
          m.position.set(Math.sin(a) * 118, 75 + 45 * Math.sin(i * 1.7 + p * 9), Math.cos(a) * 118);
          m.rotation.set(0, a, 0);
          m.scale.setScalar(26);
          m.material.opacity = 0.85 * e;
        }
        for (let i = 0; i < flames.length; i++) {
          const h = 55 + 35 * Math.sin(p * 40 + i * 2.1);
          flames[i].scale.set(15, h, 15);
          flames[i].material.opacity = 0.7 * e;
        }
      }
    };
  }

  // R: Lluvia de Meteoros (área)
  function fxR(THREE, ctx, info) {
    info = info || {};
    const R = info.kind === 'area' ? (info.radius || 450) : Math.max(150, info.radius || 250);
    const g = new THREE.Group(); const mats = [];
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-PI / 2), fxMat(THREE, mats, C.ember));
    disc.position.y = 2; disc.scale.set(R, 1, R); g.add(disc);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64).rotateX(-PI / 2), fxMat(THREE, mats, C.accent));
    rim.position.y = 3; rim.scale.set(R, 1, R); g.add(rim);
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.62, 6, 1).rotateX(-PI / 2), fxMat(THREE, mats, C.gold));
    rune.position.y = 3; rune.scale.set(R, 1, R); g.add(rune);

    const rnd = prng(31);
    const rockG = new THREE.DodecahedronGeometry(1, 0);
    const trailG = new THREE.ConeGeometry(1, 1, 8, 1, true); trailG.translate(0, 0.5, 0);
    const markG = new THREE.RingGeometry(0.7, 1, 32).rotateX(-PI / 2);
    const up = new THREE.Vector3(0, 1, 0);
    const meteors = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      let x = 0, z = 0;
      if (i > 0) { const a = rnd() * TAU, r = R * (0.3 + 0.6 * Math.sqrt(rnd())); x = Math.sin(a) * r; z = Math.cos(a) * r; }
      const size = i === 0 ? 70 : 38 + rnd() * 18;
      const land = new THREE.Vector3(x, size * 0.3, z);
      const startP = new THREE.Vector3(x - 260, 820, z - 180);
      const back = startP.clone().sub(land).normalize();
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a1810, emissive: C.ember, emissiveIntensity: 0.9, flatShading: true, transparent: true, opacity: 1 });
      mats.push(rockMat);
      const rock = new THREE.Mesh(rockG, rockMat); rock.visible = false; g.add(rock);
      const trail = new THREE.Mesh(trailG, fxMat(THREE, mats, C.fire)); trail.visible = false;
      trail.quaternion.setFromUnitVectors(up, back); g.add(trail);
      const markMat = fxMat(THREE, mats, C.ember);
      const mark = new THREE.Mesh(markG, markMat); mark.position.set(x, 4, z); g.add(mark);
      meteors.push({
        rock: rock, trail: trail, mark: mark, markMat: markMat, land: land, start: startP, size: size,
        tLand: 0.28 + i * (0.57 / (N - 1)), spin: 2 + rnd() * 4
      });
    }
    const fall = 0.13;
    const tmp = new THREE.Vector3();
    return {
      object: g,
      update: function (p) {
        const e = envelope(p, 0.06, 0.88);
        disc.material.opacity = (0.14 + 0.07 * Math.sin(p * 40)) * e;
        rim.material.opacity = 0.75 * e;
        rune.rotation.y = p * 3; rune.material.opacity = 0.5 * e;
        for (let i = 0; i < meteors.length; i++) {
          const m = meteors[i];
          const q = (p - (m.tLand - fall)) / fall;
          if (q < 0) {
            m.rock.visible = false; m.trail.visible = false;
            const w = clamp(q + 1.5, 0, 1);
            m.markMat.color.setHex(C.ember);
            const ms = m.size * 1.6;
            m.mark.scale.set(ms, 1, ms); m.markMat.opacity = 0.35 * w * e;
          } else if (q < 1) {
            const k = Math.pow(q, 1.4);
            tmp.copy(m.start).lerp(m.land, k);
            m.rock.visible = true; m.rock.position.copy(tmp); m.rock.scale.setScalar(m.size);
            m.rock.rotation.set(q * m.spin, q * m.spin * 0.6, 0);
            m.rock.material.opacity = 1; m.rock.material.emissiveIntensity = 1.2;
            m.trail.visible = true; m.trail.position.copy(tmp);
            m.trail.scale.set(m.size * 0.9, 260, m.size * 0.9); m.trail.material.opacity = 0.8 * e;
            const ms = m.size * (1.6 - 0.5 * q);
            m.markMat.color.setHex(C.ember);
            m.mark.scale.set(ms, 1, ms); m.markMat.opacity = (0.4 + 0.3 * Math.sin(q * 30)) * e;
          } else {
            const hit = (p - m.tLand) / 0.12;
            const h = clamp(hit, 0, 1);
            m.trail.visible = false;
            m.rock.visible = hit < 2.5;
            m.rock.position.copy(m.land);
            m.rock.scale.setScalar(Math.max(0.01, m.size * (1 - 0.5 * clamp(hit / 2.5, 0, 1))));
            m.rock.material.opacity = 1 - clamp(hit / 2.5, 0, 1);
            m.rock.material.emissiveIntensity = 1.2 * (1 - clamp(hit / 2.5, 0, 1)) + 0.1;
            m.markMat.color.setHex(C.gold);
            const ms = m.size * 1.2 + 160 * easeOut(h);
            m.mark.scale.set(ms, 1, ms); m.markMat.opacity = 0.95 * (1 - h) * e;
          }
        }
      }
    };
  }

  MOBA.defineChampionArt('dragon', {
    lore: 'Durmió mil años sobre una montaña de oro; lo despertaron para pelear por un nexo y todavía no sabe qué es, pero ya le prendió fuego a tres.',
    quote: '¿Tenés frío, che? Vení que te convido un fueguito.',
    build: build,
    fx: { Q: fxQ, W: fxW, E: fxE, R: fxR }
  });
})();
