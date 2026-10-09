/* Arte procedural: Sol, la Sacerdotisa Radiante (Soporte) */
(function () {
  'use strict';

  // Paleta: oro solar (principal), marfil (accent), naranja amanecer y bronce de apoyo, menta de curación (fx)
  var GOLD = 0xffcf3f, IVORY = 0xfffbe0, ORANGE = 0xff7a1a, BRONZE = 0x8a4512, SKIN = 0xf2c49b, MINT = 0x9dffb5, WHITE = 0xffffff;

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // Estrella / sol de rayos plano (en el plano XY), con agujero central opcional
  function starShape(THREE, n, ro, ri, hole) {
    var s = new THREE.Shape();
    for (var i = 0; i < n * 2; i++) {
      var a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
      var r = (i % 2 === 0) ? ro : ri;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    if (hole > 0) {
      var h = new THREE.Path();
      h.absarc(0, 0, hole, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return s;
  }
  function starGeo(THREE, n, ro, ri, hole) { return new THREE.ShapeGeometry(starShape(THREE, n, ro, ri, hole)); }
  function starSolid(THREE, n, ro, ri, hole, depth) {
    var g = new THREE.ExtrudeGeometry(starShape(THREE, n, ro, ri, hole), { depth: depth, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  function fxMat(THREE, color, op) {
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: op, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  }
  function fade(p, a, b) { return clamp(p / a, 0, 1) * clamp((1 - p) / b, 0, 1); }

  // ---------- fx genéricos ----------
  // Proyectil de luz: lanza dorada con estrella giratoria y anillos de estela
  function lightProjectile(THREE, info, col, col2) {
    var w = Math.max(40, num(info.width, 140));
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var glow = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, 14, 10), M(col, 0.35));
    glow.scale.set(1, 1, 2.2); glow.position.z = -w * 0.35; g.add(glow);
    var core = new THREE.Mesh(new THREE.SphereGeometry(w * 0.22, 12, 8), M(WHITE, 1)); g.add(core);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.09, w * 0.02, w * 2.4, 8), M(col2, 0.8));
    beam.rotation.x = Math.PI / 2; beam.position.z = -w * 1.2; g.add(beam);
    var star = new THREE.Mesh(starGeo(THREE, 8, w * 0.62, w * 0.24, 0), M(col, 0.85));
    star.rotation.x = -Math.PI / 2; g.add(star);
    var star2 = new THREE.Mesh(starGeo(THREE, 4, w * 0.75, w * 0.12, 0), M(WHITE, 0.6));
    g.add(star2);
    var rings = [];
    for (var i = 0; i < 3; i++) {
      var r = new THREE.Mesh(new THREE.TorusGeometry(w * 0.4, w * 0.04, 6, 20), M(col, 0.6));
      r.position.z = -w * (0.6 + i * 0.6); g.add(r); rings.push(r);
    }
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.05, 0.12);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      star.rotation.z = p * 30; star2.rotation.z = -p * 18;
      core.scale.setScalar(1 + 0.2 * Math.sin(p * 60));
      for (var j = 0; j < rings.length; j++) {
        var ph = (p * 6 + j / 3) % 1;
        rings[j].position.z = -w * (0.3 + ph * 1.8);
        rings[j].scale.setScalar(0.6 + ph * 0.9);
        rings[j].material.opacity = 0.6 * (1 - ph) * f;
      }
    } };
  }

  // Rayo en línea recta hacia +Z
  function lightLine(THREE, info, col, col2) {
    var L = Math.max(100, num(info.length, 1000)), w = Math.max(40, num(info.width, 140));
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var strip = new THREE.Mesh(new THREE.PlaneGeometry(w, L), M(col, 0.45));
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 3, L / 2); g.add(strip);
    var outer = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.32, L, 10, 1, true), M(col2, 0.45));
    outer.rotation.x = Math.PI / 2; outer.position.set(0, 70, L / 2); g.add(outer);
    var core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.1, w * 0.1, L, 8), M(WHITE, 0.95));
    core.rotation.x = Math.PI / 2; core.position.set(0, 70, L / 2); g.add(core);
    var tip = new THREE.Mesh(starGeo(THREE, 8, w * 0.9, w * 0.35, 0), M(col, 0.9));
    tip.rotation.x = -Math.PI / 2; tip.position.set(0, 6, L); g.add(tip);
    var base = new THREE.Mesh(starGeo(THREE, 6, w * 0.7, w * 0.3, 0), M(col2, 0.8));
    base.rotation.x = -Math.PI / 2; base.position.set(0, 6, 0); g.add(base);
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.06, 0.4), grow = easeOut(p / 0.2);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      outer.scale.set(1 + 0.25 * Math.sin(p * 40), grow, 1 + 0.25 * Math.sin(p * 40));
      core.scale.set(1 - p * 0.6, grow, 1 - p * 0.6);
      tip.rotation.z = p * 12; base.rotation.z = -p * 10;
      tip.scale.setScalar(0.5 + grow);
    } };
  }

  // ---------- fx radiales por habilidad ----------
  // Q radial: estallido de aturdimiento (estrellas giratorias sobre la cabeza)
  function qBurst(THREE, info) {
    var R = Math.max(60, num(info.radius, 200));
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var sig = new THREE.Mesh(starGeo(THREE, 8, 1, 0.45, 0), M(GOLD, 0.7));
    sig.rotation.x = -Math.PI / 2; sig.position.y = 4; g.add(sig);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 32), M(IVORY, 0.9));
    ring.rotation.x = Math.PI / 2; ring.position.y = 6; g.add(ring);
    var pillar = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.35, R * 0.5, 260, 14, 1, true), M(GOLD, 0.4));
    pillar.position.y = 130; g.add(pillar);
    var halo = new THREE.Group(); halo.position.y = 200; g.add(halo);
    var stars = [];
    for (var i = 0; i < 4; i++) {
      var s = new THREE.Mesh(new THREE.OctahedronGeometry(16, 0), M(i % 2 ? WHITE : GOLD, 1));
      s.scale.set(1, 1.6, 1); halo.add(s); stars.push(s);
    }
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.05, 0.3), e = easeOut(p / 0.35);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      sig.scale.setScalar(R * (0.4 + 0.6 * e)); sig.rotation.z = p * 4;
      ring.scale.setScalar(R * (0.2 + 0.9 * e));
      ring.material.opacity = 0.9 * (1 - e * 0.7) * f;
      pillar.scale.set(1 - p * 0.7, 0.3 + e * 0.7, 1 - p * 0.7);
      for (var j = 0; j < stars.length; j++) {
        var a = p * 14 + j * Math.PI / 2;
        stars[j].position.set(Math.cos(a) * 55, Math.sin(p * 30 + j) * 8, Math.sin(a) * 55);
        stars[j].rotation.y = p * 20;
      }
    } };
  }

  // W: Bendición — sigilo dorado y menta, plumas de luz que suben
  function wBless(THREE, info) {
    var R = Math.max(80, num(info.radius, 400));
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var sig = new THREE.Mesh(starGeo(THREE, 12, 1, 0.82, 0.7), M(GOLD, 0.55));
    sig.rotation.x = -Math.PI / 2; sig.position.y = 3; g.add(sig);
    var inner = new THREE.Mesh(starGeo(THREE, 6, 0.42, 0.2, 0), M(MINT, 0.6));
    inner.rotation.x = -Math.PI / 2; inner.position.y = 4; g.add(inner);
    var wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 40), M(MINT, 0.9));
    wave.rotation.x = Math.PI / 2; wave.position.y = 6; g.add(wave);
    var column = new THREE.Mesh(new THREE.CylinderGeometry(70, 95, 320, 16, 1, true), M(IVORY, 0.35));
    column.position.y = 160; g.add(column);
    var feathers = [];
    for (var i = 0; i < 12; i++) {
      var fm = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), M(i % 3 === 0 ? WHITE : (i % 2 ? MINT : GOLD), 0.9));
      g.add(fm); feathers.push({ m: fm, a: i * 2.399, r: 0.2 + (i * 0.37 % 0.7), d: (i * 0.13) % 0.4 });
    }
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.08, 0.35), e = easeOut(p / 0.3);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      sig.scale.setScalar(R * (0.3 + 0.7 * e)); sig.rotation.z = p * 1.5;
      inner.scale.setScalar(R * (0.3 + 0.7 * e)); inner.rotation.z = -p * 3;
      var wp = clamp(p / 0.6, 0, 1);
      wave.scale.setScalar(R * (0.1 + 0.95 * easeOut(wp)));
      wave.material.opacity = 0.9 * (1 - wp) * f;
      column.scale.set(1 + p * 0.4, e, 1 + p * 0.4);
      for (var j = 0; j < feathers.length; j++) {
        var F = feathers[j], q = clamp((p - F.d) / 0.6, 0, 1);
        var a = F.a + q * 3, rr = R * F.r * (1 - q * 0.4);
        F.m.position.set(Math.cos(a) * rr, 10 + q * 300, Math.sin(a) * rr);
        F.m.scale.set(9, 26 * (q > 0 ? 1 : 0.01), 9);
        F.m.rotation.y = q * 8;
        F.m.material.opacity = 0.9 * Math.sin(q * Math.PI) * f;
      }
    } };
  }

  // E: Escudo Solar — cúpula de luz con discos solares orbitando
  function eShield(THREE, info) {
    var R = Math.max(80, num(info.radius, 400));
    var D = 135;
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var dome = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(GOLD, 0.22));
    g.add(dome);
    var wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: IVORY, wireframe: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    mats.push([wire.material, 0.7]); g.add(wire);
    var base = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 36), M(ORANGE, 0.9));
    base.rotation.x = Math.PI / 2; base.position.y = 4; g.add(base);
    var range = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 48), M(GOLD, 0.8));
    range.rotation.x = Math.PI / 2; range.position.y = 4; g.add(range);
    var plates = new THREE.Group(); g.add(plates);
    var plist = [];
    for (var i = 0; i < 3; i++) {
      var pg = new THREE.Group();
      var disc = new THREE.Mesh(starSolid(THREE, 10, 34, 24, 0, 4), M(GOLD, 0.95));
      var gem = new THREE.Mesh(new THREE.CircleGeometry(16, 16), M(WHITE, 0.9));
      gem.position.z = 3;
      pg.add(disc); pg.add(gem); plates.add(pg); plist.push(pg);
    }
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.05, 0.3);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      var pop = p < 0.18 ? easeOut(p / 0.18) * 1.15 : lerp(1.15, 1, clamp((p - 0.18) / 0.1, 0, 1));
      var sh = 1 + 0.03 * Math.sin(p * 50);
      dome.scale.setScalar(D * pop * sh);
      wire.scale.setScalar(D * pop * sh); wire.rotation.y = p * 2;
      base.scale.setScalar(D * pop);
      var rp = clamp(p / 0.5, 0, 1);
      range.scale.setScalar(D + (R - D) * easeOut(rp));
      range.material.opacity = 0.8 * (1 - rp) * f;
      for (var j = 0; j < plist.length; j++) {
        var a = p * 9 + j * Math.PI * 2 / 3;
        plist[j].position.set(Math.sin(a) * D * 1.05 * pop, 90 + Math.sin(p * 12 + j) * 15, Math.cos(a) * D * 1.05 * pop);
        plist[j].rotation.y = a;
        plist[j].rotation.z = p * 6;
      }
    } };
  }

  // R: Amanecer — gran sol que nace, sigilo gigante, pilar y onda de choque
  function rDawn(THREE, info) {
    var R = Math.max(120, num(info.radius, 650));
    var g = new THREE.Group(), mats = [];
    function M(c, o) { var m = fxMat(THREE, c, o); mats.push([m, o]); return m; }
    var sig = new THREE.Mesh(starGeo(THREE, 16, 1, 0.78, 0.62), M(GOLD, 0.6));
    sig.rotation.x = -Math.PI / 2; sig.position.y = 3; g.add(sig);
    var sig2 = new THREE.Mesh(starGeo(THREE, 8, 0.5, 0.28, 0.2), M(ORANGE, 0.7));
    sig2.rotation.x = -Math.PI / 2; sig2.position.y = 4; g.add(sig2);
    var pillar = new THREE.Mesh(new THREE.CylinderGeometry(80, 120, 700, 18, 1, true), M(IVORY, 0.45));
    pillar.position.y = 350; g.add(pillar);
    var sun = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M(WHITE, 0.95));
    sun.position.y = 320; g.add(sun);
    var corona = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M(GOLD, 0.45));
    corona.position.y = 320; g.add(corona);
    var crown = new THREE.Mesh(starGeo(THREE, 12, 1, 0.55, 0), M(ORANGE, 0.7));
    crown.position.y = 320; g.add(crown);
    var shock = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 56), M(IVORY, 1));
    shock.rotation.x = Math.PI / 2; shock.position.y = 10; g.add(shock);
    var flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(GOLD, 0.35));
    g.add(flash);
    var rays = [];
    var rg = new THREE.BoxGeometry(22, 4, 1); rg.translate(0, 0, 0.5);
    for (var i = 0; i < 12; i++) {
      var ray = new THREE.Mesh(rg, M(i % 2 ? GOLD : IVORY, 0.85));
      ray.rotation.y = i * Math.PI / 6; ray.position.y = 6;
      g.add(ray); rays.push(ray);
    }
    return { object: g, update: function (p) {
      p = num(p, 0);
      var f = fade(p, 0.04, 0.3);
      for (var k = 0; k < mats.length; k++) mats[k][0].opacity = mats[k][1] * f;
      var charge = smooth(p / 0.42), boom = clamp((p - 0.42) / 0.35, 0, 1), be = easeOut(boom);
      sig.scale.setScalar(R * (0.2 + 0.8 * charge)); sig.rotation.z = p * 2.5;
      sig2.scale.setScalar(R * (0.2 + 0.8 * charge)); sig2.rotation.z = -p * 5;
      pillar.scale.set(0.4 + charge * 0.8 + be * 0.8, charge, 0.4 + charge * 0.8 + be * 0.8);
      var sunS = 20 + charge * 90 + be * 60;
      sun.scale.setScalar(sunS); sun.position.y = 120 + charge * 200;
      sun.material.opacity = 0.95 * f * (1 - be * 0.8);
      corona.scale.setScalar(sunS * (1.5 + 0.1 * Math.sin(p * 60)) + be * R * 0.4);
      corona.position.y = sun.position.y;
      corona.material.opacity = 0.45 * f * (1 - be);
      crown.scale.setScalar(sunS * 2.4); crown.position.y = sun.position.y; crown.rotation.z = p * 6;
      crown.material.opacity = 0.7 * f * (1 - be);
      shock.scale.setScalar(Math.max(1, R * 1.05 * be));
      shock.material.opacity = boom > 0 ? (1 - boom) * f : 0;
      flash.scale.set(R * be, R * 0.55 * be + 1, R * be);
      flash.material.opacity = boom > 0 ? 0.35 * Math.sin(boom * Math.PI) * f : 0;
      for (var j = 0; j < rays.length; j++) {
        var len = R * (0.15 * charge + 0.85 * be) * (j % 2 ? 0.85 : 1);
        rays[j].scale.set(1 + be * 0.6, 1, Math.max(1, len));
      }
    } };
  }

  function pick(main, kind, info, THREE, col, col2) {
    if (kind === 'projectile' && main !== 'projectile') return lightProjectile(THREE, info, col, col2);
    if (kind === 'line') return lightLine(THREE, info, col, col2);
    return null;
  }

  MOBA.defineChampionArt('sol', {
    lore: 'Nació en el instante exacto del primer amanecer y juró que ninguna sombra volvería a tapar a los suyos; su báculo guarda un pedazo de ese sol.',
    quote: '¡Arriba, che! Mientras yo esté, acá no se apaga nadie.',

    build: function (THREE, ctx) {
      var C = ctx.cache;
      var team = num(ctx.teamColor, 0x38a3ff);
      var mGold = C.mat(GOLD, { emissive: GOLD, emissiveIntensity: 0.3, metalness: 0.45, roughness: 0.4 });
      var mIvory = C.mat(IVORY, { emissive: IVORY, emissiveIntensity: 0.12, roughness: 0.75 });
      var mOrange = C.mat(ORANGE, { emissive: ORANGE, emissiveIntensity: 0.15, roughness: 0.6 });
      var mBronze = C.mat(BRONZE, { roughness: 0.6, metalness: 0.2 });
      var mSkin = C.mat(SKIN, { roughness: 0.8 });
      var mTeam = C.mat(team, { emissive: team, emissiveIntensity: 0.35, roughness: 0.5 });
      // materiales propios (se animan)
      var glowOrb = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 1 });
      var glowHalo = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      var glowHand = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      var glowRing = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      var glowMote = new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.95 });

      function mesh(geo, mat, parent, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }

      var root = new THREE.Group();
      // Sigilo solar en el suelo (flota sobre él)
      var ground = mesh(C.geo('sol_gring', function () { return starGeo(THREE, 12, 78, 62, 52); }), glowRing, root, 0, 1.5, 0);
      ground.rotation.x = -Math.PI / 2;

      var body = new THREE.Group(); root.add(body);
      var hover = new THREE.Group(); body.add(hover);

      // Túnica acampanada (sin piernas: se desliza)
      var robeG = new THREE.Group(); hover.add(robeG);
      var robeGeo = C.geo('sol_robe', function () {
        var pts = [[0, 106], [24, 105], [30, 92], [36, 72], [45, 48], [57, 24], [68, 8], [64, 4], [0, 4]];
        return new THREE.LatheGeometry(pts.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 14);
      });
      mesh(robeGeo, mIvory, robeG);
      var hem = mesh(C.geo('sol_hem', function () { return new THREE.TorusGeometry(66, 5, 5, 20); }), mOrange, robeG, 0, 8, 0);
      hem.rotation.x = Math.PI / 2;
      var panel = mesh(C.geo('sol_panel', function () { return new THREE.BoxGeometry(26, 100, 4); }), mGold, robeG, 0, 54, 48);
      panel.rotation.x = -0.4;
      var belt = mesh(C.geo('sol_belt', function () { return new THREE.TorusGeometry(26, 5, 6, 16); }), mTeam, robeG, 0, 104, 0);
      belt.rotation.x = Math.PI / 2;

      // Lazos que flotan detrás
      var sashes = [];
      for (var si = 0; si < 2; si++) {
        var sg = new THREE.Group(); sg.position.set(si ? 12 : -12, 102, -24); hover.add(sg);
        mesh(C.geo('sol_sash', function () { return new THREE.BoxGeometry(14, 90, 3); }), mOrange, sg, 0, -45, 0);
        sashes.push(sg);
      }

      // Torso (pivote en la cintura)
      var upper = new THREE.Group(); upper.position.y = 106; hover.add(upper);
      mesh(C.geo('sol_torso', function () { return new THREE.CylinderGeometry(19, 24, 44, 10); }), mIvory, upper, 0, 22, 0);
      var medal = mesh(C.geo('sol_medal', function () { return starSolid(THREE, 8, 14, 8, 0, 4); }), mGold, upper, 0, 26, 21);
      medal.rotation.x = -0.1;
      // Manto dorado de hombros: silueta ancha en forma de campana invertida
      mesh(C.geo('sol_mantle', function () { return new THREE.CylinderGeometry(20, 46, 22, 12); }), mGold, upper, 0, 40, 0);

      var head = new THREE.Group(); head.position.y = 52; upper.add(head);
      mesh(C.geo('sol_head', function () { return new THREE.SphereGeometry(21, 12, 10); }), mSkin, head, 0, 24, 2);
      var hairBack = mesh(C.geo('sol_hairb', function () { return new THREE.SphereGeometry(24, 12, 10); }), mBronze, head, 0, 28, -6);
      hairBack.scale.set(1, 1, 0.9);
      var hairLong = mesh(C.geo('sol_hairl', function () { return new THREE.ConeGeometry(26, 80, 10); }), mBronze, head, 0, -6, -16);
      hairLong.rotation.x = Math.PI + 0.15;
      var circlet = mesh(C.geo('sol_circ', function () { return new THREE.TorusGeometry(22, 3.5, 5, 18); }), mGold, head, 0, 34, 2);
      circlet.rotation.x = Math.PI / 2 - 0.25;

      // Halo de rayos solares detrás de la cabeza: la firma de la silueta
      var halo = new THREE.Group(); halo.position.set(0, 80, -30); upper.add(halo);
      var haloStar = mesh(C.geo('sol_halo', function () { return starSolid(THREE, 12, 68, 44, 34, 5); }), mGold, halo);
      var haloRing = mesh(C.geo('sol_haloring', function () { return new THREE.TorusGeometry(36, 4, 5, 24); }), mOrange, halo, 0, 0, 2);
      var haloGlow = mesh(C.geo('sol_haloglow', function () { return new THREE.CircleGeometry(34, 20); }), glowHalo, halo, 0, 0, -3);

      // Brazos con mangas acampanadas
      function arm(side) {
        var a = new THREE.Group(); a.position.set(side * 32, 40, 0); upper.add(a);
        mesh(C.geo('sol_sleeve', function () { return new THREE.CylinderGeometry(9, 17, 50, 8); }), mIvory, a, 0, -25, 0);
        mesh(C.geo('sol_cuff', function () { return new THREE.TorusGeometry(16, 3, 4, 12); }), mGold, a, 0, -48, 0).rotation.x = Math.PI / 2;
        var hand = new THREE.Group(); hand.position.y = -56; a.add(hand);
        mesh(C.geo('sol_hand', function () { return new THREE.SphereGeometry(8, 8, 6); }), mSkin, hand);
        return { g: a, hand: hand };
      }
      var armR = arm(-1), armL = arm(1);
      var handGlow = mesh(C.geo('sol_hglow', function () { return new THREE.SphereGeometry(16, 10, 8); }), glowHand, armL.hand);

      // Báculo solar
      var staff = new THREE.Group(); staff.rotation.order = 'ZXY'; armR.hand.add(staff);
      mesh(C.geo('sol_shaft', function () { return new THREE.CylinderGeometry(3.5, 3.5, 250, 6); }), mBronze, staff, 0, 35, 0);
      mesh(C.geo('sol_butt', function () { return new THREE.ConeGeometry(6, 16, 6); }), mGold, staff, 0, -96, 0).rotation.x = Math.PI;
      var top = new THREE.Group(); top.position.y = 168; staff.add(top);
      mesh(C.geo('sol_cradle', function () { return new THREE.TorusGeometry(20, 3.5, 5, 14, Math.PI); }), mGold, top, 0, -2, 0).rotation.z = Math.PI;
      var sStar = mesh(C.geo('sol_sstar', function () { return starSolid(THREE, 8, 36, 15, 0, 3); }), mGold, top, 0, 0, -3);
      var orb = mesh(C.geo('sol_orb', function () { return new THREE.SphereGeometry(14, 12, 10); }), glowOrb, top);

      // Motas de luz que orbitan
      var motes = [];
      for (var mi = 0; mi < 3; mi++) {
        motes.push(mesh(C.geo('sol_mote', function () { return new THREE.OctahedronGeometry(7, 0); }), glowMote, hover));
      }

      function update(s) {
        s = s || {};
        var anim = s.anim || 'idle', T = num(s.time, 0), t = num(s.t, 0), p = clamp(num(s.progress, 0), 0, 1);
        var slot = num(s.slot, 0), spd = num(s.speed, 0);
        // pose base
        var hy = 10 + Math.sin(T * 2) * 4, lean = 0, twist = 0, headX = 0;
        var aRx = -0.3, aRz = -0.12, aLx = -0.1, aLz = 0.22, tilt = 0.05;
        var haloRot = T * 0.4, haloS = 1, orbS = 1 + 0.08 * Math.sin(T * 4), hand = 0;
        var moteR = 58, moteY = 140, moteSp = 1.3, moteSpread = 1;
        var sashX = 0.15 + Math.sin(T * 1.6) * 0.08, sashZ = Math.sin(T * 1.1) * 0.06;
        var robeSway = 0, bodyRx = 0, bodyY = 0, ringS = 1, ringO = 0.28 + 0.08 * Math.sin(T * 3), haloO = 0.35, orbO = 1;

        if (anim === 'walk') {
          var f = clamp(spd / 340, 0.4, 1.6), ph = T * 6 * f;
          hy = 12 + Math.abs(Math.sin(ph)) * 5;
          lean = 0.16; robeSway = Math.sin(ph) * 0.06; twist = Math.sin(ph) * 0.08;
          aLx = Math.sin(ph) * 0.45 - 0.1; aLz = 0.3;
          aRx = -0.5 - Math.sin(ph) * 0.12; tilt = 0.25;
          sashX = 0.7 + Math.sin(ph * 2) * 0.12 * f; sashZ = Math.sin(ph) * 0.1;
          moteSp = 2.2; ringO = 0.22;
        } else if (anim === 'attack') {
          // levanta el báculo cargando el orbe y lo apunta al frente: disparo de luz
          var wind = clamp(p / 0.45, 0, 1), rel = clamp((p - 0.45) / 0.15, 0, 1), rec = clamp((p - 0.6) / 0.4, 0, 1);
          var w1 = smooth(wind), r1 = easeOut(rel), c1 = smooth(rec);
          aRx = lerp(lerp(-0.3, -2.5, w1), -1.35, r1); tilt = lerp(lerp(0.05, -0.35, w1), 1.4, r1);
          aRx = lerp(aRx, -0.3, c1); tilt = lerp(tilt, 0.05, c1);
          aLx = lerp(-0.1, -0.9, w1 * (1 - c1)); aLz = lerp(0.22, -0.2, r1 * (1 - c1));
          lean = lerp(lerp(0, -0.14, w1), 0.2, r1) * (1 - c1);
          twist = lerp(0, 0.25, w1) * (1 - r1) - 0.1 * r1 * (1 - c1);
          orbS = 1 + 1.3 * w1 * (1 - r1) + (rel > 0 ? 1.5 * (1 - rec) : 0);
          haloS = 1 + 0.25 * Math.sin(Math.PI * clamp(p / 0.7, 0, 1));
          haloRot = T * 0.4 + p * 2;
        } else if (anim === 'cast') {
          var kin = smooth(p / 0.25), kout = 1 - smooth((p - 0.8) / 0.2), k = kin * kout;
          if (slot === 3) {
            // AMANECER: se eleva, brazos abiertos, halo gigante girando
            var lift = smooth(p / 0.45), burst = clamp((p - 0.45) / 0.2, 0, 1);
            hy = 10 + 50 * lift * kout + Math.sin(T * 10) * 2 * lift;
            aRx = lerp(-0.3, -0.25, k); aRz = lerp(-0.12, -1.65, k); tilt = lerp(0.05, -0.15, k);
            aLx = -0.25 * k; aLz = lerp(0.22, 1.65, k);
            lean = -0.22 * k; headX = -0.45 * k;
            haloS = 1 + 1.1 * k + 0.4 * Math.sin(Math.PI * burst); haloRot = T * 0.4 + p * 14;
            orbS = 1 + 1.8 * k + 1.2 * Math.sin(Math.PI * burst); hand = k;
            moteR = 58 + 90 * k + 80 * burst; moteY = 140 + 60 * k; moteSp = 5;
            ringS = 1 + 2.5 * k + 2 * burst; ringO = 0.3 + 0.6 * k * (1 - burst * 0.5);
            sashX = 0.9 * k + 0.2; haloO = 0.35 + 0.6 * k;
          } else if (slot === 1) {
            // Bendición: ambos brazos al cielo, luz en la mano
            aLx = lerp(-0.1, -2.75, k); aLz = lerp(0.22, 0.45, k);
            aRx = lerp(-0.3, -2.6, k); aRz = lerp(-0.12, -0.4, k); tilt = lerp(0.05, -0.1, k);
            lean = -0.14 * k; headX = -0.35 * k; hy += 12 * k;
            hand = k; moteY = 140 + 90 * k * p; moteSp = 3; moteSpread = 1 + 0.4 * k;
            haloS = 1 + 0.3 * k; ringO = 0.28 + 0.4 * k; ringS = 1 + 0.8 * k; haloO = 0.35 + 0.4 * k;
          } else if (slot === 2) {
            // Escudo Solar: planta el báculo y adelanta la palma; el halo se agranda como escudo
            aRx = lerp(-0.3, -0.75, k); tilt = 0; aRz = -0.12;
            aLx = lerp(-0.1, -1.45, k); aLz = lerp(0.22, -0.25, k);
            lean = 0.08 * k; hy -= 4 * k;
            haloS = 1 + 0.75 * k; haloRot = T * 0.4 + p * 10;
            moteR = 58 + 40 * k; moteSp = 4; hand = 0.7 * k; ringS = 1 + 0.6 * k; ringO = 0.28 + 0.4 * k;
            haloO = 0.35 + 0.5 * k;
          } else {
            // Rayo de Luz: báculo horizontal con las dos manos, apuntando
            aRx = lerp(-0.3, -1.45, k); tilt = lerp(0.05, 1.55, k); aRz = lerp(-0.12, 0.15, k);
            aLx = lerp(-0.1, -1.4, k); aLz = lerp(0.22, -0.45, k);
            lean = 0.16 * k; twist = -0.15 * k;
            var shot = clamp((p - 0.45) / 0.15, 0, 1);
            orbS = 1 + 1.4 * k + 1.2 * Math.sin(Math.PI * shot); haloS = 1 + 0.2 * k;
            sashX = 0.15 + 0.5 * shot * kout;
          }
        } else if (anim === 'recall') {
          // reza con las manos juntas; el halo gira y late
          var kr = smooth(t / 0.6);
          aLx = lerp(-0.1, -1.05, kr); aLz = lerp(0.22, -0.65, kr);
          aRx = lerp(-0.3, -0.7, kr); aRz = lerp(-0.12, 0.25, kr); tilt = 0.1;
          headX = 0.3 * kr; hy = 8 + Math.sin(T * 1.5) * 3;
          haloRot = T * 0.4 + t * 3; haloS = 1 + 0.15 * kr + 0.08 * Math.sin(t * 6);
          hand = kr * (0.6 + 0.4 * Math.sin(t * 6));
          moteY = 30 + ((t * 70) % 220); moteR = 70 - ((t * 70) % 220) * 0.15; moteSp = 2.5;
          ringO = 0.3 + 0.35 * kr * (0.5 + 0.5 * Math.sin(t * 6)); ringS = 1 + 0.3 * kr; haloO = 0.35 + 0.4 * kr;
        } else if (anim === 'dead') {
          var kd = easeOut(t / 0.7);
          bodyRx = -1.42 * kd; bodyY = 42 * kd; hy = lerp(10, 0, kd);
          aLz = lerp(0.22, 1.3, kd); aRz = lerp(-0.12, -1.2, kd); aRx = lerp(-0.3, 0.2, kd); aLx = 0;
          tilt = 0.2; headX = 0.3 * kd;
          haloRot = 0.3; haloO = 0.35 * (1 - kd); orbO = 1 - 0.75 * kd; ringO = 0.28 * (1 - kd);
          moteY = lerp(140, 10, kd); moteSp = 0.3 * (1 - kd);
          sashX = 0.1; sashZ = 0;
        }

        body.rotation.x = bodyRx; body.position.y = bodyY;
        hover.position.y = hy;
        robeG.rotation.z = robeSway; robeG.rotation.x = lean * 0.3;
        upper.rotation.set(lean, twist, 0);
        head.rotation.x = headX;
        armR.g.rotation.set(aRx, 0, aRz); armL.g.rotation.set(aLx, 0, aLz);
        staff.rotation.z = -aRz; staff.rotation.x = tilt - aRx;
        top.scale.setScalar(1 + (orbS - 1) * 0.25);
        orb.scale.setScalar(orbS);
        sStar.rotation.z = T * 1.5;
        halo.rotation.z = haloRot; halo.scale.setScalar(haloS);
        haloGlow.scale.setScalar(1 + 0.08 * Math.sin(T * 3));
        haloRing.rotation.z = -haloRot * 2;
        handGlow.scale.setScalar(0.3 + hand * (0.9 + 0.15 * Math.sin(T * 12)));
        glowHand.opacity = 0.85 * hand;
        glowHalo.opacity = clamp(haloO, 0, 1);
        glowOrb.opacity = clamp(orbO, 0, 1);
        glowRing.opacity = clamp(ringO, 0, 1);
        ground.scale.setScalar(ringS); ground.rotation.z = T * 0.3;
        for (var i = 0; i < 2; i++) { sashes[i].rotation.x = sashX + i * 0.05; sashes[i].rotation.z = (i ? 1 : -1) * 0.08 + sashZ; }
        for (var j = 0; j < motes.length; j++) {
          var a = T * moteSp + j * Math.PI * 2 / 3;
          motes[j].position.set(Math.cos(a) * moteR, moteY + Math.sin(T * 2.3 + j * 2) * 14 * moteSpread + j * 12 * (moteSpread - 1) * 4, Math.sin(a) * moteR);
          motes[j].rotation.y = T * 3 + j;
        }
      }
      update({ anim: 'idle', time: 0, t: 0 });
      return { object: root, update: update };
    },

    fx: {
      Q: function (THREE, ctx, info) {
        info = info || {}; var kind = info.kind || 'projectile';
        if (kind === 'projectile') return lightProjectile(THREE, info, GOLD, IVORY);
        return pick('projectile', kind, info, THREE, GOLD, IVORY) || qBurst(THREE, info);
      },
      W: function (THREE, ctx, info) {
        info = info || {}; var kind = info.kind || 'self';
        return pick('self', kind, info, THREE, MINT, GOLD) || wBless(THREE, info);
      },
      E: function (THREE, ctx, info) {
        info = info || {}; var kind = info.kind || 'self';
        return pick('self', kind, info, THREE, GOLD, ORANGE) || eShield(THREE, info);
      },
      R: function (THREE, ctx, info) {
        info = info || {}; var kind = info.kind || 'self';
        return pick('self', kind, info, THREE, ORANGE, GOLD) || rDawn(THREE, info);
      }
    }
  });
})();
