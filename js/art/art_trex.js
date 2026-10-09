/* Arte procedural: T-Rex, el Rey del Cretácico (dinosaurio de juguete con mucha actitud) */
(function () {
  'use strict';

  const GREEN = 0x5f8f3a, ACCENT = 0xffcf4a;
  const DARK = 0x3a5c22, BELLY = 0xf2dc8a, BONE = 0xfff4d6, GUM = 0xd94c5a, MOUTH = 0x5a1420, DUST = 0xc9a46a;

  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = cl(x); return x * x * (3 - 2 * x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function seeded(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // envolvente: aparece hasta a, se desvanece desde b
  function env(p, a, b) { return Math.min(cl(p / Math.max(a, 1e-4)), 1 - cl((p - b) / Math.max(1 - b, 1e-4))); }

  function fxMat(THREE, color, add, op) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: op == null ? 1 : op, depthWrite: false,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide
    });
  }

  // ------------------------------------------------------------------ modelo
  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache;
    const team = ctx.teamColor != null ? ctx.teamColor : 0x38a3ff;
    const M = function (c, o) { return cache ? cache.mat(c, o) : new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true }, o || {})); };
    const G = function (k, f) { return cache ? cache.geo('trex_' + k, f) : f(); };
    const sphere = G('sph', function () { return new THREE.SphereGeometry(1, 12, 9); });
    const boxG = G('box', function () { return new THREE.BoxGeometry(1, 1, 1); });
    const coneG = G('cone', function () { return new THREE.ConeGeometry(1, 1, 6); });

    function mesh(geo, mat, parent, pos, scl, rot) {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (scl) m.scale.set(scl[0], scl[1], scl[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(m);
      return m;
    }
    function group(parent, pos) { const g = new THREE.Group(); if (pos) g.position.set(pos[0], pos[1], pos[2]); parent.add(g); return g; }

    const mGreen = M(GREEN), mDark = M(DARK), mBelly = M(BELLY), mAcc = M(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.15 });
    const mBone = M(BONE), mGum = M(GUM), mMouth = M(MOUTH), mTeam = M(team, { emissive: team, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.5 });
    // materiales propios (se animan con la furia)
    const mEye = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.4, emissive: 0xff2a00, emissiveIntensity: 0 });
    const mPupil = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true, roughness: 0.3, emissive: 0xff0000, emissiveIntensity: 0 });

    const root = new THREE.Group();
    const rig = group(root);

    // --- patas poderosas
    const legs = [];
    [-1, 1].forEach(function (s) {
      const hip = group(rig, [s * 40, 118, -5]);
      mesh(sphere, mGreen, hip, [s * 3, -18, 4], [30, 44, 40]);
      const knee = group(hip, [0, -50, 8]);
      mesh(G('shin', function () { return new THREE.CapsuleGeometry(15, 36, 3, 8); }), mDark, knee, [0, -30, -6], null, [0.197, 0, 0]);
      const foot = group(knee, [0, -60, -12]);
      mesh(boxG, mGreen, foot, [0, 0, 16], [36, 16, 60]);
      mesh(coneG, mBone, foot, [0, 0, 52], [16, 22, 7], [Math.PI / 2, 0, 0]);
      legs.push({ hip: hip, knee: knee, foot: foot });
    });

    // --- cuerpo inclinado hacia adelante
    const body = group(rig, [0, 118, 0]);
    const torso = mesh(sphere, mGreen, body, [0, 40, 0], [58, 58, 82]);
    const belly = mesh(sphere, mBelly, body, [0, 18, 34], [44, 46, 56]);
    [[0, 97, 18, -0.2, 1.15], [0, 93, -18, -0.45, 1.0], [0, 80, -50, -0.75, 0.85]].forEach(function (p) {
      mesh(coneG, mAcc, body, [p[0], p[1], p[2]], [7 * p[4], 34 * p[4], 18 * p[4]], [p[3], 0, 0]);
    });
    mesh(G('neck', function () { return new THREE.CapsuleGeometry(30, 30, 3, 10); }), mGreen, body, [0, 68, 58], null, [0.7, 0, 0]);
    mesh(G('collar', function () { return new THREE.TorusGeometry(33, 9, 6, 16); }), mTeam, body, [0, 64, 56], null, [0.7 - Math.PI / 2, 0, 0]);

    // --- cabezota
    const head = group(body, [0, 88, 70]);
    mesh(boxG, mGreen, head, [0, 22, 22], [82, 66, 78]);
    mesh(boxG, mGreen, head, [0, 12, 84], [70, 42, 64]);
    mesh(boxG, mMouth, head, [0, -6, 70], [58, 12, 66]);
    const eyes = [], pupils = [];
    [-1, 1].forEach(function (s) {
      eyes.push(mesh(sphere, mEye, head, [s * 37, 50, 30], [16, 16, 16]));
      pupils.push(mesh(sphere, mPupil, head, [s * 46, 53, 38], [8, 9, 8]));
      mesh(boxG, mDark, head, [s * 33, 66, 34], [34, 9, 16], [0, 0, s * 0.38]);
      [70, 102].forEach(function (z) { mesh(coneG, mBone, head, [s * 30, -14, z], [6, 16, 6], [Math.PI, 0, 0]); });
    });
    const jaw = group(head, [0, -6, 14]);
    mesh(boxG, mGreen, jaw, [0, -10, 52], [62, 18, 100]);
    mesh(boxG, mBelly, jaw, [0, -19, 46], [52, 4, 86]);
    [[-22, 80], [22, 80], [0, 98]].forEach(function (p) { mesh(coneG, mBone, jaw, [p[0], 6, p[1]], [5, 14, 5]); });
    const tongue = mesh(sphere, mGum, jaw, [0, 1, 46], [20, 5, 34]);

    // --- bracitos cómicos
    const arms = [];
    [-1, 1].forEach(function (s) {
      const a = group(body, [s * 36, 28, 66]);
      mesh(G('arm', function () { return new THREE.CapsuleGeometry(7, 16, 2, 6); }), mGreen, a, [0, -9, 8], null, [0.9, 0, 0]);
      mesh(coneG, mBone, a, [0, -16, 20], [6, 12, 6], [2.2, 0, 0]);
      arms.push(a);
    });

    // --- cola larga de contrapeso
    const tails = [];
    const t1 = group(body, [0, 36, -66]);
    mesh(G('tail1', function () { const g = new THREE.CylinderGeometry(25, 40, 78, 9); g.rotateX(-Math.PI / 2); return g; }), mGreen, t1, [0, 0, -34]);
    const t2 = group(t1, [0, 0, -70]);
    mesh(G('tail2', function () { const g = new THREE.CylinderGeometry(14, 25, 64, 8); g.rotateX(-Math.PI / 2); return g; }), mGreen, t2, [0, 0, -30]);
    mesh(coneG, mAcc, t2, [0, 18, -24], [5, 24, 14], [-1.0, 0, 0]);
    const t3 = group(t2, [0, 0, -60]);
    mesh(G('tail3', function () { const g = new THREE.ConeGeometry(14, 56, 8); g.rotateX(-Math.PI / 2); return g; }), mDark, t3, [0, 0, -26]);
    tails.push(t1, t2, t3);

    // --- vapor de furia (fosas nasales) y anillo de recall
    const steam = [];
    [-1, 1].forEach(function (s) {
      const m = mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), head, [s * 18, 34, 112], [10, 10, 10]);
      m.visible = false;
      steam.push(m);
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = mesh(G('ring', function () { return new THREE.TorusGeometry(95, 5, 4, 28); }), ringMat, root, [0, 4, 0], null, [-Math.PI / 2, 0, 0]);
    ring.visible = false;

    const torsoS = torso.scale.clone(), bellyS = belly.scale.clone();
    let rage = 0;

    function update(st) {
      st = st || {};
      const time = st.time || 0, anim = st.anim || 'idle', t = st.t || 0, dt = Math.min(st.dt || 0.016, 0.1);
      const p = cl(st.progress || 0), slot = st.slot | 0;
      if (anim === 'cast' && slot === 3) rage = 1; else rage = Math.max(0, rage - dt / 8);
      if (anim === 'dead') rage = 0;

      // pose base
      let bodyRx = 0.12, bodyRz = 0, bodyY = 0, bodyZ = 0, headRx = 0, headRy = 0, headRz = 0, jawO = 0.06;
      let armRx = 0, armFlap = 0.05, armFreq = 2, armRz = 0, tailRx = 0, tailAmp = 0.08, tailFreq = 1.2;
      let rigY = 0, rigX = 0, rigRz = 0, rigS = 1, eyeS = 1, pupilS = 1, breath = 1 + Math.sin(time * 2.2) * 0.025, tongueZ = 0;
      const lg = [{ h: 0, k: 0, f: 0 }, { h: 0, k: 0, f: 0 }];
      let ringOn = false;
      const blink = ((time + 0.7) % 3.7) < 0.12;

      if (anim === 'idle') {
        bodyY = Math.sin(time * 2.2) * 2;
        headRx = Math.sin(time * 1.1) * 0.06;
        headRy = Math.sin(time * 0.45) * 0.25;
        jawO = 0.06 + Math.max(0, Math.sin(time * 0.9)) * 0.12;
        // cada tanto agita los bracitos, indignado
        const fl = sm((Math.sin(time * 0.6) - 0.7) * 4);
        armFlap = 0.08 + fl * 0.7; armFreq = 2 + fl * 16;
        tailAmp = 0.14; tailFreq = 1.4;
        if (blink) eyeS = 0.15;
      } else if (anim === 'walk') {
        const sp = Math.max(0.4, (st.speed || 340) / 340);
        const ph = time * sp * 7.5;
        for (let i = 0; i < 2; i++) {
          const q = ph + i * Math.PI;
          const h = Math.sin(q) * 0.55, k = 0.1 + Math.max(0, -Math.cos(q)) * 0.85;
          lg[i].h = h; lg[i].k = k; lg[i].f = -(h + k) + Math.max(0, -Math.cos(q)) * 0.3;
        }
        bodyY = Math.abs(Math.cos(ph)) * 7 - 3;
        bodyRz = Math.sin(ph) * 0.07;
        bodyRx = 0.18;
        headRx = Math.sin(ph * 2) * 0.07 - 0.05;
        headRy = -Math.sin(ph) * 0.12;
        jawO = 0.12 + Math.sin(ph * 2) * 0.06;
        armFlap = 0.55; armFreq = sp * 15; armRx = -0.3;
        tailAmp = 0.22; tailFreq = sp * 7.5 / 2;
        if (blink) eyeS = 0.15;
      } else if (anim === 'attack') {
        // anticipación: se echa atrás con la boca abierta; golpe: mordiscón hacia adelante
        const w = sm(p / 0.5), s = sm((p - 0.5) / 0.14), r = sm((p - 0.68) / 0.32);
        const k = p < 0.5 ? w : p < 0.68 ? 1 - s : 0;
        bodyRx = lerp(lerp(0.12, -0.15, w), 0.5, s) * (1 - r) + 0.12 * r;
        bodyZ = (lerp(-18 * w, 40, s)) * (1 - r);
        headRx = (lerp(-0.45 * w, 0.25, s)) * (1 - r);
        jawO = 0.06 + 0.85 * k;
        armRx = -0.9 * w * (1 - r); armFlap = 0.3 * w; armFreq = 20;
        lg[0].h = -0.2 * (s * (1 - r)); lg[1].h = 0.3 * s * (1 - r);
        tailRx = 0.25 * w * (1 - r) - 0.15 * s * (1 - r);
      } else if (anim === 'cast') {
        if (slot === 0) {
          // Mordisco: lunge enorme + sacudida de perro
          const w = sm(p / 0.35), s = sm((p - 0.35) / 0.12), r = sm((p - 0.75) / 0.25);
          bodyRx = lerp(lerp(0.12, -0.25, w), 0.55, s) * (1 - r) + 0.12 * r;
          bodyZ = lerp(-20 * w, 55, s) * (1 - r);
          headRx = lerp(-0.6 * w, 0.3, s) * (1 - r);
          jawO = p < 0.35 ? 0.06 + 1.0 * w : 0.06 + 1.0 * (1 - s);
          headRz = p > 0.47 ? Math.sin(time * 45) * 0.35 * (1 - r) : 0;
          headRy = p > 0.47 ? Math.sin(time * 45 + 1) * 0.2 * (1 - r) : 0;
          armFlap = 0.6; armFreq = 22; armRx = -0.8;
          tailAmp = 0.3; tailFreq = 6;
        } else if (slot === 1) {
          // Rugido: se echa atrás mirando arriba y ruge hacia adelante, vibrando
          const w = sm(p / 0.3), s = sm((p - 0.3) / 0.15), r = sm((p - 0.85) / 0.15);
          bodyRx = lerp(lerp(0.12, -0.3, w), 0.25, s) * (1 - r) + 0.12 * r;
          headRx = lerp(-0.7 * w, -0.1, s) * (1 - r);
          jawO = 0.06 + (0.6 * w + 0.6 * s) * (1 - r);
          const vib = p > 0.3 ? Math.sin(time * 70) * 0.04 * (1 - r) : 0;
          bodyRz = vib; headRz = vib * 2;
          armRz = 0.9 * s * (1 - r); armRx = -1.2 * s * (1 - r); armFlap = 0.2; armFreq = 30;
          tailRx = 0.35 * s * (1 - r); tailAmp = 0.1;
          lg[0].h = -0.25 * s * (1 - r); lg[0].f = 0.25 * s * (1 - r);
          if (p > 0.3) eyeS = 1.25;
        } else if (slot === 2) {
          // Embestida: cabeza gacha como ariete y patas a todo trapo
          const w = sm(p / 0.2) * (1 - sm((p - 0.85) / 0.15));
          const ph = time * 16;
          for (let i = 0; i < 2; i++) {
            const q = ph + i * Math.PI;
            lg[i].h = Math.sin(q) * 0.75 * w; lg[i].k = (0.1 + Math.max(0, -Math.cos(q))) * w; lg[i].f = -(lg[i].h + lg[i].k);
          }
          bodyRx = lerp(0.12, 0.42, w); bodyY = -10 * w + Math.abs(Math.cos(ph)) * 8 * w;
          headRx = 0.3 * w; jawO = 0.06 + 0.3 * w;
          armRx = -1.3 * w; armFlap = 0.15; armFreq = 30;
          tailRx = 0.3 * w; tailAmp = 0.12; tailFreq = 8;
        } else {
          // FURIA JURÁSICA: se para en dos patas, crece, ruge al cielo y aplasta el piso
          const up = sm(p / 0.3), slam = sm((p - 0.5) / 0.1), r = sm((p - 0.85) / 0.15);
          const shake = Math.sin(time * 60) * 0.05;
          bodyRx = lerp(lerp(0.12, -0.7, up), 0.45, slam) * (1 - r) + 0.12 * r + shake * (1 - r);
          bodyY = lerp(25 * up, -12, slam) * (1 - r);
          headRx = lerp(-0.9 * up, 0.15, slam) * (1 - r);
          jawO = 0.06 + 1.1 * Math.max(up * (1 - slam * 0.5), 0) * (1 - r);
          headRz = shake * 2 * (1 - r);
          armFlap = 0.9 * (1 - r); armFreq = 34; armRz = 0.6 * up * (1 - r);
          tailRx = lerp(0.25 * up, 0.4, slam) * (1 - r); tailAmp = 0.35; tailFreq = 9;
          rigS = 1 + 0.28 * sm(p / 0.45) * (1 - r);
          lg[0].h = lerp(0.3 * up, -0.5, slam) * (1 - r); lg[1].h = 0.3 * up * (1 - r);
          lg[0].k = 0.2 * slam * (1 - r);
          lg[0].f = -(lg[0].h + lg[0].k); lg[1].f = -lg[1].h;
          eyeS = 1.3;
        }
      } else if (anim === 'recall') {
        // siestita prehistórica: se echa, cierra los ojos y cabecea
        const k = sm(t / 0.5);
        for (let i = 0; i < 2; i++) { lg[i].h = -0.55 * k; lg[i].k = 1.1 * k; lg[i].f = -0.55 * k; }
        rigY = -16 * k;
        bodyRx = lerp(0.12, 0.05, k);
        headRx = (0.3 + Math.sin(time * 1.6) * 0.12) * k;
        jawO = 0.04 + Math.max(0, Math.sin(time * 1.6)) * 0.15 * k;
        eyeS = lerp(1, 0.12, k);
        armFlap = 0.03; tailAmp = 0.05; tailFreq = 0.8;
        breath = 1 + Math.sin(time * 1.6) * 0.05;
        ringOn = true;
      } else if (anim === 'dead') {
        // panza arriba de costado, patas tiesas, lengua afuera
        const k = sm(t / 0.55);
        const b = Math.sin(cl((t - 0.55) / 0.3) * Math.PI) * 0.06;
        rigRz = 1.5 * k - b;
        rigY = 68 * k; rigX = 70 * k;
        for (let i = 0; i < 2; i++) { lg[i].h = (i ? 0.35 : -0.25) * k; lg[i].k = 0.1; lg[i].f = -0.4 * k; }
        bodyRx = lerp(0.12, 0.0, k);
        headRx = 0.1 * k; headRz = -0.2 * k;
        jawO = 0.06 + 0.6 * k; tongueZ = 1 * k;
        armRx = -1.2 * k; armFlap = 0; armRz = 0.5 * k;
        tailAmp = 0; tailRx = -0.1 * k;
        pupilS = 1 - 0.85 * k; eyeS = 1;
        breath = 1;
      }

      // aplicar
      rig.position.set(rigX, rigY, 0);
      rig.rotation.set(0, 0, rigRz);
      rig.scale.setScalar(rigS);
      body.position.set(0, 118 + bodyY, bodyZ);
      body.rotation.set(bodyRx, 0, bodyRz);
      torso.scale.set(torsoS.x * breath, torsoS.y * breath, torsoS.z);
      belly.scale.set(bellyS.x * breath, bellyS.y * breath, bellyS.z * breath);
      head.rotation.set(headRx, headRy, headRz);
      jaw.rotation.x = jawO;
      tongue.position.z = 46 + tongueZ * 34;
      tongue.position.y = 1 - tongueZ * 6;
      for (let i = 0; i < 2; i++) {
        const sgn = i ? 1 : -1;
        const a = arms[i];
        a.rotation.x = armRx + armFlap * Math.sin(time * armFreq + i * Math.PI);
        a.rotation.z = sgn * (armRz + 0.15);
        legs[i].hip.rotation.x = lg[i].h;
        legs[i].knee.rotation.x = lg[i].k;
        legs[i].foot.rotation.x = lg[i].f;
        eyes[i].scale.set(16, 16 * Math.max(0.12, eyeS > 1 ? 1 : eyeS), 16);
        const ps = pupilS * (eyeS > 1 ? eyeS : 1) * (1 + rage * 0.35);
        pupils[i].scale.set(8 * ps, 9 * ps * (eyeS < 1 ? Math.max(0.1, eyeS) : 1), 8 * ps);
      }
      for (let i = 0; i < 3; i++) {
        tails[i].rotation.x = (i === 0 ? tailRx : tailRx * 0.3) + (anim === 'dead' ? 0 : Math.sin(time * 1.3 - i) * 0.03);
        tails[i].rotation.y = tailAmp * Math.sin(time * tailFreq - i * 0.7) * (1 + i * 0.4);
      }
      // furia: ojos rojos y vapor por la nariz
      mPupil.color.setHex(rage > 0.05 ? 0xff1a00 : 0x111111);
      mPupil.emissiveIntensity = rage * 2.2;
      mEye.emissiveIntensity = rage * 0.5;
      for (let i = 0; i < 2; i++) {
        const sm2 = steam[i];
        if (rage > 0.02) {
          const c = (time * 1.6 + i * 0.5) % 1;
          sm2.visible = true;
          sm2.position.set((i ? 18 : -18) * (1 + c), 34 + c * 45, 112 + c * 20);
          sm2.scale.setScalar(7 + c * 22);
          sm2.material.opacity = (1 - c) * 0.65 * Math.min(1, rage * 3);
        } else sm2.visible = false;
      }
      ring.visible = ringOn;
      if (ringOn) {
        ring.rotation.z = time * 2;
        ring.scale.setScalar(1 + Math.sin(time * 4) * 0.06);
        ringMat.opacity = 0.45 + Math.sin(time * 4) * 0.25;
      }
    }

    update({ anim: 'idle', time: 0 });
    return { object: root, update: update };
  }

  // ------------------------------------------------------------------ FX
  // Q — Mordisco: mandíbulas gigantes de energía que se cierran sobre el objetivo (+ chispas de cura)
  function fxQ(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'target';
    const root = new THREE.Group(), anchor = new THREE.Group();
    root.add(anchor);
    const Rj = Math.max(70, Math.min(150, (info.radius || 120) * 0.55));
    if (kind === 'line') anchor.position.z = (info.length || 600) * 0.75;
    if (kind === 'cone') anchor.position.z = (info.length || 400) * 0.5;
    const mats = [];
    const mk = function (c, add, op) { const m = fxMat(THREE, c, add, op); mats.push([m, op == null ? 1 : op]); return m; };
    const mArc = mk(ACCENT, true, 0.9), mTooth = mk(BONE, false, 1), mFlash = mk(0xff3b3b, true, 0.8), mRing = mk(0xff6a3d, true, 0.8), mHeal = mk(0x7dff6a, true, 1);
    const arcG = new THREE.TorusGeometry(Rj, Rj * 0.09, 5, 16, Math.PI);
    const toothG = new THREE.ConeGeometry(Rj * 0.1, Rj * 0.42, 5);
    const halves = [];
    [-1, 1].forEach(function (s) {
      const hg = new THREE.Group();
      const piv = new THREE.Group();
      piv.rotation.y = -s * Math.PI / 2;
      hg.add(piv);
      const arc = new THREE.Mesh(arcG, mArc);
      arc.rotation.x = -Math.PI / 2;
      piv.add(arc);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * ((i + (s > 0 ? 0.5 : 1)) / 5.5);
        const tooth = new THREE.Mesh(toothG, mTooth);
        tooth.position.set(Math.cos(a) * Rj * 0.92, 6, -Math.sin(a) * Rj * 0.92);
        tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(a), 0.45, Math.sin(a)).normalize());
        piv.add(tooth);
      }
      anchor.add(hg);
      halves.push({ g: hg, s: s });
    });
    const flash = new THREE.Mesh(new THREE.CircleGeometry(Rj, 20), mFlash);
    flash.rotation.x = -Math.PI / 2; flash.position.y = 3;
    anchor.add(flash);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), mRing);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 4;
    anchor.add(ring);
    const heals = [];
    const hg2 = new THREE.OctahedronGeometry(12, 0);
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(hg2, mHeal);
      h.scale.set(0.7, 1.6, 0.7);
      anchor.add(h);
      heals.push(h);
    }
    function update(p) {
      p = cl(p);
      const cyc = kind === 'projectile' ? (p * 3) % 1 : p;
      const open = sm(cyc / 0.35), snap = sm((cyc - 0.35) / 0.1);
      const gap = Rj * 0.85 * open * (1 - snap);
      const fadeAll = kind === 'projectile' ? env(p, 0.08, 0.85) : 1 - sm((p - 0.72) / 0.28);
      halves.forEach(function (h) {
        h.g.position.set(h.s * gap, 20 + 50 * open * (1 - snap) + 10 * snap, 0);
        h.g.rotation.z = h.s * 0.7 * open * (1 - snap);
        const sh = cyc > 0.45 && cyc < 0.65 ? Math.sin(cyc * 140) * 6 : 0;
        h.g.position.x += sh;
      });
      const hit = cyc > 0.43 ? 1 - sm((cyc - 0.43) / 0.35) : 0;
      flash.scale.setScalar(0.3 + 0.9 * (1 - hit) * (cyc > 0.43 ? 1 : 0) + 0.2);
      mFlash.opacity = 0.75 * hit * fadeAll;
      const rq = cl((cyc - 0.43) / 0.4);
      ring.scale.setScalar(Rj * (0.6 + rq * 1.3));
      mRing.opacity = (cyc > 0.43 ? 1 - rq : 0) * 0.9 * fadeAll;
      mArc.opacity = 0.9 * fadeAll * Math.min(1, cyc / 0.1 + (kind === 'projectile' ? 1 : 0));
      mTooth.opacity = fadeAll * Math.min(1, cyc / 0.1 + (kind === 'projectile' ? 1 : 0));
      const hq = cl((p - 0.45) / 0.5);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + hq * 3;
        heals[i].position.set(Math.cos(a) * Rj * 0.5 * (1 - hq * 0.5), 30 + hq * 170 + i * 8, Math.sin(a) * Rj * 0.5 * (1 - hq * 0.5));
        heals[i].rotation.y = hq * 8;
      }
      mHeal.opacity = (p > 0.45 ? env(hq, 0.15, 0.6) : 0) * 0.95;
    }
    update(0);
    return { object: root, update: update };
  }

  // W — Rugido Ancestral: ondas sonoras concéntricas y esquirlas de rugido
  function fxW(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'self';
    const dir = kind === 'projectile' || kind === 'line' || kind === 'cone';
    const R = info.radius || 300, L = info.length || 600, W = info.width || 140;
    const root = new THREE.Group();
    const ringG = new THREE.TorusGeometry(1, 0.05, 4, 40);
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const m = fxMat(THREE, i % 2 ? 0xffffff : ACCENT, true, 0.9);
      const r = new THREE.Mesh(ringG, m);
      if (!dir) r.rotation.x = -Math.PI / 2;
      root.add(r);
      rings.push(r);
    }
    const gMat = fxMat(THREE, 0xff8a3d, true, 0.5);
    const ground = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 36), gMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = 3;
    root.add(ground);
    const shardMat = fxMat(THREE, 0xfff1b0, true, 0.95);
    const shardG = new THREE.OctahedronGeometry(1, 0);
    const shards = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(shardG, shardMat);
      root.add(s);
      shards.push(s);
    }
    function update(p) {
      p = cl(p);
      const fade = 1 - sm((p - 0.75) / 0.25);
      for (let i = 0; i < 4; i++) {
        const q = cl(p * 1.5 - i * 0.16);
        const r = rings[i];
        r.visible = q > 0 && q < 1;
        if (dir) {
          const len = kind === 'projectile' ? 0 : L;
          r.position.set(0, 90, kind === 'projectile' ? -q * 120 : q * len);
          const sz = kind === 'cone' ? 40 + q * L * Math.tan(((info.angle || 50) * Math.PI / 180) / 2) : 30 + q * W * 0.7;
          r.scale.set(sz, sz * 0.7, sz);
          r.rotation.set(0, 0, 0);
        } else {
          const sz = 30 + q * R;
          r.position.set(0, 40 + i * 28 + q * 20, 0);
          r.scale.set(sz, sz, sz * (1 + 4 * (1 - q)));
        }
        r.material.opacity = (1 - q) * 0.95 * fade;
      }
      const gq = sm(p / 0.5);
      if (dir) { ground.position.z = kind === 'projectile' ? 0 : L * 0.5 * gq; ground.scale.setScalar(20 + W * 0.6 * gq); }
      else ground.scale.setScalar(20 + R * gq);
      gMat.opacity = 0.55 * (1 - gq * 0.6) * fade;
      for (let i = 0; i < 8; i++) {
        const q = sm(cl(p * 1.4 - (i % 2) * 0.12));
        const s = shards[i];
        if (dir) {
          const off = (i - 3.5) / 3.5;
          const ln = kind === 'projectile' ? 140 : L;
          s.position.set(off * W * 0.5 * q, 70 + (i % 3) * 25, q * ln * (0.6 + 0.4 * (i % 2)));
          s.rotation.set(0, 0, 0);
        } else {
          const a = i * Math.PI / 4 + 0.3;
          const d = 40 + q * R * 0.95;
          s.position.set(Math.sin(a) * d, 70 + (i % 2) * 40, Math.cos(a) * d);
          s.rotation.set(0, a, 0);
        }
        s.scale.set(7, 7, 34 * (1 - q * 0.5));
      }
      shardMat.opacity = env(p, 0.08, 0.55) * 0.95;
    }
    update(0);
    return { object: root, update: update };
  }

  // E — Embestida: nube de polvo, líneas de velocidad y una huella de tres dedos
  function fxE(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'dash';
    const R = Math.max(80, info.radius || 150), L = info.length || 600;
    const along = kind === 'line' || kind === 'cone';
    const root = new THREE.Group();
    const rnd = seeded(77);
    const puffG = new THREE.DodecahedronGeometry(1, 0);
    const puffs = [];
    for (let i = 0; i < 12; i++) {
      const m = fxMat(THREE, i % 3 ? DUST : 0xe8d3a8, false, 0.8);
      const mesh = new THREE.Mesh(puffG, m);
      const a = kind === 'dash' ? Math.PI + (rnd() - 0.5) * 2.6 : rnd() * Math.PI * 2;
      puffs.push({ m: mesh, a: a, d: 0.45 + rnd() * 0.6, s: 0.6 + rnd() * 0.6, z: rnd(), rot: rnd() * 6, up: 20 + rnd() * 50 });
      root.add(mesh);
    }
    const streakMat = fxMat(THREE, 0xfff2d0, true, 0.7);
    const streakG = new THREE.BoxGeometry(5, 3, 1);
    const streaks = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(streakG, streakMat);
      root.add(s);
      streaks.push(s);
    }
    const printMat = fxMat(THREE, 0x4a3520, false, 0.7);
    const fp = new THREE.Group();
    fp.position.y = 2;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 14), printMat);
    pad.rotation.x = -Math.PI / 2; pad.scale.set(26, 30, 1);
    fp.add(pad);
    const toeG = new THREE.ConeGeometry(9, 50, 4);
    [-0.5, 0, 0.5].forEach(function (a) {
      const toe = new THREE.Mesh(toeG, printMat);
      toe.scale.set(1, 1, 0.15);
      toe.rotation.set(-Math.PI / 2, 0, 0);
      const holder = new THREE.Group();
      holder.rotation.y = a;
      toe.position.set(0, 0, 44);
      holder.add(toe);
      fp.add(holder);
    });
    fp.scale.setScalar(R / 150);
    root.add(fp);
    const crackMat = fxMat(THREE, DUST, false, 0.6);
    const crack = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 24), crackMat);
    crack.rotation.x = -Math.PI / 2; crack.position.y = 2;
    root.add(crack);
    if (along) { fp.position.z = L; crack.position.z = L; }

    function update(p) {
      p = cl(p);
      const q = sm(p / 0.6);
      for (let i = 0; i < puffs.length; i++) {
        const P = puffs[i];
        const sz = (12 + q * 30) * P.s * Math.min(1.6, R / 200 + 0.5);
        if (along) P.m.position.set(Math.cos(P.a) * (20 + q * 60), sz * 0.9 + q * P.up, P.z * L);
        else if (kind === 'projectile') P.m.position.set(Math.cos(P.a) * q * 50, sz * 0.9 + q * P.up * 0.6, Math.sin(P.a) * q * 50 - q * 60);
        else P.m.position.set(Math.sin(P.a) * P.d * R * (0.3 + q), sz * 0.9 + q * P.up, Math.cos(P.a) * P.d * R * (0.3 + q));
        P.m.scale.setScalar(sz);
        P.m.rotation.set(P.rot + p * 2, P.rot, 0);
        P.m.material.opacity = 0.8 * env(p, 0.06, 0.45);
      }
      for (let i = 0; i < 4; i++) {
        const s = streaks[i];
        const len = along ? L * 0.5 : R * 1.4;
        s.scale.set(1, 1, len * (0.5 + 0.5 * sm(p / 0.2)));
        s.position.set((i - 1.5) * 26, 25 + (i % 2) * 30, along ? L * (0.3 + p * 0.5) : -len * 0.5 - p * R);
      }
      streakMat.opacity = 0.7 * env(p, 0.05, 0.3);
      printMat.opacity = 0.7 * env(p, 0.08, 0.6);
      crack.scale.setScalar(R * (0.4 + 0.9 * sm(p / 0.4)));
      crackMat.opacity = 0.6 * (1 - sm(p / 0.7));
    }
    update(0);
    return { object: root, update: update };
  }

  // R — Furia Jurásica: pisotón sísmico, grietas incandescentes, rocas volando y columna de vapor
  function fxR(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'self';
    const R = info.radius || 400;
    const dur = Math.max(0.3, info.duration || 1);
    const root = new THREE.Group(), anchor = new THREE.Group();
    root.add(anchor);
    if (kind === 'line' || kind === 'cone') anchor.position.z = (info.length || 600) * 0.5;
    const rnd = seeded(1337);

    const domeMat = fxMat(THREE, 0xff3a1a, true, 0.5);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    anchor.add(dome);
    const ringMats = [fxMat(THREE, 0xff5a1f, true, 0.9), fxMat(THREE, ACCENT, true, 0.9)];
    const shock = ringMats.map(function (m, i) {
      const r = new THREE.Mesh(new THREE.RingGeometry(i ? 0.9 : 0.8, 1, 40), m);
      r.rotation.x = -Math.PI / 2; r.position.y = 3 + i;
      anchor.add(r);
      return r;
    });
    const crackMat = fxMat(THREE, 0xff6a1a, true, 1);
    const crackG = new THREE.BoxGeometry(1, 1, 1);
    const cracks = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.rotation.y = i * Math.PI / 4 + rnd() * 0.4;
      const c = new THREE.Mesh(crackG, crackMat);
      c.rotation.y = (rnd() - 0.5) * 0.4;
      g.add(c);
      anchor.add(g);
      cracks.push({ c: c, len: 0.55 + rnd() * 0.35 });
    }
    const rockMat = fxMat(THREE, 0x6b4a33, false, 1);
    const rockG = new THREE.DodecahedronGeometry(1, 0);
    const rocks = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(rockG, rockMat);
      anchor.add(m);
      rocks.push({ m: m, a: i * Math.PI / 4 + rnd() * 0.5, d: 0.35 + rnd() * 0.45, h: 120 + rnd() * 160, s: 10 + rnd() * 12 });
    }
    const steam = [];
    for (let i = 0; i < 5; i++) {
      const m = fxMat(THREE, 0xffffff, false, 0.5);
      const s = new THREE.Mesh(rockG, m);
      anchor.add(s);
      steam.push({ m: s, a: rnd() * 6.28, o: i / 5 });
    }
    const pillarMat = fxMat(THREE, 0xff2a00, true, 0.6);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(70, 110, 420, 16, 1, true), pillarMat);
    pillar.position.y = 210;
    anchor.add(pillar);
    const auraMat = fxMat(THREE, 0xff3a1a, true, 0.5);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(110, 7, 4, 30), auraMat);
    aura.rotation.x = -Math.PI / 2; aura.position.y = 6;
    anchor.add(aura);

    function update(p) {
      p = cl(p);
      const T = p * dur;
      const e = cl(T / Math.min(dur, 1.2));
      const endFade = 1 - sm((p - 0.85) / 0.15);
      const slam = sm(e / 0.25);
      dome.scale.set(R * slam, R * 0.45 * slam, R * slam);
      domeMat.opacity = 0.45 * (1 - sm(e / 0.55));
      shock.forEach(function (r, i) {
        const q = sm(cl((e - i * 0.1) / 0.6));
        r.scale.setScalar(Math.max(1, R * q));
        r.material.opacity = 0.9 * (1 - q) * (e > i * 0.1 ? 1 : 0);
      });
      for (let i = 0; i < 8; i++) {
        const c = cracks[i];
        const q = sm(cl(e / 0.3));
        const len = R * c.len * q;
        c.c.scale.set(14, 4, Math.max(1, len));
        c.c.position.set(0, 2, 20 + len * 0.5);
      }
      crackMat.opacity = (1 - sm((e - 0.5) / 0.5)) * (0.6 + 0.4 * Math.sin(T * 30));
      for (let i = 0; i < 8; i++) {
        const k = rocks[i];
        const q = cl((e - 0.08) / 0.7);
        const d = R * k.d * (0.2 + q);
        k.m.position.set(Math.sin(k.a) * d, k.s + Math.max(0, 4 * k.h * q * (1 - q)), Math.cos(k.a) * d);
        k.m.rotation.set(q * 9, q * 7, 0);
        k.m.scale.setScalar(k.s * (q > 0 && q < 1 ? 1 : 0.001));
      }
      rockMat.opacity = 1 - sm((e - 0.75) / 0.25);
      for (let i = 0; i < steam.length; i++) {
        const S = steam[i];
        const c = (T * 0.9 + S.o) % 1;
        S.m.position.set(Math.cos(S.a + c) * 45, 150 + c * 260, Math.sin(S.a + c) * 45);
        S.m.scale.setScalar(20 + c * 55);
        S.m.material.opacity = 0.5 * (1 - c) * Math.min(1, c * 5) * endFade;
      }
      pillar.scale.set(0.6 + slam * 0.6, 0.3 + slam, 0.6 + slam * 0.6);
      pillar.position.y = 210 * (0.3 + slam);
      pillarMat.opacity = 0.55 * (1 - sm(e / 0.5));
      aura.rotation.z = T * 3;
      aura.scale.setScalar(1 + Math.sin(T * 9) * 0.08);
      auraMat.opacity = 0.55 * sm(e / 0.3) * endFade * (0.7 + 0.3 * Math.sin(T * 9));
    }
    update(0);
    return { object: root, update: update };
  }

  MOBA.defineChampionArt('trex', {
    lore: 'Despertó de una siesta de 66 millones de años con hambre de campeones; lo que no alcanza con los bracitos, lo arregla a mordiscones.',
    quote: '¿Un abrazo? No llego. ¿Un mordisco? Vení, que ahí sí.',
    build: build,
    fx: { Q: fxQ, W: fxW, E: fxE, R: fxR }
  });
})();
