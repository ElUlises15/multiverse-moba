/* Arte procedural de Granito, El Gólem de la Cantera (Tanque).
 * Silueta: gólem jorobado de nudillos al piso, puños gigantes con zunchos de cantera,
 * cabeza hundida entre hombros asimétricos (musgo / cristales) y tres menhires clavados en la espalda. */
(function () {
  'use strict';

  const COL = {
    stone: 0x8a7f72, dark: 0x5a5249, light: 0xa99d8b, accent: 0xe3d3a8,
    magma: 0xff8a2a, moss: 0x6f8f3c, eye: 0xffe9a8
  };
  const TAU = Math.PI * 2;

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function seg(p, a, b) { return b - a <= 1e-6 ? (p >= b ? 1 : 0) : clamp((p - a) / (b - a), 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function outBack(t) { t = clamp(t, 0, 1); const c = 2.2, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function outQuad(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function keys(p, k) {
    if (p <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) {
      if (p <= k[i][0]) {
        const a = k[i - 1], b = k[i];
        return lerp(a[1], b[1], sm((p - a[0]) / Math.max(1e-6, b[0] - a[0])));
      }
    }
    return k[k.length - 1][1];
  }
  function rng(seed) {
    let s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  // ---------------------------------------------------------------- modelo
  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache;
    const teamC = num(ctx.teamColor, 0x38a3ff);

    const mStone = cache.mat(COL.stone, { roughness: 0.95 });
    const mDark = cache.mat(COL.dark, { roughness: 1 });
    const mLight = cache.mat(COL.light, { roughness: 0.9 });
    const mAccent = cache.mat(COL.accent, { roughness: 0.6, emissive: COL.accent, emissiveIntensity: 0.15 });
    const mMoss = cache.mat(COL.moss, { roughness: 1 });
    const mMagma = cache.mat(COL.magma, { emissive: COL.magma, emissiveIntensity: 1.4, roughness: 0.5 });
    const mTeam = cache.mat(teamC, { emissive: teamC, emissiveIntensity: 0.9, roughness: 0.4 });
    const mEye = cache.basic(COL.eye);
    const mShell = cache.mat(COL.accent, { transparent: true, opacity: 0.22, emissive: COL.accent, emissiveIntensity: 0.5, depthWrite: false });

    const geo = (k, f) => cache.geo('granito_' + k, f);
    const gDode = geo('dode', () => new THREE.DodecahedronGeometry(1, 0));
    const gIco = geo('ico', () => new THREE.IcosahedronGeometry(1, 1));
    const gBox = geo('box', () => new THREE.BoxGeometry(1, 1, 1));
    const gOct = geo('oct', () => new THREE.OctahedronGeometry(1, 0));
    const gCyl = geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 6));
    const gMenhir = geo('menhir', () => { const g = new THREE.CylinderGeometry(0.45, 1, 1, 5); g.translate(0, 0.5, 0); return g; });

    function add(parent, g, m, x, y, z, sx, sy, sz, rx, ry, rz) {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0);
      parent.add(o); return o;
    }
    function grp(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }

    const root = new THREE.Group();
    const body = grp(root);              // salto / caída (pivote en los pies)
    const core = grp(body, 0, 140, 0);   // pivote en el centro de masa (voltereta de la R)
    const inner = grp(core, 0, -140, 0);

    // Piernas cortas y macizas
    const legs = grp(inner);
    function makeLeg(side) {
      const hip = grp(legs, side * 36, 80, 0);
      add(hip, gDode, mDark, 0, -30, 0, 28, 40, 28);
      const ankle = grp(hip, 0, -60, 0);
      add(ankle, gBox, mStone, 0, -8, 10, 50, 24, 66, 0, side * -0.12, 0);
      hip.userData.ankle = ankle;
      return hip;
    }
    const legL = makeLeg(-1), legR = makeLeg(1);
    const ankL = legL.userData.ankle, ankR = legR.userData.ankle;

    add(inner, gDode, mDark, 0, 88, 0, 52, 34, 44);

    // Torso jorobado
    const torso = grp(inner, 0, 96, 0);
    add(torso, gDode, mStone, 0, 68, 0, 72, 60, 58, 0, 0.3, 0);
    add(torso, gDode, mDark, 0, 22, 18, 48, 32, 38);
    add(torso, gBox, mTeam, 0, 60, 54, 26, 26, 10, 0, 0, Math.PI / 4);           // runa del equipo
    add(torso, gBox, mMagma, -28, 84, 46, 6, 34, 6, 0.2, 0, 0.5);                // grietas de magma
    add(torso, gBox, mMagma, 30, 40, 42, 6, 26, 6, 0.1, 0, -0.6);

    // Cabeza chiquita hundida entre los hombros
    const head = grp(torso, 0, 104, 46);
    add(head, gDode, mLight, 0, 0, 0, 33, 28, 30);
    add(head, gBox, mDark, 0, 11, 17, 54, 13, 24, -0.25, 0, 0);
    const eyeL = add(head, gBox, mEye, -12, 1, 28, 11, 6, 4);
    const eyeR = add(head, gBox, mEye, 12, 1, 28, 11, 6, 4);
    add(head, gBox, mDark, 0, -16, 10, 42, 15, 30);

    // Menhires clavados en la espalda
    const back = grp(torso, 0, 100, -32);
    const m1 = grp(back, 0, 0, 0); m1.rotation.set(-0.45, 0, 0);
    add(m1, gMenhir, mLight, 0, 0, 0, 24, 88, 24);
    add(m1, gOct, mTeam, 0, 94, 0, 10, 16, 10);
    const m2 = grp(back, -34, -8, 4); m2.rotation.set(-0.3, 0, 0.45);
    add(m2, gMenhir, mStone, 0, 0, 0, 17, 72, 17);
    const m3 = grp(back, 34, -14, 4); m3.rotation.set(-0.35, 0, -0.5);
    add(m3, gMenhir, mStone, 0, 0, 0, 15, 60, 15);

    // Hombros asimétricos: musgo a la izquierda, cristales a la derecha
    add(torso, gDode, mLight, -62, 92, -2, 42, 38, 42);
    add(torso, gDode, mMoss, -64, 122, -4, 36, 10, 34);
    add(torso, gDode, mLight, 62, 94, -2, 46, 40, 44);
    add(torso, gOct, mAccent, 76, 132, -6, 10, 30, 10, 0, 0, -0.5);
    add(torso, gOct, mAccent, 52, 138, -14, 8, 24, 8, -0.3, 0, -0.15);

    // Brazos de gorila con puños enormes
    function makeArm(side) {
      const sh = grp(torso, side * 70, 84, 0);
      add(sh, gDode, mStone, 0, -26, 0, 26, 36, 26);
      const el = grp(sh, 0, -52, 0);
      add(el, gDode, mDark, 0, -26, 0, 30, 38, 30);
      const fist = grp(el, 0, -62, 0);
      add(fist, gDode, mLight, 0, -6, 0, 38, 34, 38);
      add(fist, gCyl, mAccent, 0, 24, 0, 30, 10, 30);
      add(fist, gDode, mDark, -14, -30, 18, 13, 13, 13);
      add(fist, gDode, mDark, 14, -30, 18, 13, 13, 13);
      return { sh, el, fist };
    }
    const armL = makeArm(-1), armR = makeArm(1);
    const heldRock = add(armR.fist, gDode, mStone, 0, -44, 22, 0.001, 0.001, 0.001, 0.4, 0.2, 0);

    const shell = add(inner, gIco, mShell, 0, 150, 10, 0.001, 0.001, 0.001);

    // Piedritas que lo orbitan
    const pebG = grp(root);
    const pebbles = [0, 1, 2].map(i => add(pebG, gDode, i === 1 ? mAccent : mStone, 0, 150, 0, 12, 11, 12, i, i * 2, 0));

    const LEAN = 0.35, ARM = -0.45;

    function update(s) {
      s = s || {};
      const anim = s.anim || 'idle';
      const time = num(s.time, 0), t = num(s.t, 0), p = clamp(num(s.progress, 0), 0, 1);

      let bodyY = 0, bodyRX = 0, bodyRZ = 0, sq = 1;
      let coreRX = 0;
      let lean = LEAN, twist = 0, torsoRZ = 0;
      let headRX = -0.3, headRZ = 0, headZ = 46, headY = 104;
      let lRX = ARM, lRZ = -0.06, lEl = -0.15, rRX = ARM, rRZ = 0.06, rEl = -0.15;
      let lgL = 0, lgR = 0;
      let rock = 0, shellS = 0, eye = 1;
      let pebR = 100, pebY = 150, pebSpd = 0.8, pebDead = false;
      const br = Math.sin(time * 1.7);

      if (anim === 'walk') {
        const f = clamp(num(s.speed, 340) / 340, 0.3, 2);
        const ph = time * Math.PI * 1.7 * f;
        const sw = Math.sin(ph), asw = Math.abs(sw);
        lgL = sw * 0.4; lgR = -sw * 0.4;
        bodyY = 9 * (1 - Math.pow(asw, 0.6)) + 1;     // cae de golpe en cada pisada
        sq = 1 - 0.035 * Math.pow(asw, 6);
        bodyRZ = sw * 0.07;
        twist = sw * 0.13;
        lean = LEAN + 0.08;
        lRX = ARM - sw * 0.45; rRX = ARM + sw * 0.45;
        lEl = rEl = -0.3;
        headRZ = -sw * 0.05;
        pebSpd = 1.4;
      } else if (anim === 'attack') {
        // martillazo a dos puños: levanta, se arquea, revienta el piso
        const A = [[0, ARM], [0.36, -3.0], [0.5, -1.75], [0.66, -1.75], [1, ARM]];
        lRX = rRX = keys(p, A);
        lRZ = keys(p, [[0, -0.06], [0.36, 0.32], [0.5, 0.28], [0.66, 0.28], [1, -0.06]]);
        rRZ = -lRZ;
        lEl = rEl = keys(p, [[0, -0.15], [0.36, -0.9], [0.5, -0.1], [0.66, -0.1], [1, -0.15]]);
        lean = keys(p, [[0, LEAN], [0.36, 0.0], [0.5, 0.8], [0.66, 0.8], [1, LEAN]]);
        bodyY = keys(p, [[0, 0], [0.36, 8], [0.5, -12], [0.66, -12], [1, 0]]);
        sq = keys(p, [[0, 1], [0.48, 1], [0.52, 0.9], [0.62, 1], [1, 1]]);
      } else if (anim === 'cast') {
        const slot = (s.slot | 0);
        if (slot === 0) {
          // Roca Lanzada: arranca una roca del piso y la tira por arriba
          lean = keys(p, [[0, LEAN], [0.22, 0.75], [0.32, 0.75], [0.55, 0.1], [0.7, 0.65], [1, LEAN]]);
          twist = keys(p, [[0, 0], [0.32, 0], [0.55, -0.45], [0.7, 0.4], [1, 0]]);
          rRX = keys(p, [[0, ARM], [0.22, -1.3], [0.32, -1.3], [0.55, -3.1], [0.7, -1.55], [1, ARM]]);
          rRZ = keys(p, [[0, 0.06], [0.55, -0.15], [0.7, 0.06], [1, 0.06]]);
          rEl = keys(p, [[0, -0.15], [0.32, -0.2], [0.55, -1.4], [0.7, -0.05], [1, -0.15]]);
          lRX = keys(p, [[0, ARM], [0.3, -0.9], [0.55, -1.5], [0.7, -0.6], [1, ARM]]);
          rock = keys(p, [[0, 0], [0.18, 0], [0.3, 1], [0.67, 1], [0.7, 0], [1, 0]]);
          bodyY = keys(p, [[0, 0], [0.22, -10], [0.5, 4], [0.7, -6], [1, 0]]);
        } else if (slot === 1) {
          // Piel de Piedra: se encoge con los brazos cruzados y explota en pose de fuerza
          lRZ = keys(p, [[0, -0.06], [0.3, 0.75], [0.45, 0.75], [0.58, -1.1], [0.85, -1.0], [1, -0.06]]);
          rRZ = -lRZ;
          lRX = rRX = keys(p, [[0, ARM], [0.3, -1.4], [0.45, -1.4], [0.58, -0.4], [1, ARM]]);
          lEl = rEl = keys(p, [[0, -0.15], [0.3, -1.3], [0.45, -1.3], [0.58, -1.2], [0.85, -1.1], [1, -0.15]]);
          lean = keys(p, [[0, LEAN], [0.3, 0.65], [0.45, 0.7], [0.58, 0.05], [0.85, 0.1], [1, LEAN]]);
          bodyY = keys(p, [[0, 0], [0.3, -16], [0.45, -18], [0.58, 6], [1, 0]]);
          headRX = keys(p, [[0, -0.3], [0.45, -0.1], [0.58, -0.8], [0.85, -0.6], [1, -0.3]]);
          shellS = keys(p, [[0, 0], [0.45, 0], [0.58, 1.15], [0.7, 1], [0.9, 1], [1, 0]]);
          pebR = keys(p, [[0, 100], [0.45, 60], [0.6, 135], [1, 100]]);
          pebSpd = 3.5;
        } else if (slot === 2) {
          // Temblor: salta con los brazos abiertos y clava los puños a los costados
          lRX = rRX = keys(p, [[0, ARM], [0.35, -2.9], [0.5, -1.6], [0.7, -1.6], [1, ARM]]);
          lRZ = keys(p, [[0, -0.06], [0.35, -0.45], [0.5, -0.55], [0.7, -0.55], [1, -0.06]]);
          rRZ = -lRZ;
          lEl = rEl = keys(p, [[0, -0.15], [0.35, -0.5], [0.5, 0], [1, -0.15]]);
          lean = keys(p, [[0, LEAN], [0.35, -0.05], [0.5, 0.85], [0.7, 0.85], [1, LEAN]]);
          bodyY = keys(p, [[0, 0], [0.18, -10], [0.38, 30], [0.5, -20], [0.7, -18], [1, 0]]);
          sq = keys(p, [[0, 1], [0.48, 1], [0.53, 0.84], [0.66, 1], [1, 1]]);
          pebY = keys(p, [[0, 150], [0.5, 150], [0.6, 230], [1, 150]]);
        } else {
          // Avalancha: se agacha, salta altísimo, da una voltereta y cae como un alud
          bodyY = keys(p, [[0, 0], [0.15, -30], [0.22, -30], [0.42, 190], [0.55, 205], [0.66, -28], [0.82, -24], [1, 0]]);
          coreRX = keys(p, [[0, 0], [0.24, 0], [0.62, TAU], [1, TAU]]);
          lRX = rRX = keys(p, [[0, ARM], [0.15, 0.6], [0.22, 0.6], [0.4, -3.0], [0.55, -3.0], [0.66, -1.8], [0.82, -1.8], [1, ARM]]);
          lRZ = keys(p, [[0, -0.06], [0.22, -0.2], [0.4, -0.7], [0.55, -0.3], [0.66, -0.45], [0.82, -0.45], [1, -0.06]]);
          rRZ = -lRZ;
          lEl = rEl = keys(p, [[0, -0.15], [0.22, -0.2], [0.4, -0.3], [0.66, 0], [1, -0.15]]);
          lean = keys(p, [[0, LEAN], [0.15, 0.85], [0.22, 0.85], [0.4, 0], [0.55, 0.5], [0.66, 0.95], [0.82, 0.9], [1, LEAN]]);
          lgL = lgR = keys(p, [[0, 0], [0.3, 0], [0.42, -0.9], [0.58, -0.9], [0.66, 0], [1, 0]]);
          sq = keys(p, [[0, 1], [0.64, 1], [0.68, 0.8], [0.8, 1], [1, 1]]);
          headRX = keys(p, [[0, -0.3], [0.7, -0.3], [0.8, -0.9], [1, -0.3]]);
          pebR = keys(p, [[0, 100], [0.4, 160], [0.66, 60], [0.8, 180], [1, 100]]);
          pebSpd = 4;
          eye = 1 + 0.4 * Math.sin(time * 18);
        }
      } else if (anim === 'recall') {
        // se arrodilla, apoya los puños juntos y las piedras suben girando
        const e = sm(seg(t, 0, 0.8));
        bodyY = -18 * e;
        lean = lerp(LEAN, 0.15, e);
        lRX = rRX = lerp(ARM, -0.95, e);
        lRZ = lerp(-0.06, 0.4, e); rRZ = -lRZ;
        lEl = rEl = lerp(-0.15, -0.9, e);
        headRX = lerp(-0.3, 0.25, e);
        pebR = 115; pebY = 130 + 60 * e + 25 * Math.sin(time * 2.2); pebSpd = 3;
        shellS = e * (0.92 + 0.06 * Math.sin(time * 4));
        eye = 1 + 0.35 * Math.sin(time * 5);
      } else if (anim === 'dead') {
        // se desploma de cara y la cabeza rueda
        const e = sm(seg(t, 0, 0.7));
        const bump = Math.sin(seg(t, 0.55, 0.85) * Math.PI) * 8;
        bodyRX = 1.3 * e;
        bodyRZ = 0.12 * e;
        bodyY = 62 * e + bump;
        lean = lerp(LEAN, 0.15, e);
        twist = 0.2 * e;
        lRX = rRX = lerp(ARM, -3.0, e);
        lRZ = lerp(-0.06, -0.7, e); rRZ = -lRZ;
        lEl = rEl = lerp(-0.15, 0.3, e);
        lgL = lgR = 0.15 * e;
        headZ = 46 + 30 * e; headY = 104 + 20 * e; headRZ = 1.1 * e; headRX = -0.3 - 0.9 * e;
        eye = lerp(1, 0.15, e);
        pebDead = true;
      } else {
        bodyY = 1.5 * br;
        lean = LEAN + 0.025 * br;
        lRX = ARM + 0.04 * br; rRX = ARM + 0.04 * Math.sin(time * 1.7 + 0.6);
        headRZ = 0.06 * Math.sin(time * 0.6);
        eye = (time % 4.3) < 0.12 ? 0.15 : 1;
      }

      body.position.set(0, bodyY, 0);
      body.rotation.set(bodyRX, 0, bodyRZ);
      const wide = 1 + (1 - sq) * 0.6;
      body.scale.set(wide, sq, wide);
      core.rotation.x = coreRX;

      const dn = Math.min(bodyY, 0);           // las piernas absorben la agachada
      legs.position.y = -dn;
      legs.scale.y = clamp((80 + dn) / 80, 0.4, 1);
      const spread = clamp(-dn / 30, 0, 1) * 0.25;
      legL.rotation.set(lgL, 0, -spread);
      legR.rotation.set(lgR, 0, spread);
      ankL.rotation.x = anim === 'walk' ? -lgL * 0.8 : 0;   // el pie queda plano al pisar
      ankR.rotation.x = anim === 'walk' ? -lgR * 0.8 : 0;

      torso.rotation.set(lean, twist, torsoRZ);
      head.position.set(0, headY, headZ);
      head.rotation.set(headRX - (lean - LEAN) * 0.7, -twist * 0.5, headRZ);

      armL.sh.rotation.set(lRX, 0, lRZ); armL.el.rotation.x = lEl;
      armR.sh.rotation.set(rRX, 0, rRZ); armR.el.rotation.x = rEl;

      heldRock.scale.setScalar(Math.max(0.001, rock * 40));
      heldRock.rotation.y = time * 3;
      const ss = Math.max(0.001, shellS);
      shell.scale.set(ss * 128, ss * 145, ss * 120);
      shell.rotation.y = time * 0.6;
      eyeL.scale.y = eyeR.scale.y = 6 * eye;
      eyeL.scale.x = eyeR.scale.x = 11 * (0.8 + 0.2 * eye);

      if (pebDead) {
        pebG.position.y = 0;
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + 0.6;
          pebbles[i].position.set(Math.sin(a) * 120, 10, Math.cos(a) * 120 + 60);
        }
      } else {
        pebG.position.y = Math.max(bodyY, -10);
        for (let i = 0; i < 3; i++) {
          const a = time * pebSpd + i * TAU / 3;
          pebbles[i].position.set(Math.sin(a) * pebR, pebY + 14 * Math.sin(time * 2 + i * 2.1), Math.cos(a) * pebR);
          pebbles[i].rotation.set(time * 1.3 + i, time * 0.9, 0);
        }
      }
    }

    update({ anim: 'idle', time: 0, t: 0 });
    return { object: root, update };
  }

  // ---------------------------------------------------------------- efectos
  function fxKit(THREE, info) {
    info = info || {};
    const kit = {
      kind: info.kind || 'area',
      R: clamp(num(info.radius, 300), 60, 900),
      W: clamp(num(info.width, 140), 40, 600),
      L: clamp(num(info.length, 1000), 100, 3000),
      root: new THREE.Group(),
      mats: []
    };
    kit.basic = function (color, op, additive) {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      kit.mats.push({ m, base: op }); return m;
    };
    kit.rock = function (color, emissive) {
      const m = new THREE.MeshStandardMaterial({
        color, flatShading: true, roughness: 0.9, transparent: true, opacity: 1,
        emissive: emissive || 0x000000, emissiveIntensity: emissive ? 1.3 : 0
      });
      kit.mats.push({ m, base: 1 }); return m;
    };
    kit.mesh = function (g, m, parent) { const o = new THREE.Mesh(g, m); (parent || kit.root).add(o); return o; };
    kit.fade = function (a) { for (let i = 0; i < kit.mats.length; i++) kit.mats[i].m.opacity = kit.mats[i].base * a; };
    return kit;
  }
  function env(p, a, b) { return clamp(Math.min(p / a, (1 - p) / b), 0, 1); }

  // posiciones que se adaptan al tipo de lanzamiento
  function layout(kit, i, n, rand, R) {
    if (kit.kind === 'line') {
      const d = (i + 0.5) / n;
      return { x: (rand() - 0.5) * kit.W * 0.9, z: d * kit.L, d };
    }
    const a = i / n * TAU + (rand() - 0.5) * 0.4;
    const d = 0.45 + rand() * 0.5;
    return { x: Math.sin(a) * R * d, z: Math.cos(a) * R * d, d };
  }

  // Erupción de piedra: anillos de onda, grietas de magma y púas que brotan del piso
  function eruption(THREE, kit, o) {
    const rand = rng(o.seed || 7);
    const line = kit.kind === 'line';
    const R = kit.kind === 'projectile' ? kit.W * 0.9 : kit.R;
    const D = o.delay || 0;

    const rings = [];
    const nr = o.rings == null ? 2 : o.rings;
    for (let i = 0; i < nr; i++) {
      const base = i ? 0.5 : 0.75;
      const m = kit.basic(i ? COL.accent : (o.ringColor || COL.magma), base, true);
      const g = line ? new THREE.PlaneGeometry(1, 1) : new THREE.RingGeometry(0.8, 1, 48);
      const me = kit.mesh(g, m); me.rotation.x = -Math.PI / 2; me.position.y = 2 + i;
      rings.push({ me, m, base, i });
    }

    const crackG = new THREE.BoxGeometry(1, 1, 1); crackG.translate(0, 0, 0.5);
    const crackM = kit.basic(COL.magma, 0.95, true);
    const cracks = [];
    const nc = o.cracks || 0;
    for (let i = 0; i < nc; i++) {
      const me = kit.mesh(crackG, crackM);
      let len, a, d = 0;
      if (line) {
        d = i / nc;
        me.position.set((rand() - 0.5) * kit.W * 0.4, 1.5, d * kit.L);
        a = (rand() - 0.5) * 1.2; len = kit.L / nc * 1.4;
      } else {
        a = i / nc * TAU + (rand() - 0.5) * 0.5; len = R * (0.6 + rand() * 0.4);
        me.position.set(0, 1.5, 0);
      }
      me.rotation.y = a;
      cracks.push({ me, len, w: 7 + rand() * 7, d });
    }

    const spikeG = new THREE.ConeGeometry(1, 1, 5); spikeG.translate(0, 0.5, 0);
    const spikeM = [kit.rock(COL.stone), kit.rock(COL.light), kit.rock(COL.dark)];
    const spikes = [];
    const ns = o.spikes || 0;
    for (let i = 0; i < ns; i++) {
      const L0 = layout(kit, i, ns, rand, R);
      const me = kit.mesh(spikeG, spikeM[i % 3]);
      me.position.set(L0.x, 0, L0.z);
      const len = Math.hypot(L0.x, L0.z) || 1, tilt = line ? 0.15 : (o.tilt == null ? 0.4 : o.tilt);
      me.rotation.set(tilt * L0.z / len, 0, -tilt * L0.x / len);
      spikes.push({ me, d: L0.d, h: (o.spikeH || 110) * (0.7 + rand() * 0.6), r: (o.spikeR || 28) * (0.7 + rand() * 0.6) });
    }

    return function (p, e) {
      const on = p >= D ? 1 : 0;
      const q = seg(p, D, 1);
      for (let k = 0; k < rings.length; k++) {
        const r = rings[k];
        const g = outQuad(seg(q, 0.08 * r.i, 0.45 + 0.12 * r.i));
        if (line) { r.me.scale.set(kit.W * (1 + r.i * 0.4), Math.max(1, kit.L * g), 1); r.me.position.z = kit.L * g / 2; }
        else { const s = Math.max(1, R * lerp(0.08, 1.05, g)); r.me.scale.set(s, s, 1); }
        r.m.opacity = r.base * e * on * (1 - seg(q, 0.3 + 0.1 * r.i, 0.8 + 0.1 * r.i));
      }
      for (let k = 0; k < cracks.length; k++) {
        const c = cracks[k];
        const g = sm(seg(q, 0.02 + c.d * 0.3, 0.3 + c.d * 0.3)) * on;
        c.me.scale.set(c.w, 3, Math.max(0.01, c.len * g));
      }
      crackM.opacity = 0.95 * e * on * (1 - seg(q, 0.55, 1)) * (0.8 + 0.2 * Math.sin(q * 40));
      for (let k = 0; k < spikes.length; k++) {
        const s = spikes[k];
        const tt = seg(q, 0.04 + s.d * 0.18, 0.24 + s.d * 0.18) * on;
        const sink = seg(q, 0.65, 0.95);
        const sy = Math.max(0.001, s.h * outBack(tt) * (1 - sink));
        const sr = Math.max(0.001, s.r * Math.min(1, tt * 3));
        s.me.scale.set(sr, sy, sr);
        s.me.position.y = -sink * 25;
      }
    };
  }

  // Q — Roca Lanzada: peñasco rodando con vetas de magma, esquirlas y estela de polvo
  function fxQ(THREE, ctx, info) {
    const kit = fxKit(THREE, info);
    if (kit.kind !== 'projectile') {
      const er = eruption(THREE, kit, { rings: 2, cracks: 0, spikes: 7, spikeH: 75, spikeR: 22, seed: 11, tilt: 0.6 });
      const chunkG = new THREE.DodecahedronGeometry(1, 0);
      const chunkM = kit.rock(COL.stone);
      const rand = rng(5);
      const chunks = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + rand();
        chunks.push({ me: kit.mesh(chunkG, chunkM), a, v: 0.6 + rand() * 0.6, s: 14 + rand() * 12 });
      }
      const R = kit.kind === 'line' ? kit.W : (kit.kind === 'projectile' ? kit.W : kit.R) * 0.6;
      return {
        object: kit.root,
        update(p) {
          const e = env(p, 0.04, 0.25);
          kit.fade(e); er(p, e);
          for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i], d = p * c.v;
            c.me.position.set(Math.sin(c.a) * R * d, Math.max(0, 260 * d - 380 * d * d) + 10, Math.cos(c.a) * R * d + (kit.kind === 'line' ? kit.L * 0.1 : 0));
            c.me.scale.setScalar(c.s * (1 - seg(p, 0.7, 1)) + 0.001);
            c.me.rotation.set(p * 12 + i, p * 9, 0);
          }
        }
      };
    }
    const r = kit.W * 0.42;
    const spin = new THREE.Group(); kit.root.add(spin);
    kit.mesh(new THREE.DodecahedronGeometry(r, 0), kit.rock(COL.stone), spin);
    const veins = kit.mesh(new THREE.IcosahedronGeometry(r * 0.98, 0), kit.rock(COL.magma, COL.magma), spin);
    veins.rotation.set(0.6, 0.3, 0.9);
    const moss = kit.mesh(new THREE.DodecahedronGeometry(r * 0.5, 0), kit.rock(COL.moss), spin);
    moss.position.set(0, r * 0.62, 0); moss.scale.set(1.2, 0.5, 1.2);
    const halo = kit.mesh(new THREE.SphereGeometry(r * 1.35, 14, 10), kit.basic(COL.magma, 0.18, true));
    const streak = kit.mesh(new THREE.ConeGeometry(r * 0.85, 300, 10, 1, true), kit.basic(COL.accent, 0.22, true));
    streak.rotation.x = -Math.PI / 2; streak.position.z = -r - 140;
    const chipG = new THREE.DodecahedronGeometry(1, 0), chipM = kit.rock(COL.dark);
    const chips = [];
    for (let i = 0; i < 4; i++) { const c = kit.mesh(chipG, chipM); c.scale.setScalar(r * 0.18); chips.push(c); }
    const puffG = new THREE.IcosahedronGeometry(1, 0);
    const puffs = [];
    for (let i = 0; i < 6; i++) { const m = kit.basic(COL.accent, 0.45, false); puffs.push({ me: kit.mesh(puffG, m), m }); }
    return {
      object: kit.root,
      update(p) {
        const e = env(p, 0.06, 0.08);
        kit.fade(e);
        spin.rotation.x = p * 30;
        spin.rotation.z = Math.sin(p * 20) * 0.25;
        halo.scale.setScalar(1 + 0.12 * Math.sin(p * 50));
        for (let i = 0; i < chips.length; i++) {
          const a = p * 40 + i * TAU / 4;
          chips[i].position.set(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45, -r * 0.3);
          chips[i].rotation.set(p * 20, i, p * 15);
        }
        for (let i = 0; i < puffs.length; i++) {
          const ph = (p * 5 + i / puffs.length) % 1;
          const pf = puffs[i];
          pf.me.position.set(Math.sin(i * 3.1) * ph * 40, -r * 0.6 + Math.cos(i * 1.7) * ph * 25, -r - ph * 280);
          pf.me.scale.setScalar(r * (0.35 + ph * 0.75));
          pf.m.opacity = 0.45 * e * (1 - ph);
        }
      }
    };
  }

  // W — Piel de Piedra: lajas que emergen en anillo, cúpula de cuarzo y runa del equipo
  function fxW(THREE, ctx, info) {
    const kit = fxKit(THREE, info);
    const team = num(ctx && ctx.teamColor, 0x38a3ff);
    const line = kit.kind === 'line';
    const rr = kit.kind === 'projectile' ? kit.W * 0.6 : 125;
    const N = 8;
    const ring = new THREE.Group(); kit.root.add(ring);
    const slabG = new THREE.BoxGeometry(1, 1, 1); slabG.translate(0, 0.5, 0);
    const capG = new THREE.OctahedronGeometry(1, 0);
    const slabM = [kit.rock(COL.light), kit.rock(COL.stone)], capM = kit.rock(COL.accent, 0x6b5f3e);
    const slabs = [];
    for (let i = 0; i < N; i++) {
      const g = new THREE.Group(); ring.add(g);
      const a = i / N * TAU;
      if (line) g.position.set((i % 2 ? 1 : -1) * kit.W * 0.5, 0, (i + 0.5) / N * kit.L);
      else { g.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr); g.rotation.y = a; }
      const tilt = new THREE.Group(); g.add(tilt); tilt.rotation.x = line ? 0 : -0.28;
      const slab = kit.mesh(slabG, slabM[i % 2], tilt); slab.scale.set(56, 115 + (i % 3) * 14, 22);
      const cap = kit.mesh(capG, capM, tilt); cap.scale.set(12, 20, 8); cap.position.y = 125 + (i % 3) * 14;
      slabs.push({ g, tilt, d: i / N });
    }
    const domeG = new THREE.IcosahedronGeometry(rr * 1.05, 1);
    const dome = kit.mesh(domeG, kit.basic(COL.accent, 0.14, true));
    const wire = kit.mesh(domeG, new THREE.MeshBasicMaterial({ color: team, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false }));
    kit.mats.push({ m: wire.material, base: 0.4 });
    const rune = kit.mesh(new THREE.RingGeometry(rr * 0.9, rr * 1.18, 40), kit.basic(team, 0.6, true));
    rune.rotation.x = -Math.PI / 2; rune.position.y = 2;
    const pebG = new THREE.DodecahedronGeometry(1, 0), pebM = kit.rock(COL.stone);
    const pebs = [];
    for (let i = 0; i < 4; i++) { const m = kit.mesh(pebG, pebM); m.scale.setScalar(13 + i * 2); pebs.push(m); }
    if (line) { dome.visible = false; wire.visible = false; }
    return {
      object: kit.root,
      update(p) {
        const e = env(p, 0.06, 0.12);
        kit.fade(e);
        const fall = seg(p, 0.8, 1);
        for (let i = 0; i < slabs.length; i++) {
          const s = slabs[i];
          const rise = outBack(seg(p, s.d * 0.12, s.d * 0.12 + 0.2));
          s.g.position.y = lerp(-150, 0, rise) - fall * 90;
          s.tilt.rotation.z = fall * (i % 2 ? 0.5 : -0.5);
        }
        if (!line) ring.rotation.y = p * 1.2;
        const ds = Math.max(0.001, sm(seg(p, 0.12, 0.3)) * (1 + 0.04 * Math.sin(p * 40)) * (1 - fall * 0.3));
        dome.scale.set(ds, ds * 1.25, ds); dome.position.y = 20;
        wire.scale.copy(dome.scale); wire.position.y = 20; wire.rotation.y = -p * 2;
        const rs = 1 + 0.06 * Math.sin(p * 30);
        rune.scale.set(rs, rs, 1); rune.rotation.z = p * 2;
        for (let i = 0; i < pebs.length; i++) {
          const a = p * 9 + i * TAU / 4;
          pebs[i].position.set(Math.sin(a) * rr * 0.75, 70 + 45 * Math.sin(p * 12 + i * 1.6), Math.cos(a) * rr * 0.75 + (line ? kit.L * 0.5 : 0));
          pebs[i].rotation.set(p * 10, p * 7 + i, 0);
        }
      }
    };
  }

  // E — Temblor: onda expansiva, grietas de magma radiales, púas de roca y muro de polvo
  function fxE(THREE, ctx, info) {
    const kit = fxKit(THREE, info);
    const line = kit.kind === 'line';
    const R = kit.kind === 'projectile' ? kit.W * 0.9 : kit.R;
    const er = eruption(THREE, kit, { rings: 2, cracks: 10, spikes: 10, spikeH: 120, spikeR: 30, seed: 33 });
    const flash = kit.mesh(new THREE.CircleGeometry(1, 32), kit.basic(COL.eye, 0.85, true));
    flash.rotation.x = -Math.PI / 2; flash.position.y = 4;
    const dustM = kit.basic(COL.accent, 0.32, false);
    const dust = kit.mesh(new THREE.TorusGeometry(1, 0.16, 6, 28), dustM);
    dust.rotation.x = Math.PI / 2;
    if (line) dust.visible = false;
    return {
      object: kit.root,
      update(p) {
        const e = env(p, 0.03, 0.2);
        kit.fade(e); er(p, e);
        const f = seg(p, 0, 0.22);
        flash.scale.setScalar(Math.max(0.001, R * 0.4 * (0.4 + f)));
        flash.material.opacity = 0.85 * e * (1 - f);
        if (line) flash.position.z = kit.L * 0.05;
        const g = outQuad(seg(p, 0.02, 0.6));
        const ds = Math.max(0.001, R * lerp(0.25, 1.05, g));
        dust.scale.set(ds, ds, ds * 0.6);
        dust.position.y = 15 + 25 * g;
        dustM.opacity = 0.32 * e * (1 - seg(p, 0.35, 0.85));
      }
    };
  }

  // R — Avalancha: lluvia de peñascos, impacto con columna de polvo, cráter y corona de púas
  function fxR(THREE, ctx, info) {
    const kit = fxKit(THREE, info);
    const line = kit.kind === 'line';
    const R = kit.kind === 'projectile' ? kit.W * 0.9 : kit.R;
    const IMP = 0.3;
    const rand = rng(91);
    const crater = kit.mesh(new THREE.CircleGeometry(1, 40), kit.basic(COL.dark, 0.6, false));
    crater.rotation.x = -Math.PI / 2; crater.position.y = 1;
    const er = eruption(THREE, kit, { rings: 2, cracks: 6, spikes: 12, spikeH: 170, spikeR: 40, seed: 77, delay: IMP, tilt: 0.55 });
    const metG = new THREE.DodecahedronGeometry(1, 0);
    const mets = [];
    const metM = kit.rock(COL.stone), metM2 = kit.rock(COL.light);
    const main = new THREE.Group(); kit.root.add(main);
    kit.mesh(metG, metM, main);
    const core = kit.mesh(new THREE.IcosahedronGeometry(0.98, 0), kit.rock(COL.magma, COL.magma), main);
    core.rotation.set(0.5, 0.8, 0.2);
    mets.push({ g: main, x: 0, z: line ? kit.L * 0.5 : 0, s: R * 0.26, t0: 0, t1: IMP });
    for (let i = 0; i < 3; i++) {
      const L0 = layout(kit, i, 3, rand, R * 0.75);
      const m = kit.mesh(metG, metM2);
      mets.push({ g: m, x: L0.x, z: L0.z, s: R * 0.1, t0: 0.08 + i * 0.05, t1: IMP + 0.05 + i * 0.05 });
    }
    const flash = kit.mesh(new THREE.SphereGeometry(1, 16, 10), kit.basic(COL.magma, 0.8, true));
    const colM = kit.basic(COL.accent, 0.35, true);
    const colG = new THREE.CylinderGeometry(0.55, 1, 1, 18, 1, true); colG.translate(0, 0.5, 0);
    const column = kit.mesh(colG, colM);
    if (line) { flash.position.z = kit.L * 0.5; column.position.z = kit.L * 0.5; crater.position.z = kit.L * 0.5; }
    return {
      object: kit.root,
      update(p) {
        const e = env(p, 0.03, 0.15);
        kit.fade(e); er(p, e);
        for (let i = 0; i < mets.length; i++) {
          const m = mets[i];
          const f = seg(p, m.t0, m.t1);
          const alive = p < m.t1 + 0.05;
          const sc = alive ? m.s * (p < m.t1 ? Math.min(1, f * 4 + 0.2) : 1 - seg(p, m.t1, m.t1 + 0.05)) : 0;
          m.g.scale.setScalar(Math.max(0.001, sc));
          m.g.position.set(m.x, 750 * (1 - f * f) + m.s * 0.6, m.z);
          m.g.rotation.set(p * 14 + i, p * 9, p * 5);
        }
        const fi = seg(p, IMP, IMP + 0.18);
        const on = p >= IMP ? 1 : 0;
        flash.scale.setScalar(Math.max(0.001, on * R * (0.25 + 0.4 * fi)));
        flash.scale.y *= 0.5;
        flash.material.opacity = 0.8 * e * on * (1 - fi);
        const cs = Math.max(0.001, on * R * 0.75 * outQuad(seg(p, IMP, IMP + 0.08)));
        crater.scale.set(cs, line ? cs * 2 : cs, 1);
        const cg = seg(p, IMP, IMP + 0.35);
        column.scale.set(Math.max(0.001, R * (0.3 + 0.25 * cg)), Math.max(0.001, on * 550 * outQuad(cg)), Math.max(0.001, R * (0.3 + 0.25 * cg)));
        colM.opacity = 0.35 * e * on * (1 - seg(p, IMP + 0.1, IMP + 0.5));
      }
    };
  }

  MOBA.defineChampionArt('granito', {
    lore: 'Tallado por siglos de lluvia y martillo, Granito despertó cuando dinamitaron su cantera; desde entonces se planta delante de quien no sabe aguantar.',
    quote: '¿Me querés mover? Traé una grúa, pibe.',
    build,
    fx: { Q: fxQ, W: fxW, E: fxE, R: fxR }
  });
})();
