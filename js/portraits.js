/* Retratos 3D de los campeones (para la selección y el HUD) y vista previa animada.
 * Usa un único WebGLRenderer chico, separado del de la partida. */
(function (M) {
  'use strict';
  const U = M.util;
  let gl = null, scene = null, camera = null, cache = null, failed = false;
  const shots = {};          // id -> dataURL
  const iconCache = {};

  function setup() {
    if (gl || failed) return !!gl;
    try {
      const T = window.THREE;
      if (!T || !M.webglAvailable || !M.webglAvailable()) { failed = true; return false; }
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      gl = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      gl.setPixelRatio(1); gl.setSize(256, 256, false);
      gl.outputColorSpace = T.SRGBColorSpace; gl.toneMapping = T.ACESFilmicToneMapping;
      scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xdde8ff, 0x403a30, 1.6));
      const d = new T.DirectionalLight(0xfff0dd, 2.4); d.position.set(250, 500, 400); scene.add(d);
      const rim = new T.DirectionalLight(0x88aaff, 1.2); rim.position.set(-300, 200, -300); scene.add(rim);
      camera = new T.PerspectiveCamera(28, 1, 10, 5000);
      cache = M.Art.makeCache(T);
      return true;
    } catch (e) { console.warn('Sin retratos 3D', e); failed = true; gl = null; return false; }
  }
  function buildChampion(def, team) {
    const T = window.THREE, spec = M.Art.champions[def.id];
    if (!spec) return null;
    try {
      return spec.build(T, { THREE: T, cache: cache, team: team || 0, teamColor: new T.Color(M.TEAM_COLORS[team || 0]).getHex(),
        color: new T.Color(def.color).getHex(), accent: new T.Color(def.accent).getHex() });
    } catch (e) { console.warn('Retrato ' + def.id, e); return null; }
  }
  function frame(obj, close) {
    const T = window.THREE;
    const box = new T.Box3().setFromObject(obj), size = new T.Vector3(), c = new T.Vector3();
    box.getSize(size); box.getCenter(c);
    const h = Math.max(size.y, size.x * 0.9, 120);
    const dist = (close ? h * 0.75 : h * 1.25) / Math.tan(14 * Math.PI / 180) * 0.5 + 60;
    const ty = close ? box.max.y - h * 0.32 : c.y;
    camera.position.set(dist * 0.42, ty + dist * 0.22, dist * 0.9);
    camera.lookAt(0, ty, 0);
  }
  function disposeTree(o) {
    o.traverse(function (c) {
      if (c.geometry && !c.geometry.__shared) c.geometry.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { if (!m.__cached) m.dispose(); });
    });
  }

  M.Portraits = {
    /** Retrato del campeón como dataURL (o null si no hay WebGL/arte). */
    get: function (def, close) {
      const key = def.id + (close ? ':c' : '');
      if (shots[key] !== undefined) return shots[key];
      if (!setup()) return (shots[key] = null);
      const m = buildChampion(def, 0);
      if (!m) return (shots[key] = null);
      try {
        m.update && m.update({ anim: 'idle', t: 0.4, progress: 0, time: 1.3, slot: 0, speed: 0, dt: 0.016 });
        m.object.rotation.y = 0.35;
        scene.add(m.object);
        frame(m.object, close);
        gl.setClearColor(0x000000, 0);
        gl.render(scene, camera);
        shots[key] = gl.domElement.toDataURL('image/png');
        scene.remove(m.object); disposeTree(m.object);
      } catch (e) { console.warn(e); shots[key] = null; }
      return shots[key];
    },
    /** Dibuja el retrato en un canvas 2D (con fondo); si no hay 3D usa el dibujo plano. */
    draw: function (ctx, def, size, close) {
      const url = this.get(def, close);
      const g = ctx.createRadialGradient(size / 2, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.7);
      g.addColorStop(0, U.hexToRgba(def.color, 0.55)); g.addColorStop(1, '#0d1424');
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      if (!url) { U.drawPortrait(ctx, def, size); return; }
      const img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, size, size); };
      img.src = url;
      if (img.complete) ctx.drawImage(img, 0, 0, size, size);
    },
    /** Ícono de objeto (dataURL) dibujado por el arte de objetos. */
    itemIcon: function (id, size) {
      size = size || 64;
      const key = id + ':' + size;
      if (iconCache[key]) return iconCache[key];
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      const art = M.Art.items[id];
      try { if (art) art.draw(ctx, size); else throw new Error('sin arte'); }
      catch (e) {
        ctx.fillStyle = '#26324f'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ffd54a'; ctx.font = 'bold ' + (size * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText((M.itemById[id] || { name: '?' }).name[0], size / 2, size * 0.64);
      }
      return (iconCache[key] = cv.toDataURL());
    }
  };
  M.itemName = function (id) { const a = M.Art.items[id]; return (a && a.name) || (M.itemById[id] ? M.itemById[id].name : id); };
  M.itemFlavor = function (id) { const a = M.Art.items[id]; return (a && a.flavor) || ''; };

  /** Vista previa animada de un campeón (pantalla de selección). */
  class Preview {
    constructor(canvas) {
      this.canvas = canvas; this.model = null; this.def = null; this.t = 0; this.anim = 'idle'; this.animT = 0; this.cycle = 0;
      const T = window.THREE;
      this.ok = !!(T && M.webglAvailable && M.webglAvailable());
      if (!this.ok) return;
      try {
        this.gl = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.gl.setSize(canvas.width, canvas.height, false);
        this.gl.outputColorSpace = T.SRGBColorSpace; this.gl.toneMapping = T.ACESFilmicToneMapping;
        this.scene = new T.Scene();
        this.scene.add(new T.HemisphereLight(0xdde8ff, 0x403a30, 1.5));
        const d = new T.DirectionalLight(0xfff0dd, 2.4); d.position.set(250, 500, 400); this.scene.add(d);
        const rim = new T.DirectionalLight(0x88aaff, 1.4); rim.position.set(-300, 200, -300); this.scene.add(rim);
        const disc = new T.Mesh(new T.CircleGeometry(150, 48), new T.MeshBasicMaterial({ color: 0x2a3d66, transparent: true, opacity: 0.6 }));
        disc.rotation.x = -Math.PI / 2; this.scene.add(disc);
        this.camera = new T.PerspectiveCamera(28, canvas.width / canvas.height, 10, 5000);
        this.cache = M.Art.makeCache(T);
      } catch (e) { this.ok = false; }
    }
    set(def) {
      if (!this.ok || def === this.def) return;
      const T = window.THREE;
      if (this.model) { this.scene.remove(this.model.object); disposeTree(this.model.object); this.model = null; }
      this.def = def;
      const spec = M.Art.champions[def.id];
      if (!spec) return;
      try {
        this.model = spec.build(T, { THREE: T, cache: this.cache, team: 0, teamColor: 0x38a3ff, color: new T.Color(def.color).getHex(), accent: new T.Color(def.accent).getHex() });
        this.scene.add(this.model.object);
        const box = new T.Box3().setFromObject(this.model.object), size = new T.Vector3(); box.getSize(size);
        const h = Math.max(size.y, 200), dist = h * 1.35 / Math.tan(14 * Math.PI / 180) * 0.5 + 80;
        this.camera.position.set(0, h * 0.55 + dist * 0.2, dist); this.camera.lookAt(0, h * 0.45, 0);
      } catch (e) { console.warn(e); this.model = null; }
      this.cycle = 0; this.anim = 'idle'; this.animT = 0;
    }
    render(dt) {
      if (!this.ok || !this.model) return;
      this.t += dt; this.animT += dt;
      // ciclo: quieto → ataque → caminar → habilidad → R
      const seq = [['idle', 2.2], ['attack', 0.9], ['walk', 1.8], ['cast', 0.8], ['idle', 1.2], ['cast', 1.0]];
      const cur = seq[this.cycle % seq.length];
      if (this.animT > cur[1]) { this.cycle++; this.animT = 0; }
      const now = seq[this.cycle % seq.length];
      const slot = this.cycle % seq.length === 5 ? 3 : (this.cycle >> 1) % 3;
      try { this.model.update({ anim: now[0], t: this.animT, progress: Math.min(1, this.animT / now[1]), time: this.t, slot: slot, speed: now[0] === 'walk' ? 340 : 0, dt: dt }); } catch (e) { /* nada */ }
      this.model.object.rotation.y = Math.sin(this.t * 0.4) * 0.6;
      this.gl.render(this.scene, this.camera);
    }
  }
  M.Preview = Preview;
})(window.MOBA);
