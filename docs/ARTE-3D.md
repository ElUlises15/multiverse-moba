# Multiverse MOBA — especificación de arte 3D procedural (Three.js r180)

Vas a escribir UN archivo JavaScript (script clásico, sin import/export, sin dependencias, sin red)
para un MOBA estilo League of Legends que se juega en el navegador con Three.js.
Todo el arte es PROCEDURAL: se construye con primitivas y geometrías de Three.js
(BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, DodecahedronGeometry,
OctahedronGeometry, TorusGeometry, TorusKnotGeometry, CapsuleGeometry, LatheGeometry, ExtrudeGeometry, TubeGeometry, BufferGeometry propia…).
Nada de texturas ni archivos externos (salvo donde se indica canvas 2D).

## Reglas técnicas (obligatorias)
- El archivo es un script clásico envuelto en `(function () { 'use strict'; ... })();`.
- Usá SOLO el objeto `THREE` que recibís como argumento de `build(THREE, ctx)` / las funciones de fx. No uses la variable global THREE.
- Registrá con las funciones globales `MOBA.defineChampionArt`, `MOBA.defineUnitArt`, `MOBA.defineProp`,
  `MOBA.defineItemArt`, `MOBA.defineGroundPainter`, `MOBA.defineWallMaterial` (según tu tarea).
- Sistema de coordenadas: Y hacia arriba, suelo en y = 0, el modelo mira hacia +Z (su "frente").
  Unidades = unidades de LoL: un campeón mide 180–320 de alto y ocupa un radio de 60–110 en el suelo.
- La cámara está lejos y en ángulo (estilo LoL, ~55° desde la horizontal, vista de ~2300 unidades de ancho):
  los modelos se ven chicos, así que hacé siluetas MUY marcadas, proporciones exageradas tipo juguete/chibi,
  colores saturados y partes grandes. Los detalles diminutos no se ven.
- Materiales: para piezas estáticas usá `ctx.cache.mat(color, opts)` (MeshStandardMaterial con flatShading, compartido;
  opts admite emissive, emissiveIntensity, roughness, metalness, transparent, opacity…). NO modifiques materiales del caché
  en tiempo de ejecución (son compartidos). Si necesitás animar color/opacidad, creá tu propio material.
  `ctx.cache.basic(color, opts)` da MeshBasicMaterial compartido (para brillos).
  `ctx.cache.geo(key, () => new THREE.XGeometry(...))` comparte geometrías.
- Prohibido: luces dentro de los modelos (PointLight, etc.), sombras, texturas desde URL, `document`, `window`, timers,
  `Math.random()` dentro de update (usá funciones deterministas de `state.time`). En build podés usar un PRNG con semilla.
- Presupuesto: campeón ≤ 45 mallas; súbditos ≤ 10 mallas; torres/nexo ≤ 40; props ≤ 12; efectos ≤ 30 mallas o un Points.
- Nunca lances excepciones; si falta un dato, usá un valor por defecto.
- Texto visible al jugador (lore, frases, nombres, sabor) en ESPAÑOL RIOPLATENSE (voseo: "vení", "mirá", "tenés").

## Contrato de un modelo animado
```js
build(THREE, ctx) -> { object: THREE.Object3D, update(state) }
// ctx: { THREE, cache, team (0 azul | 1 rojo | 2 neutral), teamColor (número hex), color, accent }
// state: { anim: 'idle'|'walk'|'attack'|'cast'|'recall'|'dead', t (s desde que empezó esa animación),
//          progress (0..1 para attack/cast), time (s globales), slot (0..3 si anim==='cast'),
//          speed (unidades/s), dt, hpFrac (0..1, unidades/estructuras), heat (0..3, solo torre) }
```
- `update` se llama cada cuadro. Animá con transformaciones (position/rotation/scale de sub-objetos), nada de recrear mallas.
- idle: respiración / flotación sutil. walk: piernas/brazos/rebote acorde a `speed` (~340 = trote normal).
  attack: golpe o disparo marcado (anticipación + golpe, en `progress` 0→1). cast: pose de lanzamiento (más épica si slot === 3).
  recall: pose de canalización (brillo/girar). dead: tirado en el suelo / desarmado (no lo ocultes, yo lo oculto).
- El objeto raíz NO debe moverse ni rotar sobre sí mismo (yo lo posiciono y lo giro hacia donde mira la unidad).
  Animá hijos.

## Contrato de un efecto de habilidad (fx)
```js
fx: { Q: function (THREE, ctx, info) -> { object, update(p, dt) }, W: ..., E: ..., R: ... }
// info: { kind, radius, width, length, duration, slot }
// kind: 'projectile' (misil centrado en el origen, viaja hacia +Z, ancho = info.width)
//       'area' (efecto en el suelo centrado en el origen, radio = info.radius; p 0..1 durante la advertencia+explosión
//               o durante toda la duración si es persistente)
//       'line' (desde el origen hacia +Z, largo info.length, ancho info.width)
//       'self' (aura/explosión centrada en el campeón, radio info.radius)
//       'burst' (impacto breve, radio info.radius)
//       'dash' (estela/explosión al salir o llegar de un desplazamiento, radio info.radius)
//       'target' (impacto sobre el objetivo, radio info.radius)
// p: progreso 0..1 de la vida del efecto. Yo lo posiciono, oriento y destruyo (dispose) al terminar.
```
- Cada fx DEBE funcionar con cualquier `kind` (usá el que corresponde a la habilidad como caso principal, y un buen genérico para el resto).
- Creá materiales propios para los fx (transparentes, `depthWrite: false`, podés usar `blending: THREE.AdditiveBlending`)
  y animá su opacidad para que aparezcan y se desvanezcan.

## Verificación
Corré `node lib/check.js <tu-archivo.js>` hasta que imprima "OK sin errores". Mirá también los tamaños que reporta
(alto ≈ 180–320 para campeones, minY ≈ 0) y la cantidad de mallas.
