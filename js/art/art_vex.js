/* Arte 3D procedural: Vex, la Arquera Errante (Tirador).
 * Silueta: capucha verde puntiaguda echada hacia atrás, arco recurvo enorme (más alto que ella) con puntas de hoja
 * luminosas, capa abierta, carcaj cruzado con plumas doradas y bufanda menta que flamea al correr. */
(function () {
  'use strict';

  var GREEN = 0x3fbf6a, MINT = 0xd6ffd9, DARK = 0x1f5e3a, WOOD = 0x8a5a2b, GOLD = 0xf2c14e, SKIN = 0xf2c9a0, LEATHER = 0x4a2f1e;
  var PI = Math.PI, TAU = Math.PI * 2;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp01(t); return 1 - (1 - t) * (1 - t) * (1 - t); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function bell(p, a, b) { return Math.sin(seg(p, a, b) * PI); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  /* ===================== MODELO ===================== */
  function build(THREE, ctx) {
    ctx = ctx || {};
    var cache = ctx.cache;
    var teamCol = num(ctx.teamColor, 0x38a3ff);
    function M(c, o) { return cache ? cache.mat(c, o) : new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true }, o || {})); }
    function G(k, f) { return cache ? cache.geo('vex_' + k, f) : f(); }
    function mk(geo, mat, parent, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }

    var root = new THREE.Group(); root.name = 'vex';
    var spin = new THREE.Group(); spin.position.y = 110; root.add(spin);       // pivote para volteretas / caída
    var body = new THREE.Group(); body.position.y = -110; spin.add(body);

    // --- piernas (ágiles, botas grandes) ---
    var legs = [];
    for (var s = -1; s <= 1; s += 2) {
      var lg = new THREE.Group(); lg.position.set(14 * s, 92, 0); body.add(lg);
      mk(G('leg', function () { return new THREE.CapsuleGeometry(10, 50, 3, 8); }), M(DARK), lg, 0, -40, 0);
      mk(G('boot', function () { return new THREE.BoxGeometry(22, 24, 36); }), M(LEATHER), lg, 0, -80, 6);
      legs.push(lg);
    }
    var legR = legs[0], legL = legs[1];

    // --- torso ---
    var torso = new THREE.Group(); torso.position.y = 92; torso.rotation.order = 'YXZ'; body.add(torso);
    mk(G('tunic', function () { return new THREE.CylinderGeometry(26, 44, 40, 8); }), M(GREEN), torso, 0, -8, 0);
    mk(G('chest', function () { return new THREE.CylinderGeometry(31, 24, 56, 8); }), M(GREEN), torso, 0, 38, 0);
    var belt = mk(G('belt', function () { return new THREE.TorusGeometry(27, 5, 6, 14); }), M(teamCol, { emissive: teamCol, emissiveIntensity: 0.35 }), torso, 0, 12, 0);
    belt.rotation.x = PI / 2;
    mk(G('buckle', function () { return new THREE.OctahedronGeometry(9, 0); }), M(GOLD, { metalness: 0.6, roughness: 0.3 }), torso, 0, 12, 30);
    // hombrera de hoja dorada (lado del arco)
    var paul = mk(G('paul', function () { return new THREE.ConeGeometry(17, 38, 4); }), M(GOLD, { metalness: 0.5, roughness: 0.35 }), torso, 42, 66, 0);
    paul.rotation.z = -1.15; paul.scale.set(1, 1, 0.5);

    // --- bufanda + colas ---
    mk(G('scarf', function () { return new THREE.TorusGeometry(23, 9, 6, 12); }), M(MINT, { emissive: MINT, emissiveIntensity: 0.15 }), torso, 0, 70, 0)
      .rotation.x = PI / 2;
    var tails = [];
    for (var i = 0; i < 2; i++) {
      var tg = new THREE.Group(); tg.position.set(i ? 9 : -9, 70, -20); torso.add(tg);
      mk(G('tail', function () { return new THREE.BoxGeometry(13, 4, 56); }), M(MINT, { emissive: MINT, emissiveIntensity: 0.15 }), tg, 0, 0, -26);
      tails.push(tg);
    }

    // --- capa abierta ---
    var capeG = new THREE.Group(); capeG.position.set(0, 74, -8); torso.add(capeG);
    mk(G('cape', function () { return new THREE.CylinderGeometry(30, 60, 122, 10, 1, true, PI * 0.6, PI * 0.8); }),
      M(DARK, { side: THREE.DoubleSide }), capeG, 0, -61, 0);

    // --- carcaj cruzado ---
    var quiver = new THREE.Group(); quiver.position.set(10, 52, -44); quiver.rotation.set(-0.2, 0, 0.45); torso.add(quiver);
    mk(G('quiver', function () { return new THREE.CylinderGeometry(12, 10, 66, 8); }), M(LEATHER), quiver);
    for (i = 0; i < 3; i++) {
      mk(G('qshaft', function () { return new THREE.CylinderGeometry(2.2, 2.2, 36, 4); }), M(WOOD), quiver, (i - 1) * 6, 46, 0);
      var fl = mk(G('qfletch', function () { return new THREE.BoxGeometry(3, 24, 15); }), M(GOLD, { emissive: GOLD, emissiveIntensity: 0.25 }), quiver, (i - 1) * 6, 62, 0);
      fl.rotation.y = (i - 1) * 0.7;
    }

    // --- cabeza + capucha puntiaguda ---
    var head = new THREE.Group(); head.position.y = 100; torso.add(head);
    mk(G('head', function () { return new THREE.SphereGeometry(30, 12, 10); }), M(SKIN), head);
    var hood = new THREE.Group(); hood.position.set(0, 6, -8); hood.rotation.x = -0.55; head.add(hood);
    mk(G('hood', function () { return new THREE.ConeGeometry(39, 100, 8, 1, true); }), M(GREEN, { side: THREE.DoubleSide }), hood, 0, 45, 0);
    var eyeMat = new THREE.MeshBasicMaterial({ color: MINT });
    var eyes = mk(G('eyes', function () { return new THREE.BoxGeometry(34, 6, 6); }), eyeMat, head, 0, 3, 27);
    var eyeDim = new THREE.Color(0x0d2a18), eyeHot = new THREE.Color(0xffffff), eyeBase = new THREE.Color(MINT);

    // --- brazos ---
    var SH_L = new THREE.Vector3(34, 60, 0), SH_R = new THREE.Vector3(-34, 60, 0);
    function arm(sh) {
      var g = new THREE.Group(); g.position.copy(sh); torso.add(g);
      mk(G('arm', function () { return new THREE.CapsuleGeometry(8, 32, 3, 6); }), M(GREEN), g, 0, -24, 0);
      mk(G('hand', function () { return new THREE.SphereGeometry(10, 8, 6); }), M(LEATHER), g, 0, -50, 0);
      return g;
    }
    var armL = arm(SH_L), armR = arm(SH_R);

    // --- ARCO recurvo gigante (plano YZ, panza hacia +Z, empuñadura en el origen) ---
    var BR = 125, BARC = PI * 0.6, BH = BARC / 2;
    var tipY = BR * Math.sin(BH), tipZ = BR * Math.cos(BH) - BR;
    var bow = new THREE.Group(); bow.rotation.order = 'YXZ'; torso.add(bow);
    mk(G('bowArc', function () {
      var g = new THREE.TorusGeometry(BR, 5.5, 5, 26, BARC); g.rotateZ(-BH); g.rotateY(-PI / 2); g.translate(0, 0, -BR); return g;
    }), M(WOOD, { roughness: 0.6 }), bow);
    mk(G('grip', function () { return new THREE.CylinderGeometry(8, 8, 30, 6); }), M(LEATHER), bow);
    var UPV = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
    for (var sg = -1; sg <= 1; sg += 2) {
      var dir = new THREE.Vector3(0, sg * Math.cos(BH), -Math.sin(BH));
      var tip = mk(G('btip', function () { return new THREE.ConeGeometry(10, 46, 4); }), M(MINT, { emissive: MINT, emissiveIntensity: 0.7 }), bow, 0, sg * tipY, tipZ);
      tip.position.addScaledVector(dir, 18);
      tip.quaternion.setFromUnitVectors(UPV, dir);
      tip.scale.set(0.45, 1, 1);
    }
    var strMat = cache ? cache.basic(MINT) : new THREE.MeshBasicMaterial({ color: MINT });
    var strGeo = G('string', function () { return new THREE.CylinderGeometry(1.7, 1.7, 1, 4); });
    var str1 = mk(strGeo, strMat, bow), str2 = mk(strGeo, strMat, bow);
    var topTip = new THREE.Vector3(0, tipY, tipZ), botTip = new THREE.Vector3(0, -tipY, tipZ), nockL = new THREE.Vector3();

    // flecha encastrada
    var nArrow = new THREE.Group(); bow.add(nArrow);
    mk(G('ashaft', function () { var g = new THREE.CylinderGeometry(2.4, 2.4, 116, 4); g.rotateX(PI / 2); return g; }), M(WOOD), nArrow, 0, 0, 58);
    mk(G('ahead', function () { var g = new THREE.ConeGeometry(7, 24, 4); g.rotateX(PI / 2); return g; }), M(MINT, { emissive: MINT, emissiveIntensity: 0.6 }), nArrow, 0, 0, 122);
    mk(G('afletch', function () { return new THREE.BoxGeometry(3, 14, 24); }), M(GOLD, { emissive: GOLD, emissiveIntensity: 0.3 }), nArrow, 0, 0, 12);
    var glowMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var glow = mk(G('aglow', function () { return new THREE.SphereGeometry(16, 10, 8); }), glowMat, nArrow, 0, 0, 118);
    glow.visible = false;

    // destello del disparo
    var flashMat = new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var flash = mk(G('flash', function () { return new THREE.TorusGeometry(26, 4, 4, 18); }), flashMat, bow, 0, 0, 30);
    flash.visible = false;

    // aura de suelo + hojas orbitantes (W, R, recall)
    var auraMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var aura = mk(G('aura', function () { var g = new THREE.RingGeometry(64, 82, 6, 1); g.rotateX(-PI / 2); return g; }), auraMat, root, 0, 3, 0);
    aura.visible = false;
    var leafMat = new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var leaves = [];
    for (i = 0; i < 3; i++) {
      var lf = mk(G('leaf', function () { return new THREE.OctahedronGeometry(11, 0); }), leafMat, root);
      lf.scale.set(1, 0.3, 2); lf.visible = false; leaves.push(lf);
    }

    // --- utilidades de pose ---
    var tA = new THREE.Vector3(), tB = new THREE.Vector3(), fwd = new THREE.Vector3();
    var gripIdle = new THREE.Vector3(50, 40, 14), grip = new THREE.Vector3(), aimGrip = new THREE.Vector3();
    var nockW = new THREE.Vector3(), handL = new THREE.Vector3(), handR = new THREE.Vector3(), gripC = new THREE.Vector3();
    function aimArm(a, sh, target) {
      tA.copy(target).sub(sh); var len = tA.length(); if (len < 1e-3) return;
      tA.multiplyScalar(1 / len);
      a.quaternion.setFromUnitVectors(DOWN, tA);
      a.scale.set(1, Math.max(0.6, Math.min(1.35, len / 50)), 1);
    }
    function setSeg(m, a, b) {
      tB.copy(b).sub(a); var len = tB.length();
      m.position.copy(a).add(b).multiplyScalar(0.5);
      if (len > 1e-3) m.quaternion.setFromUnitVectors(UPV, tB.multiplyScalar(1 / len));
      m.scale.set(1, Math.max(len, 0.01), 1);
    }

    function update(st) {
      st = st || {};
      var anim = st.anim || 'idle', t = num(st.t, 0), p = clamp01(num(st.progress, 0));
      var time = num(st.time, 0), slot = num(st.slot, 0), speed = num(st.speed, 0);

      var sy = 0, srx = 0, srz = 0, sScale = 1;
      var tYaw = 0, tPitch = 0, tRoll = 0, hYaw = 0, hPitch = 0;
      var lL = 0, lR = 0, lLz = 0.04, lRz = -0.04;
      var aimW = 0, aimPitch = 0, pull = 0, arrowVis = false, glowK = 0, flashK = -1, flashS = 1, cant = 0.22, bowSpin = 0;
      var capeX = 0.12, tailX = -0.55, tailAmp = 0.12, tailSpd = 3;
      var auraK = 0, auraS = 1, auraSpin = 0.5, leafK = 0, leafR = 70, leafSpd = 2, leafRise = 0, eye = 0.6;
      var useGrip = false, lT = null, rT = null, onString = 1, snap = 0;
      var breath = Math.sin(time * 2.2);
      handR.copy(SH_R).add(tA.set(-8, -48, 8));

      if (anim === 'walk') {
        var k = Math.min(1.5, Math.max(0.4, speed / 340)), ph = time * 11 * k;
        lL = Math.sin(ph) * 0.8; lR = -lL;
        sy = Math.abs(Math.cos(ph)) * 10 - 3;
        tPitch = 0.22; tRoll = Math.sin(ph) * 0.06; tYaw = Math.sin(ph) * 0.12; hPitch = -0.14;
        capeX = 0.5 + Math.sin(ph * 2) * 0.12; tailX = -0.05; tailAmp = 0.18; tailSpd = 10;
        useGrip = true; gripC.set(50, 30 + Math.sin(ph * 2) * 3, 12 + Math.sin(ph) * 16);
        handR.copy(SH_R).add(tA.set(-10, -44, -Math.sin(ph) * 24));
      } else if (anim === 'attack') {
        var REL = 0.42;
        aimW = smooth(seg(p, 0, 0.16)) * (1 - smooth(seg(p, 0.8, 1)));
        if (p < REL) { pull = easeOut(seg(p, 0.05, REL - 0.04)); arrowVis = true; }
        else { snap = 1 - seg(p, REL, REL + 0.3); onString = 0; flashK = seg(p, REL, REL + 0.28); }
        tYaw = -1.05 * aimW; tPitch = -0.07 * pull + 0.06 * snap; aimPitch = 0.06 + 0.22 * snap * snap;
        hYaw = 0.9 * aimW; lL = -0.35 * aimW; lR = 0.3 * aimW; sy = -6 * aimW;
        cant = lerp(0.22, -0.12, aimW); capeX = 0.15 + snap * 0.25; tailX = -0.4 + snap * 0.3;
      } else if (anim === 'cast' && slot === 0) {
        // Q: flecha perforante cargada
        var RQ = 0.56;
        aimW = smooth(seg(p, 0, 0.15)) * (1 - smooth(seg(p, 0.85, 1)));
        if (p < RQ) { pull = easeOut(seg(p, 0.05, RQ - 0.06)) * 1.3; arrowVis = true; glowK = seg(p, 0.1, RQ); }
        else { snap = 1 - seg(p, RQ, RQ + 0.3); onString = 0; flashK = seg(p, RQ, RQ + 0.3); flashS = 2; }
        tYaw = -1.2 * aimW; tPitch = -0.12 * pull + 0.1 * snap; aimPitch = 0.04 + 0.3 * snap * snap;
        hYaw = 1.05 * aimW; lL = -0.45 * aimW; lR = 0.35 * aimW; sy = -7 * aimW + 6 * snap;
        cant = lerp(0.22, -0.05, aimW); eye = 0.6 + glowK * 0.8; auraK = glowK * 0.5; auraS = 0.9; auraSpin = 3;
        capeX = 0.2 + snap * 0.5; tailX = -0.3 + snap * 0.5;
      } else if (anim === 'cast' && slot === 1) {
        // W: concentración — arco vertical frente a la cara, ojos que se encienden, giro del arco
        var f = smooth(seg(p, 0, 0.2)) * (1 - smooth(seg(p, 0.6, 0.85)));
        useGrip = true; gripC.copy(gripIdle).lerp(tA.set(0, 72, 36), f);
        cant = 0.22 * (1 - f); bowSpin = TAU * smooth(seg(p, 0.6, 0.9));
        hPitch = 0.28 * f - 0.15 * bell(p, 0.55, 0.8);
        tPitch = 0.08 * f; sy = 4 * f + 16 * bell(p, 0.55, 0.8);
        handL.copy(gripC).add(tA.set(6, -10, 0)); lT = handL;
        handR.lerp(tA.set(-6, -10, 0).add(gripC), f); rT = handR;
        eye = 0.6 + 1.0 * seg(p, 0.05, 0.55) - 0.4 * seg(p, 0.85, 1);
        auraK = smooth(seg(p, 0, 0.3)) * (1 - seg(p, 0.85, 1)); auraS = 1 + 0.25 * bell(p, 0.55, 0.85); auraSpin = 2.5;
        leafK = auraK; leafR = 60; leafSpd = 7; leafRise = 1;
        flashK = seg(p, 0.55, 0.85); flashS = 1.5;
        tailX = -0.3 + 0.4 * f; tailSpd = 6;
      } else if (anim === 'cast' && slot === 2) {
        // E: voltereta hacia adelante, hecha bolita
        var r = smooth(seg(p, 0.08, 0.72)), tuck = bell(p, 0.04, 0.78);
        srx = TAU * r; sy = Math.sin(PI * r) * 70 - 22 * bell(p, 0.75, 1);
        sScale = 1 - 0.15 * tuck;
        lL = lR = -1.5 * tuck; tPitch = 0.6 * tuck; hPitch = 0.4 * tuck;
        useGrip = true; gripC.copy(gripIdle).lerp(tA.set(28, 40, 28), tuck);
        handR.copy(SH_R).add(tA.set(18 * tuck - 8, -48 + 20 * tuck, 8 + 22 * tuck));
        capeX = 0.2 + 0.9 * tuck; tailX = 0.2; tailAmp = 0.3; tailSpd = 14;
      } else if (anim === 'cast') {
        // R: salto épico, arco apuntando al cielo, tres flechas en ráfaga
        var rise = smooth(seg(p, 0.1, 0.3)) * (1 - smooth(seg(p, 0.88, 1)));
        aimW = smooth(seg(p, 0.05, 0.25)) * (1 - smooth(seg(p, 0.92, 1)));
        sy = -18 * bell(p, 0, 0.16) + 55 * rise + Math.sin(time * 5) * 4 * rise;
        aimPitch = 1.15; tYaw = -0.7 * aimW; tPitch = -0.25 * aimW; hPitch = -0.55 * aimW; hYaw = 0.55 * aimW;
        var rels = [0.45, 0.62, 0.79], starts = [0.18, 0.47, 0.64], fired = -1;
        for (var j = 0; j < 3; j++) {
          if (p < rels[j]) { if (p >= starts[j] || j === 0) { pull = easeOut(seg(p, starts[j], rels[j] - 0.02)) * (j ? 1.1 : 1.4); arrowVis = true; } break; }
          fired = j;
        }
        if (fired >= 0) { var fk = seg(p, rels[fired], rels[fired] + 0.15); if (fk < 1) { flashK = fk; flashS = 2.4; snap = 1 - fk; onString = arrowVis ? 1 : 0; } }
        if (!arrowVis) onString = 0;
        glowK = aimW;
        lL = -0.6 * rise; lR = 0.4 * rise; cant = 0;
        auraK = aimW; auraS = 1.8 + 0.2 * Math.sin(time * 6); auraSpin = 4;
        leafK = aimW; leafR = 100; leafSpd = 5; leafRise = 1; eye = 1.6;
        capeX = 0.5 + 0.25 * Math.sin(time * 9); tailX = 0.25; tailAmp = 0.25; tailSpd = 12;
      } else if (anim === 'recall') {
        // arrodillada, arco clavado delante, hojas que suben en espiral
        var kq = smooth(seg(t, 0, 0.6));
        sy = -20 * kq; lL = -0.55 * kq; lR = 0.8 * kq;
        useGrip = true; gripC.copy(gripIdle).lerp(tA.set(6, 42, 48), kq); cant = 0.22 * (1 - kq);
        tPitch = 0.14 * kq; hPitch = 0.3 * kq + Math.sin(time * 1.5) * 0.03;
        handL.copy(gripC).add(tA.set(4, 26 * kq, -4)); lT = handL;
        handR.copy(gripC).add(tA.set(-6, 18 * kq, -4));
        eye = 0.7 + 0.5 * (0.5 + 0.5 * Math.sin(time * 4)) * kq;
        auraK = kq * (0.6 + 0.25 * Math.sin(time * 4)); auraS = 1.1; auraSpin = 0.8;
        leafK = kq; leafR = 75; leafSpd = 1.6; leafRise = 1;
        tailX = -0.5 + 0.15 * Math.sin(time * 2);
      } else if (anim === 'dead') {
        var fd = easeOut(seg(t, 0, 0.55));
        srx = -(PI / 2) * fd + bell(t, 0.55, 0.75) * 0.08; sy = -20 * fd; srz = 0.1 * fd;
        useGrip = true; gripC.copy(gripIdle).lerp(tA.set(85, 10, 30), fd); cant = lerp(0.22, 1.35, fd); onString = 0;
        handL.copy(SH_L).add(tA.set(46, -10, 12)); lT = handL;
        handR.copy(SH_R).add(tA.set(-46, -10, 12));
        eye = 0.6 * (1 - fd); capeX = 0.12 - 0.2 * fd; tailX = -0.9; tailAmp = 0.02; hPitch = -0.2 * fd;
        lL = -0.15 * fd; lR = 0.1 * fd; lLz = 0.3 * fd; lRz = -0.3 * fd;
      } else {
        // idle: respira, mira alrededor y cada tanto hace girar el arco
        sy = breath * 2.5; tPitch = 0.03 + breath * 0.02;
        hYaw = Math.sin(time * 0.45) * 0.3; hPitch = Math.sin(time * 0.7) * 0.05;
        var fc = time % 7; if (fc < 0.9) bowSpin = TAU * smooth(fc / 0.9);
        capeX = 0.1 + breath * 0.03;
      }

      // --- aplicar pose ---
      spin.position.y = 110 + sy; spin.rotation.set(srx, 0, srz); spin.scale.setScalar(sScale);
      torso.rotation.set(tPitch, tYaw, tRoll);
      head.rotation.set(hPitch, hYaw, 0);
      legL.rotation.set(lL, 0, lLz); legR.rotation.set(lR, 0, lRz);
      capeG.rotation.x = capeX + Math.sin(time * 2.5) * 0.03;
      for (var q = 0; q < 2; q++) {
        tails[q].rotation.x = tailX + Math.sin(time * tailSpd + q * 1.3) * tailAmp;
        tails[q].rotation.y = (q ? 0.25 : -0.25) + Math.sin(time * tailSpd * 0.7 + q) * 0.1;
      }

      // arco: posición de empuñadura
      grip.copy(useGrip ? gripC : gripIdle);
      var fy = -tYaw;
      fwd.set(Math.sin(fy), 0, Math.cos(fy));
      if (aimW > 0) {
        aimGrip.copy(SH_L).addScaledVector(fwd, 64 * Math.cos(aimPitch)); aimGrip.y += 64 * Math.sin(aimPitch);
        grip.lerp(aimGrip, aimW);
      }
      bow.position.copy(grip);
      bow.rotation.set(-aimPitch * aimW, -tYaw + bowSpin, cant);

      // cuerda
      var vib = snap > 0 ? Math.sin(time * 70) * 6 * snap : 0;
      var nockZ = tipZ - pull * 52 + vib;
      nockL.set(0, 0, nockZ);
      setSeg(str1, topTip, nockL); setSeg(str2, botTip, nockL);
      nArrow.visible = arrowVis; nArrow.position.z = nockZ;
      glow.visible = arrowVis && glowK > 0.01;
      if (glow.visible) { glowMat.opacity = (0.35 + 0.45 * glowK) * (0.85 + 0.15 * Math.sin(time * 22)); glow.scale.setScalar(0.6 + glowK * 1.1); }

      // destello
      flash.visible = flashK >= 0 && flashK < 1;
      if (flash.visible) { flash.scale.setScalar((0.5 + flashK * 2.2) * flashS); flash.position.z = 30 + flashK * 70; flashMat.opacity = (1 - flashK) * 0.9; }

      // brazos
      bow.updateMatrix();
      nockW.set(0, 0, nockZ).applyMatrix4(bow.matrix);
      if (aimW > 0 && !rT) {
        if (onString) tA.copy(nockW);
        else tA.copy(nockW).addScaledVector(fwd, -30).add(tB.set(0, 18, 0));
        handR.lerp(tA, aimW);
      }
      aimArm(armL, SH_L, lT || grip);
      aimArm(armR, SH_R, handR);

      // ojos
      if (eye <= 0.6) eyeMat.color.copy(eyeDim).lerp(eyeBase, clamp01(eye / 0.6));
      else eyeMat.color.copy(eyeBase).lerp(eyeHot, clamp01((eye - 0.6) / 1.0));
      eyes.scale.set(1 + 0.25 * clamp01(eye - 0.6), 1 + 0.6 * clamp01(eye - 0.6), 1);

      // aura y hojas
      aura.visible = auraK > 0.01;
      if (aura.visible) { auraMat.opacity = 0.75 * auraK; aura.scale.setScalar(auraS); aura.rotation.y = time * auraSpin; }
      for (q = 0; q < 3; q++) {
        var lf2 = leaves[q]; lf2.visible = leafK > 0.01;
        if (!lf2.visible) continue;
        var a = time * leafSpd + q * TAU / 3;
        var h = leafRise ? 20 + ((time * 70 + q * 70) % 210) : 120;
        lf2.position.set(Math.cos(a) * leafR, h, Math.sin(a) * leafR);
        lf2.rotation.set(0.4, -a, Math.sin(time * 6 + q) * 0.5);
      }
      leafMat.opacity = 0.9 * leafK;
    }

    update({ anim: 'idle', t: 0, time: 0 });
    return { object: root, update: update };
  }

  /* ===================== EFECTOS ===================== */
  function fxMat(THREE, color, opts) {
    return new THREE.MeshBasicMaterial(Object.assign({
      color: color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    }, opts || {}));
  }
  function env(p, a, b) { return clamp01(p / a) * clamp01((1 - p) / b); }

  // Flecha de luz que gira como taladro con estela y anillos de viento
  function arrowFx(THREE, info, tipC, glowC, big) {
    var w = Math.max(0.6, Math.min(2.2, num(info.width, 120) / 110)) * (big || 1);
    var g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    var mCore = fxMat(THREE, 0xffffff), mTip = fxMat(THREE, tipC), mGlow = fxMat(THREE, glowC), mTrail = fxMat(THREE, glowC), mRing = fxMat(THREE, tipC), mFl = fxMat(THREE, GOLD);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.5 * w, 3.5 * w, 190, 6), mCore); shaft.rotation.x = PI / 2; body.add(shaft);
    var tip = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mTip); tip.scale.set(20 * w, 20 * w, 50 * w); tip.position.z = 112; body.add(tip);
    var flGeo = new THREE.BoxGeometry(1, 1, 1);
    for (var i = 0; i < 2; i++) {
      var fl = new THREE.Mesh(flGeo, mFl); fl.position.z = -85;
      fl.scale.set(i ? 2 : 30 * w, i ? 30 * w : 2, 44); body.add(fl);
    }
    var halo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mGlow); halo.scale.set(34 * w, 34 * w, 150); halo.position.z = 30; body.add(halo);
    var trail = new THREE.Mesh(new THREE.ConeGeometry(16 * w, 480, 10, 1, true), mTrail); trail.rotation.x = -PI / 2; trail.position.z = -95 - 240; g.add(trail);
    var rings = [], rGeo = new THREE.TorusGeometry(26 * w, 2.5 * w, 4, 18);
    for (i = 0; i < 3; i++) { var rg = new THREE.Mesh(rGeo, mRing); g.add(rg); rings.push(rg); }
    function update(p) {
      p = clamp01(num(p, 0));
      var a = env(p, 0.06, 0.12);
      mCore.opacity = a; mTip.opacity = a; mFl.opacity = 0.9 * a;
      mGlow.opacity = 0.35 * a * (0.85 + 0.15 * Math.sin(p * 60)); mTrail.opacity = 0.45 * a; mRing.opacity = 0.55 * a;
      body.rotation.z = p * 16;
      for (var k = 0; k < 3; k++) {
        var c = (p * 6 + k / 3) % 1;
        rings[k].position.z = -40 - c * 320; rings[k].scale.setScalar(1 + c * 1.3); rings[k].rotation.z = p * 20 + k;
      }
    }
    update(0);
    return { object: g, update: update, body: body };
  }

  // La flecha recorre una línea dejando un surco brillante
  function arrowLineFx(THREE, info, tipC, glowC) {
    var L = Math.max(100, num(info.length, 1000)), W = Math.max(40, num(info.width, 120));
    var g = new THREE.Group(), arrow = arrowFx(THREE, info, tipC, glowC); arrow.object.position.y = 70; g.add(arrow.object);
    var mPath = fxMat(THREE, glowC);
    var path = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mPath); path.rotation.x = -PI / 2; path.position.y = 4; g.add(path);
    function update(p) {
      p = clamp01(num(p, 0)); arrow.update(p);
      var z = easeOut(p * 1.15) * L; arrow.object.position.z = z;
      path.scale.set(W * (0.4 + 0.6 * (1 - p)), Math.max(1, z), 1); path.position.z = z / 2;
      mPath.opacity = 0.35 * env(p, 0.05, 0.4);
    }
    update(0);
    return { object: g, update: update };
  }

  // Estallido genérico de hojas
  function burstFx(THREE, info, c1, c2) {
    var r = Math.max(60, Math.min(450, num(info.radius, 150)));
    var g = new THREE.Group();
    var mF = fxMat(THREE, c2), mR = fxMat(THREE, c1), mL = fxMat(THREE, c2);
    var fl = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mF); fl.position.y = 50; g.add(fl);
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), mR); ring.rotation.x = -PI / 2; ring.position.y = 4; g.add(ring);
    var shards = [], lg = new THREE.OctahedronGeometry(12, 0);
    for (var i = 0; i < 6; i++) { var s = new THREE.Mesh(lg, mL); s.scale.set(1, 0.3, 2); g.add(s); shards.push(s); }
    function update(p) {
      p = clamp01(num(p, 0)); var e = easeOut(p);
      fl.scale.setScalar(r * 0.45 * (0.3 + e)); mF.opacity = 0.7 * (1 - seg(p, 0, 0.5));
      ring.scale.setScalar(r * (0.2 + 0.8 * e)); mR.opacity = 0.85 * (1 - p);
      for (var k = 0; k < 6; k++) {
        var a = k * TAU / 6 + 0.3; var d = r * 0.9 * e;
        shards[k].position.set(Math.cos(a) * d, 40 + Math.sin(p * PI) * 90, Math.sin(a) * d);
        shards[k].rotation.set(p * 8 + k, -a, p * 5);
      }
      mL.opacity = 0.9 * (1 - p);
    }
    update(0);
    return { object: g, update: update };
  }

  // W: Concentración — hexágono rúnico, mira que se cierra, columnas de luz y hojas en espiral
  function focusFx(THREE, info) {
    var r = Math.max(90, Math.min(320, num(info.radius, 160)));
    var g = new THREE.Group();
    var mBase = fxMat(THREE, GREEN), mHex = fxMat(THREE, MINT), mRet = fxMat(THREE, MINT), mCol = fxMat(THREE, GREEN), mLeaf = fxMat(THREE, MINT);
    var base = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 48), mBase); base.rotation.x = -PI / 2; base.position.y = 3; g.add(base);
    var hex = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r * 0.63, 6), mHex); hex.rotation.x = -PI / 2; hex.position.y = 5; g.add(hex);
    var ret = new THREE.Group(); ret.position.y = 6; g.add(ret);
    var tris = [], triGeo = new THREE.ConeGeometry(14, 40, 3); triGeo.rotateZ(PI / 2);
    for (var i = 0; i < 4; i++) { var tr = new THREE.Mesh(triGeo, mRet); ret.add(tr); tris.push(tr); }
    var cols = [], colGeo = new THREE.CylinderGeometry(r * 0.7, r * 0.8, 160, 24, 1, true);
    for (i = 0; i < 2; i++) { var c = new THREE.Mesh(colGeo, mCol); g.add(c); cols.push(c); }
    var leaves = [], lg = new THREE.OctahedronGeometry(10, 0);
    for (i = 0; i < 8; i++) { var l = new THREE.Mesh(lg, mLeaf); l.scale.set(1, 0.3, 2); g.add(l); leaves.push(l); }
    function update(p) {
      p = clamp01(num(p, 0)); var a = env(p, 0.12, 0.3);
      mBase.opacity = 0.6 * a; mHex.opacity = 0.8 * a; hex.rotation.z = p * 4;
      var close = smooth(seg(p, 0, 0.45));
      mRet.opacity = 0.95 * a * (1 - 0.5 * seg(p, 0.6, 1));
      ret.rotation.y = -p * 3;
      for (var k = 0; k < 4; k++) {
        var ang = k * PI / 2, d = r * lerp(1.25, 0.3, close);
        tris[k].position.set(Math.cos(ang) * d, 0, Math.sin(ang) * d);
        tris[k].rotation.y = -ang + PI;
      }
      for (k = 0; k < 2; k++) {
        var c2 = (p * 2 + k * 0.5) % 1;
        cols[k].position.y = 80 + c2 * 120; cols[k].scale.set(1 - 0.3 * c2, 0.6 + c2, 1 - 0.3 * c2);
      }
      mCol.opacity = 0.22 * a;
      for (k = 0; k < 8; k++) {
        var an = p * 9 + k * TAU / 8, rr = r * (0.75 - 0.35 * ((p * 1.5 + k / 8) % 1));
        leaves[k].position.set(Math.cos(an) * rr, 20 + ((p * 1.5 + k / 8) % 1) * 220, Math.sin(an) * rr);
        leaves[k].rotation.set(0.5, -an, p * 10);
      }
      mLeaf.opacity = 0.9 * a;
    }
    update(0);
    return { object: g, update: update };
  }

  // E: Voltereta — aros de viento que ruedan, polvo y hojas desprendidas
  function rollFx(THREE, info) {
    var r = Math.max(70, Math.min(320, num(info.radius, 150)));
    var len = info.kind === 'line' ? Math.max(100, num(info.length, 300)) : r * 1.6;
    var g = new THREE.Group();
    var mWind = fxMat(THREE, MINT), mDust = fxMat(THREE, 0xa8c79a, { blending: THREE.NormalBlending }), mLeaf = fxMat(THREE, GREEN), mSkid = fxMat(THREE, GREEN);
    var winds = [], wGeo = new THREE.TorusGeometry(70, 5, 4, 24, PI * 1.4);
    for (var i = 0; i < 3; i++) { var w = new THREE.Mesh(wGeo, mWind); w.rotation.y = PI / 2; var wh = new THREE.Group(); wh.add(w); g.add(wh); winds.push(wh); }
    var dust = [], dGeo = new THREE.IcosahedronGeometry(1, 0);
    for (i = 0; i < 6; i++) { var d = new THREE.Mesh(dGeo, mDust); g.add(d); dust.push(d); }
    var leaves = [], lg = new THREE.OctahedronGeometry(11, 0);
    for (i = 0; i < 6; i++) { var l = new THREE.Mesh(lg, mLeaf); l.scale.set(1, 0.3, 2); g.add(l); leaves.push(l); }
    var skid = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mSkid); skid.rotation.x = -PI / 2; skid.position.y = 3; g.add(skid);
    function update(p) {
      p = clamp01(num(p, 0)); var a = env(p, 0.08, 0.45), e = easeOut(p);
      for (var k = 0; k < 3; k++) {
        winds[k].position.set((k - 1) * 22, 70, -len * 0.5 * (1 - e) + (k - 1) * 30);
        winds[k].rotation.x = p * 14 + k * 2;
        winds[k].scale.setScalar(0.8 + 0.4 * e);
      }
      mWind.opacity = 0.75 * a;
      for (k = 0; k < 6; k++) {
        var ang = PI + (k - 2.5) * 0.45, dd = r * (0.3 + 0.6 * e);
        dust[k].position.set(Math.sin(ang) * dd * 0.8, 15 + e * 40, Math.cos(ang) * dd - len * 0.3);
        dust[k].scale.setScalar(18 + 30 * e + k * 2);
      }
      mDust.opacity = 0.45 * (1 - p);
      for (k = 0; k < 6; k++) {
        var la = k * TAU / 6, ld = r * 0.8 * e;
        leaves[k].position.set(Math.cos(la) * ld, 30 + Math.sin(p * PI) * 110, Math.sin(la) * ld - len * 0.4 * e);
        leaves[k].rotation.set(p * 9 + k, la, p * 6);
      }
      mLeaf.opacity = 0.9 * (1 - p);
      skid.scale.set(60, len * (0.3 + 0.7 * e), 1); skid.position.z = -len * (0.15 + 0.35 * e);
      mSkid.opacity = 0.3 * (1 - p);
    }
    update(0);
    return { object: g, update: update };
  }

  // R: Lluvia de Flechas — zona marcada, portal dorado en el cielo y flechas de luz cayendo sin parar
  function rainFx(THREE, info) {
    var r = Math.max(120, Math.min(700, num(info.radius, 400)));
    var dur = Math.max(0.5, num(info.duration, 3));
    var cycles = Math.max(3, Math.round(dur * 2.6));
    var g = new THREE.Group();
    var mDisc = fxMat(THREE, GREEN, { blending: THREE.NormalBlending }), mEdge = fxMat(THREE, MINT), mRune = fxMat(THREE, GOLD), mArrow = fxMat(THREE, MINT), mImp = fxMat(THREE, GREEN), mSky = fxMat(THREE, GOLD);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mDisc); disc.rotation.x = -PI / 2; disc.position.y = 2; g.add(disc);
    var edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 64), mEdge); edge.rotation.x = -PI / 2; edge.position.y = 3; g.add(edge);
    var rune = new THREE.Mesh(new THREE.RingGeometry(r * 0.58, r * 0.63, 8), mRune); rune.rotation.x = -PI / 2; rune.position.y = 4; g.add(rune);
    var sky = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 10, 4, 32), mSky); sky.rotation.x = PI / 2; sky.position.y = 700; g.add(sky);
    var N = 20, arrows = [], aGeo = new THREE.ConeGeometry(6, 150, 4); aGeo.rotateX(PI);
    for (var i = 0; i < N; i++) { var a = new THREE.Mesh(aGeo, mArrow); g.add(a); arrows.push(a); }
    var imps = [], iGeo = new THREE.RingGeometry(0.7, 1, 20); iGeo.rotateX(-PI / 2);
    for (i = 0; i < 4; i++) { var im = new THREE.Mesh(iGeo, mImp); im.position.y = 5; g.add(im); imps.push(im); }
    function spot(i, n, out) {
      var ang = hash(i * 13.1 + n * 7.7) * TAU, d = Math.sqrt(hash(i * 3.3 + n * 1.9 + 5)) * r * 0.92;
      out.x = Math.cos(ang) * d; out.z = Math.sin(ang) * d;
    }
    var tmp = { x: 0, z: 0 };
    function update(p) {
      p = clamp01(num(p, 0));
      var a = env(p, 0.06, 0.12), rain = smooth(seg(p, 0.06, 0.14)) * (1 - smooth(seg(p, 0.9, 1)));
      mDisc.opacity = 0.16 * a + 0.08 * Math.sin(p * 40) * a; mEdge.opacity = 0.85 * a;
      mRune.opacity = 0.7 * a; rune.rotation.z = p * 5;
      mSky.opacity = 0.8 * rain; sky.rotation.z = p * 8; sky.scale.setScalar(0.8 + 0.2 * Math.sin(p * 30));
      mArrow.opacity = 0.95 * rain;
      for (var k = 0; k < N; k++) {
        var ph = hash(k * 5.7), x = p * cycles + ph, n = Math.floor(x), c = x - n;
        spot(k, n, tmp);
        var ar = arrows[k];
        if (c < 0.45) {
          var f = c / 0.45; ar.visible = true;
          ar.position.set(tmp.x * (0.85 + 0.15 * (1 - f)), lerp(700, 60, f * f), tmp.z * (0.85 + 0.15 * (1 - f)));
          ar.scale.set(1, 1.4, 1);
        } else if (c < 0.8) {
          ar.visible = true; var sk = 1 - seg(c, 0.6, 0.8);
          ar.position.set(tmp.x, 45, tmp.z); ar.scale.set(sk, 0.7 * sk + 0.01, sk);
        } else ar.visible = false;
      }
      for (k = 0; k < 4; k++) {
        var x2 = p * cycles * 1.5 + k / 4, n2 = Math.floor(x2), c2 = x2 - n2;
        spot(k + 50, n2, tmp);
        imps[k].position.x = tmp.x; imps[k].position.z = tmp.z; imps[k].scale.setScalar(20 + c2 * 90);
      }
      mImp.opacity = 0.7 * rain * 0.8;
    }
    update(0);
    return { object: g, update: update };
  }

  function safe(fn) {
    return function (THREE, ctx, info) {
      info = info || {};
      try { return fn(THREE, ctx || {}, info); }
      catch (e) { return { object: new THREE.Group(), update: function () {} }; }
    };
  }

  MOBA.defineChampionArt('vex', {
    lore: 'Vex cruzó cien bosques sin dejar huella; dicen que su arco fue tallado de un árbol que crece donde cae una estrella.',
    quote: '¿Lejos? Para mí, che, no existe el lejos.',
    build: build,
    fx: {
      Q: safe(function (THREE, ctx, info) {
        if (info.kind === 'projectile') return arrowFx(THREE, info, MINT, GREEN);
        if (info.kind === 'line') return arrowLineFx(THREE, info, MINT, GREEN);
        return burstFx(THREE, info, GREEN, MINT);
      }),
      W: safe(function (THREE, ctx, info) {
        if (info.kind === 'projectile') return arrowFx(THREE, info, MINT, MINT, 0.8);
        return focusFx(THREE, info);
      }),
      E: safe(function (THREE, ctx, info) {
        if (info.kind === 'projectile') return arrowFx(THREE, info, GREEN, MINT, 0.8);
        return rollFx(THREE, info);
      }),
      R: safe(function (THREE, ctx, info) {
        if (info.kind === 'projectile') return arrowFx(THREE, info, GOLD, GREEN, 1.4);
        if (info.kind === 'line') return arrowLineFx(THREE, info, GOLD, GREEN);
        return rainFx(THREE, info);
      })
    }
  });
})();
