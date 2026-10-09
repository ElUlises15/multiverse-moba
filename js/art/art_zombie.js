(function () {
  'use strict';
  const GREEN = 0x6f9a5a, LIME = 0xb7ff5a, SKY = 0x65c6e7, NAVY = 0x213650;
  const clamp = x => Math.max(0, Math.min(1, x));
  const hit = p => Math.sin(Math.PI * clamp((p - 0.30) / 0.70));

  function build(THREE, ctx) {
    const cache = ctx.cache;
    const object = new THREE.Group(), puppet = new THREE.Group();
    object.add(puppet);
    const box = cache.geo('zombie-box', () => new THREE.BoxGeometry(1, 1, 1));
    const ico = cache.geo('zombie-ico', () => new THREE.IcosahedronGeometry(1, 0));
    const cone = cache.geo('zombie-rag', () => new THREE.ConeGeometry(1, 1, 3));
    const skin = cache.mat(GREEN), shirt = cache.mat(SKY), pants = cache.mat(NAVY);
    const dark = cache.mat(0x172b23), bone = cache.mat(0xe4e8bb);
    const glow = cache.basic(LIME), brightSkin = cache.mat(LIME, { emissive: LIME, emissiveIntensity: 0.18 });
    function piece(parent, geo, mat, x, y, z, sx, sy, sz) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
    }
    const trunk = new THREE.Group(); trunk.position.set(0, 113, 0); puppet.add(trunk);
    const belly = piece(trunk, ico, shirt, 0, 33, 2, 52, 58, 36); belly.rotation.z = -0.10;
    for (let i = 0; i < 3; i++) {
      const rag = piece(trunk, cone, shirt, -33 + i * 30, -9, 15, 13, 29 + i * 4, 9); rag.rotation.z = Math.PI + (i - 1) * 0.2;
    }
    piece(trunk, box, dark, -19, 30, 32, 24, 31, 5).rotation.z = -0.2;
    for (let i = 0; i < 2; i++) piece(trunk, box, bone, -19, 23 + i * 14, 36, 24, 6, 6).rotation.z = -0.2;
    piece(puppet, box, pants, 0, 105, -4, 66, 27, 40);
    const legs = [];
    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Group(); leg.position.set(i ? 24 : -24, 99, -4); puppet.add(leg); legs.push(leg);
      piece(leg, box, pants, 0, -25, 0, 28, 49, 31);
      piece(leg, box, i ? skin : pants, 0, -62, 3, 24, 29, 25);
      const shoe = piece(leg, box, dark, i ? 5 : -5, -85, 13, 35, 26, 53); shoe.rotation.y = i ? -0.3 : 0.2;
    }
    piece(legs[1], ico, brightSkin, 0, -44, 18, 16, 14, 9);
    const head = new THREE.Group(); head.position.set(0, 97, 13); trunk.add(head); head.rotation.z = -0.25;
    piece(head, ico, skin, 0, 17, 0, 53, 47, 43);
    const jaw = new THREE.Group(); jaw.position.set(0, -9, 21); head.add(jaw);
    piece(jaw, box, skin, 5, -8, 0, 60, 22, 33).rotation.z = 0.12;
    for (let i = 0; i < 2; i++) {
      piece(head, box, dark, i ? 21 : -21, 22, 35, i ? 27 : 23, i ? 22 : 28, 9).rotation.z = i ? 0.17 : -0.15;
      piece(head, ico, glow, i ? 21 : -21, 22, 42, i ? 9 : 11, i ? 7 : 10, 5);
    }
    piece(jaw, box, bone, -13, 5, 17, 15, 10, 7).rotation.z = -0.12;
    piece(head, cone, dark, -20, 56, -8, 20, 30, 19).rotation.z = 0.65;
    const arms = [], elbows = [];
    for (let i = 0; i < 2; i++) {
      const arm = new THREE.Group(); arm.position.set(i ? 48 : -48, 60, 5); trunk.add(arm); arms.push(arm);
      piece(arm, box, shirt, 0, -8, 0, 35, 29, 35).rotation.z = i ? -0.15 : 0.2;
      piece(arm, box, skin, 0, -31, 0, 25, 39, 25);
      const elbow = new THREE.Group(); elbow.position.y = -50; arm.add(elbow); elbows.push(elbow);
      piece(elbow, box, skin, 0, -22, 0, 23, 44, 25);
      piece(elbow, box, i ? brightSkin : skin, 0, -51, 1, i ? 38 : 32, 25, 23);
      for (let j = 0; j < 3; j++) {
        const finger = piece(elbow, box, skin, (j - 1) * 12, -72, 3, 9, 26 + j * 4, 12); finger.rotation.x = -0.25;
      }
      piece(elbow, box, skin, i ? -22 : 20, -52, 6, 12, 26, 14).rotation.z = i ? -0.55 : 0.55;
      arm.rotation.x = -1.24; elbow.rotation.x = -0.20;
    }
    const auraMat = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(cache.geo('zombie-recall-ring', () => new THREE.TorusGeometry(67, 4, 4, 32)), auraMat);
    aura.rotation.x = Math.PI / 2; aura.position.y = 7; puppet.add(aura); aura.visible = false;
    return { object, update(state) {
      state = state || {};
      const time = state.time || 0, t = state.t || 0, p = clamp(state.progress || 0), anim = state.anim || 'idle';
      puppet.position.set(0, 0, 0); puppet.rotation.set(0, 0, 0); puppet.scale.set(1, 1, 1);
      trunk.position.set(0, 113 + Math.sin(time * 2.4) * 2, 0); trunk.rotation.set(0.10, 0, -0.08);
      head.rotation.set(0.10, 0.08, -0.25 + Math.sin(time * 1.5) * 0.035);
      jaw.rotation.x = 0.12 + (1 + Math.sin(time * 2.4)) * 0.05;
      legs.forEach((leg, i) => { leg.rotation.set(i ? 0.08 : -0.06, 0, i ? -0.07 : 0.07); leg.position.y = 99; });
      arms.forEach((arm, i) => { arm.rotation.set(-1.24 + Math.sin(time * 2 + i) * 0.04, i ? -0.15 : 0.17, i ? -0.12 : 0.18); });
      elbows.forEach(elbow => { elbow.rotation.x = -0.20; elbow.scale.set(1, 1, 1); });
      aura.visible = false; auraMat.opacity = 0; aura.position.y = 7; aura.scale.setScalar(1);
      if (anim === 'walk') {
        const cadence = t * 6 * Math.max(0.25, Math.min(1.7, (state.speed || 330) / 330)), s = Math.sin(cadence);
        legs[0].rotation.x = s * 0.43; legs[1].rotation.x = -s * 0.22;
        legs[0].position.y += Math.max(0, s) * 8;
        trunk.rotation.z += s * 0.10; trunk.position.y += Math.abs(s) * 3;
        head.rotation.z -= s * 0.10; arms[1].rotation.x += s * 0.18;
      } else if (anim === 'attack') {
        const wind = Math.sin(Math.PI * clamp(p / 0.30)), strike = hit(p);
        trunk.rotation.y = -0.38 * wind + 0.42 * strike;
        arms[1].rotation.x = -1.24 + 1.05 * wind - 0.85 * strike;
        arms[1].rotation.z = -0.12 - 0.40 * strike;
        elbows[1].rotation.x = -0.2 - 0.9 * wind + 0.3 * strike;
        trunk.rotation.x += 0.28 * strike; head.rotation.z += strike * 0.15;
      } else if (anim === 'cast') {
        const surge = Math.sin(Math.PI * p), slot = state.slot || 0;
        if (slot === 0) { arms[0].rotation.x -= 0.35 * surge; elbows[0].scale.y = 1 + 1.1 * surge; trunk.rotation.y = 0.35 * surge; }
        if (slot === 1) { trunk.rotation.x -= 0.28 * surge; arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 0.95 * surge; }); jaw.rotation.x += 0.45 * surge; }
        if (slot === 2) { trunk.rotation.x += 0.43 * surge; head.rotation.x += 0.40 * surge; arms.forEach(a => { a.rotation.x += 0.7 * surge; }); jaw.rotation.x += 0.55 * surge; }
        if (slot === 3) {
          const rise = Math.sin(Math.PI * clamp(p / 0.70)), slam = Math.sin(Math.PI * clamp((p - 0.70) / 0.30));
          arms.forEach((a, i) => { a.rotation.x = -1.24 - 1.65 * rise + 1.0 * slam; a.rotation.z = (i ? -1 : 1) * 0.6 * rise; });
          trunk.rotation.x = -0.30 * rise + 0.65 * slam; trunk.position.y -= 17 * slam;
          head.rotation.x = -0.4 * rise; jaw.rotation.x = 0.3 + 0.5 * rise;
          aura.visible = true; aura.scale.setScalar(1 + surge * 0.6); auraMat.opacity = surge * 0.75;
        }
      } else if (anim === 'recall') {
        puppet.rotation.y = t * 1.6; trunk.rotation.z = Math.sin(t * 3) * 0.17;
        arms.forEach((a, i) => { a.rotation.x = -2.5; a.rotation.z = i ? -0.7 : 0.7; });
        head.rotation.z = -0.4; jaw.rotation.x = 0.5;
        aura.visible = true; aura.position.y = 8 + (t * 42) % 240; aura.scale.setScalar(1 + Math.sin(t * 4) * 0.1); auraMat.opacity = 0.55;
      } else if (anim === 'dead') {
        const fall = clamp(t / 0.55); puppet.rotation.x = -Math.PI / 2 * fall; puppet.position.y = 80 * fall;
        head.rotation.z = -0.65; arms.forEach(a => { a.rotation.x = -0.4; }); jaw.rotation.x = 0.65;
      }
    } };
  }

  function effect(THREE, ctx, info, slot) {
    info = info || {};
    const object = new THREE.Group(), kind = info.kind || ['projectile', 'self', 'self', 'area'][slot];
    const radius = Math.max(12, info.radius || 160), width = Math.max(12, info.width || 90), length = Math.max(20, info.length || 500);
    const moving = kind === 'projectile', linear = kind === 'line' || kind === 'dash', cone = kind === 'cone';
    const spread = moving ? width * 0.46 : linear ? width * 0.45 : radius;
    const angle = Math.max(5, Math.min(170, info.angle || 50)) * Math.PI / 180;
    const materials = [];
    function material(color, opacity, additive) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      materials.push({ m, opacity }); return m;
    }
    const green = material(slot === 2 ? 0x9dff4a : slot === 3 ? 0x7aff3a : LIME, 0.85, true);
    const flesh = material(GREEN, 0.95, false), shadow = material(0x172b23, 0.9, false), mist = material(0x9dff4a, 0.28, false);
    const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.IcosahedronGeometry(1, 1);
    function mesh(parent, geometry, mat, x, y, z, sx, sy, sz) {
      const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
    }
    function placement(i, n, fraction) {
      const a = i * Math.PI * 2 / n;
      if (linear) return [Math.sin(i * 2.4) * spread * 0.65, (i + 0.5) / n * length];
      if (cone) { const z = (i + 1) / (n + 1) * length; return [Math.sin(i * 2.4) * Math.tan(angle / 2) * z * 0.7, z]; }
      return [Math.cos(a) * spread * fraction, Math.sin(a) * spread * fraction];
    }
    let boundary;
    if (linear) boundary = mesh(object, cube, green, 0, 3, length / 2, width, 3, length);
    else {
      const r = cone ? length : spread;
      boundary = mesh(object, new THREE.RingGeometry(r * 0.94, r, 48, 1, cone ? -Math.PI / 2 - angle / 2 : 0, cone ? angle : Math.PI * 2), green, 0, moving ? 65 : 3, 0, 1, 1, 1);
      if (!moving) boundary.rotation.x = -Math.PI / 2;
    }
    const nodes = [];
    function hand(parent, size) {
      const g = new THREE.Group(); parent.add(g);
      mesh(g, cube, flesh, 0, 16, 0, 17, 32, 16);
      mesh(g, cube, flesh, 0, 40, 0, 31, 23, 19);
      for (let j = 0; j < 3; j++) mesh(g, cube, flesh, (j - 1) * 12, 62 + j * 2, 2, 9, 29 + j * 3, 12).rotation.x = 0.27;
      mesh(g, cube, flesh, 22, 43, 3, 11, 29, 13).rotation.z = -0.65;
      g.scale.setScalar(size); return g;
    }
    if (slot === 0) {
      const g = hand(object, width / 70); g.position.y = 60; g.rotation.x = Math.PI / 2; nodes.push(g);
      mesh(g, cube, flesh, 0, -34, 0, 14, 70, 15);
      for (let i = 0; i < 3; i++) mesh(g, sphere, green, 0, -40 - i * 28, 0, 10 - i * 2, 18, 10 - i * 2);
      if (!moving) { const loc = placement(0, 1, 0); g.position.set(loc[0], 65, linear || cone ? length * 0.7 : 0); }
    } else if (slot === 1) {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group(); object.add(g); const loc = placement(i, 3, 0.62); g.position.set(loc[0], 145 + i * 25, loc[1]);
        const s = Math.min(42, spread * 0.23); g.scale.setScalar(s / 25);
        mesh(g, sphere, green, 0, 0, 0, 25, 27, 22);
        mesh(g, cube, flesh, 0, -22, 4, 26, 14, 19);
        for (let j = 0; j < 2; j++) mesh(g, cube, shadow, j ? 10 : -10, 4, 19, 10, 12, 7);
        mesh(g, new THREE.ConeGeometry(14, 65, 5), mist, 0, -48, -8, 1, 1, 1).rotation.z = Math.PI;
        nodes.push(g);
      }
      const halo = mesh(object, new THREE.TorusGeometry(spread * 0.77, 5, 4, 48), green, 0, 110, 0, 1, 1, 1); halo.rotation.x = Math.PI / 2;
    } else if (slot === 2) {
      for (let i = 0; i < 8; i++) {
        const loc = placement(i, 8, 0.64), s = Math.max(13, Math.min(95, spread * 0.30));
        const g = new THREE.Group(); object.add(g); g.position.set(loc[0], 25 + i % 3 * 16, loc[1]);
        mesh(g, sphere, mist, 0, 0, 0, s, s * 0.55, s);
        mesh(g, sphere, green, s * 0.2, 15 + i % 3 * 9, 0, s * 0.15, s * 0.15, s * 0.15); nodes.push(g);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const loc = placement(i, 4, i % 2 ? 0.70 : 0.44), g = hand(object, Math.min(2.1, spread / 110));
        g.position.set(loc[0], -130, loc[1]); g.rotation.y = -i * 1.5; nodes.push(g);
        mesh(object, new THREE.ConeGeometry(1, 1, 3), shadow, loc[0], 4, loc[1], Math.min(65, spread * 0.22), 7, Math.min(65, spread * 0.22)).rotation.y = i;
      }
    }
    const bases = nodes.map(g => ({ y: g.position.y, x: g.position.x, z: g.position.z, rz: g.rotation.z, s: g.scale.x }));
    return { object, update(p) {
      p = clamp(p || 0);
      const fade = Math.min(1, p * 10) * Math.min(1, (1 - p) * 6);
      materials.forEach(entry => { entry.m.opacity = entry.opacity * fade; });
      nodes.forEach((g, i) => {
        const b = bases[i], pulse = Math.sin(p * Math.PI * 6 + i * 1.8);
        if (slot === 0) { g.rotation.z = pulse * 0.12; g.scale.setScalar(b.s * (0.94 + Math.sin(p * Math.PI) * 0.12)); }
        if (slot === 1) {
          g.position.y = b.y + Math.sin(p * Math.PI * 4 + i) * 15;
          if (!linear && !cone && !moving) { const a = i * Math.PI * 2 / 3 + p * Math.PI * 2; g.position.x = Math.cos(a) * spread * 0.62; g.position.z = Math.sin(a) * spread * 0.62; }
          g.rotation.z = pulse * 0.17;
        }
        if (slot === 2) { g.position.y = b.y + ((p * 2 + i / 8) % 1) * 50; g.scale.setScalar(0.82 + 0.18 * Math.sin(p * 12 + i)); }
        if (slot === 3) {
          const emerge = clamp((p - 0.12 - i * 0.025) / 0.20);
          g.position.y = -100 * b.s * (1 - emerge); g.rotation.z = 0.22 * pulse * emerge; g.rotation.x = 0.22 * Math.sin(p * 9 + i) * emerge;
        }
      });
      if (!linear) boundary.scale.setScalar(1 + 0.018 * Math.sin(p * Math.PI * 8));
    } };
  }
  MOBA.defineChampionArt('zombie', {
    lore: 'Lo enterraron tres veces, pero siempre volvió: abajo no había ni un kiosco abierto.',
    quote: 'Vení, dame una mano… la mía se está cayendo.',
    build: build,
    fx: {
      Q: (THREE, ctx, info) => effect(THREE, ctx, info, 0),
      W: (THREE, ctx, info) => effect(THREE, ctx, info, 1),
      E: (THREE, ctx, info) => effect(THREE, ctx, info, 2),
      R: (THREE, ctx, info) => effect(THREE, ctx, info, 3)
    }
  });
})();
