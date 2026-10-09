(function () {
  'use strict';
  var YELLOW = 0xffd629, RED = 0xff5a3a, INK = 0x241e25, WHITE = 0xfff7df;
  function clamp(p) { return Math.max(0, Math.min(1, p || 0)); }
  function mesh(THREE, parent, geometry, material, x, y, z) {
    var m = new THREE.Mesh(geometry, material);
    m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
  }
  function wire(THREE, points, radius) {
    var path = new THREE.CurvePath();
    for (var i = 1; i < points.length; i++) {
      path.add(new THREE.LineCurve3(new THREE.Vector3().fromArray(points[i - 1]), new THREE.Vector3().fromArray(points[i])));
    }
    return new THREE.TubeGeometry(path, points.length * 5, radius, 5, false);
  }
  function build(THREE, ctx) {
    var cache = ctx.cache, root = new THREE.Group(), actor = new THREE.Group(); root.add(actor);
    var gold = cache.mat(YELLOW), red = cache.mat(RED), black = cache.mat(INK);
    var white = cache.basic(WHITE), glow = cache.basic(0xfff15a);
    var sphere = cache.geo('pikachu.sphere', function () { return new THREE.SphereGeometry(1, 16, 12); });
    function ball(parent, mat, pos, scale) {
      var m = mesh(THREE, parent, sphere, mat, pos[0], pos[1], pos[2]); m.scale.set(scale[0], scale[1], scale[2]); return m;
    }
    var body = new THREE.Group(); body.position.y = 85; actor.add(body);
    ball(body, gold, [0, 0, 0], [61, 72, 48]);
    var head = new THREE.Group(); head.position.set(0, 82, 18); body.add(head);
    ball(head, gold, [0, 0, 0], [69, 55, 49]);
    // Wide ears with separate black tips: the silhouette remains clear at MOBA distance.
    var ears = [];
    for (var side = -1; side <= 1; side += 2) {
      var ear = new THREE.Group(); ear.position.set(side * 39, 36, -5); ear.rotation.z = -side * 0.31; head.add(ear); ears.push(ear);
      ball(ear, gold, [0, 32, 0], [16, 43, 11]);
      ball(ear, black, [0, 68, 0], [13, 22, 10]);
      ball(head, black, [side * 25, 13, 43], [13, 17, 6]);
      ball(head, white, [side * 25 - 3, 19, 48], [4.5, 6, 2]);
      ball(head, red, [side * 48, -12, 35], [18, 17, 8]);
    }
    ball(head, black, [0, 1, 65 - 16], [5, 3.5, 3]);
    var mouth = mesh(THREE, head, cache.geo('pikachu.smile', function () {
      return wire(THREE, [[-13, -10, 47], [-7, -15, 49], [0, -11, 50], [7, -15, 49], [13, -10, 47]], 2.3);
    }), black);
    var limbs = [];
    for (var j = 0; j < 4; j++) {
      var front = j < 2, s = j % 2 ? 1 : -1;
      var limb = new THREE.Group(); limb.position.set(s * (front ? 46 : 35), front ? 27 : -48, front ? 19 : 2); body.add(limb);
      ball(limb, gold, [0, -15, 7], front ? [15, 29, 17] : [23, 19, 30]);
      limbs.push(limb);
    }
    // One thick extruded lightning tail, with a dark root instead of tiny ornamentation.
    var tail = new THREE.Group(); tail.position.set(34, -3, -38); body.add(tail);
    var shape = new THREE.Shape();
    [[0, 0], [24, 20], [13, 43], [47, 64], [30, 89], [71, 118], [92, 84], [58, 68], [74, 42], [37, 28], [42, 5], [8, -9]].forEach(function (p, i) {
      if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]);
    }); shape.closePath();
    mesh(THREE, tail, cache.geo('pikachu.tail', function () { return new THREE.ExtrudeGeometry(shape, { depth: 13, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 1 }); }), gold);
    var tailRoot = mesh(THREE, tail, cache.geo('pikachu.tailRoot', function () { return new THREE.BoxGeometry(18, 27, 15); }), black, 11, 4, 6); tailRoot.rotation.z = -0.55;
    // Two broad back marks visible when the champion turns away.
    for (var k = 0; k < 2; k++) ball(body, black, [0, 10 - k * 29, -46], [31, 6, 4]);
    var sparks = [];
    for (var c = -1; c <= 1; c += 2) {
      for (var a = 0; a < 2; a++) {
        var spark = mesh(THREE, head, cache.geo('pikachu.cheekSpark.' + c + '.' + a, function () {
          return wire(THREE, [[c * 56, -10, 42], [c * 72, 1 + a * 11, 46], [c * 65, 6 + a * 11, 49], [c * 84, 14 + a * 13, 51]], 2);
        }), glow); sparks.push(spark);
      }
    }
    var shot = new THREE.Group(); actor.add(shot);
    mesh(THREE, shot, cache.geo('pikachu.basicBolt', function () { return wire(THREE, [[0, 0, -20], [7, 4, -7], [-6, -2, 4], [0, 0, 23]], 3); }), glow);
    ball(shot, white, [0, 0, 16], [5, 5, 9]);
    var halo = mesh(THREE, actor, cache.geo('pikachu.halo', function () { return new THREE.TorusGeometry(76, 3, 6, 40); }), glow, 0, 5, 0); halo.rotation.x = Math.PI / 2;
    function update(state) {
      state = state || {}; var time = state.time || 0, t = state.t || 0, p = clamp(state.progress), anim = state.anim || 'idle';
      actor.position.set(0, 0, 0); actor.rotation.set(0, 0, 0); actor.scale.set(1, 1, 1);
      body.position.set(0, 85, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
      head.rotation.set(0, 0, 0); tail.rotation.set(0, 0, 0); mouth.scale.set(1, 1, 1);
      ears.forEach(function (ear, i) { ear.rotation.set(0, 0, (i ? -1 : 1) * 0.31); });
      limbs.forEach(function (limb) { limb.rotation.set(0, 0, 0); });
      shot.visible = false; shot.position.set(0, 100, 0); shot.scale.setScalar(1);
      halo.visible = false; halo.position.y = 5; halo.scale.setScalar(1);
      sparks.forEach(function (spark, i) { spark.visible = anim !== 'dead' && Math.sin(time * 11 + i * 1.8) > 0.76; spark.scale.setScalar(0.75 + 0.2 * Math.sin(time * 13 + i)); });
      if (anim === 'idle') {
        body.scale.y = 1 + 0.025 * Math.sin(time * 3); head.rotation.z = 0.045 * Math.sin(time * 1.7);
        tail.rotation.y = 0.18 * Math.sin(time * 2.5); ears[0].rotation.x = 0.12 * Math.sin(time * 2);
      } else if (anim === 'walk') {
        var cycle = t * (8 + Math.min(500, state.speed || 335) * 0.018), fast = (state.speed || 335) > 280;
        body.position.y = (fast ? 88 : 85) + Math.abs(Math.sin(cycle)) * 10;
        body.rotation.x = fast ? 0.68 : 0.16; head.rotation.x = fast ? -0.53 : -0.1;
        limbs.forEach(function (limb, i) { limb.rotation.x = (fast ? -0.8 : 0) + Math.sin(cycle + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.65; });
        tail.rotation.x = -0.3; tail.rotation.z = 0.1 * Math.sin(cycle); ears.forEach(function (ear) { ear.rotation.x = -0.35; });
      } else if (anim === 'attack') {
        var jump = Math.sin(Math.PI * p), release = clamp((p - 0.32) / 0.52);
        body.position.y = 85 + 38 * jump; body.rotation.x = p < 0.32 ? -0.22 * Math.sin(p / 0.32 * Math.PI) : 0.24 * jump;
        head.rotation.x = -0.16 * jump; limbs[0].rotation.x = limbs[1].rotation.x = -1.15 * jump;
        shot.visible = p > 0.32 && p < 0.9; shot.position.set(0, 164 + 28 * jump, 72 + release * 170); shot.scale.setScalar(1.25 - 0.4 * release);
        sparks.forEach(function (spark) { spark.visible = p > 0.2 && p < 0.65; spark.scale.setScalar(1.2); });
      } else if (anim === 'cast') {
        var surge = Math.sin(Math.PI * p), slot = state.slot || 0;
        sparks.forEach(function (spark) { spark.visible = true; spark.scale.setScalar(1 + surge); });
        if (slot === 0) { head.rotation.x = -0.24 * surge; body.rotation.x = 0.27 * surge; limbs[0].rotation.x = limbs[1].rotation.x = -1.3 * surge; ears[0].rotation.z += 0.3 * surge; }
        if (slot === 1) { body.position.y = 90; body.rotation.x = 0.95 * surge; head.rotation.x = -0.6 * surge; limbs.forEach(function (limb, i) { limb.rotation.x = -0.9 + 0.55 * Math.sin(p * 24 + i * Math.PI); }); tail.rotation.x = -0.7 * surge; }
        if (slot === 2) { body.position.y += 16 * surge; limbs[0].rotation.x = limbs[1].rotation.x = -1.6 * surge; limbs[0].rotation.z = -0.55 * surge; limbs[1].rotation.z = 0.55 * surge; head.rotation.z = 0.18 * surge; tail.rotation.y = 0.6 * surge; }
        if (slot === 3) {
          body.position.y += 67 * surge; body.rotation.x = -0.25 * surge; head.rotation.x = -0.4 * surge;
          limbs[0].rotation.z = 1.7 * surge; limbs[1].rotation.z = -1.7 * surge;
          ears[0].rotation.z += 0.28 * surge; ears[1].rotation.z -= 0.28 * surge; tail.rotation.z = 0.36 * surge;
          halo.visible = true; halo.position.y = 5; halo.scale.setScalar(0.75 + 0.8 * surge); mouth.scale.y = 1 + surge;
        }
      } else if (anim === 'recall') {
        body.position.y += 20 + 15 * Math.sin(t * 3); body.rotation.y = t * 2.2; head.rotation.z = 0.15 * Math.sin(t * 5);
        limbs[0].rotation.z = 1.1; limbs[1].rotation.z = -1.1; tail.rotation.y = 0.3 * Math.sin(t * 5);
        halo.visible = true; halo.position.y = 6 + 22 * (0.5 + 0.5 * Math.sin(t * 3)); halo.scale.setScalar(1 + 0.12 * Math.sin(t * 4));
      } else if (anim === 'dead') {
        body.rotation.x = -Math.PI / 2; body.position.set(0, 50, 0); head.rotation.z = -0.15;
        ears[0].rotation.z = 0.9; ears[1].rotation.z = -0.9; tail.rotation.z = -0.3;
        limbs.forEach(function (limb, i) { limb.rotation.x = 0.4; limb.rotation.z = i % 2 ? -0.3 : 0.3; });
      }
    }
    update({}); return { object: root, update: update };
  }
  function effect(THREE, ctx, info, slot) {
    info = info || {}; var principal = ['projectile', 'dash', 'target', 'area'][slot];
    var kind = info.kind || principal, radius = Math.max(12, info.radius || (slot === 3 ? 375 : 90));
    var width = Math.max(8, info.width || 70), length = Math.max(20, info.length || 450);
    var root = new THREE.Group(), parts = [], mats = [];
    function material(color, opacity) {
      var m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); mats.push({ mat: m, base: opacity }); return m;
    }
    var yellow = material(slot === 3 ? 0xfff7a0 : 0xffe94a, 0.9), core = material(WHITE, 1), haze = material(YELLOW, 0.2);
    function add(g, mat, x, y, z) { var m = mesh(THREE, root, g, mat, x, y, z); parts.push(m); return m; }
    function bolt(points, size, mat) { return add(wire(THREE, points, size), mat || yellow); }
    function ring(r, y, mat) { var m = add(new THREE.TorusGeometry(r, Math.max(2, r * 0.015), 5, 56), mat || yellow, 0, y, 0); m.rotation.x = Math.PI / 2; return m; }
    var mode = slot, rings = [], streaks = [], orb, column, flash;
    if (kind !== principal) {
      // Fallback follows the engine's footprint and direction for every alternate cast kind.
      mode = 4;
      if (kind === 'projectile' || kind === 'line' || kind === 'cone' || kind === 'dash') {
        var run = kind === 'projectile' ? width * 1.8 : length;
        var start = kind === 'projectile' ? -run * 0.5 : 0;
        var spread = kind === 'cone' ? Math.tan(Math.min(160, info.angle || 50) * Math.PI / 360) * run : width * 0.3;
        for (var b = -1; b <= 1; b++) {
          var pts = [];
          for (var n = 0; n <= 8; n++) pts.push([b * spread * n / 8 + (n % 2 ? width * 0.09 : -width * 0.09), kind === 'projectile' ? 0 : 12, start + run * n / 8]);
          bolt(pts, Math.max(2, width * 0.035), slot === 1 ? core : yellow);
        }
      } else {
        rings.push(ring(radius, 5)); rings.push(ring(radius * 0.62, 8, core));
        for (var f = 0; f < 6; f++) {
          var ang = f * Math.PI / 3, x = Math.cos(ang) * radius * 0.7, z = Math.sin(ang) * radius * 0.7;
          bolt([[x, 5, z], [x * 0.7, radius * 0.2, z * 0.7], [x * 0.9, radius * 0.3, z * 0.9]], 3);
        }
      }
    } else if (slot === 0) {
      var zig = [[0, 0, -75], [width * 0.28, 0, -42], [-width * 0.22, 0, -14], [width * 0.2, 0, 7], [-width * 0.14, 0, 29], [0, 0, 68]];
      bolt(zig, width * 0.065, yellow); bolt(zig, width * 0.023, core);
      bolt([[-width * 0.22, 0, -14], [-width * 0.5, 9, -33], [-width * 0.6, 5, -23]], 2);
      bolt([[width * 0.2, 0, 7], [width * 0.48, -7, -3], [width * 0.6, -3, 17]], 2);
    } else if (slot === 1) {
      for (var w = 0; w < 7; w++) {
        var offset = (w - 3) * radius * 0.19;
        streaks.push(bolt([[offset, 18 + w % 3 * 14, 18], [offset * 0.9, 15 + w % 3 * 14, -radius], [offset * 0.55, 12 + w % 3 * 14, -radius * (2.2 + w % 2 * 0.8)]], w % 2 ? 2.5 : 4, core));
      }
      rings.push(ring(radius * 0.6, 8, core)); rings.push(ring(radius * 0.85, 10, haze));
    } else if (slot === 2) {
      orb = new THREE.Group(); orb.position.y = 110; root.add(orb);
      mesh(THREE, orb, new THREE.SphereGeometry(radius * 0.35, 16, 12), haze);
      mesh(THREE, orb, new THREE.IcosahedronGeometry(radius * 0.17, 1), core);
      for (var e = 0; e < 3; e++) {
        var orbit = mesh(THREE, orb, new THREE.TorusGeometry(radius * 0.36, 3, 5, 40), yellow); orbit.rotation.set(e * 1.1, e * 0.8, 0.5);
      }
      for (var v = 0; v < 5; v++) {
        var angle = v * Math.PI * 0.4;
        bolt([[Math.cos(angle) * radius * 0.15, 110, Math.sin(angle) * radius * 0.15], [Math.cos(angle + 0.3) * radius * 0.55, 52, Math.sin(angle + 0.3) * radius * 0.55], [Math.cos(angle) * radius * 0.65, 8, Math.sin(angle) * radius * 0.65]], 3);
      }
      rings.push(ring(radius * 0.8, 5));
    } else {
      rings.push(ring(radius, 5)); rings.push(ring(radius * 0.92, 6, core)); rings.push(ring(radius * 0.48, 8));
      column = new THREE.Group(); root.add(column);
      var thunder = [[-40, 720, -20], [45, 570, 15], [-35, 465, -8], [55, 370, 10], [-20, 240, 0], [35, 140, 7], [0, 5, 0]];
      mesh(THREE, column, wire(THREE, thunder, 19), yellow); mesh(THREE, column, wire(THREE, thunder, 7), core);
      for (var r = 0; r < 7; r++) {
        var theta = r * Math.PI * 2 / 7;
        mesh(THREE, column, wire(THREE, [[0, 70, 0], [Math.cos(theta + 0.15) * radius * 0.35, 20, Math.sin(theta + 0.15) * radius * 0.35], [Math.cos(theta) * radius * 0.65, 55, Math.sin(theta) * radius * 0.65], [Math.cos(theta) * radius * 0.94, 6, Math.sin(theta) * radius * 0.94]], 5), yellow);
      }
      flash = add(new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 6, 56), haze, 0, 4, 0);
      // The outer warning circle stays fixed; inner rings charge before the sky strike.
    }
    function update(progress) {
      var p = clamp(progress), fade = Math.min(1, p * 9) * Math.min(1, (1 - p) * 5);
      mats.forEach(function (entry) { entry.mat.opacity = entry.base * fade; });
      if (mode === 0) root.scale.setScalar(0.94 + 0.08 * Math.sin(p * 50));
      if (mode === 1) {
        streaks.forEach(function (m, i) { m.scale.z = 0.65 + p * 0.7; m.position.z = -p * 32; m.scale.x = 1 + 0.06 * Math.sin(p * 30 + i); });
        rings.forEach(function (m, i) { m.scale.setScalar(0.6 + p * (0.9 + i * 0.2)); });
      }
      if (mode === 2) {
        orb.rotation.set(p * 5, p * 9, p * 3); orb.position.y = 110 + Math.sin(p * Math.PI) * 40;
        orb.scale.setScalar(0.65 + 0.55 * Math.sin(p * Math.PI)); rings[0].scale.setScalar(0.75 + p * 0.4);
      }
      if (mode === 3) {
        var strike = p >= 0.55, impact = clamp((p - 0.55) / 0.45);
        column.visible = strike; flash.visible = strike;
        column.scale.x = column.scale.z = 1 + 0.12 * Math.sin(impact * 80);
        flash.scale.setScalar(0.4 + impact * 0.8);
        rings[0].scale.setScalar(1); rings[1].scale.setScalar(strike ? 1 + impact * 0.18 : 1);
        rings[2].scale.setScalar(strike ? 1 + impact : 0.65 + p * 0.6);
        haze.opacity = strike ? 0.35 * (1 - impact) : 0.05;
        core.opacity = strike ? fade : 0.3 + 0.18 * Math.sin(p * 22);
        yellow.opacity = strike ? fade : 0.38 + p * 0.45;
      }
      if (mode === 4) rings.forEach(function (m, i) { m.scale.setScalar(0.7 + p * (0.4 + i * 0.2)); });
    }
    update(0); return { object: root, update: update };
  }
  MOBA.defineChampionArt('pikachu', {
    lore: 'Le dijeron que era muy chiquito para salvar el barrio; ahora las tormentas le piden permiso y el asado sale con luz propia.',
    quote: 'Vení, que te despierto de un chispazo.',
    build: build,
    fx: {
      Q: function (THREE, ctx, info) { return effect(THREE, ctx, info, 0); },
      W: function (THREE, ctx, info) { return effect(THREE, ctx, info, 1); },
      E: function (THREE, ctx, info) { return effect(THREE, ctx, info, 2); },
      R: function (THREE, ctx, info) { return effect(THREE, ctx, info, 3); }
    }
  });
})();
