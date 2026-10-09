(function () {
  'use strict';
  const BLUE = 0x4fb4ff, ICE = 0xe0f6ff, INK = 0x142b58, GOLD = 0xe9b965;
  const clamp = v => Math.max(0, Math.min(1, v));
  const pulse = p => Math.sin(Math.PI * clamp(p));

  MOBA.defineChampionArt('lyra', {
    lore: 'Lyra teje con el último invierno de su pueblo: cada nudo guarda una voz y cada ventisca exige que alguien la escuche.',
    quote: 'Vení, que te hago un abrigo de escarcha.',
    build: function (THREE, ctx) {
      const root = new THREE.Group(), rig = new THREE.Group();
      root.add(rig); rig.position.y = 30;
      const cache = ctx.cache;
      const blue = cache.mat(BLUE, { metalness: 0.25, roughness: 0.32 });
      const ice = cache.mat(ICE, { emissive: BLUE, emissiveIntensity: 0.25, roughness: 0.25 });
      const ink = cache.mat(INK), gold = cache.mat(GOLD, { metalness: 0.6, roughness: 0.3 });
      const glow = cache.basic(ICE);
      function geo(key, fn) { return cache.geo('lyra:' + key, fn); }
      function mesh(g, m, parent, x, y, z) {
        const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); (parent || rig).add(o); return o;
      }
      const shard = geo('shard', () => new THREE.OctahedronGeometry(1, 0));
      const ball = geo('ball', () => new THREE.IcosahedronGeometry(1, 1));
      const box = geo('box', () => new THREE.BoxGeometry(1, 1, 1));
      function crystal(parent, material, x, y, z, sx, sy, sz) {
        const o = mesh(shard, material, parent, x, y, z); o.scale.set(sx, sy, sz); return o;
      }
      const ground = mesh(geo('ground-ring', () => new THREE.TorusGeometry(66, 3, 4, 40)), ice, root, 0, 3, 0);
      ground.rotation.x = Math.PI / 2;
      // Five enormous facets replace legs: a floating, split bell of frozen cloth.
      const skirts = [];
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const pivot = new THREE.Group(); pivot.position.set(0, 82, 0); pivot.rotation.y = a; rig.add(pivot);
        const panel = mesh(geo('skirt', () => new THREE.ConeGeometry(31, 87, 3)), i % 2 ? ice : blue, pivot, 0, -29, 42);
        panel.rotation.x = Math.PI; panel.rotation.z = 0.16;
        skirts.push(pivot);
      }
      const torso = mesh(geo('torso', () => new THREE.CylinderGeometry(27, 18, 63, 5)), ink, rig, 0, 111, 0);
      const belt = mesh(geo('belt', () => new THREE.TorusGeometry(24, 7, 4, 5)), gold, rig, 0, 88, 0); belt.rotation.x = Math.PI / 2;
      crystal(rig, ice, 0, 126, 25, 18, 27, 8);
      const collar = mesh(geo('collar', () => new THREE.ConeGeometry(44, 31, 5, 1, true)), blue, rig, 0, 150, -1); collar.rotation.x = Math.PI;
      const head = new THREE.Group(); head.position.set(0, 176, 8); rig.add(head);
      const hood = mesh(ball, ice, head, 0, 0, 0); hood.scale.set(31, 33, 26);
      const face = mesh(ball, ink, head, 0, -2, 19); face.scale.set(24, 21, 11);
      for (const side of [-1, 1]) {
        const eye = mesh(box, glow, head, side * 10, 1, 29); eye.scale.set(12, 5, 3); eye.rotation.z = side * -0.15;
        crystal(head, blue, side * 25, 25, -1, 11, 28, 10).rotation.z = side * -0.45;
      }
      crystal(head, gold, 0, 32, 5, 10, 21, 8);
      // A monumental pentagonal loom: visible from above as well as in silhouette.
      const loom = new THREE.Group(); loom.position.set(0, 163, -29); rig.add(loom);
      const loomPoints = [];
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI / 2 + i * Math.PI * 2 / 5;
        loomPoints.push(new THREE.Vector3(Math.cos(a) * 98, Math.sin(a) * 98, 0));
      }
      mesh(geo('pentagonal-loom', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loomPoints, false, 'catmullrom', 0), 40, 7, 5, false)), gold, loom);
      const satellites = [], threads = [];
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 29;
        const thread = mesh(geo('thread', () => new THREE.CylinderGeometry(1.8, 1.8, 118, 4)), glow, loom, x, 0, 0); threads.push(thread);
        const a = Math.PI / 2 + i * Math.PI * 2 / 5;
        const c = crystal(loom, blue, Math.cos(a) * 94, Math.sin(a) * 94, 0, 14, 24, 13);
        c.rotation.z = a - Math.PI / 2; satellites.push(c);
      }
      const arms = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(side * 32, 141, 7); rig.add(arm);
        const sleeve = mesh(geo('sleeve', () => new THREE.ConeGeometry(22, 48, 5)), blue, arm, side * 12, -18, 0);
        sleeve.rotation.z = side * -0.5;
        crystal(arm, ice, side * 20, -43, 8, 14, 17, 12);
        arms.push(arm);
      }
      const shuttle = new THREE.Group(); arms[1].add(shuttle); shuttle.position.set(22, -45, 23);
      crystal(shuttle, ice, 0, 0, 0, 15, 13, 48);
      crystal(shuttle, gold, 0, 0, 0, 19, 16, 17);
      const shot = crystal(shuttle, glow, 0, 0, 0, 7, 7, 27); shot.visible = false;
      // This glow is private; cache materials are never animated.
      const auraMat = new THREE.MeshBasicMaterial({ color: ICE, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const aura = mesh(geo('aura', () => new THREE.TorusGeometry(82, 4, 4, 40)), auraMat, rig, 0, 105, -31);
      return {
        object: root,
        update: function (state) {
          state = state || {};
          const time = state.time || 0, t = state.t || 0, p = clamp(state.progress || 0), s = pulse(p);
          const anim = state.anim || 'idle';
          rig.position.set(0, 30 + Math.sin(time * 2.1) * 4, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1);
          head.rotation.set(0, Math.sin(time * 0.8) * 0.12, 0);
          loom.rotation.set(0, Math.sin(time) * 0.08, Math.sin(time * 0.6) * 0.025);
          loom.scale.setScalar(1); loom.position.set(0, 163, -29);
          arms[0].rotation.set(-0.1, 0, -0.15); arms[1].rotation.set(-0.2, 0, 0.15);
          shuttle.rotation.set(0, 0, 0); shot.visible = false; shot.position.z = 0;
          auraMat.opacity = 0; aura.rotation.set(0, 0, 0); aura.scale.setScalar(1);
          ground.scale.setScalar(1 + Math.sin(time * 2) * 0.04);
          for (let i = 0; i < 5; i++) {
            skirts[i].rotation.x = Math.sin(time * 2 + i) * 0.045;
            satellites[i].scale.set(14, 24 + Math.sin(time * 2 + i) * 3, 13);
            threads[i].scale.x = 1;
          }
          if (anim === 'walk') {
            const rate = Math.max(0.4, (state.speed || 330) / 330);
            rig.rotation.x = 0.16; rig.rotation.z = Math.sin(t * 4 * rate) * 0.06;
            rig.position.y += Math.sin(t * 5 * rate) * 5;
            arms[0].rotation.x = 0.35; arms[1].rotation.x = 0.2;
            for (let i = 0; i < 5; i++) skirts[i].rotation.x = 0.2 + Math.sin(t * 5 * rate + i) * 0.09;
            loom.rotation.x = -0.13;
          } else if (anim === 'attack') {
            // Draw the shuttle back, then thrust and release a luminous needle toward +Z.
            const draw = Math.sin(Math.PI * Math.min(1, p / 0.38));
            const fire = clamp((p - 0.38) / 0.22);
            arms[1].rotation.x = 0.45 * draw - 1.35 * fire * (1 - p * 0.3);
            arms[1].rotation.z = -0.35 * fire;
            rig.rotation.x = -0.07 * draw + 0.14 * s;
            shot.visible = p > 0.38 && p < 0.85;
            shot.position.z = fire * 82; shot.scale.set(7 * (1 - p), 7 * (1 - p), 27);
          } else if (anim === 'cast') {
            const slot = state.slot == null ? 0 : state.slot;
            auraMat.opacity = 0.5 * s;
            if (slot === 0) {
              arms[1].rotation.x = -1.7 * s; arms[0].rotation.z = -0.8 * s;
              shuttle.rotation.z = 0.7 * s; loom.rotation.y = -0.2 * s;
            } else if (slot === 1) {
              arms[0].rotation.z = -1.2 * s; arms[1].rotation.z = 1.2 * s;
              arms[0].rotation.x = arms[1].rotation.x = -0.65 * s;
              loom.scale.setScalar(1 + 0.12 * s); rig.position.y -= 8 * s;
              aura.rotation.x = Math.PI / 2; aura.position.y = 35;
            } else if (slot === 2) {
              rig.scale.set(1 - 0.32 * s, 1 + 0.12 * s, 1 - 0.32 * s);
              rig.rotation.y = Math.PI * 2 * p; arms[0].rotation.z = 0.75 * s; arms[1].rotation.z = -0.75 * s;
              loom.rotation.z = -Math.PI * 2 * p;
            } else {
              rig.position.y += 27 * s; rig.rotation.x = -0.12 * s;
              arms[0].rotation.z = -2.3 * s; arms[1].rotation.z = 2.3 * s;
              loom.rotation.z = Math.PI * 2 * p; loom.scale.setScalar(1 + 0.18 * s);
              auraMat.opacity = 0.85 * s; aura.scale.setScalar(1 + 0.35 * s);
              for (let i = 0; i < 5; i++) { skirts[i].rotation.x = 0.55 * s; threads[i].scale.x = 1 + 2 * s; }
            }
          } else if (anim === 'recall') {
            arms[0].rotation.z = -0.8; arms[1].rotation.z = 0.8;
            rig.position.y += 12 + Math.sin(t * 3) * 8;
            loom.rotation.z = t * 1.3; aura.rotation.z = -t * 1.8;
            auraMat.opacity = 0.35 + Math.sin(t * 4) * 0.15;
            for (let i = 0; i < 5; i++) skirts[i].rotation.x = 0.22;
          } else if (anim === 'dead') {
            const fall = clamp(t * 2);
            rig.position.y = 30 + 45 * fall; rig.rotation.x = -1.4 * fall;
            // Move the fallen loom forward to keep its lowest edge above the ground.
            loom.position.z = -29 + 60 * fall;
            arms[0].rotation.z = -1.2 * fall; arms[1].rotation.z = 1.1 * fall;
            head.rotation.z = 0.45 * fall; ground.scale.setScalar(1 - 0.2 * fall);
          }
          if (!(anim === 'cast' && state.slot === 1)) aura.position.y = 105;
        }
      };
    },
    fx: {
      Q: function (THREE, ctx, info) { return frostFX(THREE, info, 0); },
      W: function (THREE, ctx, info) { return frostFX(THREE, info, 1); },
      E: function (THREE, ctx, info) { return frostFX(THREE, info, 2); },
      R: function (THREE, ctx, info) { return frostFX(THREE, info, 3); }
    }
  });

  function frostFX(THREE, info, slot) {
    info = info || {};
    const kind = info.kind || ['projectile', 'area', 'dash', 'area'][slot];
    const r = Math.max(12, info.radius || (slot === 3 ? 450 : 175));
    const width = Math.max(12, info.width || 120), length = Math.max(20, info.length || 650);
    const object = new THREE.Group(), pieces = [], materials = [];
    function material(color, opacity) {
      const m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      materials.push({ m: m, opacity: opacity }); return m;
    }
    const blue = material(BLUE, 0.65), ice = material(ICE, 0.9), gold = material(GOLD, 0.55);
    const oct = new THREE.OctahedronGeometry(1, 0);
    function add(geo, mat, x, y, z) {
      const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); object.add(o); return o;
    }
    function shard(x, y, z, sx, sy, sz, mat) {
      const o = add(oct, mat || ice, x, y, z); o.scale.set(sx, sy, sz); return o;
    }
    function ring(radius, tube, mat, y, vertical) {
      const o = add(new THREE.TorusGeometry(radius, tube, 4, 60), mat, 0, y || 6, 0);
      if (!vertical) o.rotation.x = Math.PI / 2; return o;
    }
    function curve(points, tube, mat) {
      return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, tube, 4, false), mat);
    }
    let needle, rim, inner, portal;
    const travel = kind === 'projectile' || kind === 'line';
    const extent = travel ? width * 0.45 : r;
    if (travel) {
      const zSize = kind === 'line' ? length * 0.5 : width * 1.15;
      const zCenter = kind === 'line' ? length * 0.5 : 0;
      needle = shard(0, 20, zCenter, width * 0.24, width * 0.2, zSize, ice);
      shard(0, 20, zCenter - zSize * 0.3, width * 0.38, width * 0.27, zSize * 0.35, blue);
      for (let k = 0; k < 2; k++) {
        const points = [];
        for (let i = 0; i <= 24; i++) {
          const a = i / 24 * Math.PI * 4 + k * Math.PI;
          points.push(new THREE.Vector3(Math.cos(a) * width * 0.27, 20 + Math.sin(a) * width * 0.27, zCenter - zSize + i / 24 * zSize * 2));
        }
        pieces.push({ o: curve(points, 3, k ? gold : blue), type: 'thread', phase: k });
      }
      if (slot !== 0) {
        for (let i = 0; i < 5; i++) {
          const z = kind === 'line' ? length * (i + 0.5) / 5 : (i - 2) * width * 0.35;
          pieces.push({ o: shard(0, 20, z, width * 0.36, width * 0.3, 12, blue), type: 'cross', phase: i });
        }
      }
    } else {
      rim = ring(extent, 4, blue, 6); inner = ring(extent * 0.75, 2.5, ice, 7);
      // Sparse radial stitches preserve the visibility of units inside the zone.
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + i * Math.PI * 2 / 5;
        const stitch = add(new THREE.BoxGeometry(3, 2, extent * 0.55), gold, Math.cos(a) * extent * 0.58, 8, Math.sin(a) * extent * 0.58);
        stitch.rotation.y = Math.PI / 2 - a;
      }
      if (slot === 0) {
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          pieces.push({ o: shard(Math.cos(a) * r * 0.45, 35, Math.sin(a) * r * 0.45, 16, 65, 16), type: 'prison', phase: i });
        }
      } else if (slot === 1) {
        const pentagon = [];
        for (let i = 0; i <= 5; i++) {
          const a = Math.PI / 2 + i * Math.PI * 2 / 5;
          pentagon.push(new THREE.Vector3(Math.cos(a) * r * 0.82, 12, Math.sin(a) * r * 0.82));
          if (i < 5) {
            const o = shard(Math.cos(a) * r * 0.82, 75, Math.sin(a) * r * 0.82, r * 0.14, 105, r * 0.14, ice);
            pieces.push({ o: o, type: 'prison', phase: i });
          }
        }
        curve(pentagon, 4, ice);
      } else if (slot === 2) {
        portal = ring(r * 0.66, 7, ice, r * 0.65, true);
        const other = ring(r * 0.48, 4, gold, r * 0.65, true); other.rotation.y = 0.5;
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7;
          pieces.push({ o: shard(Math.cos(a) * r * 0.5, r * 0.6 + Math.sin(a) * r * 0.5, 0, 12, 24, 12), type: 'blink', phase: a });
        }
      } else {
        // Three open helices make a storm, without an opaque cylinder hiding the fight.
        for (let j = 0; j < 3; j++) {
          const points = [];
          for (let i = 0; i <= 36; i++) {
            const a = i / 36 * Math.PI * 2.7 + j * Math.PI * 2 / 3;
            const radius = r * (0.88 - i / 36 * 0.18);
            points.push(new THREE.Vector3(Math.cos(a) * radius, 16 + i / 36 * r * 0.68, Math.sin(a) * radius));
          }
          pieces.push({ o: curve(points, r * 0.012, j === 1 ? ice : blue), type: 'storm', phase: j });
        }
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI * 2 / 10;
          const o = shard(Math.cos(a) * r * 0.7, 30 + i % 3 * r * 0.16, Math.sin(a) * r * 0.7, 13, 28, 13, ice);
          pieces.push({ o: o, type: 'snow', phase: a });
        }
      }
    }
    for (const piece of pieces) {
      piece.position = piece.o.position.clone(); piece.scale = piece.o.scale.clone();
    }
    return {
      object: object,
      update: function (p) {
        p = clamp(p || 0);
        const fade = Math.min(1, p * 12) * Math.min(1, (1 - p) * 6);
        for (const entry of materials) entry.m.opacity = entry.opacity * fade;
        if (rim) rim.scale.setScalar(0.9 + 0.1 * Math.min(1, p * 4));
        if (inner) { inner.scale.setScalar(0.75 + 0.25 * pulse(p)); inner.rotation.z = p * 0.5; }
        if (portal) { portal.rotation.z = p * Math.PI; portal.scale.setScalar(0.4 + 0.75 * pulse(p)); }
        if (needle) needle.rotation.z = Math.sin(p * Math.PI * 4) * 0.08;
        for (const piece of pieces) {
          const o = piece.o, b = piece.position;
          o.position.copy(b); o.scale.copy(piece.scale); o.rotation.set(0, 0, 0);
          if (piece.type === 'prison') {
            const grow = clamp((p - 0.33) / 0.16);
            o.scale.y = piece.scale.y * (0.03 + 0.97 * grow); o.position.y = 10 + piece.scale.y * grow;
            o.rotation.z = Math.sin(piece.phase) * 0.18 * grow;
          } else if (piece.type === 'blink') {
            const a = piece.phase + p * Math.PI * 1.2;
            o.position.set(Math.cos(a) * r * (0.5 + p * 0.25), r * 0.6 + Math.sin(a) * r * 0.5, p * r * 0.6);
            o.rotation.z = -a;
          } else if (piece.type === 'storm') {
            o.rotation.y = -p * Math.PI * 3; o.scale.y = 0.45 + 0.55 * Math.min(1, p * 5);
          } else if (piece.type === 'snow') {
            const a = piece.phase - p * Math.PI * 5;
            o.position.set(Math.cos(a) * r * 0.7, 25 + ((p * 2 + piece.phase / 7) % 1) * r * 0.6, Math.sin(a) * r * 0.7);
            o.rotation.set(p * 5 + piece.phase, 0, a);
          } else if (piece.type === 'thread') {
            o.rotation.z = p * Math.PI * 2;
          } else if (piece.type === 'cross') {
            o.rotation.z = p * Math.PI * 2 + piece.phase; o.scale.x *= 0.7 + 0.3 * pulse(p);
          }
        }
      }
    };
  }
})();
