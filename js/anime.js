/* Modo anime (experimental): sombreado toon (cel shading) con contornos, paleta más saturada
 * y modelos 3D hechos en Blender (GLB con esqueleto y animaciones).
 * Se activa con ?anime=1 en la dirección o en Configuración → Gráficos → "Estilo anime".
 * Si un modelo GLB no carga (por ejemplo abriendo el dist con file://), se usa el modelo procedural de siempre. */
(function (M) {
  'use strict';
  const Anime = M.Anime = {
    /** Modelos disponibles: artId → archivo, escala (metros de Blender → unidades del juego) e inclinación de la cabeza hacia la cámara (rad). */
    MODELS: { 'champ:ignis': { file: 'ignis_anime.glb', scale: 100, headTilt: -0.42 } },
    gltf: {}, loading: {}, failed: {},
    HEAD_TILT: -0.3,

    enabled: function () {
      const q = /[?&]anime=(0|1)\b/.exec(location.search);
      if (q) return q[1] === '1';
      return !!(M.Settings && M.Settings.get('anime'));
    },
    /** Textura de 3 escalones para MeshToonMaterial (sombra, medio tono, luz). */
    gradient: function (T) {
      if (this._grad) return this._grad;
      const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
      const tex = new T.DataTexture(data, 3, 1, T.RGBAFormat);
      tex.minFilter = tex.magFilter = T.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      return (this._grad = tex);
    },
    /** Color más vivo (anime): más saturación y un toque más claro. */
    vivid: function (T, c) {
      const col = new T.Color(c), hsl = {};
      col.getHSL(hsl);
      col.setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.04), Math.min(0.92, hsl.l * 1.06 + 0.02));
      return col;
    },
    TOON_KEYS: ['color', 'emissive', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'depthWrite', 'depthTest', 'blending', 'map', 'alphaTest', 'vertexColors', 'fog', 'wireframe', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits'],
    /** Material toon equivalente a uno estándar. */
    toonMaterial: function (T, opts) {
      const o = { gradientMap: this.gradient(T) };
      for (const k of this.TOON_KEYS) if (opts[k] !== undefined) o[k] = opts[k];
      o.color = opts.noVivid ? new T.Color(opts.color) : this.vivid(T, opts.color != null ? opts.color : 0xffffff);
      if (o.emissive != null) o.emissive = new T.Color(o.emissive);
      return new T.MeshToonMaterial(o);
    },
    /** Contorno con "casco invertido": copia de la malla, caras de atrás, inflada sobre las normales. Funciona con mallas con esqueleto. */
    outlineMaterial: function (T, width) {
      const key = 'ol' + width;
      this._ol = this._ol || {};
      if (this._ol[key]) return this._ol[key];
      const m = new T.MeshBasicMaterial({ color: 0x1a0c10, side: T.BackSide });
      m.onBeforeCompile = function (sh) {
        sh.uniforms.olWidth = { value: width };
        sh.vertexShader = 'uniform float olWidth;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * olWidth;');
      };
      m.customProgramCacheKey = function () { return key; };
      m.__cached = true;
      return (this._ol[key] = m);
    },
    addOutline: function (T, mesh, width) {
      if (!mesh.geometry || !mesh.geometry.attributes.normal || mesh.userData.outline) return null;
      const mat = mesh.material;
      if (mat && (mat.transparent || mat.isMeshBasicMaterial)) return null;
      let o;
      if (mesh.isSkinnedMesh) { o = new T.SkinnedMesh(mesh.geometry, this.outlineMaterial(T, width)); o.bind(mesh.skeleton, mesh.bindMatrix); }
      else o = new T.Mesh(mesh.geometry, this.outlineMaterial(T, width));
      o.userData.isOutline = true; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = mesh.frustumCulled;
      mesh.userData.outline = o;
      mesh.add(o);
      return o;
    },
    /** Contornos para un modelo procedural (solo piezas que se ven desde la cámara). */
    outlineModel: function (T, root, width, minRadius) {
      const list = [];
      root.traverse(function (m) { if (m.isMesh && !m.userData.isOutline) list.push(m); });
      for (const m of list) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const s = m.getWorldScale(new T.Vector3());
        if (m.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) >= (minRadius || 0)) this.addOutline(T, m, width / Math.max(1e-3, Math.max(s.x, s.y, s.z)));
      }
    },

    /** Carga los GLB (una vez). onReady(artId) se llama cuando cada uno está listo. */
    load: function (onReady) {
      const self = this;
      if (!window.THREE_GLTF || location.protocol === 'file:') return;
      const loader = new window.THREE_GLTF.GLTFLoader();
      Object.keys(this.MODELS).forEach(function (id) {
        if (self.gltf[id]) { onReady(id); return; }
        if (self.failed[id]) return;
        (self.loading[id] = self.loading[id] || []).push(onReady);
        if (self.loading[id].length > 1) return;
        loader.load((M.MODELS_BASE || 'assets/models/') + self.MODELS[id].file, function (g) {
          self.gltf[id] = g; const cbs = self.loading[id]; self.loading[id] = null;
          cbs.forEach(function (f) { try { f(id); } catch (e) { console.warn(e); } });
        }, undefined, function (e) { self.failed[id] = true; self.loading[id] = null; console.info('Modelo anime ' + id + ' no disponible; uso el procedural.', e && e.message || ''); });
      });
    },
    has: function (artId) { return !!this.gltf[artId]; },

    /** Arma una instancia animada del GLB: { object, update(estado), mixer }. */
    build: function (T, artId) {
      const g = this.gltf[artId], info = this.MODELS[artId];
      const self = this;
      const root = window.THREE_GLTF.SkeletonUtils.clone(g.scene);
      root.scale.setScalar(info.scale);
      const meshes = [];
      root.traverse(function (o) { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        const src = o.material;
        const emissive = src.emissive && (src.emissive.r + src.emissive.g + src.emissive.b) > 0.01;
        o.material = self.toonMaterial(T, { noVivid: true, color: src.color.getHex(), map: src.map || undefined, emissive: emissive ? src.emissive.getHex() : undefined, emissiveIntensity: emissive ? Math.min(1.2, (src.emissiveIntensity || 1) * 0.5) : undefined });
        o.frustumCulled = false; o.castShadow = true;
        if (!emissive) self.addOutline(T, o, 0.011);
      }
      // la cámara del MOBA mira desde arriba: la cabeza se inclina un poco hacia atrás para que se vea la cara
      let headBone = null;
      root.traverse(function (o) { if (o.isBone && o.name === 'head') headBone = o; });
      const mixer = new T.AnimationMixer(root);
      const acts = {};
      for (const clip of g.animations) {
        const a = mixer.clipAction(clip);
        if (clip.name === 'attack' || clip.name === 'cast' || clip.name === 'death') { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
        acts[clip.name] = a;
      }
      const MAP = { idle: 'idle', walk: 'run', attack: 'attack', cast: 'cast', dead: 'death', recall: 'recall', victory: 'victory' };
      let cur = null;
      const play = function (name, fade) {
        const a = acts[name] || acts.idle;
        if (!a || a === cur) return a;
        a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
        if (cur) cur.crossFadeTo(a, fade, false);
        cur = a;
        return a;
      };
      play('idle', 0);
      return {
        object: root, mixer: mixer, anime: true,
        update: function (s) {
          const name = MAP[s.anim] || 'idle';
          const a = play(name, name === 'death' ? 0.1 : 0.15);
          if (!a) return;
          const dur = a.getClip().duration;
          if (name === 'attack' || name === 'cast') { a.paused = false; a.time = Math.min(dur - 1e-3, s.progress * dur); a.timeScale = 0; }
          else if (name === 'run') a.timeScale = Math.max(0.7, Math.min(1.6, (s.speed || 330) / 330));
          else a.timeScale = 1;
          mixer.update(Math.min(0.1, s.dt || 0.016));
          if (headBone && name !== 'death') headBone.rotateX(info.headTilt != null ? info.headTilt : Anime.HEAD_TILT);
        }
      };
    }
  };
})(window.MOBA);
