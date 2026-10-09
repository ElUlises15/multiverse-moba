(function () {
  'use strict';

  var GOLD = 0xc9b037, CREAM = 0xfff6c2, COAL = 0x252d38, FIRE = 0xff7b24;
  function clamp(x) { return Math.max(0, Math.min(1, x)); }

  MOBA.defineChampionArt('bolt', {
    lore: 'Bolt escapó de la fundición con un cañón robado y una antena que todavía le cobra favores al cielo.',
    quote: 'Vos marcá el blanco. Yo arreglo el paisaje.',
    build: function (THREE, ctx) {
      ctx = ctx || {};
      var object = new THREE.Group(), rig = new THREE.Group();
      object.add(rig);
      var cache = ctx.cache;
      function material(c, glow) {
        var opts = { roughness: 0.65, metalness: 0.45, flatShading: true };
        if (glow) { opts.emissive = c; opts.emissiveIntensity = 0.8; }
        return cache ? cache.mat(c, opts) : new THREE.MeshStandardMaterial(Object.assign({ color: c }, opts));
      }
      var gold = material(GOLD), cream = material(CREAM, true), coal = material(COAL), fire = material(FIRE, true);
      var team = material(ctx.teamColor === undefined ? 0x38a3ff : ctx.teamColor);
      function mesh(parent, type, args, mat, x, y, z) {
        var key = 'bolt:' + type + ':' + args.join(',');
        var geo = cache ? cache.geo(key, function () { return new THREE[type](...args); }) : new THREE[type](...args);
        var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
      }
      function box(p, w, h, d, mat, x, y, z) { return mesh(p, 'BoxGeometry', [w, h, d], mat, x, y, z); }
      function group(p, x, y, z) { var g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }
      var tracks = [], wheels = [];
      [-1, 1].forEach(function (side) {
        var track = group(rig, side * 64, 0, 0); tracks.push(track);
        box(track, 42, 48, 128, coal, 0, 24, 0);
        box(track, 46, 14, 108, gold, 0, 52, 0);
        [-40, 0, 40].forEach(function (z) {
          var w = mesh(track, 'CylinderGeometry', [17, 17, 44, 8], gold, 0, 24, z);
          w.rotation.z = Math.PI / 2; wheels.push(w);
        });
      });
      box(rig, 105, 45, 105, gold, 0, 65, -3);
      var prow = box(rig, 84, 30, 22, coal, 0, 65, 57); prow.rotation.x = -0.25;
      box(rig, 48, 12, 5, team, 0, 70, 70);
      var turret = group(rig, 0, 102, -7);
      mesh(turret, 'CylinderGeometry', [44, 52, 24, 8], coal, 0, 0, 0);
      box(turret, 86, 67, 70, gold, 0, 39, 0);
      box(turret, 65, 19, 9, coal, -3, 52, 39);
      box(turret, 41, 9, 11, cream, -8, 53, 44);
      // One enormous gun and one tiny working claw make the silhouette asymmetric.
      var gun = group(turret, 52, 37, 11);
      mesh(gun, 'SphereGeometry', [28, 8, 6], coal, 0, 0, 0);
      var barrel = group(gun, 0, 0, 0);
      var tube = mesh(barrel, 'CylinderGeometry', [25, 32, 94, 8], gold, 0, 0, 48); tube.rotation.x = Math.PI / 2;
      var collar = mesh(barrel, 'CylinderGeometry', [33, 33, 23, 8], coal, 0, 0, 92); collar.rotation.x = Math.PI / 2;
      mesh(barrel, 'TorusGeometry', [24, 6, 6, 8], cream, 0, 0, 105);
      mesh(barrel, 'CylinderGeometry', [21, 21, 3, 8], coal, 0, 0, 104).rotation.x = Math.PI / 2;
      box(barrel, 16, 13, 68, cream, 0, 26, 51);
      var flashMat = new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      var flash = mesh(barrel, 'ConeGeometry', [33, 64, 6], flashMat, 0, 0, 136); flash.rotation.x = Math.PI / 2;
      var claw = group(turret, -56, 26, 0);
      box(claw, 26, 24, 54, coal, 0, 0, 20);
      var grenade = mesh(claw, 'IcosahedronGeometry', [21, 0], fire, 0, 0, 55);
      [-1, 1].forEach(function (s) { box(claw, 9, 29, 28, gold, s * 19, 0, 51); });
      var antenna = group(turret, -15, 72, -25);
      box(antenna, 13, 55, 13, coal, 0, 25, 0);
      var dish = group(antenna, 0, 70, 0);
      mesh(dish, 'TorusGeometry', [40, 9, 6, 12], gold, 0, 0, 0);
      mesh(dish, 'OctahedronGeometry', [18, 0], cream, 0, 0, 0);
      var panels = [];
      [-1, 1].forEach(function (s) { var panel = box(dish, 24, 42, 9, gold, s * 55, 0, 0); panel.rotation.z = s * 0.3; panels.push(panel); });
      var jets = [], flames = [];
      [-1, 1].forEach(function (s) {
        var jet = mesh(rig, 'CylinderGeometry', [15, 21, 38, 8], coal, s * 38, 72, -69); jet.rotation.x = Math.PI / 2; jets.push(jet);
        var flame = mesh(rig, 'ConeGeometry', [15, 52, 6], fire, s * 38, 72, -109); flame.rotation.x = -Math.PI / 2; flames.push(flame);
      });

      return { object: object, update: function (state) {
        state = state || {};
        var time = state.time || 0, t = state.t || 0, p = clamp(state.progress || 0), anim = state.anim || 'idle';
        var pulse = Math.sin(Math.PI * p), step = time * (5 + (state.speed || 0) / 65);
        rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
        turret.position.y = 102 + Math.sin(time * 2) * 1.4; turret.rotation.set(0, Math.sin(time * 1.2) * 0.04, 0);
        gun.rotation.set(0, 0, 0); barrel.position.z = 0;
        claw.rotation.set(0, 0, 0); grenade.scale.setScalar(1);
        antenna.rotation.set(0, 0, 0); dish.rotation.set(0, 0, Math.sin(time) * 0.1);
        panels.forEach(function (m, i) { m.position.x = (i ? 1 : -1) * 55; m.rotation.y = 0; });
        tracks.forEach(function (m) { m.position.y = 0; m.rotation.x = 0; });
        wheels.forEach(function (m) { m.rotation.y = 0; });
        flashMat.opacity = 0; flash.scale.setScalar(1);
        flames.forEach(function (m) { m.scale.set(0.6, 0.25, 0.6); });
        if (anim === 'walk') {
          rig.rotation.z = Math.sin(step) * 0.045; turret.rotation.x = Math.sin(step + 0.8) * 0.035;
          tracks.forEach(function (m, i) { m.position.y = 2 + Math.sin(step + i * Math.PI) * 2; m.rotation.x = Math.sin(step) * 0.025; });
          wheels.forEach(function (m) { m.rotation.y = -time * (state.speed || 325) / 17; });
          dish.rotation.z = Math.sin(step - 0.5) * 0.15;
        } else if (anim === 'attack') {
          var recoil = p < 0.27 ? -p * 12 : Math.max(0, 1 - (p - 0.27) / 0.28) * 20;
          barrel.position.z = -recoil; gun.rotation.x = -0.06 * pulse;
          turret.rotation.x = -Math.max(0, recoil) * 0.003;
          flashMat.opacity = p > 0.26 && p < 0.43 ? 1 : 0;
          flash.scale.setScalar(1 + pulse * 0.4);
        } else if (anim === 'cast') {
          var slot = state.slot || 0;
          if (slot === 0) { barrel.position.z = -22 * pulse; gun.rotation.x = -0.12 * pulse; flashMat.opacity = p > 0.62 && p < 0.82 ? 1 : 0; flash.scale.setScalar(1.7); }
          if (slot === 1) { claw.rotation.x = -1.35 * Math.sin(Math.PI * Math.min(1, p * 1.6)); claw.rotation.z = -0.3 * pulse; grenade.scale.setScalar(p > 0.55 ? 0.2 : 1 + pulse * 0.15); turret.rotation.y = 0.15 * pulse; }
          if (slot === 2) { rig.rotation.x = 0.16 * pulse; turret.position.y -= 9 * pulse; flames.forEach(function (m) { m.scale.set(1.3, 1 + pulse * 1.5, 1.3); }); }
          if (slot === 3) {
            turret.position.y += 16 * pulse; gun.rotation.x = -0.8 * pulse; claw.rotation.x = -0.65 * pulse;
            antenna.rotation.x = -0.18 * pulse; dish.rotation.z = time * 4;
            panels.forEach(function (m, i) { m.position.x = (i ? 1 : -1) * (55 + 20 * pulse); m.rotation.y = (i ? 1 : -1) * pulse * 0.8; });
            rig.position.y = Math.sin(p * Math.PI) * 8; rig.rotation.x = p > 0.7 ? -0.15 * Math.sin((p - 0.7) / 0.3 * Math.PI) : 0;
            flames.forEach(function (m) { m.scale.set(1, 1.3 * pulse + 0.2, 1); });
          }
        } else if (anim === 'recall') {
          turret.rotation.y = t * 2; gun.rotation.x = -0.9; claw.rotation.x = -0.8;
          rig.position.y = 8 + Math.sin(t * 3) * 6; dish.rotation.z = -t * 5;
          panels.forEach(function (m, i) { m.position.x = (i ? 1 : -1) * (65 + Math.sin(t * 4) * 8); });
          flames.forEach(function (m) { m.scale.set(1, 1 + Math.sin(t * 6) * 0.2, 1); });
        } else if (anim === 'dead') {
          var fall = clamp(t * 2);
          turret.rotation.z = -0.32 * fall; turret.position.y = 102 - 18 * fall;
          gun.rotation.x = 0.18 * fall; antenna.rotation.z = -0.75 * fall; claw.rotation.x = 0.7 * fall;
          dish.rotation.z = 0; flames.forEach(function (m) { m.scale.setScalar(0.001); });
        }
      } };
    },
    fx: {
      Q: function (THREE, ctx, info) { return effect(THREE, info, 0, 'projectile'); },
      W: function (THREE, ctx, info) { return effect(THREE, info, 1, 'area'); },
      E: function (THREE, ctx, info) { return effect(THREE, info, 2, 'self'); },
      R: function (THREE, ctx, info) { return effect(THREE, info, 3, 'line'); }
    }
  });

  // All signatures adapt to the engine's alternate impact and travel kinds.
  function effect(THREE, info, slot, fallback) {
    info = info || {};
    var kind = info.kind || fallback, radius = Math.max(10, info.radius || 180);
    var width = Math.max(10, info.width || 100), length = Math.max(20, info.length || 1100);
    var object = new THREE.Group(), moving = new THREE.Group(); object.add(moving);
    var mats = [CREAM, GOLD, FIRE].map(function (c) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); });
    var bits = [], rings = [], beam = null, core = null;
    function add(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mats[mat]); m.position.set(x || 0, y || 0, z || 0); (parent || moving).add(m); return m; }
    function ring(r, thick, x, y, z, floor) { var m = add(new THREE.TorusGeometry(r, thick, 5, 32), 1, x, y, z); if (floor) m.rotation.x = -Math.PI / 2; rings.push(m); return m; }
    if (kind === 'projectile') {
      core = add(new THREE.OctahedronGeometry(width * 0.27, 0), 0, 0, 0, 0); core.scale.z = 2.2;
      ring(width * 0.38, width * 0.045, 0, 0, -width * 0.15, false);
      add(new THREE.ConeGeometry(width * 0.22, width * 1.5, 6), 2, 0, 0, -width * 0.9).rotation.x = -Math.PI / 2;
      for (var j = 0; j < 4; j++) { var fin = add(new THREE.BoxGeometry(width * 0.12, width * 0.12, width * 0.75), 1, Math.cos(j * Math.PI / 2) * width * 0.34, Math.sin(j * Math.PI / 2) * width * 0.34, -width * 0.4); bits.push(fin); }
    } else if (kind === 'line') {
      beam = add(new THREE.BoxGeometry(width * 0.68, slot === 3 ? 90 : 24, length), 0, 0, slot === 3 ? 80 : 26, length / 2);
      add(new THREE.BoxGeometry(width, 12, length), 1, 0, 8, length / 2);
      for (var k = 0; k < 7; k++) { ring(width * 0.6, width * 0.045, 0, 80, length * k / 6, false); }
      if (slot === 3) { var column = add(new THREE.CylinderGeometry(width * 0.12, width * 0.35, 480, 8), 2, 0, 250, 0); bits.push(column); }
    } else {
      ring(radius * 0.96, Math.max(3, radius * 0.025), 0, 5, 0, true);
      ring(radius * 0.68, Math.max(3, radius * 0.018), 0, 7, 0, true);
      if (slot === 1) {
        core = add(new THREE.IcosahedronGeometry(radius * 0.15, 1), 2, 0, radius * 0.17, 0);
        // Broad sticky splats remain below the warning perimeter.
        for (var a = 0; a < 6; a++) { var ang = a * Math.PI / 3; var puddle = add(new THREE.SphereGeometry(radius * 0.19, 8, 4), 1, Math.cos(ang) * radius * 0.48, 3, Math.sin(ang) * radius * 0.48); puddle.scale.y = 0.06; bits.push(puddle); }
      } else if (slot === 2) {
        for (var b = 0; b < 6; b++) { var ang2 = b * Math.PI / 3; var jet = add(new THREE.ConeGeometry(radius * 0.09, radius * 0.5, 5), 2, Math.cos(ang2) * radius * 0.55, 22, Math.sin(ang2) * radius * 0.55); jet.rotation.x = -Math.PI / 2; bits.push(jet); }
      } else {
        core = add(new THREE.OctahedronGeometry(radius * 0.2, 0), 0, 0, radius * 0.23, 0);
        for (var c = 0; c < 6; c++) { var ang3 = c * Math.PI / 3; bits.push(add(new THREE.BoxGeometry(radius * 0.08, 8, radius * 0.25), 2, Math.cos(ang3) * radius * 0.8, 9, Math.sin(ang3) * radius * 0.8)); }
      }
    }
    return { object: object, update: function (p) {
      p = clamp(p || 0);
      var fade = Math.min(1, p * 12) * Math.min(1, (1 - p) * 6);
      mats.forEach(function (m, i) { m.opacity = fade * (i === 0 ? 0.9 : 0.65); });
      if (kind === 'projectile') { moving.rotation.z = p * Math.PI * (slot + 1); if (core) core.scale.set(1 + Math.sin(p * 20) * 0.08, 1, 2.2); }
      else if (kind === 'line') {
        var charged = p < 0.42 ? 0.05 + p * 0.12 : 0.75 + Math.sin(p * 35) * 0.15;
        beam.scale.set(charged, charged, 1);
        rings.forEach(function (m, i) { m.rotation.z = p * 4 + i * 0.4; m.scale.setScalar(p < 0.42 ? 0.7 + p * 0.5 : 1 + Math.sin(p * 20 - i) * 0.1); });
      } else {
        var blast = clamp((p - 0.58) / 0.2);
        rings.forEach(function (m, i) { m.scale.setScalar(i === 0 ? 1 : 0.7 + p * 0.3); m.rotation.z = p * (i ? -2 : 2); });
        if (core) { core.rotation.y = p * 8; core.scale.setScalar(slot === 1 ? 1 + blast * 2 : 0.5 + Math.sin(p * Math.PI) * 1.5); core.position.y = radius * (slot === 1 ? 0.17 : 0.23) * core.scale.x; }
        bits.forEach(function (m, i) {
          if (slot === 2) { m.scale.y = 0.6 + Math.sin(p * 22 + i) * 0.2 + p * 0.5; m.position.z = Math.sin(i * Math.PI / 3) * radius * 0.55 - p * radius * 0.4; }
          else if (slot === 1) { m.scale.x = m.scale.z = 0.5 + blast * 0.8; }
          else { m.rotation.y = p * 3 + i; }
        });
        if (kind === 'dash') moving.position.z = -p * radius * 0.65;
      }
    } };
  }
})();
