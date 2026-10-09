(function () {
  'use strict';
  var DARK = 0x1c1426, VIOLET = 0xd36bff, SOIL = 0x8a6a4a, GRASS = 0x719348;
  var TAU = Math.PI * 2;
  function clamp(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
  function pulse(p, a, b) { return Math.sin(Math.PI * clamp((p - a) / (b - a))); }

  MOBA.defineChampionArt('enderman', {
    lore: 'Lo echaron del vacío por afanar macetas; ahora cruza mundos a zancadas y te cobra el alquiler con la mirada.',
    quote: 'No me mirés así, que te cambio de barrio.',
    build: function (THREE, ctx) {
      var root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
      var cache = ctx.cache;
      var black = cache.mat(DARK, { roughness: 0.48, metalness: 0.25, emissive: 0x240c38, emissiveIntensity: 0.32 });
      var edge = cache.mat(0x39224d, { roughness: 0.35, emissive: 0x49106c, emissiveIntensity: 0.45 });
      var glow = cache.basic(VIOLET), earth = cache.mat(SOIL), grass = cache.mat(GRASS);
      var cube = cache.geo('enderman-unit-box', function () { return new THREE.BoxGeometry(1, 1, 1); });
      function box(parent, mat, x, y, z, w, h, d) {
        var m = new THREE.Mesh(cube, mat); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
      }
      var hips = new THREE.Group(); hips.position.y = 151; rig.add(hips);
      box(hips, black, 0, 2, 0, 33, 24, 24);
      var chest = new THREE.Group(); chest.position.y = 12; hips.add(chest);
      box(chest, black, 0, 42, 0, 36, 86, 27);
      box(chest, edge, -15, 48, 14, 5, 66, 3);
      box(chest, edge, 15, 48, 14, 5, 66, 3);
      box(chest, glow, 0, 53, 15, 7, 25, 2).rotation.z = 0.3;
      box(chest, black, 0, 99, 0, 17, 22, 18);
      var head = new THREE.Group(); head.position.set(0, 131, 0); chest.add(head);
      box(head, black, 0, 0, 0, 53, 52, 49);
      box(head, edge, 0, 22, 0, 55, 7, 51);
      box(head, edge, 0, -3, 25, 47, 13, 2);
      [-1, 1].forEach(function (side) {
        box(head, glow, side * 13, -2, 27, 20, 8, 3);
        box(head, cache.basic(0xf4d5ff), side * 13, -2, 29, 7, 6, 1);
      });
      var arms = [], forearms = [], legs = [], shins = [];
      [-1, 1].forEach(function (side) {
        var arm = new THREE.Group(); arm.position.set(side * 29, 88, 0); chest.add(arm); arms.push(arm);
        box(arm, edge, 0, -5, 0, 19, 19, 22);
        box(arm, black, 0, -39, 0, 13, 73, 15);
        var elbow = new THREE.Group(); elbow.position.y = -75; arm.add(elbow); forearms.push(elbow);
        box(elbow, black, 0, -34, 0, 11, 68, 13);
        box(elbow, black, 0, -74, 3, 18, 22, 20);
        box(elbow, glow, 0, -75, 14, 12, 4, 2);
        var leg = new THREE.Group(); leg.position.set(side * 11, -1, 0); hips.add(leg); legs.push(leg);
        box(leg, black, 0, -37, 0, 14, 74, 16);
        var knee = new THREE.Group(); knee.position.y = -74; leg.add(knee); shins.push(knee);
        box(knee, edge, 0, -4, 3, 15, 13, 17);
        box(knee, black, 0, -35, 0, 11, 68, 13);
        box(knee, black, 0, -71, 7, 17, 10, 30);
      });
      var held = new THREE.Group(); held.position.set(0, -87, 14); forearms[1].add(held);
      box(held, earth, 0, 0, 0, 35, 30, 35); box(held, grass, 0, 17, 0, 36, 7, 36); held.visible = false;
      var auraMat = new THREE.PointsMaterial({ color: VIOLET, size: 5, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
      var coords = new Float32Array(18 * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
      var motes = new THREE.Points(geo, auraMat); motes.frustumCulled = false; rig.add(motes);
      var beamMat = new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
      var beams = new THREE.Group(); head.add(beams);
      [-1, 1].forEach(function (side) { box(beams, beamMat, side * 13, -2, 97, 5, 6, 140); }); beams.visible = false;
      var halo = new THREE.Mesh(cache.geo('enderman-recall-ring', function () { return new THREE.TorusGeometry(51, 3, 5, 32); }), glow);
      halo.rotation.x = Math.PI / 2; halo.position.y = 6; rig.add(halo); halo.visible = false;
      function update(state) {
        state = state || {}; var time = Number(state.time) || 0, t = Number(state.t) || 0, p = clamp(state.progress), anim = state.anim || 'idle';
        rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.set(1, 1, 1);
        hips.position.y = 151; hips.rotation.set(0, 0, 0); chest.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
        arms.forEach(function (a, i) { a.rotation.set(0, 0, (i ? 1 : -1) * 0.04); forearms[i].rotation.set(0, 0, 0); legs[i].rotation.set(0, 0, 0); shins[i].rotation.set(0, 0, 0); });
        held.visible = false; beams.visible = false; halo.visible = false; halo.scale.setScalar(0.001);
        var breath = Math.sin(time * 1.5); chest.scale.y = 1 + breath * 0.008; head.rotation.z = 0.035 * Math.sin(time * 0.7);
        if (anim === 'idle') { arms[0].rotation.x = 0.045 * breath; arms[1].rotation.x = -0.045 * breath; head.rotation.y = 0.16 * Math.sin(time * 0.5); }
        if (anim === 'walk') {
          var stride = t * 6.6 * Math.max(0.25, (Number(state.speed) || 350) / 350), swing = Math.sin(stride);
          hips.position.y += 6 * Math.abs(Math.sin(stride)); chest.rotation.x = 0.1; head.rotation.x = -0.1;
          legs[0].rotation.x = swing * 0.66; legs[1].rotation.x = -swing * 0.66;
          shins[0].rotation.x = Math.max(0, -swing) * 0.65; shins[1].rotation.x = Math.max(0, swing) * 0.65;
          arms[0].rotation.x = -swing * 0.55; arms[1].rotation.x = swing * 0.55;
        }
        if (anim === 'attack') {
          // Wind up behind the shoulder, then whip the long fist forward.
          var wind = clamp(p / 0.36), hit = clamp((p - 0.36) / 0.18), recover = clamp((p - 0.66) / 0.34);
          arms[1].rotation.x = (0.9 * wind - 2.6 * hit) * (1 - recover);
          forearms[1].rotation.x = -0.65 * pulse(p, 0, 0.75); chest.rotation.y = (-0.5 * wind + 0.95 * hit) * (1 - recover);
          chest.rotation.x = 0.2 * pulse(p, 0.35, 0.85); arms[0].rotation.x = -0.4 * pulse(p, 0, 1);
        }
        if (anim === 'cast') {
          var power = pulse(p, 0, 1), slot = Number(state.slot) || 0;
          if (slot === 0) { rig.scale.set(1 - power * 0.35, 1 + power * 0.08, 1 - power * 0.35); arms[0].rotation.z = -power * 0.7; arms[1].rotation.z = power * 0.7; head.rotation.x = power * 0.3; }
          if (slot === 1) { held.visible = p < 0.57; arms[1].rotation.x = p < 0.4 ? 1.25 * clamp(p / 0.4) : 1.25 - 3.45 * clamp((p - 0.4) / 0.22); arms[1].rotation.x *= 1 - clamp((p - 0.72) / 0.28); forearms[1].rotation.x = -power * 0.85; chest.rotation.y = -power * 0.35; }
          if (slot === 2) { head.rotation.x = -0.15 * power; head.scale.set(1 + power * 0.08, 1, 1); beams.visible = p > 0.3 && p < 0.8; arms[0].rotation.z = -power * 0.22; arms[1].rotation.z = power * 0.22; }
          if (slot === 3) {
            var rise = pulse(p, 0, 0.7), slam = pulse(p, 0.5, 1);
            hips.position.y += rise * 40 - slam * 23; chest.rotation.x = -rise * 0.28 + slam * 0.7;
            arms[0].rotation.x = -rise * 2.8 - slam * 1.35; arms[1].rotation.x = -rise * 2.8 - slam * 1.35;
            arms[0].rotation.z = -rise * 0.3; arms[1].rotation.z = rise * 0.3; forearms[0].rotation.x = -slam * 0.5; forearms[1].rotation.x = -slam * 0.5;
            legs[0].rotation.x = rise * 0.35; legs[1].rotation.x = -rise * 0.35; halo.visible = true; halo.scale.setScalar(1 + rise * 0.8 + slam);
          }
        } else head.scale.set(1, 1, 1);
        if (anim === 'cast' && Number(state.slot) !== 2) head.scale.set(1, 1, 1);
        if (anim === 'recall') { halo.visible = true; halo.scale.setScalar(1 + Math.sin(t * 3) * 0.13); hips.position.y += 15 + 9 * Math.sin(t * 2); chest.rotation.y = t * 0.75; arms[0].rotation.x = arms[1].rotation.x = -1.2; forearms[0].rotation.x = forearms[1].rotation.x = -0.55; head.rotation.z = 0.2; }
        if (anim === 'dead') { var fall = clamp(t / 0.65); rig.rotation.x = -Math.PI / 2 * fall; rig.position.y = 35 * fall; arms[0].rotation.z = -0.6 * fall; arms[1].rotation.z = 0.6 * fall; legs[0].rotation.z = -0.13 * fall; legs[1].rotation.z = 0.17 * fall; head.rotation.y = 0.3 * fall; }
        held.scale.setScalar(held.visible ? 1 : 0.001); beams.scale.setScalar(beams.visible ? 1 : 0.001);
        auraMat.opacity = anim === 'dead' ? 0.2 : 0.65 + 0.15 * Math.sin(time * 2);
        for (var i = 0; i < 18; i++) { var angle = i * 2.399 + time * (0.16 + i * 0.007), r = 45 + 10 * Math.sin(time + i); coords[i * 3] = Math.cos(angle) * r; coords[i * 3 + 1] = 35 + ((i * 43 + time * 19) % 267); coords[i * 3 + 2] = Math.sin(angle) * r * (anim === 'dead' ? 0.2 : 1); }
        geo.attributes.position.needsUpdate = true; geo.computeBoundingBox();
      }
      update({}); return { object: root, update: update };
    },
    fx: { Q: effect('Q'), W: effect('W'), E: effect('E'), R: effect('R') }
  });

  function effect(slot) {
    return function (THREE, ctx, info) {
      info = info || {};
      var kind = info.kind || ({ Q: 'dash', W: 'projectile', E: 'target', R: 'target' })[slot];
      var radius = Math.max(12, Number(info.radius) || 180), width = Math.max(8, Number(info.width) || 80), length = Math.max(20, Number(info.length) || 600);
      var root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      var mats = [];
      function material(color, opacity, additive) { var m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }); m.userData.baseOpacity = opacity; mats.push(m); return m; }
      var violet = material(VIOLET, 0.85, true), dark = material(DARK, 0.85, false), pale = material(0xf0c8ff, 0.9, true);
      function mesh(g, m, parent) { var o = new THREE.Mesh(g, m); (parent || body).add(o); return o; }
      function box(m, w, h, d, parent) { return mesh(new THREE.BoxGeometry(w, h, d), m, parent); }
      function ring(r, tube, m) { var o = mesh(new THREE.TorusGeometry(r, tube, 5, 48), m); o.rotation.x = Math.PI / 2; return o; }
      // Keep fallback shapes aligned with the engine's +Z targeting contract.
      function footprint(a, r) {
        if (kind === 'line') return [Math.cos(a) * width * 0.45 * r, (Math.sin(a) * 0.5 + 0.5) * length * r];
        if (kind === 'cone') { var z = (Math.sin(a) * 0.5 + 0.5) * length * r; return [Math.cos(a) * z * Math.tan(Math.min(150, Number(info.angle) || 50) * Math.PI / 360), z]; }
        var size = kind === 'projectile' ? width * 0.45 : radius; return [Math.cos(a) * size * r, Math.sin(a) * size * r];
      }
      function fitRing(o) { if (kind === 'line') { o.scale.set(width / (2 * radius), length / (2 * radius), 1); o.position.z = length / 2; } else if (kind === 'cone') { o.scale.set(length * Math.tan((Number(info.angle) || 50) * Math.PI / 360) / radius, length / (2 * radius), 1); o.position.z = length / 2; } else if (kind === 'projectile') o.scale.setScalar(width / (2 * radius)); }
      var shards = [], rings = [], block, eye, beamGroup, slit, fist;
      if (slot === 'Q') {
        for (var q = 0; q < 2; q++) { var rq = ring(radius * (q ? 0.67 : 0.95), q ? 4 : 6, q ? pale : violet); rq.position.y = 5 + q * 12; fitRing(rq); rings.push(rq); }
        for (var j = 0; j < 18; j++) shards.push(box(j % 4 === 0 ? pale : violet, 7, 17, 7));
      }
      if (slot === 'W') {
        block = new THREE.Group(); body.add(block);
        var size = kind === 'projectile' ? width * 0.75 : Math.min(radius * 0.55, 85);
        box(material(SOIL, 1, false), size, size, size, block);
        var top = box(material(GRASS, 1, false), size * 1.015, size * 0.18, size * 1.015, block); top.position.y = size * 0.44;
        for (var k = 0; k < 3; k++) { var seam = box(dark, size * 0.12, size * 0.3, 2, block); seam.position.set((k - 1) * size * 0.25, -size * 0.12, size * 0.51); seam.rotation.z = 0.3; }
        for (var w = 0; w < 9; w++) shards.push(box(w % 3 ? violet : material(SOIL, 0.9, false), 9, 9, 9));
      }
      if (slot === 'E') {
        eye = new THREE.Group(); eye.position.y = kind === 'projectile' ? 25 : 190; body.add(eye);
        var outline = mesh(new THREE.TorusGeometry(32, 4, 5, 32), violet, eye); outline.scale.y = 0.48;
        box(pale, 9, 21, 5, eye); var socket = box(dark, 49, 12, 4, eye); socket.position.z = -4;
        for (var e = 0; e < 2; e++) { var hook = box(violet, 7, 24, 6, eye); hook.position.set((e ? 1 : -1) * 42, 0, 0); hook.rotation.z = (e ? 1 : -1) * 0.35; }
        beamGroup = new THREE.Group(); body.add(beamGroup);
        function ray(a, b, thickness) { var dir = new THREE.Vector3().subVectors(b, a); var o = mesh(new THREE.CylinderGeometry(thickness, thickness, dir.length(), 6), violet, beamGroup); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); }
        for (var b = 0; b < 2; b++) {
          if (kind === 'line' || kind === 'cone') ray(new THREE.Vector3((b ? 1 : -1) * 12, 30, 0), new THREE.Vector3(0, 30, length), 3);
          else if (kind === 'projectile') ray(new THREE.Vector3((b ? 1 : -1) * 12, 25, -width), new THREE.Vector3(0, 25, width), 3);
          else ray(new THREE.Vector3((b ? 1 : -1) * 23, 177, -65), new THREE.Vector3(0, 15, 0), 3);
        }
        var re = ring(radius * 0.52, 3, violet); re.position.y = 5; fitRing(re); rings.push(re);
        for (var n = 0; n < 6; n++) shards.push(box(violet, 6, 22, 6));
      }
      if (slot === 'R') {
        var pool = mesh(new THREE.CircleGeometry(radius, 48), dark); pool.rotation.x = -Math.PI / 2; pool.position.y = 3; fitRing(pool);
        for (var r = 0; r < 4; r++) { var rr = ring(radius * (0.3 + r * 0.2), 5 + r, r % 2 ? violet : dark); rr.position.y = 7 + r * 4; fitRing(rr); rings.push(rr); }
        slit = new THREE.Group(); body.add(slit); slit.position.y = 128;
        box(dark, 39, 245, 9, slit);
        for (var s = 0; s < 2; s++) { var lip = box(violet, 6, 252, 12, slit); lip.position.x = (s ? 1 : -1) * 24; lip.rotation.z = (s ? 1 : -1) * 0.07; }
        fist = new THREE.Group(); body.add(fist); box(dark, 65, 78, 58, fist); var knuckle = box(violet, 66, 12, 60, fist); knuckle.position.y = -28;
        for (var f = 0; f < 12; f++) shards.push(box(f % 4 ? violet : pale, 8, 25, 8));
      }
      var baseScales = rings.map(function (o) { return o.scale.clone(); });
      function update(p) {
        p = clamp(p); var fade = Math.min(1, p * 10) * Math.min(1, (1 - p) * 5);
        mats.forEach(function (m) { m.opacity = m.userData.baseOpacity * fade; });
        if (block) { block.position.y = kind === 'projectile' ? 0 : 45 + Math.sin(Math.PI * p) * 50; block.rotation.set(p * TAU * 1.2, p * TAU * 0.7, p * TAU * 0.5); }
        if (eye) { eye.rotation.y = Math.sin(p * TAU) * 0.12; eye.scale.setScalar(0.8 + pulse(p, 0, 1) * 0.3); beamGroup.scale.x = 0.8 + pulse(p, 0, 1) * 0.2; }
        if (slit) { slit.scale.set(Math.max(0.03, pulse(p, 0, 0.9)), 0.7 + pulse(p, 0, 1) * 0.3, 1); fist.position.set(0, 280 * (1 - clamp((p - 0.27) / 0.3)) + 45, 15); fist.rotation.x = -0.7 * (1 - clamp(p / 0.6)); }
        rings.forEach(function (o, i) { var factor = slot === 'Q' ? (p < 0.45 ? 1 - p * 1.9 : 0.14 + (p - 0.45) * 1.8) : slot === 'R' ? 0.8 + p * 0.3 + Math.sin(p * 15 + i) * 0.07 : 0.85 + p * 0.2; o.scale.copy(baseScales[i]).multiplyScalar(factor); o.rotation.z = p * (i % 2 ? -4 : 4); });
        shards.forEach(function (o, i) {
          var a = i * 2.399 + p * (slot === 'R' ? 7 : 2), spread = slot === 'Q' ? (p < 0.45 ? 1 - p * 2 : 0.1 + (p - 0.45) * 1.9) : slot === 'R' ? 0.95 - p * 0.55 : 0.45 + p * 0.6;
          var pos = footprint(a, spread); o.position.set(pos[0], 12 + ((i * 31) % 125) * (slot === 'Q' ? 1 - p * 0.6 : 0.4 + p), pos[1]);
          if (slot === 'W' && kind === 'projectile') o.position.set(Math.sin(a) * width * 0.28, Math.cos(a) * width * 0.28, -width * (0.7 + i * 0.22));
          o.rotation.set(p * 5 + i, p * 7, a); o.scale.setScalar(0.4 + fade * 0.6);
        });
      }
      update(0); return { object: root, update: update };
    };
  }
})();
