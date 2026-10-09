/* La Grieta Multiversal — escenografía procedural: bosque mágico low-poly estilo juguete.
 * Props (árboles, rocas, pasto, arbustos, hongos, flores, cristales, estandartes, faroles, fuente, juncos),
 * material de las paredes de terreno y pintor de la textura del suelo. */
(function () {
  'use strict';
  if (typeof MOBA === 'undefined' || !MOBA) return;

  // ---------------------------------------------------------------- utilidades
  function rng(seed) {
    let a = ((seed | 0) ^ 0x9e3779b9) | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(ctx) {
    const s = ctx && ctx.seed;
    return (typeof s === 'number' && isFinite(s)) ? (s | 0) : 1;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  // Caché de respaldo por si el ctx no trae una.
  function fallbackCache(THREE) {
    const mats = {}, geos = {};
    return {
      mat: function (color, opts) {
        const k = 'm' + color + JSON.stringify(opts || {});
        if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: color, flatShading: true, roughness: 0.8, metalness: 0.05 }, opts || {}));
        return mats[k];
      },
      basic: function (color, opts) {
        const k = 'b' + color + JSON.stringify(opts || {});
        if (!mats[k]) mats[k] = new THREE.MeshBasicMaterial(Object.assign({ color: color }, opts || {}));
        return mats[k];
      },
      geo: function (key, f) { if (!geos[key]) geos[key] = f(); return geos[key]; }
    };
  }

  function kit(THREE, ctx) {
    ctx = ctx || {};
    const cache = ctx.cache || fallbackCache(THREE);
    const K = {
      THREE: THREE,
      cache: cache,
      seed: seedOf(ctx),
      team: ctx.team === 1 ? 1 : (ctx.team === 2 ? 2 : 0),
      teamColor: (typeof ctx.teamColor === 'number') ? ctx.teamColor : 0x38a3ff,
      mat: function (c, o) { return cache.mat(c, o); },
      glow: function (c, op) {
        return cache.basic(c, { transparent: true, opacity: op == null ? 0.35 : op, depthWrite: false, blending: THREE.AdditiveBlending });
      },
      add: function (parent, geo, mat, x, y, z, sx, sy, sz) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
        parent.add(m);
        return m;
      },
      // Geometrías unitarias compartidas (base en y = 0 donde aplica).
      g: {
        cyl: function (top, sides) {
          top = top == null ? 1 : top; sides = sides || 7;
          return cache.geo('p_cyl' + top + '_' + sides, function () { const g = new THREE.CylinderGeometry(top, 1, 1, sides); g.translate(0, 0.5, 0); return g; });
        },
        cone: function (sides) {
          sides = sides || 7;
          return cache.geo('p_cone' + sides, function () { const g = new THREE.ConeGeometry(1, 1, sides); g.translate(0, 0.5, 0); return g; });
        },
        ico: function (d) { d = d || 0; return cache.geo('p_ico' + d, function () { return new THREE.IcosahedronGeometry(1, d); }); },
        dodec: function () { return cache.geo('p_dodec', function () { return new THREE.DodecahedronGeometry(1, 0); }); },
        octa: function () { return cache.geo('p_octa', function () { return new THREE.OctahedronGeometry(1, 0); }); },
        dome: function () { return cache.geo('p_dome', function () { return new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); }); },
        sphere: function () { return cache.geo('p_sph', function () { return new THREE.SphereGeometry(1, 8, 6); }); },
        disc: function () { return cache.geo('p_disc', function () { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; }); },
        capsule: function () { return cache.geo('p_caps', function () { return new THREE.CapsuleGeometry(1, 2, 3, 6); }); }
      }
    };
    return K;
  }

  // Sombra falsa en el suelo (no es una sombra real, sólo un disco oscuro suave).
  function blobShadow(K, parent, r, op) {
    const m = K.add(parent, K.g.disc(), K.cache.basic(0x0b1a10, { transparent: true, opacity: op || 0.28, depthWrite: false }), 0, 1.5, 0, r, 1, r);
    m.renderOrder = -1;
    return m;
  }

  // Icosaedro deformado de forma determinista (vértices compartidos se mueven igual).
  function lumpyGeo(THREE, seed, detail, amount) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position;
    const r = rng(seed * 7919 + 13);
    const table = [];
    for (let i = 0; i < 64; i++) table.push(r());
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const h = Math.abs(Math.round(v.x * 97) * 73856093 ^ Math.round(v.y * 97) * 19349663 ^ Math.round(v.z * 97) * 83492791);
      const k = 1 - amount * 0.5 + amount * table[h % 64];
      v.multiplyScalar(k);
      if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3; // base aplanada
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------------- árbol
  MOBA.defineProp('tree', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 31 + 7);
      const variant = mod(K.seed, 5);
      const root = new THREE.Group();
      const sway = new THREE.Group();
      root.add(sway);
      const swayers = [];
      const bobbers = [];
      const trunkMat = K.mat(pick(r, [0x7a5232, 0x6e4a2c, 0x85593a]));
      const ph = r() * 6.28;

      if (variant === 0) { // frondoso: copa grande de burbujas verdes
        const th = 200 + r() * 70;
        K.add(sway, K.g.cyl(0.55, 7), trunkMat, 0, 0, 0, 38, th, 38);
        K.add(sway, K.g.cone(6), trunkMat, 0, 0, 0, 62, 50, 62); // raíces
        const greens = [0x3f9b3a, 0x52b441, 0x2f8a45, 0x67c24a];
        const crown = new THREE.Group(); crown.position.y = th + 70; sway.add(crown); swayers.push(crown);
        K.add(crown, K.g.ico(0), K.mat(greens[0]), 0, 40, 0, 165, 140, 165);
        const n = 4 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + r() * 0.5, d = 110 + r() * 40;
          const s = 95 + r() * 45;
          K.add(crown, K.g.ico(0), K.mat(greens[(i + 1) % greens.length]), Math.cos(a) * d, r() * 70 - 10, Math.sin(a) * d, s, s * 0.85, s);
        }
        K.add(crown, K.g.ico(0), K.mat(0x7fd35a), 0, 150, 0, 95, 75, 95);
        blobShadow(K, root, 230);
      } else if (variant === 1) { // pino: conos apilados
        const tiers = 4;
        K.add(sway, K.g.cyl(0.6, 6), trunkMat, 0, 0, 0, 30, 170, 30);
        const greens = [0x23704a, 0x2e8556, 0x3a9a60, 0x4aae6a];
        const crown = new THREE.Group(); sway.add(crown); swayers.push(crown);
        const base = 170 + r() * 160;
        for (let i = 0; i < tiers; i++) {
          const rad = base - i * (base * 0.2), h = 210 - i * 18;
          const c = K.add(crown, K.g.cone(7), K.mat(greens[i]), 0, 110 + i * 105, 0, rad, h, rad);
          c.rotation.y = r() * 3;
        }
        blobShadow(K, root, base * 1.05);
      } else if (variant === 2) { // árbol mágico violeta con orbes brillantes
        const th = 190 + r() * 50;
        const tm = K.mat(0x5d3f78);
        const t1 = K.add(sway, K.g.cyl(0.5, 6), tm, 0, 0, 0, 36, th, 36); t1.rotation.z = 0.08;
        const br = K.add(sway, K.g.cyl(0.4, 5), tm, 10, th * 0.6, 0, 18, 120, 18); br.rotation.z = -0.9;
        const hue = r() < 0.5;
        const c1 = hue ? 0x8a5cf0 : 0x3fc6d9, c2 = hue ? 0xc07bff : 0x6ef0e0;
        const crown = new THREE.Group(); crown.position.y = th + 60; sway.add(crown); swayers.push(crown);
        K.add(crown, K.g.dodec(), K.mat(c1, { emissive: c1, emissiveIntensity: 0.25 }), 0, 30, 0, 150, 120, 150);
        K.add(crown, K.g.dodec(), K.mat(c2, { emissive: c2, emissiveIntensity: 0.3 }), 95, 0, 40, 100, 85, 100);
        K.add(crown, K.g.dodec(), K.mat(c2, { emissive: c2, emissiveIntensity: 0.3 }), -90, 10, -50, 105, 90, 105);
        K.add(crown, K.g.dodec(), K.mat(c1, { emissive: c1, emissiveIntensity: 0.25 }), -20, 120, 20, 90, 70, 90);
        const orbC = hue ? 0xffe36b : 0xff8af0;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + 0.4;
          const o = K.add(crown, K.g.ico(1), K.cache.basic(orbC), Math.cos(a) * 140, -80, Math.sin(a) * 140, 16);
          bobbers.push({ m: o, y: -80, p: i * 1.7 });
        }
        const halo = K.add(root, K.g.disc(), K.glow(c2, 0.22), 0, 2, 0, 230, 1, 230);
        bobbers.push({ halo: halo });
      } else if (variant === 3) { // cerezo rosado con ramas
        const th = 170 + r() * 40;
        K.add(sway, K.g.cyl(0.6, 6), trunkMat, 0, 0, 0, 40, th, 40);
        const b1 = K.add(sway, K.g.cyl(0.5, 5), trunkMat, 0, th * 0.75, 0, 20, 140, 20); b1.rotation.z = 0.8;
        const b2 = K.add(sway, K.g.cyl(0.5, 5), trunkMat, 0, th * 0.8, 0, 20, 130, 20); b2.rotation.z = -0.75; b2.rotation.y = 0.6;
        const pinks = [0xff8fc8, 0xffb3da, 0xf26bb0, 0xffd0e6];
        const crown = new THREE.Group(); crown.position.y = th + 80; sway.add(crown); swayers.push(crown);
        K.add(crown, K.g.ico(0), K.mat(pinks[0]), 0, 30, 0, 145, 115, 145);
        K.add(crown, K.g.ico(0), K.mat(pinks[1]), -120, -10, 30, 105, 90, 105);
        K.add(crown, K.g.ico(0), K.mat(pinks[2]), 115, 0, -25, 110, 90, 110);
        K.add(crown, K.g.ico(0), K.mat(pinks[3]), 20, 115, -10, 90, 70, 90);
        K.add(crown, K.g.ico(0), K.mat(pinks[1]), 10, -20, 120, 85, 70, 85);
        blobShadow(K, root, 230);
        K.add(root, K.g.disc(), K.cache.basic(0xffa8d4, { transparent: true, opacity: 0.45, depthWrite: false }), 30, 2.5, 20, 190, 1, 150); // pétalos caídos
      } else { // álamo otoñal alto y estilizado
        const th = 140 + r() * 40;
        K.add(sway, K.g.cyl(0.55, 6), trunkMat, 0, 0, 0, 32, th, 32);
        const ors = [0xf08a2a, 0xe8b23a, 0xd9602b];
        const crown = new THREE.Group(); crown.position.y = th; sway.add(crown); swayers.push(crown);
        const tall = 380 + r() * 120;
        K.add(crown, K.g.ico(1), K.mat(ors[0]), 0, tall * 0.45, 0, 135, tall * 0.5, 135);
        K.add(crown, K.g.ico(0), K.mat(ors[1]), 55, tall * 0.35, 45, 90, tall * 0.3, 90);
        K.add(crown, K.g.ico(0), K.mat(ors[2]), -60, tall * 0.55, -30, 85, tall * 0.3, 85);
        K.add(crown, K.g.ico(0), K.mat(ors[1]), 0, tall * 0.85, 0, 70, 90, 70);
        blobShadow(K, root, 170);
      }
      sway.rotation.y = r() * Math.PI * 2;
      const sc = 0.92 + r() * 0.16;
      sway.scale.setScalar(sc);

      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          for (let i = 0; i < swayers.length; i++) {
            swayers[i].rotation.z = Math.sin(t * 0.7 + ph) * 0.025;
            swayers[i].rotation.x = Math.sin(t * 0.53 + ph * 1.3) * 0.02;
          }
          for (let i = 0; i < bobbers.length; i++) {
            const b = bobbers[i];
            if (b.halo) b.halo.scale.set(230 + Math.sin(t * 1.6) * 18, 1, 230 + Math.sin(t * 1.6) * 18);
            else b.m.position.y = b.y + Math.sin(t * 1.8 + b.p) * 14;
          }
        }
      };
    }
  });

  // ---------------------------------------------------------------- roca
  MOBA.defineProp('rock', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 17 + 3);
      const v = mod(K.seed, 6);
      const geo = K.cache.geo('rock_lumpy' + v, function () { return lumpyGeo(THREE, v + 1, 1, 0.55); });
      const root = new THREE.Group();
      const body = new THREE.Group(); root.add(body);
      const rx = 75 + r() * 70, rz = rx * (0.7 + r() * 0.4), ry = 55 + r() * 55;
      const col = pick(r, [0x8c8f99, 0x9a8f80, 0x7d8a8f, 0x8f86a0, 0x868d7c]);
      K.add(body, geo, K.mat(col, { roughness: 0.95 }), 0, ry * 0.42, 0, rx, ry, rz);
      // musgo en la parte de arriba
      if (r() < 0.75) {
        const mg = K.cache.geo('rock_lumpy' + ((v + 3) % 6), function () { return lumpyGeo(THREE, ((v + 3) % 6) + 1, 1, 0.55); });
        K.add(body, mg, K.mat(pick(r, [0x5aa640, 0x4f9a48, 0x6cb84a]), { roughness: 1 }), rx * 0.05, ry * 0.95, 0, rx * 0.72, ry * 0.32, rz * 0.72);
      }
      // piedritas
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, d = Math.max(rx, rz) * (0.95 + r() * 0.25), s = 18 + r() * 22;
        const p = K.add(body, K.g.dodec(), K.mat(col, { roughness: 0.95 }), Math.cos(a) * d, s * 0.4, Math.sin(a) * d, s, s * 0.7, s);
        p.rotation.set(r() * 3, r() * 3, r() * 3);
      }
      blobShadow(K, root, Math.max(rx, rz) * 1.15, 0.22);
      body.rotation.y = r() * Math.PI * 2;
      return { object: root };
    }
  });

  // ---------------------------------------------------------------- mata de pasto alto (≤ 3 mallas)
  function tuftGeo(THREE, seed, count, hMin, hMax, radius, widthMul) {
    const r = rng(seed);
    const pos = [];
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
      const h = hMin + r() * (hMax - hMin);
      const w = (9 + r() * 7) * widthMul;
      const ta = r() * Math.PI * 2;                        // orientación de la hoja
      const tx = Math.cos(ta), tz = Math.sin(ta);
      const lean = 0.12 + r() * 0.2;                      // inclinación hacia afuera
      const ox = d > 1 ? bx / d : Math.cos(a), oz = d > 1 ? bz / d : Math.sin(a);
      const mx = bx + ox * h * lean * 0.35, mz = bz + oz * h * lean * 0.35, my = h * 0.55;
      const px = bx + ox * h * lean, pz = bz + oz * h * lean, py = h;
      const L = [bx - tx * w, 0, bz - tz * w], R = [bx + tx * w, 0, bz + tz * w];
      const ML = [mx - tx * w * 0.6, my, mz - tz * w * 0.6], MR = [mx + tx * w * 0.6, my, mz + tz * w * 0.6];
      const T = [px, py, pz];
      pos.push.apply(pos, L.concat(R, MR, L, MR, ML, ML, MR, T));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    return g;
  }
  MOBA.defineProp('grassTuft', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx);
      const v = mod(K.seed, 4);
      const r = rng(K.seed * 13 + 1);
      const root = new THREE.Group();
      const side = { side: THREE.DoubleSide, roughness: 0.9 };
      const g1 = K.cache.geo('tuft_a' + v, function () { return tuftGeo(THREE, 100 + v, 16, 85, 118, 42, 1); });
      const g2 = K.cache.geo('tuft_b' + v, function () { return tuftGeo(THREE, 200 + v, 12, 60, 100, 36, 0.9); });
      const m1 = K.add(root, g1, K.mat(0x2f8a3a, side));
      const m2 = K.add(root, g2, K.mat(0x58b84a, side));
      m1.rotation.y = r() * 6.28; m2.rotation.y = r() * 6.28;
      const ph = r() * 6.28;
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          m1.rotation.z = Math.sin(t * 1.3 + ph) * 0.06;
          m1.rotation.x = Math.sin(t * 1.1 + ph * 0.7) * 0.04;
          m2.rotation.z = Math.sin(t * 1.5 + ph + 1) * 0.07;
          m2.rotation.x = Math.sin(t * 1.2 + ph) * 0.05;
        }
      };
    }
  });

  // ---------------------------------------------------------------- arbusto con flores
  MOBA.defineProp('bush', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 11 + 5);
      const root = new THREE.Group();
      const body = new THREE.Group(); root.add(body);
      const greens = [0x3e9a3c, 0x4fae43, 0x2f8640];
      K.add(body, K.g.ico(1), K.mat(greens[0]), 0, 48, 0, 66, 52, 66);
      const blobs = [];
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + r() * 0.6, d = 45 + r() * 10, s = 38 + r() * 12;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        K.add(body, K.g.ico(0), K.mat(greens[(i + 1) % 3]), x, s * 0.75, z, s, s * 0.9, s);
        blobs.push([x, s * 1.5, z]);
      }
      const fc = pick(r, [0xff6fae, 0xffd84a, 0xffffff, 0xb07bff, 0xff8a4a]);
      const flowerMat = K.mat(fc, { emissive: fc, emissiveIntensity: 0.15 });
      const spots = [[0, 99, 0], [35, 88, 30], [-38, 86, 18], [10, 80, -45]].concat(blobs.slice(0, 2));
      for (let i = 0; i < 5; i++) {
        const p = spots[i];
        const f = K.add(body, K.g.dodec(), flowerMat, p[0] * (0.95 + r() * 0.1), p[1] - 4, p[2], 11, 6, 11);
        f.rotation.y = r() * 3;
      }
      blobShadow(K, root, 100, 0.25);
      body.rotation.y = r() * 6.28;
      return { object: root };
    }
  });

  // ---------------------------------------------------------------- hongo mágico
  MOBA.defineProp('mushroom', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 19 + 2);
      const root = new THREE.Group();
      const capC = pick(r, [0x3fe0ff, 0xff4fd8, 0xffa13a, 0x8f6bff]);
      const capMat = K.mat(capC, { emissive: capC, emissiveIntensity: 0.55, roughness: 0.6 });
      const stemMat = K.mat(0xf3ead2, { emissive: 0xfff4d0, emissiveIntensity: 0.12 });
      const spotMat = K.cache.basic(0xfff8e0);
      const caps = [];
      const defs = [[0, 0, 1], [38, 18, 0.55], [-30, 28, 0.42]];
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i], s = d[2];
        const g = new THREE.Group(); g.position.set(d[0], 0, d[1]); g.rotation.z = (i ? (i === 1 ? -0.2 : 0.25) : 0.05);
        root.add(g);
        K.add(g, K.g.cyl(0.7, 7), stemMat, 0, 0, 0, 13 * s, 56 * s, 13 * s);
        const cap = K.add(g, K.g.dome(), capMat, 0, 52 * s, 0, 40 * s, 28 * s, 40 * s);
        caps.push({ g: g, base: g.rotation.z, p: i * 1.9 });
        if (i === 0) {
          K.add(g, K.g.ico(0), spotMat, 14, 74, 8, 6);
          K.add(g, K.g.ico(0), spotMat, -12, 76, -10, 5);
          K.add(g, K.g.ico(0), spotMat, 2, 79, 18, 4.5);
          cap.rotation.y = r() * 3;
        }
      }
      const halo = K.add(root, K.g.disc(), K.glow(capC, 0.3), 0, 2, 0, 75, 1, 75);
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          const k = 75 + Math.sin(t * 2.2 + K.seed) * 9;
          halo.scale.set(k, 1, k);
          for (let i = 0; i < caps.length; i++) caps[i].g.rotation.z = caps[i].base + Math.sin(t * 1.4 + caps[i].p) * 0.04;
        }
      };
    }
  });

  // ---------------------------------------------------------------- grupito de flores
  MOBA.defineProp('flowers', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 23 + 9);
      const root = new THREE.Group();
      const palette = [[0xff5f9e, 0xffd84a, 0xffffff], [0x8a6bff, 0x5fd3ff, 0xffffff], [0xffa13a, 0xff5f5f, 0xffe36b]][mod(K.seed, 3)];
      const stemMat = K.mat(0x3f9a3a);
      K.add(root, K.g.ico(0), K.mat(0x4cae42), 0, 6, 0, 52, 14, 52); // mata de hojas
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + r() * 0.8, d = 12 + r() * 40;
        const h = 30 + r() * 26;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        K.add(root, K.g.cyl(1, 4), stemMat, x, 0, z, 2.5, h, 2.5);
        const c = palette[i % palette.length];
        const f = K.add(root, K.g.dodec(), K.mat(c, { emissive: c, emissiveIntensity: 0.15 }), x, h, z, 13, 6, 13);
        f.rotation.y = r() * 3;
      }
      return { object: root };
    }
  });

  // ---------------------------------------------------------------- cristal arcano
  MOBA.defineProp('crystal', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 29 + 4);
      const root = new THREE.Group();
      const c = pick(r, [0xb36bff, 0x4fe3ff, 0xff6bd5, 0x6bffb8]);
      const cm = K.mat(c, { emissive: c, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.1 });
      const main = K.add(root, K.g.octa(), cm, 0, 78, 0, 30, 82, 30);
      main.rotation.y = r() * 3;
      const sides = [];
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + r() * 0.5, s = 0.45 + r() * 0.25;
        const m = K.add(root, K.g.octa(), cm, Math.cos(a) * 36, 30 * s, Math.sin(a) * 36, 18 * s * 1.3, 75 * s, 18 * s * 1.3);
        m.rotation.z = Math.cos(a) * -0.45; m.rotation.x = Math.sin(a) * 0.45;
        sides.push(m);
      }
      const rockMat = K.mat(0x5c5a6b, { roughness: 1 });
      const b1 = K.add(root, K.g.dodec(), rockMat, 18, 8, 22, 34, 18, 30); b1.rotation.y = 0.7;
      const b2 = K.add(root, K.g.dodec(), rockMat, -26, 7, -12, 28, 16, 26);
      const core = K.add(root, K.g.octa(), K.glow(c, 0.22), 0, 78, 0, 42, 88, 42);
      const halo = K.add(root, K.g.disc(), K.glow(c, 0.3), 0, 2, 0, 90, 1, 90);
      const ph = r() * 6.28;
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          const p = 1 + Math.sin(t * 2 + ph) * 0.08;
          core.scale.set(42 * p, 88 * p, 42 * p);
          core.rotation.y = t * 0.4;
          const h = 90 + Math.sin(t * 2 + ph) * 10;
          halo.scale.set(h, 1, h);
        }
      };
    }
  });

  // ---------------------------------------------------------------- estandarte del equipo
  MOBA.defineProp('banner', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 37 + 1);
      const root = new THREE.Group();
      const tc = K.teamColor;
      const stone = K.mat(0x8d8c95, { roughness: 0.95 });
      const gold = K.mat(0xe8c15a, { metalness: 0.5, roughness: 0.4, emissive: 0x6b4a10, emissiveIntensity: 0.25 });
      const wood = K.mat(0x4a3a35);
      K.add(root, K.g.cyl(0.8, 6), stone, 0, 0, 0, 42, 26, 42);
      K.add(root, K.g.cyl(0.85, 6), wood, 0, 26, 0, 9, 270, 9);
      K.add(root, K.g.octa(), gold, 0, 312, 0, 15, 26, 15);
      const bar = K.add(root, K.g.cyl(1, 6), wood, -66, 284, 4, 6, 132, 6); bar.rotation.z = -Math.PI / 2;
      K.add(root, K.g.sphere(), gold, -68, 284, 4, 9);
      K.add(root, K.g.sphere(), gold, 68, 284, 4, 9);

      // Tela: se deforma por vértice para flamear (geometría propia de esta instancia).
      const W = 116, H = 180;
      const flagGeo = new THREE.PlaneGeometry(W, H, 6, 9);
      flagGeo.translate(0, -H / 2, 0);
      const fp = flagGeo.attributes.position;
      for (let i = 0; i < fp.count; i++) { // corte en cola de golondrina
        const x = fp.getX(i), y = fp.getY(i);
        const k = (y + H) / H; // 0 abajo .. 1 arriba
        if (k < 0.25) fp.setY(i, y + (1 - Math.abs(x) / (W / 2)) * 42 * (1 - k / 0.25));
      }
      const emGeo = new THREE.CircleGeometry(30, 6);
      emGeo.translate(0, -78, 0.8);
      const emInner = new THREE.CircleGeometry(14, 4);
      emInner.translate(0, -78, 1.6);
      const flag = new THREE.Group(); flag.position.set(0, 280, 10); root.add(flag);
      const flagMat = K.mat(tc, { side: THREE.DoubleSide, emissive: tc, emissiveIntensity: 0.18, roughness: 0.7 });
      flag.add(new THREE.Mesh(flagGeo, flagMat));
      flag.add(new THREE.Mesh(emGeo, K.mat(0xf2d27a, { side: THREE.DoubleSide, emissive: 0x806020, emissiveIntensity: 0.3 })));
      flag.add(new THREE.Mesh(emInner, K.mat(0xffffff, { side: THREE.DoubleSide, emissive: tc, emissiveIntensity: 0.6 })));
      const geos = [flagGeo, emGeo, emInner].map(function (g) {
        const p = g.attributes.position;
        return { p: p, base: Float32Array.from(p.array), z: g === flagGeo ? 0 : (g === emGeo ? 0.8 : 1.6) };
      });
      geos.forEach(function (o) { o.p.setUsage && o.p.setUsage(THREE.DynamicDrawUsage); });
      flagGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -H / 2, 0), H * 0.7);
      emGeo.boundingSphere = flagGeo.boundingSphere.clone();
      emInner.boundingSphere = flagGeo.boundingSphere.clone();
      const ph = r() * 6.28;
      function wave(x, y, t) {
        const down = Math.min(1, -y / H);
        return (Math.sin(x * 0.045 - t * 3.2 + ph + y * 0.02) * 0.6 + Math.sin(x * 0.02 + y * 0.03 - t * 2.1 + ph) * 0.4) * (4 + 20 * down);
      }
      function deform(t) {
        for (let k = 0; k < geos.length; k++) {
          const o = geos[k], a = o.p.array, b = o.base;
          for (let i = 0; i < a.length; i += 3) {
            const x = b[i], y = b[i + 1];
            a[i] = x + Math.sin(t * 1.3 + ph + y * 0.02) * 4 * Math.min(1, -y / H);
            a[i + 2] = o.z + wave(x, y, t);
          }
          o.p.needsUpdate = true;
        }
      }
      deform(0);
      return {
        object: root,
        update: function (s) { deform((s && s.time) || 0); }
      };
    }
  });

  // ---------------------------------------------------------------- farol / brasero de piedra
  MOBA.defineProp('lamp', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 41 + 6);
      const root = new THREE.Group();
      const stone = K.mat(0x9a96a0, { roughness: 0.95 });
      const dark = K.mat(0x6c6875, { roughness: 0.95 });
      K.add(root, K.g.cyl(0.85, 8), dark, 0, 0, 0, 46, 22, 46);
      K.add(root, K.g.cyl(0.8, 6), stone, 0, 22, 0, 26, 92, 26);
      K.add(root, K.g.cyl(1.3, 8), dark, 0, 112, 0, 30, 14, 30);
      const bowl = K.add(root, K.g.cyl(1.7, 8), K.mat(0x4d4652, { metalness: 0.3, roughness: 0.6 }), 0, 124, 0, 28, 26, 28);
      bowl.rotation.y = 0.2;
      K.add(root, K.g.ico(0), K.cache.basic(0xff7a2a), 0, 148, 0, 34, 8, 34); // brasas
      const fireC = pick(r, [[0xff8a2a, 0xffe36b], [0xff8a2a, 0xffe36b], [0x3fb8ff, 0xc8f4ff]]);
      const flame = new THREE.Group(); flame.position.y = 146; root.add(flame);
      const outer = K.add(flame, K.g.cone(6), K.glow(fireC[0], 0.85), 0, 0, 0, 26, 48, 26);
      const inner = K.add(flame, K.g.cone(5), K.glow(fireC[1], 0.95), 0, 0, 0, 14, 32, 14);
      const aura = K.add(flame, K.g.ico(1), K.glow(fireC[0], 0.18), 0, 22, 0, 46);
      const halo = K.add(root, K.g.disc(), K.glow(fireC[0], 0.16), 0, 2, 0, 120, 1, 120);
      const ph = r() * 6.28;
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          const f = 1 + Math.sin(t * 11 + ph) * 0.14 + Math.sin(t * 17.3 + ph * 2) * 0.08;
          outer.scale.set(26 * (1.05 - (f - 1) * 0.5), 48 * f, 26 * (1.05 - (f - 1) * 0.5));
          inner.scale.set(14, 32 * (2 - f * 0.9), 14);
          outer.rotation.y = t * 1.5; inner.rotation.y = -t * 2.1;
          flame.rotation.z = Math.sin(t * 3.1 + ph) * 0.06;
          const a = 46 * (0.95 + Math.sin(t * 7 + ph) * 0.06);
          aura.scale.set(a, a, a);
          const h = 120 + Math.sin(t * 9 + ph) * 8;
          halo.scale.set(h, 1, h);
        }
      };
    }
  });

  // ---------------------------------------------------------------- fuente de la base (≤ 30 mallas)
  MOBA.defineProp('fountain', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx);
      const root = new THREE.Group();
      const tc = new THREE.Color(K.teamColor);
      const tint = new THREE.Color(0x9a9ca6).lerp(tc, 0.25);
      const stoneA = K.mat(0x7f838f, { roughness: 0.95 });
      const stoneB = K.mat(0xa4a7b1, { roughness: 0.9 });
      const floor = K.mat(tint.getHex(), { roughness: 0.85 });
      // Materiales propios (se animan).
      const runeMat = new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const glyphMat = new THREE.MeshBasicMaterial({ color: tc.clone().lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
      const crystalMat = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 0.8, flatShading: true, roughness: 0.25, metalness: 0.1 });
      const haloMat = new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });

      const t1 = K.cache.geo('ftn_t1', function () { const g = new THREE.CylinderGeometry(690, 720, 50, 16); g.translate(0, 25, 0); return g; });
      const t2 = K.cache.geo('ftn_t2', function () { const g = new THREE.CylinderGeometry(545, 570, 30, 16); g.translate(0, 65, 0); return g; });
      const t3 = K.cache.geo('ftn_t3', function () { const g = new THREE.CylinderGeometry(390, 400, 12, 16); g.translate(0, 86, 0); return g; });
      K.add(root, t1, stoneA);
      K.add(root, t2, stoneB);
      K.add(root, t3, floor);
      const ringG = K.cache.geo('ftn_ring', function () { const g = new THREE.RingGeometry(440, 470, 48); g.rotateX(-Math.PI / 2); return g; });
      const ringG2 = K.cache.geo('ftn_ring2', function () { const g = new THREE.RingGeometry(240, 258, 40); g.rotateX(-Math.PI / 2); return g; });
      const ring1 = K.add(root, ringG, runeMat, 0, 81, 0);
      const ring2 = K.add(root, ringG2, runeMat, 0, 93, 0);
      // runas sobre el piso interior
      const glyphG = K.cache.geo('ftn_glyph', function () { return new THREE.OctahedronGeometry(1, 0); });
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8;
        const g = K.add(root, glyphG, glyphMat, Math.cos(a) * 320, 93, Math.sin(a) * 320, 36, 2, 14);
        g.rotation.y = -a + (i % 2 ? 0.5 : -0.5);
      }
      // pilares con cristales en el borde
      const pillarG = K.cache.geo('ftn_pillar', function () { const g = new THREE.CylinderGeometry(28, 38, 55, 6); g.translate(0, 27.5, 0); return g; });
      const crystals = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const x = Math.cos(a) * 625, z = Math.sin(a) * 625;
        K.add(root, pillarG, stoneB, x, 50, z).rotation.y = a;
        const c = K.add(root, K.g.octa(), crystalMat, x, 122, z, 20, 28, 20);
        crystals.push({ m: c, p: i * 1.05 });
      }
      // cristal central flotante
      K.add(root, K.g.cyl(0.8, 8), stoneA, 0, 92, 0, 95, 18, 95);
      const core = K.add(root, K.g.octa(), crystalMat, 0, 128, 0, 26, 36, 26);
      const halo = K.add(root, K.g.ico(1), haloMat, 0, 128, 0, 50);
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          const pulse = 0.5 + 0.5 * Math.sin(t * 2);
          runeMat.opacity = 0.45 + 0.4 * pulse;
          glyphMat.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2 + 1.3));
          crystalMat.emissiveIntensity = 0.65 + 0.45 * pulse;
          haloMat.opacity = 0.15 + 0.15 * pulse;
          ring1.rotation.y = t * 0.08;
          ring2.rotation.y = -t * 0.15;
          core.position.y = 128 + Math.sin(t * 1.6) * 8;
          core.rotation.y = t * 0.7;
          halo.position.y = core.position.y;
          const h = 46 + pulse * 8;
          halo.scale.set(h, h, h);
          for (let i = 0; i < crystals.length; i++) {
            const c = crystals[i];
            c.m.position.y = 122 + Math.sin(t * 1.8 + c.p) * 6;
            c.m.rotation.y = t * 0.5 + c.p;
          }
        }
      };
    }
  });

  // ---------------------------------------------------------------- juncos de río
  MOBA.defineProp('reed', {
    build: function (THREE, ctx) {
      const K = kit(THREE, ctx), r = rng(K.seed * 43 + 8);
      const root = new THREE.Group();
      const greens = [K.mat(0x4f9a3c), K.mat(0x6bb84a), K.mat(0x3c8a48)];
      const tailMat = K.mat(0x7a4a2a);
      const stalks = [];
      for (let i = 0; i < 7; i++) {
        const a = r() * 6.28, d = r() * 32;
        const h = 75 + r() * 50;
        const g = new THREE.Group(); g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        g.rotation.z = (r() - 0.5) * 0.35; g.rotation.x = (r() - 0.5) * 0.35;
        root.add(g);
        K.add(g, K.g.cone(4), greens[i % 3], 0, 0, 0, 4 + r() * 3, h, 4 + r() * 3);
        if (i < 3) K.add(g, K.g.capsule(), tailMat, 0, h * 0.78, 0, 5, 9, 5);
        stalks.push({ g: g, bx: g.rotation.x, bz: g.rotation.z, p: r() * 6.28 });
      }
      const pad = K.add(root, K.g.cyl(1, 9), K.mat(0x3fa65a), 40, 0, 26, 26, 2, 26);
      pad.rotation.y = r() * 3;
      K.add(root, K.g.dodec(), K.mat(0xffb3e0, { emissive: 0xff8ad0, emissiveIntensity: 0.2 }), 42, 5, 26, 8, 5, 8);
      return {
        object: root,
        update: function (s) {
          const t = (s && s.time) || 0;
          for (let i = 0; i < stalks.length; i++) {
            const st = stalks[i];
            st.g.rotation.z = st.bz + Math.sin(t * 1.2 + st.p) * 0.06;
            st.g.rotation.x = st.bx + Math.sin(t * 0.9 + st.p * 1.4) * 0.04;
          }
        }
      };
    }
  });

  // ---------------------------------------------------------------- material de paredes (roca musgosa)
  MOBA.defineWallMaterial(function (THREE) {
    const m = new THREE.MeshStandardMaterial({ color: 0x7c7f74, flatShading: true, roughness: 0.95, metalness: 0.02 });
    // Musgo en las caras que miran hacia arriba (sin texturas: sólo mezcla por normal).
    m.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n' +
        '{ vec3 wn = inverseTransformDirection( normal, viewMatrix );\n' +
        '  float moss = smoothstep( 0.45, 0.8, wn.y );\n' +
        '  float side = smoothstep( 0.0, 0.35, abs( wn.y ) );\n' +
        '  diffuseColor.rgb = mix( diffuseColor.rgb * ( 0.9 + 0.1 * side ), vec3( 0.33, 0.56, 0.24 ), moss ); }'
      );
    };
    m.customProgramCacheKey = function () { return 'moba_mossy_wall'; };
    return m;
  });

  // ---------------------------------------------------------------- pintor del suelo
  MOBA.defineGroundPainter(function (g, size, map) {
    const S = (typeof size === 'number' && size > 0) ? size : 1024;
    map = map || {};
    const R = rng(20240917);
    const lanesObj = map.lanes || {};
    const laneList = ['top', 'mid', 'bot'].map(function (k) { return lanesObj[k]; }).filter(function (l) { return l && l.length > 1; });
    const laneW = (map.laneWidth || 0.05) * S;
    const river = (map.river && map.river.length > 1) ? map.river : null;
    const riverW = (map.riverWidth || 0.07) * S;
    const bases = map.bases || [];
    const walls = map.walls || [];
    const brush = map.brush || [];

    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    function smoothPath(pts) {
      g.beginPath();
      g.moveTo(pts[0][0] * S, pts[0][1] * S);
      if (pts.length === 2) { g.lineTo(pts[1][0] * S, pts[1][1] * S); return; }
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        g.quadraticCurveTo(pts[i][0] * S, pts[i][1] * S, mx * S, my * S);
      }
      const l = pts[pts.length - 1];
      g.lineTo(l[0] * S, l[1] * S);
    }
    function strokeSmooth(pts, w, style) {
      smoothPath(pts);
      g.lineWidth = w; g.strokeStyle = style; g.stroke();
    }
    function polyPath(pts) {
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i) g.lineTo(pts[i][0] * S, pts[i][1] * S); else g.moveTo(pts[i][0] * S, pts[i][1] * S);
      }
      g.closePath();
    }
    // Recorre una polilínea en px cada `step`, llamando fn(x, y, dirX, dirY).
    function walk(pts, step, fn) {
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0] * S, ay = pts[i][1] * S, bx = pts[i + 1][0] * S, by = pts[i + 1][1] * S;
        const dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1;
        for (let d = 0; d < L; d += step) fn(ax + dx * d / L, ay + dy * d / L, dx / L, dy / L);
      }
    }
    function blob(x, y, rad, c, a) {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalAlpha = 1;

    // 1) Pasto base con manchas de tono.
    g.fillStyle = '#4f8f3c';
    g.fillRect(0, 0, S, S);
    const tones = [[96, 160, 70], [60, 120, 52], [112, 170, 76], [70, 130, 70], [130, 165, 72], [52, 105, 55]];
    for (let i = 0; i < 170; i++) blob(R() * S, R() * S, S * (0.03 + R() * 0.065), tones[i % tones.length], 0.22 + R() * 0.2);
    // manchitas medianas (lotes por color)
    for (let c = 0; c < tones.length; c++) {
      g.fillStyle = rgba(tones[c], 0.22);
      g.beginPath();
      for (let i = 0; i < 160; i++) {
        const x = R() * S, y = R() * S, rr = S * (0.003 + R() * 0.008);
        g.moveTo(x + rr, y);
        g.ellipse(x, y, rr, rr * (0.6 + R() * 0.4), R() * 3, 0, Math.PI * 2);
      }
      g.fill();
    }
    // briznas de pasto
    const bladeCols = ['rgba(40,95,40,0.45)', 'rgba(120,185,85,0.4)', 'rgba(80,145,60,0.45)'];
    const bl = Math.max(1, S / 1024);
    for (let c = 0; c < 3; c++) {
      g.strokeStyle = bladeCols[c];
      g.lineWidth = bl * 1.3;
      g.beginPath();
      for (let i = 0; i < 2200; i++) {
        const x = R() * S, y = R() * S, l = bl * (3 + R() * 5), a = -1.9 + R() * 0.8;
        g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      g.stroke();
    }
    // florcitas
    const flowerCols = ['#ffe36b', '#ffffff', '#ff8fc8', '#b48cff'];
    for (let c = 0; c < flowerCols.length; c++) {
      g.fillStyle = flowerCols[c];
      g.beginPath();
      for (let i = 0; i < 110; i++) {
        const cx = R() * S, cy = R() * S;
        for (let k = 0; k < 3; k++) {
          const x = cx + (R() - 0.5) * S * 0.012, y = cy + (R() - 0.5) * S * 0.012, rr = bl * (1.2 + R() * 1.1);
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
      g.fill();
    }

    // 2) Sombra alrededor de las paredes.
    for (let w = 0; w < walls.length; w++) {
      const pts = walls[w];
      if (!pts || pts.length < 3) continue;
      polyPath(pts);
      g.lineWidth = S * 0.036; g.strokeStyle = 'rgba(16,36,14,0.12)'; g.stroke();
      g.lineWidth = S * 0.022; g.strokeStyle = 'rgba(16,36,14,0.16)'; g.stroke();
      g.lineWidth = S * 0.011; g.strokeStyle = 'rgba(12,28,12,0.22)'; g.stroke();
      g.save();
      g.translate(S * 0.006, S * 0.008);
      polyPath(pts);
      g.fillStyle = 'rgba(10,24,10,0.35)'; g.fill();
      g.restore();
    }

    // 3) Arbustos: pasto más oscuro y tupido.
    for (let i = 0; i < brush.length; i++) {
      const b = brush[i];
      if (!b) continue;
      const cx = b.x * S, cy = b.y * S, rx = Math.max(2, (b.rx || 0.02) * S), ry = Math.max(2, (b.ry || 0.02) * S), rot = b.rot || 0;
      g.save();
      g.translate(cx, cy); g.rotate(rot); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * 1.35);
      gr.addColorStop(0, 'rgba(28,72,30,0.9)');
      gr.addColorStop(0.7, 'rgba(34,82,34,0.7)');
      gr.addColorStop(1, 'rgba(34,82,34,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, rx * 1.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,55,24,0.5)';
      g.beginPath();
      for (let k = 0; k < 14; k++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * rx * 0.95, rr = rx * (0.08 + R() * 0.1);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
      }
      g.fill();
      g.restore();
    }

    // 4) Carriles: tierra con bordes suaves y losas.
    for (let i = 0; i < laneList.length; i++) {
      const L = laneList[i];
      strokeSmooth(L, laneW * 1.6, 'rgba(60,70,30,0.18)');
      strokeSmooth(L, laneW * 1.32, 'rgba(110,95,55,0.45)');
      strokeSmooth(L, laneW * 1.12, 'rgba(140,110,70,0.85)');
      strokeSmooth(L, laneW, '#a8865a');
      strokeSmooth(L, laneW * 0.62, 'rgba(190,158,112,0.55)');
    }
    // moteado de tierra
    const dirtCols = ['rgba(120,92,58,0.35)', 'rgba(200,170,120,0.3)', 'rgba(95,72,45,0.3)'];
    for (let c = 0; c < dirtCols.length; c++) {
      g.fillStyle = dirtCols[c];
      g.beginPath();
      for (let i = 0; i < laneList.length; i++) {
        walk(laneList[i], laneW * 0.35, function (x, y, dx, dy) {
          const o = (R() - 0.5) * laneW * 0.95, rr = laneW * (0.03 + R() * 0.06);
          const px = x - dy * o, py = y + dx * o;
          g.moveTo(px + rr, py); g.arc(px, py, rr, 0, Math.PI * 2);
        });
      }
      g.fill();
    }
    // losas
    const stoneCols = ['#bdb29b', '#a89f8b', '#c9bfa8', '#9f9a8e'];
    const stones = [[], [], [], []];
    for (let i = 0; i < laneList.length; i++) {
      walk(laneList[i], laneW * 0.5, function (x, y, dx, dy) {
        const n = R() < 0.55 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const o = (R() - 0.5) * laneW * 0.62, rr = laneW * (0.1 + R() * 0.08);
          stones[Math.floor(R() * 4)].push([x - dy * o + dx * (R() - 0.5) * laneW * 0.2, y + dx * o, rr, R() * 6.28, 5 + Math.floor(R() * 2)]);
        }
      });
    }
    function stonePath(list) {
      for (let k = 0; k < list.length; k++) {
        const s = list[k];
        for (let j = 0; j < s[4]; j++) {
          const a = s[3] + j / s[4] * Math.PI * 2, rr = s[2] * (0.8 + ((j * 7 + k) % 5) * 0.06);
          const px = s[0] + Math.cos(a) * rr, py = s[1] + Math.sin(a) * rr * 0.85;
          if (j) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath();
      }
    }
    g.lineWidth = Math.max(1, laneW * 0.035);
    for (let c = 0; c < 4; c++) {
      g.save(); g.translate(laneW * 0.02, laneW * 0.03);
      g.beginPath(); stonePath(stones[c]); g.fillStyle = 'rgba(70,55,35,0.35)'; g.fill();
      g.restore();
      g.beginPath(); stonePath(stones[c]);
      g.fillStyle = stoneCols[c]; g.fill();
      g.strokeStyle = 'rgba(95,85,70,0.6)'; g.stroke();
    }

    // 5) Río: orillas, agua turquesa y reflejos.
    if (river) {
      strokeSmooth(river, riverW * 1.6, 'rgba(60,70,40,0.3)');
      strokeSmooth(river, riverW * 1.36, '#b7a774');
      strokeSmooth(river, riverW * 1.2, '#8d8a5e');
      strokeSmooth(river, riverW * 1.08, '#3e7f73');
      strokeSmooth(river, riverW, '#1f6f92');
      strokeSmooth(river, riverW * 0.8, '#2490ad');
      strokeSmooth(river, riverW * 0.55, 'rgba(60,190,200,0.75)');
      strokeSmooth(river, riverW * 0.28, 'rgba(110,220,215,0.45)');
      // piedritas en las orillas
      g.fillStyle = 'rgba(150,145,130,0.85)';
      g.beginPath();
      walk(river, riverW * 0.18, function (x, y, dx, dy) {
        if (R() < 0.45) return;
        const side = R() < 0.5 ? -1 : 1, o = side * riverW * (0.55 + R() * 0.1), rr = riverW * (0.02 + R() * 0.03);
        const px = x - dy * o, py = y + dx * o;
        g.moveTo(px + rr, py); g.ellipse(px, py, rr, rr * 0.75, R() * 3, 0, Math.PI * 2);
      });
      g.fill();
      // reflejos y ondas
      g.lineWidth = Math.max(1, riverW * 0.035);
      g.strokeStyle = 'rgba(235,255,255,0.4)';
      g.beginPath();
      walk(river, riverW * 0.14, function (x, y, dx, dy) {
        if (R() < 0.35) return;
        const o = (R() - 0.5) * riverW * 0.8, l = riverW * (0.08 + R() * 0.22);
        const px = x - dy * o, py = y + dx * o;
        g.moveTo(px, py); g.quadraticCurveTo(px + dx * l * 0.5 - dy * l * 0.08, py + dy * l * 0.5 + dx * l * 0.08, px + dx * l, py + dy * l);
      });
      g.stroke();
      g.strokeStyle = 'rgba(20,70,100,0.35)';
      g.beginPath();
      walk(river, riverW * 0.3, function (x, y, dx, dy) {
        const o = (R() - 0.5) * riverW * 0.7, rr = riverW * (0.05 + R() * 0.07);
        const px = x - dy * o, py = y + dx * o;
        g.moveTo(px + rr, py); g.ellipse(px, py, rr, rr * 0.5, Math.atan2(dy, dx), 0, Math.PI * 2);
      });
      g.stroke();
      // nenúfares
      g.fillStyle = '#3f9a52';
      g.beginPath();
      walk(river, riverW * 1.1, function (x, y, dx, dy) {
        if (R() < 0.5) return;
        const o = (R() < 0.5 ? -1 : 1) * riverW * (0.3 + R() * 0.12), rr = riverW * (0.05 + R() * 0.04);
        const px = x - dy * o, py = y + dx * o, a = R() * 6.28;
        g.moveTo(px, py); g.arc(px, py, rr, a, a + Math.PI * 1.75); g.closePath();
      });
      g.fill();
    }

    // 6) Bases: piso de piedra con tinte del equipo y círculo rúnico.
    for (let i = 0; i < bases.length; i++) {
      const b = bases[i];
      if (!b) continue;
      const cx = b.x * S, cy = b.y * S, r = Math.max(4, (b.r || 0.12) * S);
      const tcol = b.team === 1 ? [210, 70, 70] : [70, 130, 220];
      blob(cx, cy, r * 1.25, [20, 30, 25], 0.45);
      g.fillStyle = '#9d9c98';
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, rgba(tcol, 0.45));
      gr.addColorStop(0.6, rgba(tcol, 0.22));
      gr.addColorStop(1, rgba(tcol, 0.12));
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      // losas: anillos y radios desfasados
      const rings = 6;
      for (let k = 1; k <= rings; k++) {
        const r0 = r * (k - 1) / rings, r1 = r * k / rings, seg = 6 + k * 4, off = (k % 2) * Math.PI / seg;
        for (let j = 0; j < seg; j++) {
          const v = R();
          if (v < 0.3) continue;
          const a0 = off + j / seg * Math.PI * 2, a1 = off + (j + 1) / seg * Math.PI * 2;
          g.fillStyle = v < 0.65 ? 'rgba(60,60,70,0.10)' : 'rgba(255,255,255,0.08)';
          g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fill();
        }
      }
      g.strokeStyle = 'rgba(40,40,52,0.35)';
      g.lineWidth = Math.max(1, S * 0.0012);
      g.beginPath();
      for (let k = 1; k <= rings; k++) { const rr = r * k / rings; g.moveTo(cx + rr, cy); g.arc(cx, cy, rr, 0, Math.PI * 2); }
      for (let k = 1; k <= rings; k++) {
        const r0 = r * (k - 1) / rings, r1 = r * k / rings, seg = 6 + k * 4, off = (k % 2) * Math.PI / seg;
        for (let j = 0; j < seg; j++) {
          const a = off + j / seg * Math.PI * 2;
          g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        }
      }
      g.stroke();
      // borde
      g.lineWidth = r * 0.05; g.strokeStyle = '#6c6a66';
      g.beginPath(); g.arc(cx, cy, r * 0.975, 0, Math.PI * 2); g.stroke();
      g.lineWidth = r * 0.015; g.strokeStyle = 'rgba(230,225,210,0.55)';
      g.beginPath(); g.arc(cx, cy, r * 0.94, 0, Math.PI * 2); g.stroke();
      // círculo rúnico
      g.lineWidth = r * 0.02; g.strokeStyle = rgba(tcol.map(function (v) { return Math.min(255, v + 50); }), 0.75);
      g.beginPath(); g.arc(cx, cy, r * 0.5, 0, Math.PI * 2); g.moveTo(cx + r * 0.42, cy); g.arc(cx, cy, r * 0.42, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2, rr = r * 0.46, s = r * 0.025;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        g.moveTo(x - s, y); g.lineTo(x, y - s * 1.4); g.lineTo(x + s, y); g.lineTo(x, y + s * 1.4); g.closePath();
      }
      g.fillStyle = rgba(tcol.map(function (v) { return Math.min(255, v + 80); }), 0.8); g.fill();
      blob(cx, cy, r * 0.5, tcol.map(function (v) { return Math.min(255, v + 60); }), 0.3);
    }

    // 7) Pie de las paredes (roca oscura bajo los acantilados).
    for (let w = 0; w < walls.length; w++) {
      const pts = walls[w];
      if (!pts || pts.length < 3) continue;
      polyPath(pts);
      g.fillStyle = '#4b5444'; g.fill();
      g.lineWidth = S * 0.004; g.strokeStyle = 'rgba(30,40,28,0.6)'; g.stroke();
    }

    // 8) Viñeta suave en los bordes del mapa.
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.45, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(10,25,15,0)');
    vg.addColorStop(1, 'rgba(10,25,15,0.35)');
    g.fillStyle = vg;
    g.fillRect(0, 0, S, S);
    g.restore();
  });
})();
