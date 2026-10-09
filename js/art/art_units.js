(function () {
  'use strict';

  // Primitives and static materials are shared; structures own animated crystal materials.
  function kit(THREE, ctx) {
    ctx = ctx || {};
    var root = new THREE.Group(), poses = [], cache = ctx.cache;
    var team = ctx.teamColor === undefined ? 0x38a3ff : ctx.teamColor;
    function group(parent, x, y, z) {
      var g = new THREE.Group();
      g.position.set(x || 0, y || 0, z || 0);
      (parent || root).add(g);
      return g;
    }
    function geo(kind) {
      return cache.geo('units-toy-' + kind, function () {
        if (kind === 'box') return new THREE.BoxGeometry(1, 1, 1);
        if (kind === 'ball') return new THREE.IcosahedronGeometry(1, 0);
        if (kind === 'crystal') return new THREE.OctahedronGeometry(1, 0);
        if (kind === 'cone') return new THREE.ConeGeometry(1, 1, 6);
        if (kind === 'ring') return new THREE.TorusGeometry(1, 0.085, 4, 12);
        return new THREE.CylinderGeometry(1, 1, 1, 8);
      });
    }
    function mesh(parent, kind, color, x, y, z, sx, sy, sz, glow) {
      var m = new THREE.Mesh(geo(kind), cache.mat(color, glow ? {
        emissive: color, emissiveIntensity: glow, roughness: 0.35
      } : { roughness: 0.8 }));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      (parent || root).add(m); return m;
    }
    function remember() {
      root.traverse(function (o) {
        if (o !== root) poses.push({ o: o, p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() });
      });
    }
    function reset() {
      poses.forEach(function (v) {
        v.o.position.copy(v.p); v.o.rotation.copy(v.r); v.o.scale.copy(v.s); v.o.visible = true;
      });
    }
    return { root: root, team: team, group: group, mesh: mesh, remember: remember, reset: reset };
  }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function frame(s) {
    s = s || {};
    return { anim: s.anim || 'idle', t: Math.max(0, num(s.t, 0)),
      time: num(s.time, num(s.t, 0)), p: clamp(num(s.progress, 0), 0, 1),
      hp: clamp(num(s.hpFrac, 1), 0, 1), heat: clamp(num(s.heat, 0), 0, 3),
      speed: clamp(num(s.speed, 340) / 340, 0, 2), slot: num(s.slot, 0) };
  }
  // An anticipation followed by a fast forward strike and a slow recovery.
  function strike(p) {
    if (p < 0.28) return -p / 0.28;
    if (p < 0.46) return -1 + 2 * (p - 0.28) / 0.18;
    return 1 - (p - 0.46) / 0.54;
  }

  function soldier(caster) {
    return function (THREE, ctx) {
      var k = kit(THREE, ctx), m = k.mesh, g = k.group;
      var body = g(null, 0, 0, 0);
      var legs = [g(body, -14, 31, 0), g(body, 14, 31, 0)];
      legs.forEach(function (l) { m(l, 'box', 0x27334a, 0, -15, 4, 20, 30, 28); });
      m(body, caster ? 'cone' : 'cylinder', k.team, 0, 54, 0, 30, 50, 27);
      m(body, 'ball', 0xffd396, 0, 90, 6, 21, 20, 19);
      m(body, caster ? 'cone' : 'ball', k.team, 0, caster ? 105 : 102, -2,
        caster ? 28 : 25, caster ? 30 : 18, 24);
      var arm = g(body, -28, 68, 0);
      m(arm, 'box', k.team, 0, -11, 0, 17, 30, 18);
      var other = g(body, 28, 68, 0);
      m(other, 'box', k.team, 0, -11, 0, 17, 30, 18);
      if (caster) {
        m(arm, 'ball', k.team, 0, -28, 16, 13, 13, 13, 1.8);
        m(other, 'cylinder', 0x805536, 0, -10, 10, 4, 76, 4);
        m(other, 'crystal', k.team, 0, 34, 10, 12, 18, 12, 1.2);
      } else {
        m(arm, 'box', 0xe7eff8, 0, -10, 28, 10, 9, 44);
        m(other, 'cylinder', k.team, 0, -12, 14, 23, 8, 23).rotation.x = Math.PI / 2;
        m(body, 'box', 0xffd05e, 0, 56, 28, 18, 13, 5);
      }
      k.remember();
      return { object: k.root, update: function (state) {
        var s = frame(state); k.reset();
        if (s.anim === 'dead') {
          body.rotation.x = -Math.PI / 2; body.position.set(0, 28, -35);
          arm.rotation.z = -0.7; other.rotation.z = 0.8; return;
        }
        body.position.y = 1.5 + 1.5 * Math.sin(s.time * 3);
        if (s.anim === 'walk') {
          var a = s.time * (6 + 5 * s.speed);
          legs[0].rotation.x = Math.sin(a) * 0.65 * s.speed;
          legs[1].rotation.x = -legs[0].rotation.x;
          body.position.y = 4 + Math.abs(Math.sin(a)) * 5 * s.speed;
          arm.rotation.x = -Math.sin(a) * 0.25; other.rotation.x = Math.sin(a) * 0.25;
        } else if (s.anim === 'attack' || s.anim === 'cast') {
          var hit = strike(s.p);
          arm.rotation.x = caster ? -0.6 - hit * 1.2 : -hit * 1.7;
          body.rotation.y = -hit * 0.24; body.rotation.x = hit * 0.13;
          other.rotation.x = caster ? -0.35 : hit * 0.3;
          if (s.anim === 'cast' && s.slot === 3) other.rotation.x = -1.5;
        } else if (s.anim === 'recall') {
          arm.rotation.x = other.rotation.x = -1.8;
          body.position.y = 5 + Math.sin(s.time * 4) * 4;
        }
      } };
    };
  }
  MOBA.defineUnitArt('minion_melee', { build: soldier(false) });
  MOBA.defineUnitArt('minion_caster', { build: soldier(true) });

  MOBA.defineUnitArt('minion_cannon', { build: function (THREE, ctx) {
    var k = kit(THREE, ctx), m = k.mesh, cart = k.group(null, 0, 0, 0), wheels = [];
    m(cart, 'box', k.team, 0, 44, 0, 76, 38, 84);
    [-1, 1].forEach(function (side) {
      [-28, 28].forEach(function (z) {
        var w = m(cart, 'cylinder', 0x30384b, side * 44, 25, z, 25, 14, 25);
        w.rotation.z = Math.PI / 2; wheels.push(w);
      });
    });
    m(cart, 'cylinder', k.team, 0, 81, -4, 30, 35, 30);
    var gun = k.group(cart, 0, 106, 0);
    m(gun, 'cylinder', 0xaab7c9, 0, 0, 18, 25, 83, 25).rotation.x = Math.PI / 2;
    m(gun, 'cylinder', 0x20283c, 0, 0, 61, 19, 3, 19).rotation.x = Math.PI / 2;
    m(cart, 'cone', k.team, 0, 133, -24, 22, 34, 22);
    k.remember();
    return { object: k.root, update: function (state) {
      var s = frame(state); k.reset();
      if (s.anim === 'dead') {
        cart.position.y = 16; cart.rotation.z = 0.28;
        gun.position.set(17, 57, 24); gun.rotation.y = 0.7;
        wheels[0].position.set(-52, 25, 35); wheels[0].rotation.z = 0.3; return;
      }
      cart.rotation.x = Math.sin(s.time * 2) * 0.015;
      if (s.anim === 'walk') {
        wheels.forEach(function (w) { w.rotation.x = -s.time * 10 * s.speed; });
        cart.position.y = Math.abs(Math.sin(s.time * 10)) * 2 * s.speed;
      }
      if (s.anim === 'attack' || s.anim === 'cast') {
        var recoil = s.p < 0.3 ? -s.p * 5 : Math.exp(-(s.p - 0.3) * 7) * 22;
        gun.position.z = -recoil; gun.rotation.x = -recoil * 0.008;
        cart.rotation.x = -recoil * 0.003;
      }
      if (s.anim === 'recall') gun.rotation.y = Math.sin(s.time * 2) * 0.3;
    } };
  } });

  MOBA.defineUnitArt('tower', { build: function (THREE, ctx) {
    var k = kit(THREE, ctx), m = k.mesh;
    m(null, 'cylinder', 0x555e79, 0, 18, 0, 88, 36, 88);
    m(null, 'cylinder', k.team, 0, 45, 0, 74, 20, 74);
    var shaft = k.group(null, 0, 55, 0);
    m(shaft, 'cylinder', 0x8997b1, 0, 134, 0, 49, 268, 49);
    m(shaft, 'cylinder', k.team, 0, 55, 0, 53, 26, 53);
    m(shaft, 'cylinder', k.team, 0, 220, 0, 54, 28, 54);
    m(shaft, 'cylinder', 0xc1cadd, 0, 282, 0, 72, 36, 72);
    var prongs = [], rubble = [];
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4;
      var p = k.group(shaft, Math.sin(a) * 52, 289, Math.cos(a) * 52);
      m(p, 'box', 0xb2bfd4, 0, 28, 0, 23, 70, 23);
      m(p, 'cone', k.team, 0, 77, 0, 19, 32, 19); prongs.push(p);
      var r = m(null, 'ball', 0x8997b1, Math.sin(a) * 57, 22, Math.cos(a) * 57, 30, 22, 30);
      r.rotation.y = a; rubble.push(r);
    }
    var crystal = k.group(null, 0, 425, 0);
    var gem = m(crystal, 'crystal', k.team, 0, 0, 0, 48, 95, 48, 1.5);
    gem.material = gem.material.clone();
    var core = m(crystal, 'crystal', 0xd5faff, 0, 0, 0, 25, 61, 25, 2.2);
    var halo = m(null, 'ring', k.team, 0, 416, 0, 73, 73, 73, 1.4);
    halo.rotation.x = Math.PI / 2;
    k.remember();
    return { object: k.root, update: function (state) {
      var s = frame(state); k.reset();
      rubble.forEach(function (r) { r.visible = s.hp < 0.45 || s.anim === 'dead'; });
      if (s.anim === 'dead') {
        shaft.visible = false; halo.visible = false;
        crystal.position.set(0, 28, 10); crystal.rotation.z = Math.PI / 2;
        crystal.scale.setScalar(0.52); core.visible = false;
        gem.material.emissiveIntensity = 0.05; return;
      }
      var damage = 1 - s.hp;
      shaft.rotation.z = damage * damage * 0.07;
      prongs.forEach(function (p, n) { p.rotation.z = (n % 2 ? -1 : 1) * damage * 0.32; });
      crystal.position.y += Math.sin(s.time * 2) * 5 * s.hp;
      crystal.rotation.y = s.time * 0.35;
      var pulse = (s.anim === 'attack' || s.anim === 'cast') ? Math.sin(Math.PI * s.p) : 0;
      gem.material.emissiveIntensity = (0.1 + 1.4 * s.hp) * (1 + s.heat * 0.45 + pulse * 1.1);
      var energy = (0.65 + s.hp * 0.35) * (1 + pulse * 0.17 + s.heat * 0.025);
      crystal.scale.setScalar(energy);
      core.visible = s.hp > 0.18;
      core.scale.multiplyScalar((0.35 + s.hp * 0.65) * (1 + s.heat * 0.16 + pulse * 0.25));
      halo.scale.multiplyScalar(0.8 + s.hp * 0.2 + s.heat * 0.06 + pulse * 0.22);
      halo.visible = s.hp > 0.25;
      halo.rotation.z = s.time * 0.4;
    } };
  } });

  MOBA.defineUnitArt('nexus', { build: function (THREE, ctx) {
    var k = kit(THREE, ctx), m = k.mesh;
    m(null, 'cylinder', 0x59637d, 0, 20, 0, 160, 40, 160);
    m(null, 'cylinder', k.team, 0, 46, 0, 133, 18, 133);
    m(null, 'cylinder', 0x919eb6, 0, 65, 0, 106, 24, 106);
    var crystal = k.group(null, 0, 242, 0);
    var gem = m(crystal, 'crystal', k.team, 0, 0, 0, 86, 138, 75, 1.4);
    gem.material = gem.material.clone();
    var heart = m(crystal, 'crystal', 0xe3ffff, 0, 0, 0, 47, 92, 42, 2);
    var ring = m(null, 'ring', k.team, 0, 120, 0, 116, 116, 116, 1.4);
    ring.rotation.x = Math.PI / 2;
    var shards = [];
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5;
      m(null, 'cone', 0xb8c5dc, Math.sin(a) * 124, 85, Math.cos(a) * 124, 22, 70, 22);
      var shard = m(null, 'crystal', k.team, Math.sin(a) * 91, 95, Math.cos(a) * 91, 20, 40, 20, 0.7);
      shard.rotation.z = a; shards.push(shard);
    }
    k.remember();
    // Integrate only this child's spin, so losing health changes speed smoothly.
    var angle = 0;
    return { object: k.root, update: function (state) {
      var s = frame(state); k.reset();
      if (s.anim === 'dead') {
        crystal.visible = false; ring.visible = false;
        shards.forEach(function (sh, n) {
          sh.position.y = 62; sh.rotation.z = Math.PI / 2 + n * 0.31;
          sh.scale.set(32, 62, 28);
        }); return;
      }
      angle += clamp(num(state && state.dt, 1 / 60), 0, 0.1) * (0.08 + s.hp * 0.5);
      crystal.rotation.y = angle;
      crystal.position.y += Math.sin(s.time * 1.6) * 10 * s.hp;
      var pulse = (s.anim === 'attack' || s.anim === 'cast') ? Math.sin(s.p * Math.PI) : 0;
      gem.material.emissiveIntensity = 0.08 + s.hp * (1.32 + pulse);
      crystal.scale.setScalar(0.82 + s.hp * 0.18 + pulse * 0.07);
      heart.scale.multiplyScalar(0.3 + s.hp * 0.7 + pulse * 0.2);
      heart.visible = s.hp > 0.15; ring.visible = s.hp > 0.25;
      ring.scale.multiplyScalar(0.8 + s.hp * 0.2 + pulse * 0.15);
      shards.forEach(function (sh, n) { sh.position.y += Math.sin(s.time * 2 + n) * 6 * s.hp; });
    } };
  } });

  MOBA.defineUnitArt('golem', { build: function (THREE, ctx) {
    var k = kit(THREE, ctx), m = k.mesh, body = k.group(null, 0, 0, 0);
    var stone = 0x7e8d82, moss = 0x5aab46, eyes = 0xbfff6b;
    var legs = [k.group(body, -31, 68, 0), k.group(body, 31, 68, 0)];
    legs.forEach(function (l) {
      m(l, 'ball', stone, 0, -23, 0, 29, 43, 32);
      m(l, 'box', 0x57685f, 0, -53, 10, 48, 30, 63);
    });
    m(body, 'ball', stone, 0, 135, 0, 62, 73, 43);
    m(body, 'ball', moss, 0, 183, -15, 53, 25, 35);
    var head = k.group(body, 0, 213, 9);
    m(head, 'box', stone, 0, 0, 0, 64, 60, 52);
    m(head, 'cone', moss, -12, 37, -6, 27, 20, 25);
    [-1, 1].forEach(function (side) { m(head, 'box', eyes, side * 16, 3, 28, 13, 10, 5, 2); });
    m(head, 'box', 0x354d42, 0, -16, 28, 27, 7, 5);
    var arms = [k.group(body, -59, 166, 0), k.group(body, 59, 166, 0)];
    arms.forEach(function (a) {
      m(a, 'ball', moss, 0, 1, -2, 22, 27, 30);
      m(a, 'ball', stone, 0, -36, 0, 21, 43, 27);
      m(a, 'ball', 0x65766b, 0, -73, 7, 27, 29, 31);
    });
    m(body, 'crystal', eyes, 0, 133, 41, 17, 24, 8, 0.7);
    k.remember();
    return { object: k.root, update: function (state) {
      var s = frame(state); k.reset();
      if (s.anim === 'dead') {
        body.rotation.x = -Math.PI / 2; body.position.set(0, 49, -100);
        head.position.y = 190; head.rotation.z = 0.4;
        arms[0].rotation.z = -0.8; arms[1].rotation.z = 0.8; return;
      }
      body.position.y = 1 + Math.sin(s.time * 1.5);
      if (s.anim === 'walk') {
        var a = s.time * (3 + s.speed * 2);
        legs[0].rotation.x = Math.sin(a) * 0.32 * s.speed; legs[1].rotation.x = -legs[0].rotation.x;
        arms[0].rotation.x = -Math.sin(a) * 0.23; arms[1].rotation.x = -arms[0].rotation.x;
        body.position.y = 3 + Math.abs(Math.sin(a)) * 6; body.rotation.z = Math.sin(a) * 0.045;
      } else if (s.anim === 'attack' || s.anim === 'cast') {
        var hit = strike(s.p);
        arms[1].rotation.x = -0.65 - hit * 1.3; arms[0].rotation.x = -0.3 - hit * 0.55;
        body.rotation.x = hit * 0.2; head.rotation.x = -hit * 0.12;
      } else if (s.anim === 'recall') {
        arms[0].rotation.x = arms[1].rotation.x = -1.4;
      }
    } };
  } });

  MOBA.defineUnitArt('wolf', { build: function (THREE, ctx) {
    var k = kit(THREE, ctx), m = k.mesh, body = k.group(null, 0, 0, 0);
    var fur = 0x879cce, pale = 0xc4d9f8, glow = 0x66f6ed;
    body.scale.z = 0.8;
    var aura = m(body, 'ball', glow, 0, 65, 0, 34, 37, 64, 0.35);
    aura.material = ctx.cache.mat(glow, { emissive: glow, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.5 });
    m(body, 'ball', fur, 0, 69, 0, 28, 33, 55);
    m(body, 'ball', pale, 0, 78, 29, 31, 37, 31);
    var legs = [];
    [-1, 1].forEach(function (side) {
      [-32, 33].forEach(function (z) {
        var l = k.group(body, side * 21, 65, z);
        m(l, 'box', fur, 0, -26, 0, 13, 49, 16);
        m(l, 'box', pale, 0, -58, 5, 18, 14, 27); legs.push(l);
      });
    });
    var head = k.group(body, 0, 108, 38);
    m(head, 'ball', fur, 0, 0, 0, 25, 25, 28);
    m(head, 'box', pale, 0, -8, 25, 27, 17, 27);
    m(head, 'box', 0x344269, 0, -5, 41, 18, 12, 5);
    var jaw = k.group(head, 0, -15, 9);
    m(jaw, 'box', 0x536590, 0, -2, 16, 25, 10, 33);
    [-1, 1].forEach(function (side) {
      m(head, 'cone', fur, side * 17, 23, -8, 10, 20, 10);
      m(head, 'box', glow, side * 18, 3, 20, 9, 8, 6, 2);
    });
    var tail = k.group(body, 0, 72, -43);
    m(tail, 'cone', pale, 0, 8, -15, 17, 54, 17).rotation.x = -1.0;
    k.remember();
    return { object: k.root, update: function (state) {
      var s = frame(state); k.reset();
      aura.scale.multiplyScalar(1 + Math.sin(s.time * 3) * 0.06);
      tail.rotation.z = Math.sin(s.time * 3) * 0.14;
      if (s.anim === 'dead') {
        body.rotation.z = Math.PI / 2; body.position.set(53, 34, 0);
        aura.visible = false; head.rotation.y = -0.35; return;
      }
      body.position.y = 1 + Math.sin(s.time * 2) * 1;
      if (s.anim === 'walk') {
        var a = s.time * (7 + s.speed * 5);
        legs.forEach(function (l, n) { l.rotation.x = Math.sin(a + (n === 0 || n === 3 ? 0 : Math.PI)) * 0.65 * s.speed; });
        body.position.y = 4 + Math.sin(a * 2) * 3 * s.speed;
        body.rotation.x = Math.sin(a) * 0.035; tail.rotation.x = -0.25;
      } else if (s.anim === 'attack' || s.anim === 'cast') {
        var hit = strike(s.p), bite = Math.sin(Math.PI * s.p);
        body.position.z = hit * 15; body.rotation.x = hit * 0.14;
        head.rotation.x = -hit * 0.3; jaw.rotation.x = bite * 0.7;
        legs[1].rotation.x = -bite * 1.05;
      } else if (s.anim === 'recall') {
        head.rotation.x = -0.65; aura.scale.multiplyScalar(1.15);
      }
    } };
  } });
})();
