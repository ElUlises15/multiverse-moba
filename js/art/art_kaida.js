/* Arte procedural de Kaida, La Hoja Carmesí (Luchadora).
 * Silueta: dos sables carmesí enormes barridos hacia atrás como alas, coleta alta pálida con moño rojo,
 * bufanda larga que flamea, hombrera dorada asimétrica y una gema-diamante flotando en la espalda. */
(function () {
  'use strict';

  const C = 0xc23b5a, A = 0xffd1dc, INK = 0x2a1b2e, GOLD = 0xf0b84a, SKIN = 0xf3c9ad, HAIR = 0xffe6ee, BLADE = 0xd42a4e;
  const HOT = 0xff3d6a;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function env(p, a, b) { return clamp(p / a, 0, 1) * clamp((1 - p) / (1 - b), 0, 1); }
  function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function fallbackCache(THREE) {
    const m = {}, g = {};
    return {
      mat: function (c, o) { const k = c + JSON.stringify(o || {}); return m[k] || (m[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true }, o || {}))); },
      basic: function (c, o) { const k = 'b' + c + JSON.stringify(o || {}); return m[k] || (m[k] = new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}))); },
      geo: function (k, f) { return g[k] || (g[k] = f()); }
    };
  }

  // Media luna afilada (más gruesa en el centro) en el plano XY, panza hacia +Y.
  function crescentShape(THREE, R, arc) {
    const s = new THREE.Shape();
    const a1 = Math.PI / 2 - arc / 2, a2 = Math.PI / 2 + arc / 2;
    s.absarc(0, 0, R, a1, a2, false);
    const off = R * 0.32, ex = R * Math.cos(a2), ey = R * Math.sin(a2);
    const rin = Math.hypot(ex, ey + off);
    s.absarc(0, -off, rin, Math.atan2(ey + off, ex), Math.atan2(ey + off, -ex), true);
    return s;
  }
  function crescentGeo(THREE, R, arc) {
    const g = new THREE.ShapeGeometry(crescentShape(THREE, R, arc), 16);
    g.rotateX(Math.PI / 2); // acostada, panza hacia +Z
    return g;
  }

  // ---------------------------------------------------------------- poses
  const BASE = {
    y: 0, z: 0, rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0, hx: 0, hy: 0,
    lL: 0, kL: 0, lR: 0, kR: 0, sL: 0.08, sR: 0.08,
    aLx: 0, aLz: 0.2, fL: 0, bL: 0, bLz: 0, aRx: 0, aRz: 0.2, fR: 0, bR: 0, bRz: 0,
    pony: 0, ph: 0, scarf: 0, glow: 0, gem: 0
  };
  const KEYS = Object.keys(BASE);
  function pose(o) { return Object.assign({}, BASE, o); }
  function mix(a, b, t) { const r = {}; for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; r[k] = a[k] + (b[k] - a[k]) * t; } return r; }
  // Agacharse c unidades doblando rodillas (los pies quedan en el piso).
  function legs(o, c, offL, offR) {
    const a = Math.acos(clamp(1 - c / 88, -1, 1));
    o.y = -c; o.lL = -a + (offL || 0); o.kL = 2 * a; o.lR = -a + (offR || 0); o.kR = 2 * a;
    return o;
  }
  function seq(p, frames) {
    if (p <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      if (p <= frames[i][0]) {
        const f0 = frames[i - 1], f1 = frames[i];
        return mix(f0[1], f1[1], sm((p - f0[0]) / Math.max(1e-4, f1[0] - f0[0])));
      }
    }
    return frames[frames.length - 1][1];
  }

  function idlePose(time) {
    const br = Math.sin(time * 2.4);
    const o = pose({
      tx: 0.14, ty: -0.12, hx: -0.08 + br * 0.02, hy: 0.12, sL: 0.16, sR: 0.16,
      aLx: 0.25, aLz: 0.45, fL: -0.6, bL: 2.5 + br * 0.05, bLz: 0.35,
      aRx: 0.15, aRz: 0.42, fR: -0.7, bR: 2.35 - br * 0.05, bRz: 0.35,
      pony: 0.1, scarf: 0.1
    });
    return legs(o, 7 + br * 1.5, -0.25, 0.2);
  }
  function walkPose(time, speed) {
    const k = clamp((speed || 340) / 340, 0.3, 1.6);
    const ph = time * Math.PI * 2 * 1.55 * k;
    const s = Math.sin(ph), c = Math.cos(ph);
    const o = pose({
      tx: 0.42, hx: -0.3, ty: s * 0.12,
      aLx: 0.85 - s * 0.15, aLz: 0.32, fL: -0.25, bL: 1.85, bLz: 0.45,
      aRx: 0.85 + s * 0.15, aRz: 0.32, fR: -0.25, bR: 1.85, bRz: 0.45,
      pony: 0.85, scarf: 0.95
    });
    o.lL = s * 0.85 - 0.12; o.kL = 0.3 + 1.0 * Math.max(0, c);
    o.lR = -s * 0.85 - 0.12; o.kR = 0.3 + 1.0 * Math.max(0, -c);
    o.y = -9 + Math.abs(c) * 7;
    return o;
  }

  // ---------------------------------------------------------------- modelo
  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache || fallbackCache(THREE);
    const team = typeof ctx.teamColor === 'number' ? ctx.teamColor : 0x38a3ff;
    const M = function (c, o) { return cache.mat(c, o); };
    const G = function (k, f) { return cache.geo('kaida_' + k, f); };
    const mesh = function (geo, mat, parent, x, y, z) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
    };
    const grp = function (parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; };

    const mInk = M(INK, { roughness: 0.7 });
    const mC = M(C, { roughness: 0.5, metalness: 0.2 });
    const mGold = M(GOLD, { roughness: 0.35, metalness: 0.6 });
    const mSkin = M(SKIN);
    const mHair = M(HAIR, { roughness: 0.6 });
    const mPink = M(A, { roughness: 0.6 });
    const mBlade = M(BLADE, { roughness: 0.25, metalness: 0.7, emissive: 0x5a0a1e, emissiveIntensity: 0.6 });
    const mTeam = M(team, { emissive: team, emissiveIntensity: 0.35 });
    const mEyes = cache.basic(0xfff0f4);
    // Materiales propios (se animan)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5a82, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending });
    const gemMat = new THREE.MeshStandardMaterial({ color: C, emissive: 0xff2050, emissiveIntensity: 0.6, flatShading: true, roughness: 0.2, metalness: 0.3 });

    const root = new THREE.Group();
    const rig = grp(root);

    // ---- caderas, falda y piernas
    const hips = grp(rig, 0, 88, 0);
    mesh(G('skirt', () => new THREE.CylinderGeometry(18, 34, 30, 6)), mC, hips, 0, -10, 0).rotation.y = Math.PI / 6;
    const thighG = G('thigh', () => new THREE.CapsuleGeometry(9, 26, 3, 8));
    const shinG = G('shin', () => new THREE.CapsuleGeometry(8, 18, 3, 8));
    const footG = G('foot', () => new THREE.BoxGeometry(13, 9, 26));
    function makeLeg(side) {
      const leg = grp(hips, side * 12, -6, 0);
      mesh(thighG, mInk, leg, 0, -22, 0);
      const knee = grp(leg, 0, -44, 0);
      mesh(shinG, mC, knee, 0, -17, 0);
      const foot = mesh(footG, mInk, knee, 0, -33.5, 6);
      return { leg: leg, knee: knee, foot: foot };
    }
    const legL = makeLeg(-1), legR = makeLeg(1);

    // ---- torso
    const torso = grp(rig, 0, 92, 0);
    const chest = mesh(G('chest', () => new THREE.CapsuleGeometry(19, 20, 4, 8)), mInk, torso, 0, 30, 0);
    chest.scale.set(1, 1, 0.78);
    const emblem = mesh(G('oct', () => new THREE.OctahedronGeometry(1, 0)), mC, torso, 0, 34, 14);
    emblem.scale.set(10, 15, 4);
    mesh(G('belt', () => new THREE.TorusGeometry(20, 4, 6, 16)), mTeam, torso, 0, 6, 0).rotation.x = Math.PI / 2;
    const sashG = G('sash', () => { const g = new THREE.BoxGeometry(9, 38, 2.5); g.translate(0, -19, 0); return g; });
    const sashL = grp(torso, -9, 4, -15), sashR = grp(torso, 9, 4, -15);
    mesh(sashG, mPink, sashL); mesh(sashG, mPink, sashR);

    // bufanda
    mesh(G('scarfRing', () => new THREE.TorusGeometry(14, 6, 6, 12)), mC, torso, 0, 58, 0).rotation.x = Math.PI / 2;
    const scarfA = grp(torso, 6, 58, -12);
    mesh(G('scarfA', () => new THREE.BoxGeometry(17, 4, 44)), mC, scarfA, 0, 0, -22);
    const scarfB = grp(scarfA, 0, 0, -43);
    mesh(G('scarfB', () => { const g = new THREE.CylinderGeometry(7.5, 2, 44, 4, 1); g.rotateX(-Math.PI / 2); g.scale(1.3, 0.35, 1); return g; }), mC, scarfB, 0, 0, -21);

    // hombreras asimétricas
    const pR = mesh(G('oct', () => new THREE.OctahedronGeometry(1, 0)), mGold, torso, 26, 57, 0);
    pR.scale.set(20, 13, 17); pR.rotation.z = -0.35;
    const pL = mesh(G('oct', () => new THREE.OctahedronGeometry(1, 0)), mC, torso, -23, 54, 0);
    pL.scale.set(11, 9, 11);

    // gema-diamante flotante en la espalda
    const gem = mesh(G('oct', () => new THREE.OctahedronGeometry(1, 0)), gemMat, torso, 0, 42, -32);
    gem.scale.set(11, 18, 11);

    // ---- brazos y sables
    const upperG = G('upper', () => new THREE.CapsuleGeometry(6.5, 16, 3, 8));
    const foreG = G('fore', () => new THREE.CapsuleGeometry(7.5, 12, 3, 8));
    const fistG = G('fist', () => new THREE.SphereGeometry(8, 8, 6));
    const gripG = G('grip', () => new THREE.CylinderGeometry(2.8, 2.8, 20, 6));
    const bladeG = G('blade', () => {
      const s = new THREE.Shape();
      s.moveTo(-5, 0); s.lineTo(10, 0);
      s.quadraticCurveTo(24, 62, 9, 128);
      s.quadraticCurveTo(2, 66, -5, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false });
      g.translate(0, 0, -1.5); g.rotateX(Math.PI); g.translate(0, -8, 0);
      return g;
    });
    function makeArm(side) {
      const arm = grp(torso, side * 23, 50, 0);
      mesh(upperG, mInk, arm, 0, -14, 0);
      const fore = grp(arm, 0, -29, 0);
      mesh(foreG, mC, fore, 0, -12, 0);
      const hand = grp(fore, 0, -26, 0);
      mesh(fistG, mInk, hand);
      const sword = grp(hand);
      mesh(gripG, mInk, sword, 0, 6, 0);
      const guard = mesh(G('oct', () => new THREE.OctahedronGeometry(1, 0)), mGold, sword, 0, -6, 0);
      guard.scale.set(9, 5, 7);
      const blade = mesh(bladeG, mBlade, sword);
      if (side < 0) blade.scale.x = -1;
      const glow = mesh(bladeG, glowMat, sword, 0, 2, 0);
      glow.scale.set(side < 0 ? -1.35 : 1.35, 1.05, 0.5);
      return { arm: arm, fore: fore, sword: sword };
    }
    const armL = makeArm(-1), armR = makeArm(1);

    // ---- cabeza, pelo y coleta
    const head = grp(torso, 0, 62, 0);
    mesh(G('head', () => new THREE.SphereGeometry(25, 12, 10)), mSkin, head, 0, 24, 0);
    const cap = mesh(G('hair', () => new THREE.SphereGeometry(27.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)), mHair, head, 0, 26, -2);
    cap.rotation.x = -0.4;
    mesh(G('eyes', () => new THREE.BoxGeometry(24, 5, 4)), mEyes, head, 0, 22, 22.5);
    const ponyA = grp(head, 0, 46, -12);
    mesh(G('ponyA', () => { const g = new THREE.CylinderGeometry(9, 12, 36, 7); g.rotateX(-Math.PI / 2); g.translate(0, 0, -18); return g; }), mHair, ponyA);
    const ponyB = grp(ponyA, 0, 0, -34);
    mesh(G('ponyB', () => { const g = new THREE.CylinderGeometry(5, 9, 34, 7); g.rotateX(-Math.PI / 2); g.translate(0, 0, -17); return g; }), mHair, ponyB);
    const ponyC = grp(ponyB, 0, 0, -32);
    mesh(G('ponyC', () => { const g = new THREE.ConeGeometry(5, 30, 7); g.rotateX(-Math.PI / 2); g.translate(0, 0, -15); return g; }), mHair, ponyC);
    const bowG = G('bow', () => new THREE.ConeGeometry(10, 20, 4));
    mesh(bowG, mC, ponyA, 11, 2, -2).rotation.z = Math.PI / 2;
    mesh(bowG, mC, ponyA, -11, 2, -2).rotation.z = -Math.PI / 2;

    let gemSpin = 0;

    function apply(o, time) {
      rig.position.set(0, o.y, o.z);
      rig.rotation.set(o.rx, o.ry, o.rz);
      torso.rotation.set(o.tx, o.ty, o.tz);
      head.rotation.set(o.hx, o.hy, 0);
      legL.leg.rotation.set(o.lL, 0, -o.sL); legL.knee.rotation.x = o.kL;
      legL.foot.rotation.x = -clamp(o.lL + o.kL + o.rx, -1.2, 1.2);
      legR.leg.rotation.set(o.lR, 0, o.sR); legR.knee.rotation.x = o.kR;
      legR.foot.rotation.x = -clamp(o.lR + o.kR + o.rx, -1.2, 1.2);
      armL.arm.rotation.set(o.aLx, 0, -o.aLz); armL.fore.rotation.x = o.fL;
      armL.sword.rotation.set(o.bL - o.aLx - o.fL, 0, -o.bLz);
      armR.arm.rotation.set(o.aRx, 0, o.aRz); armR.fore.rotation.x = o.fR;
      armR.sword.rotation.set(o.bR - o.aRx - o.fR, 0, o.bRz);
      // pelo y telas
      const fl = Math.sin(time * (3 + o.scarf * 9));
      const fl2 = Math.sin(time * (3 + o.scarf * 9) - 1.3);
      ponyA.rotation.set(0.75 + o.ph - o.pony * 0.35 + fl * 0.04, Math.sin(time * 1.7) * 0.15 * (1 - o.pony), 0);
      ponyB.rotation.x = -0.9 + o.pony * 0.7 + fl2 * 0.08;
      ponyC.rotation.x = -0.6 + o.pony * 0.5 + fl * 0.12;
      scarfA.rotation.set(-1.25 + o.scarf * 1.05 + fl * 0.08 * (0.3 + o.scarf), 0.15 * fl2 * o.scarf, 0);
      scarfB.rotation.set(-0.3 * (1 - o.scarf) + fl2 * 0.25 * (0.2 + o.scarf), 0, 0);
      sashL.rotation.x = 0.12 + o.scarf * 0.8 + fl2 * 0.12;
      sashR.rotation.x = 0.12 + o.scarf * 0.8 + fl * 0.12;
      // brillos
      glowMat.opacity = clamp(0.12 + o.glow * 0.7 + Math.sin(time * 9) * 0.05 * o.glow, 0, 1);
      gemMat.emissiveIntensity = 0.6 + o.glow * 1.6 + o.gem * 0.8;
      gem.position.y = 42 + Math.sin(time * 2.2) * 3;
      gem.rotation.y = gemSpin;
    }

    function update(state) {
      state = state || {};
      const anim = state.anim || 'idle';
      const t = state.t || 0, time = state.time || 0, p = clamp(state.progress || 0, 0, 1);
      const dt = clamp(state.dt || 0.016, 0, 0.1);
      const base = idlePose(time);
      let o = base;

      if (anim === 'walk') {
        o = walkPose(time, state.speed);
      } else if (anim === 'attack') {
        // anticipación: sable derecho bien alto atrás; golpe diagonal; remate cruzado con el izquierdo
        const wind = legs(pose({ tx: 0.2, ty: 0.55, hy: -0.4, sL: 0.2, sR: 0.2,
          aRx: -2.5, aRz: 0.55, fR: -0.5, bR: 3.5, bRz: 0.2,
          aLx: -0.6, aLz: 0.5, fL: -0.9, bL: 2.2, bLz: 0.3, pony: 0.2, scarf: 0.3 }), 14, -0.4, 0.35);
        const strike = legs(pose({ tx: 0.45, ty: -0.55, hy: 0.3, sL: 0.2, sR: 0.2,
          aRx: -0.5, aRz: -0.25, fR: -0.05, bR: 4.88, bRz: -0.3,
          aLx: 0.4, aLz: 0.6, fL: -0.4, bL: 2.0, bLz: 0.4, pony: 0.7, scarf: 0.8, glow: 0.5 }), 18, -0.7, 0.5);
        strike.z = 26;
        const follow = legs(pose({ tx: 0.35, ty: 0.3, sL: 0.2, sR: 0.2,
          aRx: -0.2, aRz: 0.5, fR: -0.3, bR: 4.5, bRz: 0.3,
          aLx: -1.4, aLz: -0.3, fL: -0.1, bL: 4.71, bLz: 0, pony: 0.6, scarf: 0.7, glow: 0.3 }), 16, -0.6, 0.45);
        follow.z = 30;
        o = seq(p, [[0, base], [0.3, wind], [0.42, strike], [0.58, follow], [1, base]]);
      } else if (anim === 'cast') {
        const slot = state.slot | 0;
        if (slot === 0) {
          // Corte Doble: brazos cruzados y apertura explosiva en tijera
          const cross = legs(pose({ tx: 0.3, aRx: -1.2, aRz: -0.6, fR: -0.8, bR: 2.8, bRz: -0.6,
            aLx: -1.2, aLz: -0.6, fL: -0.8, bL: 2.8, bLz: -0.6, glow: 0.4, scarf: 0.3 }), 14, -0.3, 0.3);
          const fling = legs(pose({ tx: 0.5, hx: -0.3, aRx: -1.4, aRz: 1.3, fR: 0, bR: 4.88, bRz: 0.4,
            aLx: -1.4, aLz: 1.3, fL: 0, bL: 4.88, bLz: 0.4, glow: 1, pony: 0.9, scarf: 1 }), 20, -0.8, 0.6);
          fling.z = 34;
          const hold = mix(fling, cross, 0.1); hold.z = 34;
          o = seq(p, [[0, base], [0.25, cross], [0.42, fling], [0.7, hold], [1, base]]);
        } else if (slot === 1) {
          // Furia Carmesí: sables cruzados arriba y rugido con los brazos abiertos
          const charge = legs(pose({ tx: 0.4, hx: 0.3, aRx: -2.9, aRz: -0.25, fR: -0.3, bR: 3.3, bRz: -0.5,
            aLx: -2.9, aLz: -0.25, fL: -0.3, bL: 3.3, bLz: -0.5, glow: 0.6, gem: 0.5 }), 22, 0, 0);
          const roar = legs(pose({ tx: -0.3, hx: -0.45, sL: 0.3, sR: 0.3, aRx: -0.5, aRz: 1.4, fR: -0.2, bR: 2.4, bRz: 0.6,
            aLx: -0.5, aLz: 1.4, fL: -0.2, bL: 2.4, bLz: 0.6, glow: 1, gem: 1, pony: 0.6, scarf: 0.7 }), 4, -0.3, 0.3);
          roar.ry = Math.sin(time * 40) * 0.03; // temblor de furia
          const end = Object.assign({}, base, { glow: 0.5 });
          o = seq(p, [[0, base], [0.3, charge], [0.55, roar], [0.8, roar], [1, end]]);
        } else if (slot === 2) {
          // Paso Veloz: rasante, casi horizontal, sables estirados hacia atrás
          const dash = pose({ y: -30, z: 10, tx: 0.95, hx: -0.7, lL: -1.2, kL: 1.0, lR: 0.9, kR: 0.4,
            aRx: 1.3, aRz: 0.35, fR: 0, bR: 1.6, bRz: 0.3, aLx: 1.3, aLz: 0.35, fL: 0, bL: 1.6, bLz: 0.3,
            pony: 1, scarf: 1, glow: 0.4 });
          const dash2 = Object.assign({}, dash, { z: 30 });
          o = seq(p, [[0, base], [0.2, dash], [0.75, dash2], [1, base]]);
        } else {
          // Tormenta de Acero: se enrosca, salta girando como un torbellino de acero y clava los sables
          const coil = legs(pose({ tx: 0.5, ty: 0.8, aRx: -1.0, aRz: -0.7, fR: -1.0, bR: 2.8, bRz: -0.4,
            aLx: -1.0, aLz: -0.7, fL: -1.0, bL: 2.8, bLz: -0.4, glow: 0.6, gem: 0.6 }), 26, 0, 0);
          const spin = pose({ y: 34, lL: -0.9, kL: 1.4, lR: -0.3, kR: 1.2, tx: 0.05,
            aRx: -0.15, aRz: 1.5, fR: 0, bR: 6.03, bRz: 0.25, aLx: -0.15, aLz: 1.5, fL: 0, bL: 6.03, bLz: 0.25,
            glow: 1, gem: 1, pony: 1, scarf: 1 });
          const spin2 = Object.assign({}, spin, { y: 44 });
          const slam = legs(pose({ tx: 0.6, hx: -0.4, sL: 0.3, sR: 0.3, aRx: 0.2, aRz: 1.0, fR: -0.2, bR: 5.6, bRz: 0.3,
            aLx: 0.2, aLz: 1.0, fL: -0.2, bL: 5.6, bLz: 0.3, glow: 1, gem: 1, scarf: 0.5 }), 30, -0.6, 0.6);
          o = seq(p, [[0, base], [0.15, coil], [0.3, spin], [0.7, spin2], [0.85, slam], [1, base]]);
          o.ry += Math.PI * 2 * 4 * sm((p - 0.15) / 0.7);
        }
      } else if (anim === 'recall') {
        // arrodillada, un sable clavado adelante, el otro en la espalda, la gema late
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        const kneel = pose({ y: -38, lL: -1.35, kL: 1.45, lR: 0.25, kR: 1.85, tx: 0.3, hx: 0.4,
          aRx: -1.0, aRz: 0.15, fR: -0.4, bR: 5.15, bRz: 0,
          aLx: 0.2, aLz: 0.35, fL: -1.2, bL: 2.7, bLz: 0.3, glow: 0.3 + 0.5 * pulse, gem: 1 });
        o = mix(base, kneel, sm(t / 0.5));
      } else if (anim === 'dead') {
        const still = idlePose(0);
        const fallen = pose({ rx: -1.45, y: 24, z: -10, tx: -0.1, hx: 0.25, hy: 0.5, lL: -0.4, kL: 0.6, lR: -0.1, kR: 0.2, sL: 0.25, sR: 0.1, ph: 1.75, pony: 1, scarf: 2.6,
          aRx: -0.4, aRz: 1.4, fR: -0.3, bR: 3.4, bRz: 0.2, aLx: -0.8, aLz: 1.2, fL: -0.2, bL: 3.0, bLz: 0.3 });
        o = mix(still, fallen, sm(t / 0.8));
        o.rz = Math.sin(clamp(t / 0.8, 0, 1) * Math.PI) * 0.25;
      }

      gemSpin += dt * (1.2 + o.gem * 8);
      if (gemSpin > 1000) gemSpin -= Math.PI * 200;
      apply(o, anim === 'dead' ? 0 : time);
    }

    update({ anim: 'idle', t: 0, time: 0 });
    return { object: root, update: update };
  }

  // ---------------------------------------------------------------- fx
  function addMat(THREE, color, opacity) {
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  }
  function flatGeo(THREE, kind) {
    let g;
    if (kind === 'ring') g = new THREE.RingGeometry(0.85, 1, 48);
    else if (kind === 'thinRing') g = new THREE.RingGeometry(0.95, 1, 64);
    else if (kind === 'disc') g = new THREE.CircleGeometry(1, 40);
    else { g = new THREE.PlaneGeometry(1, 1); }
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function sizeFor(info, def) {
    const k = info.kind;
    if (k === 'projectile') return Math.max(50, (info.width || 100) * 0.7);
    if (k === 'line') return Math.max(60, (info.width || 140) * 0.9);
    return info.radius > 0 ? info.radius : def;
  }
  function makePetals(THREE, parent, n, mat) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    const arr = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(6, 3, 11);
      parent.add(m); arr.push(m);
    }
    return arr;
  }

  // Q — Corte Doble (line): dos medias lunas carmesí que viajan en tijera por la línea dejando pétalos
  function fxQ(THREE, ctx, info) {
    info = info || {};
    const kind = info.kind || 'line';
    const root = new THREE.Group();
    const W = info.width || 160, L = info.length || 450;
    const isLine = kind === 'line', isProj = kind === 'projectile';
    const size = isLine ? W * 0.75 : isProj ? Math.max(60, W * 0.7) : (info.radius || 200) * 0.85;
    const cg = crescentGeo(THREE, size, 2.3);
    const m1 = addMat(THREE, HOT, 0.9), m2 = addMat(THREE, A, 0.9), mS = addMat(THREE, 0xff8fab, 0.5), mP = addMat(THREE, A, 0.9);
    const c1 = new THREE.Mesh(cg, m1), c2 = new THREE.Mesh(cg, m2);
    c2.scale.setScalar(0.85);
    root.add(c1, c2);
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, 0.5);
    const streak = new THREE.Mesh(sg, mS);
    streak.position.y = 4;
    root.add(streak);
    const petals = makePetals(THREE, root, 8, mP);

    function update(p) {
      p = clamp(p || 0, 0, 1);
      const e = env(p, 0.06, 0.7);
      m1.opacity = 0.95 * e; m2.opacity = 0.85 * env(p, 0.15, 0.75); mP.opacity = 0.9 * env(p, 0.1, 0.6);
      if (isLine) {
        const f1 = sm(p / 0.6), f2 = sm((p - 0.12) / 0.6);
        c1.position.set(0, 55, L * f1 * 0.92); c1.rotation.set(0, 0, 0.35);
        c2.position.set(0, 45, L * f2 * 0.92); c2.rotation.set(0, 0, -0.35);
        streak.scale.set(W * 0.45 * (1 - p * 0.6), 1, Math.max(1, L * f1));
        mS.opacity = 0.45 * env(p, 0.05, 0.55);
        for (let i = 0; i < petals.length; i++) {
          const zi = (i + 0.5) / petals.length;
          const lp = clamp((f1 - zi) * 3, 0, 1);
          const m = petals[i];
          m.visible = lp > 0;
          m.position.set((hash(i) - 0.5) * W * (0.6 + lp), 20 + lp * 70, zi * L);
          m.rotation.set(lp * 5 + i, lp * 3, i);
        }
      } else if (isProj) {
        const spin = p * 14;
        c1.position.set(0, 50, 0); c1.rotation.set(0, spin, 0.5);
        c2.position.set(0, 50, 0); c2.rotation.set(0, -spin, -0.5);
        streak.position.z = -size * 2.5; streak.scale.set(size * 0.6, 1, size * 2.5);
        mS.opacity = 0.35 * e;
        for (let i = 0; i < petals.length; i++) {
          const ph = (p * 3 + i / petals.length) % 1;
          petals[i].visible = true;
          petals[i].position.set((hash(i) - 0.5) * size, 40 + hash(i + 9) * 30, -ph * size * 3);
          petals[i].rotation.set(ph * 6, i, 0);
        }
      } else {
        const g = 0.4 + 0.8 * sm(p / 0.4);
        c1.position.set(0, 40, 0); c1.rotation.set(0, 0.785, 0.08); c1.scale.setScalar(g);
        c2.position.set(0, 40, 0); c2.rotation.set(0, -0.785, -0.08); c2.scale.setScalar(g * 0.85);
        streak.visible = false;
        for (let i = 0; i < petals.length; i++) {
          const a = (i / petals.length) * Math.PI * 2 + hash(i);
          const r = size * (0.2 + 1.0 * sm(p / 0.6));
          petals[i].visible = true;
          petals[i].position.set(Math.cos(a) * r, 30 + Math.sin(p * Math.PI) * 60, Math.sin(a) * r);
          petals[i].rotation.set(p * 8 + i, i, 0);
        }
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // W — Furia Carmesí (self): columna de aura carmesí, diamantes en espiral y gotas que vuelven a ella (robo de vida)
  function fxW(THREE, ctx, info) {
    info = info || {};
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const R = sizeFor(info, 160);
    if (info.kind === 'line') body.position.z = (info.length || 400) * 0.5;
    const mRing = addMat(THREE, HOT, 0.8), mDisc = addMat(THREE, C, 0.2), mCol = addMat(THREE, 0xff2e5c, 0.25);
    const mShard = addMat(THREE, A, 0.9), mDrop = addMat(THREE, 0xff1f4d, 0.9);
    const ring = new THREE.Mesh(flatGeo(THREE, 'ring'), mRing); ring.position.y = 3;
    const disc = new THREE.Mesh(flatGeo(THREE, 'disc'), mDisc); disc.position.y = 2;
    const cg = new THREE.CylinderGeometry(0.55, 0.85, 1, 20, 1, true); cg.translate(0, 0.5, 0);
    const col = new THREE.Mesh(cg, mCol);
    body.add(ring, disc, col);
    const og = new THREE.OctahedronGeometry(1, 0);
    const shards = [], drops = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(og, mShard); m.scale.set(7, 16, 7); body.add(m); shards.push(m); }
    const dg = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(dg, mDrop); body.add(m); drops.push(m); }

    function update(p) {
      p = clamp(p || 0, 0, 1);
      const e = env(p, 0.08, 0.8);
      const pulse = 0.5 + 0.5 * Math.sin(p * 40);
      ring.scale.setScalar(R * (0.9 + 0.12 * pulse));
      disc.scale.setScalar(R);
      mRing.opacity = 0.85 * e; mDisc.opacity = 0.16 * e;
      col.scale.set(R, 230 * (0.5 + 0.5 * sm(p / 0.2)), R);
      col.rotation.y = p * 10;
      mCol.opacity = (0.16 + 0.1 * pulse) * e;
      mShard.opacity = 0.9 * e; mDrop.opacity = 0.9 * e;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + p * 12;
        const f = (p * 3 + i / 6) % 1;
        shards[i].position.set(Math.cos(a) * R * 0.75, 20 + f * 200, Math.sin(a) * R * 0.75);
        shards[i].rotation.y = a;
        const s = Math.sin(f * Math.PI);
        shards[i].scale.set(7 * s + 0.1, 16 * s + 0.1, 7 * s + 0.1);
        const g = (p * 2.5 + i / 6 + 0.5) % 1;
        const b = i / 6 * Math.PI * 2 + 0.5;
        const r = R * 1.3 * (1 - g);
        drops[i].position.set(Math.cos(b) * r, 30 + 100 * g, Math.sin(b) * r);
        const ds = 1 - g * 0.6;
        drops[i].scale.set(6 * ds, 10 * ds, 6 * ds);
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // E — Paso Veloz (dash): líneas de velocidad, imágenes residuales en diamante, corte y onda en el piso
  function fxE(THREE, ctx, info) {
    info = info || {};
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const R = sizeFor(info, 100);
    if (info.kind === 'line') body.position.z = (info.length || 400) * 0.5;
    const mStreak = addMat(THREE, A, 0.7), mG1 = addMat(THREE, HOT, 0.45), mG2 = addMat(THREE, C, 0.3);
    const mRing = addMat(THREE, 0xff6f90, 0.8), mCut = addMat(THREE, 0xffffff, 0.9), mP = addMat(THREE, A, 0.9);
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, -0.5);
    const streaks = [];
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(sg, mStreak); body.add(m); streaks.push(m); }
    const og = new THREE.OctahedronGeometry(1, 0);
    const g1 = new THREE.Mesh(og, mG1), g2 = new THREE.Mesh(og, mG2);
    body.add(g1, g2);
    const ring = new THREE.Mesh(flatGeo(THREE, 'ring'), mRing); ring.position.y = 3;
    const cut = new THREE.Mesh(crescentGeo(THREE, R * 1.1, 2.0), mCut);
    body.add(ring, cut);
    const petals = makePetals(THREE, body, 8, mP);

    function update(p) {
      p = clamp(p || 0, 0, 1);
      const e = env(p, 0.05, 0.5);
      mStreak.opacity = 0.75 * e;
      for (let i = 0; i < 7; i++) {
        const len = R * (2.5 + hash(i) * 2.5) * sm(p / 0.25) * (1 - 0.4 * p);
        streaks[i].position.set((hash(i + 3) - 0.5) * R * 1.4, 15 + hash(i + 7) * 110, -p * R * 1.5);
        streaks[i].scale.set(3 + hash(i + 1) * 6, 1, Math.max(1, len));
      }
      const gs = Math.max(0.01, 1 - p * 0.5);
      g1.position.set(0, 90, -R * 0.4 - p * R * 0.6); g1.scale.set(R * 0.35 * gs, 95, R * 0.25 * gs);
      g2.position.set(0, 85, -R * 1.1 - p * R * 0.9); g2.scale.set(R * 0.3 * gs, 85, R * 0.22 * gs);
      mG1.opacity = 0.45 * env(p, 0.05, 0.4); mG2.opacity = 0.3 * env(p, 0.1, 0.35);
      ring.scale.setScalar(R * (0.3 + 1.5 * sm(p / 0.5)));
      mRing.opacity = 0.8 * env(p, 0.03, 0.4);
      cut.position.set(0, 50, R * 0.2);
      cut.scale.set(0.6 + 0.8 * sm(p / 0.2), 1, 0.6 + 0.6 * sm(p / 0.2));
      cut.rotation.z = 0.1;
      mCut.opacity = 0.9 * env(p, 0.03, 0.3);
      mP.opacity = 0.9 * env(p, 0.05, 0.6);
      for (let i = 0; i < petals.length; i++) {
        const a = (i / petals.length) * Math.PI * 2 + hash(i + 20);
        const r = R * (0.2 + 1.6 * sm(p / 0.7));
        petals[i].position.set(Math.cos(a) * r, 20 + 160 * p * (1 - p) * (0.6 + hash(i)), Math.sin(a) * r);
        petals[i].rotation.set(p * 9 + i, i * 0.7, 0);
      }
    }
    update(0);
    return { object: root, update: update };
  }

  // R — Tormenta de Acero (self, radio grande): vórtice carmesí con hojas en órbita y pulso de curación final
  function fxR(THREE, ctx, info) {
    info = info || {};
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const R = sizeFor(info, 400);
    if (info.kind === 'line') body.position.z = (info.length || 400) * 0.5;
    const mTel = addMat(THREE, HOT, 0.8), mFill = addMat(THREE, C, 0.12), mBlade = addMat(THREE, 0xff4d74, 0.9);
    const mVort = addMat(THREE, 0xff2e5c, 0.2), mSwirl = addMat(THREE, A, 0.6), mP = addMat(THREE, A, 0.9), mHeal = addMat(THREE, 0xffb3c6, 0.6);
    const tel = new THREE.Mesh(flatGeo(THREE, 'thinRing'), mTel); tel.position.y = 3;
    const fill = new THREE.Mesh(flatGeo(THREE, 'disc'), mFill); fill.position.y = 2;
    body.add(tel, fill);
    const spin = new THREE.Group(); body.add(spin);
    const bg = crescentGeo(THREE, Math.max(40, R * 0.18), 1.7);
    const blades = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(bg, mBlade); spin.add(m); blades.push(m); }
    const vg = new THREE.CylinderGeometry(1, 0.4, 1, 24, 1, true); vg.translate(0, 0.5, 0);
    const vort = new THREE.Mesh(vg, mVort); body.add(vort);
    const tg = new THREE.TorusGeometry(1, 0.025, 4, 48); tg.rotateX(Math.PI / 2);
    const sw1 = new THREE.Mesh(tg, mSwirl), sw2 = new THREE.Mesh(tg, mSwirl);
    body.add(sw1, sw2);
    const petals = makePetals(THREE, body, 10, mP);
    const hg = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true); hg.translate(0, 0.5, 0);
    const heal = new THREE.Mesh(hg, mHeal); body.add(heal);

    function update(p) {
      p = clamp(p || 0, 0, 1);
      const e = env(p, 0.06, 0.8);
      tel.scale.setScalar(R); fill.scale.setScalar(R * sm(p / 0.3));
      mTel.opacity = 0.85 * e; mFill.opacity = 0.14 * e;
      spin.rotation.y = -p * 30;
      const rr = R * (0.3 + 0.6 * sm(p / 0.45));
      mBlade.opacity = 0.95 * e;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        blades[i].position.set(Math.cos(a) * rr, 45 + 30 * (i % 2), Math.sin(a) * rr);
        blades[i].rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI, (i % 2 ? 0.3 : -0.3));
      }
      vort.scale.set(R * 0.75, 260 * (0.4 + 0.6 * sm(p / 0.25)), R * 0.75);
      vort.rotation.y = -p * 18;
      mVort.opacity = 0.2 * e;
      sw1.position.y = 35; sw1.scale.setScalar(R * (0.5 + 0.1 * Math.sin(p * 30)));
      sw2.position.y = 110; sw2.scale.setScalar(R * (0.75 + 0.1 * Math.cos(p * 30)));
      mSwirl.opacity = 0.6 * e;
      mP.opacity = 0.9 * e;
      for (let i = 0; i < petals.length; i++) {
        const f = (p * 1.6 + i / petals.length) % 1;
        const a = -p * 20 + i * 2.4;
        const r = R * (0.15 + 0.85 * f);
        petals[i].position.set(Math.cos(a) * r, 20 + 120 * f * (1 - f) * 2, Math.sin(a) * r);
        petals[i].rotation.set(p * 10 + i, a, 0);
      }
      const hp = clamp((p - 0.7) / 0.3, 0, 1);
      heal.visible = hp > 0;
      heal.scale.set(60 + 90 * hp, 40 + 180 * hp, 60 + 90 * hp);
      mHeal.opacity = 0.6 * Math.sin(hp * Math.PI);
    }
    update(0);
    return { object: root, update: update };
  }

  MOBA.defineChampionArt('kaida', {
    lore: 'Forjó sus sables con el hierro de su aldea quemada; desde entonces cada herida que abre le devuelve un poco de la vida que le robaron.',
    quote: '¿Querés bailar? Dale, pero el ritmo lo marcan mis hojas.',
    build: build,
    fx: { Q: fxQ, W: fxW, E: fxE, R: fxR }
  });
})();
