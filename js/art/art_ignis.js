/* Arte procedural: Ignis, el Hechicero de Brasas.
 * Silueta: mago flotante con túnica de campana, cabeza = brasero de hierro con una llama gigante
 * por corona, cuello alto, hombreras de obsidiana, halo de fuego en la espalda y báculo con orbe ardiente. */
(function () {
  'use strict';

  const C = {
    fire: 0xff6a1a,    // color principal
    gold: 0xffd36b,    // accent
    coal: 0x2b1d1f,    // obsidiana / hierro
    crimson: 0xa8201c, // túnica
    wood: 0x3a2418,
    white: 0xfff3c4,
    magma: 0xff3a0a
  };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ------------------------------------------------------------------ modelo
  function build(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache;
    const G = function (k, f) { return cache ? cache.geo('ignis_' + k, f) : f(); };
    const M = function (c, o) { return cache ? cache.mat(c, o) : new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true }, o || {})); };
    const B = function (c, o) { return cache ? cache.basic(c, o) : new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); };
    const teamCol = num(ctx.teamColor, 0xffffff);

    function add(parent, geo, mat, x, y, z) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      parent.add(m);
      return m;
    }

    const mRobe = M(C.crimson, { roughness: 0.9 });
    const mGold = M(C.gold, { metalness: 0.6, roughness: 0.35, emissive: C.gold, emissiveIntensity: 0.15 });
    const mCoal = M(C.coal, { metalness: 0.3, roughness: 0.6 });
    const mObsid = M(C.coal, { metalness: 0.2, roughness: 0.4, emissive: C.magma, emissiveIntensity: 0.18 });
    const mIron = M(C.coal, { metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
    const mCollar = M(C.crimson, { side: THREE.DoubleSide, roughness: 0.9 });
    const mWood = M(C.wood, { roughness: 0.9 });
    const mFireSolid = M(C.fire, { emissive: C.fire, emissiveIntensity: 0.9 });
    const mTeam = M(teamCol, { emissive: teamCol, emissiveIntensity: 0.6, metalness: 0.4 });
    const bFire = B(C.fire);
    const bGold = B(C.gold);
    const bWhite = B(C.white);
    const bCrim = B(C.magma);

    // materiales propios (se animan)
    const glowMat = new THREE.MeshBasicMaterial({ color: C.fire, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const haloMat = new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const palmMat = new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const ringMat = new THREE.MeshBasicMaterial({ color: C.fire, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

    const root = new THREE.Group();
    root.name = 'ignis';

    // brillo en el suelo (no flota)
    const glow = add(root, G('glow', () => new THREE.CircleGeometry(60, 20)), glowMat, 0, 1.5, 0);
    glow.rotation.x = -Math.PI / 2;

    const body = new THREE.Group();
    body.position.y = 22;
    root.add(body);

    // --- túnica de campana
    const robeG = new THREE.Group();
    body.add(robeG);
    const robeGeo = G('robe', () => new THREE.LatheGeometry([
      new THREE.Vector2(64, 0), new THREE.Vector2(60, 10), new THREE.Vector2(50, 34),
      new THREE.Vector2(39, 60), new THREE.Vector2(31, 86), new THREE.Vector2(27, 102)
    ], 10));
    add(robeG, robeGeo, mRobe, 0, 0, 0);
    const hem = add(robeG, G('hem', () => new THREE.TorusGeometry(61, 6, 5, 16)), mGold, 0, 4, 0);
    hem.rotation.x = Math.PI / 2;
    // lenguas de fuego en el ruedo
    const licks = [];
    const lickGeo = G('lick', () => new THREE.ConeGeometry(13, 46, 5));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const l = add(robeG, lickGeo, i % 2 ? bGold : bFire, Math.sin(a) * 56, 18, Math.cos(a) * 56);
      l.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      l.userData.a = a;
      licks.push(l);
    }
    // propulsor de fuego bajo la túnica (flota)
    const thruster = add(body, G('thr', () => new THREE.ConeGeometry(30, 26, 7)), bFire, 0, -2, 0);
    thruster.rotation.x = Math.PI;

    // --- torso
    const torso = add(body, G('torso', () => new THREE.SphereGeometry(34, 10, 8)), mCoal, 0, 106, 0);
    torso.scale.set(1, 0.95, 0.85);
    const belt = add(body, G('belt', () => new THREE.TorusGeometry(31, 5, 5, 14)), mGold, 0, 88, 0);
    belt.rotation.x = Math.PI / 2;
    const gem = add(body, G('gem', () => new THREE.OctahedronGeometry(9, 0)), mTeam, 0, 88, 32);
    gem.scale.set(1, 1.3, 0.6);
    const emblem = add(body, G('emb', () => new THREE.ConeGeometry(11, 30, 4)), mFireSolid, 0, 112, 28);
    emblem.rotation.x = 0.25;

    // cuello alto (solo mitad trasera)
    const collar = add(body, G('collar', () => new THREE.CylinderGeometry(52, 26, 44, 10, 1, true, Math.PI / 2, Math.PI)), mCollar, 0, 146, -4);

    // hombreras de obsidiana con púas doradas
    const pauldrons = [];
    for (const s of [1, -1]) {
      const p = add(body, G('pauld', () => new THREE.DodecahedronGeometry(24, 0)), mObsid, s * 42, 134, 0);
      p.scale.set(1.1, 0.8, 1);
      const sp = add(p, G('spike', () => new THREE.ConeGeometry(8, 36, 5)), mGold, s * 6, 22, 0);
      sp.rotation.z = -s * 0.5;
      pauldrons.push(p);
    }

    // --- cabeza: brasero de hierro con llama
    const head = new THREE.Group();
    head.position.set(0, 152, 0);
    body.add(head);
    add(head, G('helm', () => new THREE.CylinderGeometry(27, 31, 40, 8, 1, true)), mIron, 0, 0, 0);
    const rim = add(head, G('rim', () => new THREE.TorusGeometry(28, 4, 5, 12)), mGold, 0, 20, 0);
    rim.rotation.x = Math.PI / 2;
    const eyeGeo = G('eye', () => new THREE.BoxGeometry(9, 5, 3));
    const eyes = [add(head, eyeGeo, bWhite, 10, 2, 30), add(head, eyeGeo, bWhite, -10, 2, 30)];
    eyes[0].rotation.z = -0.25; eyes[1].rotation.z = 0.25;
    const core = add(head, G('core', () => new THREE.IcosahedronGeometry(25, 0)), mFireSolid, 0, 10, 0);
    const crown = new THREE.Group();
    crown.position.y = 18;
    head.add(crown);
    const flameA = add(crown, G('flA', () => new THREE.ConeGeometry(26, 100, 6)), bFire, 0, 46, -4);
    const flameB = add(crown, G('flB', () => new THREE.ConeGeometry(15, 66, 6)), bGold, 0, 34, 6);
    const flameC = add(crown, G('flC', () => new THREE.ConeGeometry(15, 56, 5)), bCrim, 0, 30, -16);
    flameC.rotation.x = -0.55;

    // halo de fuego en la espalda
    const backRing = add(body, G('bring', () => new THREE.TorusGeometry(46, 3.5, 4, 20)), ringMat, 0, 168, -34);

    // --- brazos
    function makeArm(s) {
      const arm = new THREE.Group();
      arm.position.set(s * 44, 128, 0);
      body.add(arm);
      const sleeve = add(arm, G('sleeve', () => new THREE.CylinderGeometry(9, 20, 56, 7)), mRobe, 0, -28, 0);
      sleeve.userData.s = s;
      const hand = add(arm, G('hand', () => new THREE.IcosahedronGeometry(11, 0)), mFireSolid, 0, -60, 0);
      return { arm: arm, hand: hand };
    }
    const L = makeArm(1);   // mano de hechizos (+X)
    const R = makeArm(-1);  // mano del báculo (-X)

    // bola de fuego en la palma
    const palm = add(L.arm, G('palm', () => new THREE.IcosahedronGeometry(13, 1)), palmMat, 0, -66, 6);

    // báculo
    const staff = new THREE.Group();
    staff.position.set(0, -60, 0);
    R.arm.add(staff);
    add(staff, G('shaft', () => new THREE.CylinderGeometry(4, 5, 230, 6)), mWood, 0, 40, 0);
    const claw = add(staff, G('claw', () => new THREE.TorusGeometry(22, 4, 5, 12, Math.PI * 1.4)), mGold, 0, 172, 0);
    claw.rotation.z = -Math.PI * 0.2 - Math.PI;
    const orb = add(staff, G('orb', () => new THREE.IcosahedronGeometry(15, 0)), mFireSolid, 0, 172, 0);
    const halo = add(staff, G('halo', () => new THREE.SphereGeometry(26, 10, 8)), haloMat, 0, 172, 0);

    // brasas orbitando
    const embers = [];
    const emGeo = G('ember', () => new THREE.OctahedronGeometry(8, 0));
    for (let i = 0; i < 3; i++) embers.push(add(root, emGeo, i === 1 ? bFire : bGold, 0, 100, 0));

    // ----------------------------------------------------------- animación
    function update(state) {
      state = state || {};
      const anim = state.anim || 'idle';
      const time = num(state.time, 0);
      const t = num(state.t, 0);
      const p = clamp01(num(state.progress, 0));
      const slot = num(state.slot, 0) | 0;
      const sp = Math.min(1.5, Math.max(0, num(state.speed, 0)) / 340);

      // valores base
      let by = 22 + Math.sin(time * 2.1) * 5, bz = 0, rx = 0, ry = 0, rz = 0;
      let sx = 1, sy = 1, sz = 1;
      let lx = 0, lz = 0.3 + Math.sin(time * 1.7) * 0.05, rX = -0.3, rZ = -0.22;
      let stX = 0, stZ = 0;
      let flame = 1, ringS = 1, ringSpin = 0.8, palmS = 0.7, haloS = 1, glowS = 1, glowO = 0.3;
      let emR = 72, emY = 110, emSpin = 1.6, emSpread = 0, emZ = 0, headX = 0, thr = 1;
      let palmZ = 6;

      if (anim === 'walk') {
        const ph = time * (5 + 3 * sp);
        by = 26 + Math.sin(ph * 2) * 4;
        rx = 0.2 * Math.min(sp, 1.2);
        rz = Math.sin(ph) * 0.05;
        lx = 0.5 + Math.sin(ph) * 0.15; lz = 0.35;
        rX = -0.55; rZ = -0.2;
        stX = 0.35;
        emZ = -40 * sp; emSpin = 2.4;
        thr = 1.4 + 0.2 * Math.sin(ph * 3);
        robeG.rotation.x = -0.08 * sp;
      } else {
        robeG.rotation.x = 0;
      }

      if (anim === 'attack') {
        const a = ease(seg(p, 0, 0.45)), b = ease(seg(p, 0.45, 0.62)), c = ease(seg(p, 0.7, 1));
        lx = lerp(lerp(0, 1.0, a), -1.55, b) * (1 - c * 0.8);
        lz = lerp(0.3, 0.6, a) - 0.45 * b;
        ry = lerp(0, -0.35, a) + 0.6 * b - 0.25 * c;
        rx = 0.12 * b;
        palmS = lerp(0.8, 2.4, a) * (1 - b * 0.85) + c * 0.5;
        palmZ = 6 + 30 * b;
        flame = 1 + 0.5 * a * (1 - b);
        ringS = 1 + 0.3 * b * (1 - c);
      } else if (anim === 'cast') {
        if (slot === 0) {
          // Bola de Fuego: estocada con el báculo al frente
          const a = ease(seg(p, 0, 0.4)), b = ease(seg(p, 0.4, 0.6)), c = ease(seg(p, 0.75, 1));
          const k = b * (1 - c);
          rX = lerp(lerp(-0.3, 0.6, a), -1.5, b) * (1 - c) + -0.3 * c;
          stX = -0.9 * k + 0.3 * a * (1 - b);
          lx = lerp(0, -1.2, k); lz = 0.3 + 0.3 * a;
          rx = 0.25 * k - 0.1 * a * (1 - b);
          ry = -0.25 * a * (1 - b) + 0.2 * k;
          haloS = 1 + 1.6 * a * (1 - c);
          palmS = 0.7 + a;
          flame = 1 + 0.4 * a;
        } else if (slot === 1) {
          // Pilar de Llamas: alza el báculo y lo clava
          const a = ease(seg(p, 0, 0.5)), b = ease(seg(p, 0.5, 0.68)), c = ease(seg(p, 0.8, 1));
          rX = lerp(lerp(-0.3, -2.7, a), -0.7, b) * (1 - c) - 0.3 * c;
          rZ = -0.2 - 0.25 * a * (1 - b);
          stX = lerp(0, 0.6, a) * (1 - b) + 0.25 * b * (1 - c);
          by = 22 + 22 * a - 30 * b * (1 - c);
          rx = -0.15 * a * (1 - b) + 0.3 * b * (1 - c);
          lx = -2.2 * a * (1 - b) - 0.5 * b * (1 - c); lz = 0.7 * a;
          haloS = 1 + 1.4 * a;
          glowS = 1 + 1.6 * b * (1 - c); glowO = 0.3 + 0.4 * b * (1 - c);
          flame = 1 + 0.5 * a;
        } else if (slot === 2) {
          // Combustión: se comprime y estalla
          const a = ease(seg(p, 0, 0.38)), b = ease(seg(p, 0.38, 0.52)), c = ease(seg(p, 0.7, 1));
          const k = b * (1 - c);
          sx = sz = lerp(lerp(1, 1.12, a), 1.25, b) * (1 - c) + c;
          sy = lerp(lerp(1, 0.82, a), 1.12, b) * (1 - c) + c;
          by = 22 - 12 * a * (1 - b) + 18 * k;
          lx = -1.2 * a * (1 - b); lz = lerp(lerp(0.3, -0.5, a), 1.5, b) * (1 - c) + 0.3 * c;
          rX = lerp(-1.2 * a, -0.2, b); rZ = lerp(lerp(-0.22, 0.5, a), -1.5, b) * (1 - c) - 0.22 * c;
          flame = 1 - 0.3 * a + 1.3 * k;
          ringS = 1 + 2 * k; ringSpin = 4;
          emR = 72 - 30 * a + 200 * k; emSpread = 60 * k;
          glowS = 1 + 3.5 * k; glowO = 0.3 + 0.45 * k;
          palmS = 0.7 + 0.8 * k;
        } else {
          // Meteoro: levita, alza todo y lo descarga
          const a = ease(seg(p, 0, 0.6)), b = ease(seg(p, 0.6, 0.78)), c = ease(seg(p, 0.85, 1));
          const up = a * (1 - b);
          by = 22 + 70 * a - 50 * b - 20 * c + Math.sin(time * 14) * 3 * up;
          lz = lerp(0.3, 2.7, up) * (1 - b) + 0.5 * b * (1 - c);
          lx = -1.3 * b * (1 - c);
          rZ = lerp(-0.22, -2.4, up) * (1 - b) - 0.3 * b;
          rX = -0.3 * (1 - up) - 1.4 * b * (1 - c);
          stX = -0.8 * b * (1 - c);
          headX = -0.45 * up + 0.3 * b * (1 - c);
          rx = -0.12 * up + 0.35 * b * (1 - c);
          flame = 1 + 1.6 * a * (1 - c * 0.7);
          ringS = 1 + 2.6 * a * (1 - c); ringSpin = 2 + 8 * a;
          haloS = 1 + 2.2 * up;
          palmS = 0.7 + 1.6 * up;
          emR = lerp(72, 40, up) + 120 * b * (1 - c); emY = 110 + 170 * up; emSpin = 1.6 + 7 * up;
          glowS = 1 + 2.5 * a * (1 - c); glowO = 0.3 + 0.5 * a * (1 - c);
          thr = 1 + 1.5 * up;
        }
      } else if (anim === 'recall') {
        const a = ease(seg(t, 0, 0.6));
        by = 22 + 14 * a + Math.sin(time * 1.6) * 4;
        lx = -0.4 * a; lz = 0.3 + 0.8 * a;
        rX = -0.1; rZ = -0.22 - 0.3 * a;
        flame = 0.9 + 0.2 * Math.sin(time * 3);
        ringS = 1 + 0.6 * a; ringSpin = 2.5;
        emR = 90 + 20 * Math.sin(time * 2); emY = 40 + ((time * 70) % 200); emSpin = 3;
        glowS = 1.5 + 0.3 * Math.sin(time * 4) * a; glowO = 0.3 + 0.25 * a;
        palmS = 0.5 + 0.6 * a;
        haloS = 1.3 + 0.3 * Math.sin(time * 4);
      } else if (anim === 'dead') {
        const a = ease(seg(t, 0, 0.7));
        by = lerp(22, 62, a);
        bz = 70 * a;
        rx = -1.5 * a;
        rz = 0.15 * a;
        lz = lerp(0.3, 1.2, a); lx = 0.4 * a;
        rZ = lerp(-0.22, -1.3, a); rX = -0.3 + 0.6 * a;
        flame = lerp(1, 0.18, a);
        ringS = lerp(1, 0.4, a); ringSpin = 0.2;
        palmS = lerp(0.7, 0.1, a);
        haloS = lerp(1, 0.2, a);
        glowO = 0.3 * (1 - a) + 0.06;
        thr = 1 - a;
        emR = 90 + 20 * a; emY = lerp(110, 6, a); emSpin = 0.3 * (1 - a);
      }

      // aplicar
      body.position.set(0, by, bz);
      body.rotation.set(rx, ry, rz);
      body.scale.set(sx, sy, sz);
      head.rotation.x = headX + Math.sin(time * 1.3) * 0.04;
      L.arm.rotation.set(lx, 0, lz);
      R.arm.rotation.set(rX, 0, rZ);
      staff.rotation.set(-rX + stX, 0, -rZ * 0.85 + stZ);

      const fl = flame * (1 + 0.12 * Math.sin(time * 9) + 0.07 * Math.sin(time * 15.3));
      crown.scale.set(1 + 0.1 * (flame - 1), fl, 1 + 0.1 * (flame - 1));
      flameA.rotation.z = Math.sin(time * 4.3) * 0.12;
      flameB.rotation.z = Math.sin(time * 5.1 + 1) * 0.16;
      flameC.rotation.z = Math.sin(time * 3.7 + 2) * 0.1;
      core.rotation.y = time * 2;
      for (let i = 0; i < licks.length; i++) {
        const s = Math.max(0.05, (anim === 'dead' ? 1 - seg(t, 0, 0.7) : 1) * (0.8 + 0.3 * Math.sin(time * 8 + i * 1.7)));
        licks[i].scale.set(1, s, 1);
      }
      thruster.scale.set(1, Math.max(0.01, thr * (0.9 + 0.15 * Math.sin(time * 11))), 1);
      backRing.scale.setScalar(ringS);
      backRing.rotation.z = time * ringSpin;
      const ps = Math.max(0.01, palmS * (1 + 0.1 * Math.sin(time * 12)));
      palm.scale.setScalar(ps);
      palm.position.z = palmZ;
      palm.rotation.y = time * 3;
      halo.scale.setScalar(Math.max(0.01, haloS * (1 + 0.08 * Math.sin(time * 6))));
      haloMat.opacity = Math.min(0.75, 0.3 + 0.12 * (haloS - 1));
      orb.rotation.y = time * 2.5;
      glow.scale.setScalar(glowS);
      glowMat.opacity = glowO * (0.85 + 0.15 * Math.sin(time * 5));
      ringMat.opacity = anim === 'dead' ? 0.3 : 0.85;
      gem.rotation.y = time;

      for (let i = 0; i < embers.length; i++) {
        const ang = time * emSpin + i * (Math.PI * 2 / 3);
        const r = emR + emSpread * Math.sin(i * 2.1);
        const y = anim === 'recall' ? ((emY + i * 66) % 200) + 40 : emY + Math.sin(time * 3 + i * 2) * 14;
        embers[i].position.set(Math.cos(ang) * r, y, Math.sin(ang) * r + emZ + bz);
        embers[i].rotation.set(time * 3 + i, time * 2, 0);
      }
    }

    update({ anim: 'idle', time: 0, t: 0 });
    return { object: root, update: update };
  }

  // ------------------------------------------------------------------ efectos
  function fxMat(THREE, color, op) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: op, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
  }

  function makeFx(THREE) {
    const group = new THREE.Group();
    const mats = [];
    return {
      group: group,
      mesh: function (geo, color, op, parent) {
        const m = fxMat(THREE, color, op);
        m.userData.base = op;
        mats.push(m);
        const me = new THREE.Mesh(geo, m);
        (parent || group).add(me);
        return me;
      },
      fade: function (f) { for (const m of mats) m.opacity = m.userData.base * clamp01(f); }
    };
  }

  // bola de fuego viajera (projectile / line)
  function fireball(THREE, info, big) {
    const F = makeFx(THREE);
    const w = Math.max(60, num(info.width, 140)) * (big ? 1.6 : 1);
    const len = num(info.length, 1000);
    const ball = new THREE.Group();
    F.group.add(ball);
    ball.position.y = 70;
    const core = F.mesh(new THREE.IcosahedronGeometry(w * 0.22, 1), C.white, 1, ball);
    const shell = F.mesh(new THREE.IcosahedronGeometry(w * 0.36, 1), C.fire, 0.75, ball);
    const outer = F.mesh(new THREE.SphereGeometry(w * 0.5, 12, 8), C.magma, 0.3, ball);
    const trail = [];
    for (let i = 0; i < 5; i++) {
      const tc = F.mesh(new THREE.ConeGeometry(w * (0.32 - i * 0.04), w * (1.4 + i * 0.35), 6), i % 2 ? C.gold : C.fire, 0.6 - i * 0.07, ball);
      tc.rotation.x = -Math.PI / 2;
      tc.position.set(Math.sin(i * 2.4) * w * 0.12, Math.cos(i * 2.4) * w * 0.12, -w * (0.6 + i * 0.25));
      trail.push(tc);
    }
    const spin = F.mesh(new THREE.TorusGeometry(w * 0.45, w * 0.04, 4, 16), C.gold, 0.8, ball);
    const sparks = [];
    for (let i = 0; i < 4; i++) sparks.push(F.mesh(new THREE.OctahedronGeometry(w * 0.08, 0), C.gold, 0.9, ball));
    let time = 0;
    return {
      object: F.group,
      update: function (p, dt) {
        time += num(dt, 0.016);
        p = clamp01(p);
        if (info.kind === 'line') ball.position.z = p * len;
        core.rotation.set(time * 7, time * 5, 0);
        shell.rotation.set(-time * 4, time * 6, 0);
        shell.scale.setScalar(1 + 0.12 * Math.sin(time * 25));
        outer.scale.setScalar(1 + 0.15 * Math.sin(time * 17));
        spin.rotation.z = time * 9;
        for (let i = 0; i < trail.length; i++) trail[i].scale.set(1, 0.8 + 0.3 * Math.sin(time * 20 + i * 1.3), 1);
        for (let i = 0; i < sparks.length; i++) {
          const k = (time * 2.5 + i / 4) % 1;
          sparks[i].position.set(Math.sin(i * 1.9) * w * 0.4 * (1 + k), Math.cos(i * 1.9) * w * 0.4 * (1 + k), -w * (0.4 + 2 * k));
          sparks[i].scale.setScalar(1 - k);
        }
        F.fade(Math.min(p / 0.06, (1 - p) / 0.12, 1));
      }
    };
  }

  // estallido radial (self / burst / target / dash / genérico)
  function burst(THREE, info, opts) {
    opts = opts || {};
    const F = makeFx(THREE);
    const R = Math.max(80, num(info.radius, 300));
    const ring = F.mesh(new THREE.RingGeometry(0.82, 1, 48), C.fire, 0.9);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 4;
    const ring2 = F.mesh(new THREE.RingGeometry(0.9, 1, 48), C.gold, 0.8);
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 6;
    const disc = F.mesh(new THREE.CircleGeometry(1, 32), C.magma, 0.45);
    disc.rotation.x = -Math.PI / 2; disc.position.y = 3;
    const dome = F.mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.fire, 0.5);
    const core = F.mesh(new THREE.IcosahedronGeometry(1, 1), C.white, 0.9);
    core.position.y = 60;
    const n = opts.spikes || 10;
    const spikes = [];
    const spGeo = new THREE.ConeGeometry(R * 0.07, R * 0.45, 5);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const s = F.mesh(spGeo, i % 2 ? C.gold : C.fire, 0.85);
      s.userData.a = a;
      // apuntar hacia afuera (cono mira +Y): rotar sobre el eje tangente
      s.rotation.set(0, a, 0);
      s.rotation.order = 'YXZ';
      s.rotation.x = Math.PI / 2 - 0.45;
      spikes.push(s);
    }
    const embers = [];
    const emGeo = new THREE.OctahedronGeometry(R * 0.04, 0);
    for (let i = 0; i < 8; i++) embers.push(F.mesh(emGeo, i % 2 ? C.gold : C.fire, 1));
    return {
      object: F.group,
      update: function (p) {
        p = clamp01(p);
        const e = 1 - Math.pow(1 - p, 3);
        ring.scale.set(R * (0.2 + 1.1 * e), R * (0.2 + 1.1 * e), 1);
        ring2.scale.set(R * (0.1 + 0.9 * ease(seg(p, 0.05, 0.6))) + 1, R * (0.1 + 0.9 * ease(seg(p, 0.05, 0.6))) + 1, 1);
        disc.scale.set(R * e, R * e, 1);
        const d = R * (0.3 + 0.75 * e);
        dome.scale.set(d, d * (0.7 - 0.4 * p), d);
        core.scale.setScalar(Math.max(0.01, R * 0.35 * (1 - seg(p, 0, 0.4))));
        for (const s of spikes) {
          const a = s.userData.a, r = R * (0.25 + 0.85 * e);
          s.position.set(Math.sin(a) * r, 25 + 30 * (1 - e), Math.cos(a) * r);
          s.scale.set(1, Math.max(0.01, 1.2 - p), 1);
        }
        for (let i = 0; i < embers.length; i++) {
          const a = i / embers.length * Math.PI * 2 + 0.3;
          const r = R * (0.2 + 1.0 * e);
          embers[i].position.set(Math.sin(a) * r, Math.max(8, 20 + 220 * p - 260 * p * p + (i % 3) * 30 * p), Math.cos(a) * r);
          embers[i].rotation.set(p * 10 + i, p * 7, 0);
        }
        F.fade(Math.min(p / 0.05, 1) * (1 - ease(seg(p, 0.45, 1))));
      }
    };
  }

  // pilar de llamas (área con retardo)
  function pillar(THREE, info) {
    const F = makeFx(THREE);
    const R = Math.max(80, num(info.radius, 200));
    const IMP = 0.45;
    const warn = F.mesh(new THREE.RingGeometry(0.9, 1, 48), C.fire, 0.9);
    warn.rotation.x = -Math.PI / 2; warn.position.y = 3; warn.scale.set(R, R, 1);
    const fill = F.mesh(new THREE.CircleGeometry(1, 40), C.magma, 0.35);
    fill.rotation.x = -Math.PI / 2; fill.position.y = 2;
    const rune = F.mesh(new THREE.RingGeometry(0.55, 0.6, 6, 1), C.gold, 0.8);
    rune.rotation.x = -Math.PI / 2; rune.position.y = 4; rune.scale.set(R, R, 1);
    const col = new THREE.Group();
    F.group.add(col);
    const H = 520;
    const outer = F.mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.85, H, 14, 1, true), C.fire, 0.55, col);
    outer.position.y = H / 2;
    const inner = F.mesh(new THREE.CylinderGeometry(R * 0.25, R * 0.45, H * 1.15, 10, 1, true), C.gold, 0.8, col);
    inner.position.y = H * 1.15 / 2;
    const cap = F.mesh(new THREE.ConeGeometry(R * 0.55, 160, 10, 1, true), C.fire, 0.5, col);
    cap.position.y = H + 80;
    const tongues = [];
    const tGeo = new THREE.ConeGeometry(R * 0.16, 200, 5);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const tg = F.mesh(tGeo, i % 2 ? C.gold : C.magma, 0.75, col);
      tg.position.set(Math.sin(a) * R * 0.85, 100, Math.cos(a) * R * 0.85);
      tg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
      tongues.push(tg);
    }
    const scorch = F.mesh(new THREE.CircleGeometry(1, 32), C.fire, 0.6);
    scorch.rotation.x = -Math.PI / 2; scorch.position.y = 5;
    const embers = [];
    const eGeo = new THREE.OctahedronGeometry(14, 0);
    for (let i = 0; i < 7; i++) embers.push(F.mesh(eGeo, i % 2 ? C.gold : C.white, 1));
    let time = 0;
    return {
      object: F.group,
      update: function (p, dt) {
        time += num(dt, 0.016);
        p = clamp01(p);
        const w = seg(p, 0, IMP), up = ease(seg(p, IMP, IMP + 0.1)), out = ease(seg(p, 0.7, 1));
        fill.scale.set(R * w + 0.01, R * w + 0.01, 1);
        rune.rotation.z = time * 2;
        warn.scale.set(R * (1 + 0.04 * Math.sin(time * 18)), R * (1 + 0.04 * Math.sin(time * 18)), 1);
        const visCol = p >= IMP;
        col.visible = visCol;
        col.scale.set(1 + 0.25 * up * (1 - up) * 4 * 0.25, Math.max(0.01, up * (1 - 0.5 * out)), 1);
        outer.rotation.y = time * 3; inner.rotation.y = -time * 5;
        for (let i = 0; i < tongues.length; i++) tongues[i].scale.set(1, 0.7 + 0.4 * Math.sin(time * 14 + i), 1);
        scorch.visible = visCol;
        const sc = R * (0.6 + 0.6 * up);
        scorch.scale.set(sc, sc, 1);
        for (let i = 0; i < embers.length; i++) {
          const k = ((time * 0.9 + i / embers.length) % 1);
          const a = i * 2.4 + time;
          embers[i].visible = visCol;
          embers[i].position.set(Math.sin(a) * R * 0.6, k * 650, Math.cos(a) * R * 0.6);
          embers[i].scale.setScalar(1 - k * 0.8);
        }
        F.fade(Math.min(p / 0.05, 1) * (1 - out));
      }
    };
  }

  // meteoro gigante (área con retardo largo)
  function meteor(THREE, info) {
    const F = makeFx(THREE);
    const R = Math.max(120, num(info.radius, 400));
    const IMP = 0.58;
    // advertencia
    const warn = F.mesh(new THREE.RingGeometry(0.93, 1, 64), C.magma, 0.95);
    warn.rotation.x = -Math.PI / 2; warn.position.y = 3; warn.scale.set(R, R, 1);
    const fill = F.mesh(new THREE.CircleGeometry(1, 48), C.fire, 0.28);
    fill.rotation.x = -Math.PI / 2; fill.position.y = 2;
    const rune = F.mesh(new THREE.RingGeometry(0.62, 0.68, 5, 1), C.gold, 0.85);
    rune.rotation.x = -Math.PI / 2; rune.position.y = 4;
    const rune2 = F.mesh(new THREE.RingGeometry(0.78, 0.8, 32, 1), C.gold, 0.7);
    rune2.rotation.x = -Math.PI / 2; rune2.position.y = 4;
    const cross = [];
    for (let i = 0; i < 2; i++) {
      const b = F.mesh(new THREE.BoxGeometry(R * 1.7, 2, R * 0.04), C.fire, 0.6);
      b.position.y = 4; b.rotation.y = i * Math.PI / 2 + Math.PI / 4;
      cross.push(b);
    }
    // roca
    const rock = new THREE.Group();
    F.group.add(rock);
    const rockMat = new THREE.MeshStandardMaterial({ color: C.coal, emissive: C.magma, emissiveIntensity: 0.55, flatShading: true, roughness: 0.7 });
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(R * 0.3, 0), rockMat);
    rock.add(stone);
    const shell = F.mesh(new THREE.IcosahedronGeometry(R * 0.4, 1), C.fire, 0.55, rock);
    const trail = [];
    for (let i = 0; i < 3; i++) {
      const tc = F.mesh(new THREE.ConeGeometry(R * (0.36 - i * 0.08), R * (1.6 + i * 0.6), 7), [C.fire, C.gold, C.magma][i], 0.55 - i * 0.1, rock);
      tc.position.y = R * (0.85 + i * 0.3);
      trail.push(tc);
    }
    // dirección de caída: desde arriba y atrás
    const from = new THREE.Vector3(0, 1700, -650);
    const dir = from.clone().normalize();
    rock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // impacto
    const flash = F.mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.white, 0.9);
    const dome = F.mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.fire, 0.6);
    const shock = F.mesh(new THREE.RingGeometry(0.85, 1, 64), C.gold, 0.9);
    shock.rotation.x = -Math.PI / 2; shock.position.y = 6;
    const plume = F.mesh(new THREE.CylinderGeometry(R * 0.35, R * 0.15, 600, 12, 1, true), C.fire, 0.6);
    const plumeCap = F.mesh(new THREE.SphereGeometry(R * 0.5, 12, 8), C.magma, 0.55);
    const scorch = F.mesh(new THREE.CircleGeometry(1, 40), C.magma, 0.6);
    scorch.rotation.x = -Math.PI / 2; scorch.position.y = 3;
    const debris = [];
    const dGeo = new THREE.DodecahedronGeometry(R * 0.07, 0);
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(dGeo, rockMat);
      d.userData.a = i / 6 * Math.PI * 2 + 0.4;
      F.group.add(d);
      debris.push(d);
    }
    const impactParts = [flash, dome, shock, plume, plumeCap, scorch].concat(debris);
    let time = 0;
    return {
      object: F.group,
      update: function (p, dt) {
        time += num(dt, 0.016);
        p = clamp01(p);
        const fall = seg(p, 0.05, IMP);
        const hit = p >= IMP;
        const q = seg(p, IMP, 1);
        // advertencia
        const wv = seg(p, 0, IMP);
        fill.scale.set(R * wv + 0.01, R * wv + 0.01, 1);
        const rs = R * (1.6 - 0.6 * ease(wv));
        rune.scale.set(rs, rs, 1); rune.rotation.z = time * 1.5;
        rune2.scale.set(rs, rs, 1); rune2.rotation.z = -time;
        for (const b of cross) b.visible = !hit;
        rune.visible = rune2.visible = !hit;
        warn.scale.set(R * (1 + 0.03 * Math.sin(time * 20)), R * (1 + 0.03 * Math.sin(time * 20)), 1);
        // caída
        rock.visible = !hit && p > 0.04;
        const f2 = fall * fall;
        rock.position.set(from.x * (1 - f2), from.y * (1 - f2) + R * 0.25, from.z * (1 - f2));
        stone.rotation.set(time * 2, time * 3, 0);
        shell.scale.setScalar(1 + 0.1 * Math.sin(time * 22));
        for (let i = 0; i < trail.length; i++) trail[i].scale.set(1, 0.85 + 0.25 * Math.sin(time * 16 + i), 1);
        // impacto
        for (const o of impactParts) o.visible = hit;
        const e = 1 - Math.pow(1 - q, 3);
        flash.scale.setScalar(R * (0.4 + 0.8 * ease(seg(q, 0, 0.25))) * (1 - seg(q, 0.15, 0.4)) + 0.01);
        const dr = R * (0.5 + 0.7 * e);
        dome.scale.set(dr, dr * (0.8 - 0.5 * q), dr);
        shock.scale.set(R * (0.3 + 1.3 * e), R * (0.3 + 1.3 * e), 1);
        plume.scale.set(1 + q, Math.max(0.01, ease(seg(q, 0, 0.3))), 1 + q);
        plume.position.y = 300 * ease(seg(q, 0, 0.3));
        plumeCap.position.y = 80 + 560 * ease(seg(q, 0, 0.45));
        plumeCap.scale.setScalar(0.4 + 1.4 * e);
        scorch.scale.set(R * 1.05, R * 1.05, 1);
        for (const d of debris) {
          const a = d.userData.a, r = R * 1.3 * e;
          d.position.set(Math.sin(a) * r, Math.max(0, 500 * q - 700 * q * q) + 10, Math.cos(a) * r);
          d.rotation.set(q * 12 + a, q * 9, 0);
        }
        let fade = Math.min(p / 0.05, 1);
        if (hit) fade *= 1 - ease(seg(q, 0.45, 1));
        F.fade(fade);
        rockMat.emissiveIntensity = 0.55 + 0.6 * fall;
      }
    };
  }

  // fx por habilidad, con genéricos para cualquier kind
  function fxQ(THREE, ctx, info) {
    info = info || {};
    const k = info.kind;
    if (k === 'projectile' || k === 'line' || !k) return fireball(THREE, info, false);
    return burst(THREE, info, { spikes: 8 });
  }
  function fxW(THREE, ctx, info) {
    info = info || {};
    const k = info.kind;
    if (k === 'projectile' || k === 'line') return fireball(THREE, info, false);
    return pillar(THREE, info);
  }
  function fxE(THREE, ctx, info) {
    info = info || {};
    const k = info.kind;
    if (k === 'projectile' || k === 'line') return fireball(THREE, info, false);
    return burst(THREE, info, { spikes: 12 });
  }
  function fxR(THREE, ctx, info) {
    info = info || {};
    const k = info.kind;
    if (k === 'projectile' || k === 'line') return fireball(THREE, info, true);
    if (k === 'self' || k === 'burst' || k === 'dash') return burst(THREE, info, { spikes: 14 });
    return meteor(THREE, info);
  }

  function safe(fn) {
    return function (THREE, ctx, info) {
      try { return fn(THREE, ctx, info); } catch (e) {
        const g = new THREE.Group();
        return { object: g, update: function () {} };
      }
    };
  }

  MOBA.defineChampionArt('ignis', {
    lore: 'Fue aprendiz de herrero hasta que se tragó una brasa del corazón de un volcán; ahora su cabeza es un brasero que nunca se apaga.',
    quote: '¿Tenés frío? Vení, que yo te prendo fuego.',
    build: build,
    fx: { Q: safe(fxQ), W: safe(fxW), E: safe(fxE), R: safe(fxR) }
  });
})();
