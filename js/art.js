/* Registro de arte 3D: modelos procedurales (Three.js) de campeones, unidades, objetos y escenografía.
 * Los archivos de js/art/*.js llaman a estas funciones. El arte NO participa de la simulación. */
window.MOBA = window.MOBA || {};
(function (M) {
  'use strict';
  const Art = M.Art = { champions: {}, units: {}, props: {}, items: {}, ground: null };
  /** Campeón: { lore, quote, build(THREE, ctx) -> { object, update(state) }, fx: { Q|W|E|R: (THREE, ctx, info) -> { object, update(p, dt) } } } */
  M.defineChampionArt = function (id, spec) { Art.champions[id] = spec; };
  /** Unidades: 'minion_melee' | 'minion_caster' | 'minion_cannon' | 'tower' | 'nexus' | 'golem' | 'wolf' */
  M.defineUnitArt = function (id, spec) { Art.units[id] = spec; };
  /** Escenografía: 'tree' | 'rock' | 'grassTuft' | 'bush' | 'mushroom' | 'flowers' | 'crystal' | 'banner' | 'lamp' | 'fountain' | 'reed' */
  M.defineProp = function (id, spec) { Art.props[id] = spec; };
  /** Íconos de objetos: { name, flavor, draw(ctx2d, size) } */
  M.defineItemArt = function (id, spec) { Art.items[id] = spec; };
  /** Pintor del suelo: function(ctx2d, sizePx, mapInfo) */
  M.defineGroundPainter = function (fn) { Art.ground = fn; };
  /** Material de las paredes de terreno: function(THREE, ctx) -> Material */
  M.defineWallMaterial = function (fn) { Art.wallMaterial = fn; };

  /** Caché de materiales y geometrías compartidas (para no crear miles de objetos). */
  Art.makeCache = function (THREE, opt) {
    const mats = {}, geos = {};
    const toon = opt && opt.toon;   // modo anime: materiales toon (cel shading)
    return {
      mat: function (color, opts) {
        opts = opts || {};
        const key = String(color) + JSON.stringify(opts);
        if (!mats[key]) {
          const o = Object.assign({ color: color, flatShading: true, roughness: 0.8, metalness: 0.05 }, opts);
          mats[key] = toon ? toon.toonMaterial(THREE, o) : new THREE.MeshStandardMaterial(o); mats[key].__cached = true;
        }
        return mats[key];
      },
      basic: function (color, opts) {
        opts = opts || {};
        const key = 'b' + String(color) + JSON.stringify(opts);
        if (!mats[key]) { mats[key] = new THREE.MeshBasicMaterial(Object.assign({ color: color }, opts)); mats[key].__cached = true; }
        return mats[key];
      },
      geo: function (key, factory) { if (!geos[key]) { geos[key] = factory(); geos[key].__shared = true; } return geos[key]; }
    };
  };
})(window.MOBA);
