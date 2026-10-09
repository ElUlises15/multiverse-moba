/* Objetos de la tienda con rutas de construcción estilo LoL.
 * - Básicos: se compran directo.
 * - Intermedios y legendarios: tienen `from` (componentes). Al comprar, se consumen los componentes que ya tenés
 *   (incluso si están dentro de otros intermedios tuyos) y solo pagás la diferencia (regla de LoL).
 * - `cost` es el costo TOTAL del objeto; el "costo de combinación" es cost − suma de los componentes.
 * - Algunos legendarios tienen una pasiva única (`passive`), implementada en game.js / abilities.js. */
(function (M) {
  'use strict';
  // stats posibles: hp, mana, ad, ap, apMult, armor, mr, attackSpeed (fracción), critChance, critDamage,
  //                 lifesteal, haste (aceleración de habilidades), moveSpeed, moveSpeedPct, hpRegen, manaRegen (por segundo)
  M.ITEMS = [
    // ---------- Básicos ----------
    { id: 'espada', name: 'Espada Larga', tier: 1, cost: 350, stats: { ad: 10 } },
    { id: 'tomo', name: 'Tomo Amplificador', tier: 1, cost: 400, stats: { ap: 20 } },
    { id: 'rubi', name: 'Cristal de Rubí', tier: 1, cost: 400, stats: { hp: 150 } },
    { id: 'zafiro', name: 'Cristal de Zafiro', tier: 1, cost: 350, stats: { mana: 250 } },
    { id: 'daga', name: 'Daga', tier: 1, cost: 300, stats: { attackSpeed: 0.12 } },
    { id: 'tela', name: 'Armadura de Tela', tier: 1, cost: 300, stats: { armor: 15 } },
    { id: 'manto', name: 'Capa Nula', tier: 1, cost: 450, stats: { mr: 25 } },
    { id: 'capa', name: 'Capa de Agilidad', tier: 1, cost: 600, stats: { critChance: 0.15 } },
    { id: 'pico', name: 'Pico', tier: 1, cost: 875, stats: { ad: 25 } },
    { id: 'vara', name: 'Vara Explosiva', tier: 1, cost: 850, stats: { ap: 45 } },
    { id: 'botas', name: 'Botas', tier: 1, cost: 300, stats: { moveSpeed: 25 } },
    // ---------- Intermedios ----------
    { id: 'martillo', name: 'Martillo de Guerra', tier: 2, cost: 1050, from: ['espada', 'espada'], stats: { ad: 25, haste: 10 } },
    { id: 'cetro', name: 'Cetro Vampírico', tier: 2, cost: 900, from: ['espada'], stats: { ad: 15, lifesteal: 0.07 } },
    { id: 'arco', name: 'Arco Recurvo', tier: 2, cost: 700, from: ['daga', 'daga'], stats: { attackSpeed: 0.25 } },
    { id: 'celo', name: 'Celo', tier: 2, cost: 1050, from: ['daga', 'capa'], stats: { attackSpeed: 0.18, critChance: 0.15, moveSpeedPct: 0.04 } },
    { id: 'capitulo', name: 'Capítulo Perdido', tier: 2, cost: 1200, from: ['tomo', 'zafiro'], stats: { ap: 40, mana: 300, haste: 10 } },
    { id: 'gema', name: 'Gema Avivadora', tier: 2, cost: 800, from: ['rubi'], stats: { hp: 200, haste: 10 } },
    { id: 'cinturon', name: 'Cinturón del Gigante', tier: 2, cost: 900, from: ['rubi'], stats: { hp: 350 } },
    { id: 'cota', name: 'Cota de Malla', tier: 2, cost: 800, from: ['tela'], stats: { armor: 40 } },
    { id: 'negatron', name: 'Capa de Negatrón', tier: 2, cost: 900, from: ['manto'], stats: { mr: 50 } },
    // ---------- Botas mejoradas ----------
    { id: 'grebas', name: 'Grebas del Berserker', tier: 2, boots: true, cost: 1100, from: ['botas', 'daga'], stats: { attackSpeed: 0.35, moveSpeed: 45 } },
    { id: 'jonias', name: 'Botas Jonias', tier: 2, boots: true, cost: 900, from: ['botas'], stats: { haste: 20, moveSpeed: 45 } },
    { id: 'tabi', name: 'Botas de Acero', tier: 2, boots: true, cost: 1100, from: ['botas', 'tela'], stats: { armor: 20, moveSpeed: 45 },
      passive: { id: 'tabi', text: 'Bloqueo: recibís 12% menos daño de ataques básicos.' } },
    { id: 'mercurio', name: 'Botas de Mercurio', tier: 2, boots: true, cost: 1100, from: ['botas', 'manto'], stats: { mr: 25, moveSpeed: 45 },
      passive: { id: 'tenacity', text: 'Tenacidad: los aturdimientos, miedos y ralentizaciones te duran 30% menos.' } },
    // ---------- Legendarios ----------
    { id: 'cuchilla', name: 'Cuchilla Negra', tier: 3, cost: 3000, from: ['martillo', 'gema'], stats: { ad: 40, hp: 400, haste: 20 },
      passive: { id: 'shred', text: 'Partir: tus ataques a campeones les sacan 5% de armadura (se acumula 6 veces, 6 s).' } },
    { id: 'filo', name: 'Filo del Infinito', tier: 3, cost: 3400, from: ['pico', 'capa', 'espada'], stats: { ad: 65, critChance: 0.25, critDamage: 0.4 },
      passive: { id: 'crit', text: 'Perfección: tus críticos hacen 40% más de daño.' } },
    { id: 'hidra', name: 'Hidra Voraz', tier: 3, cost: 3300, from: ['cetro', 'martillo'], stats: { ad: 65, lifesteal: 0.1 },
      passive: { id: 'cleave', text: 'Hendidura: tus ataques dañan un 40% a los enemigos cercanos al objetivo (cuerpo a cuerpo).' } },
    { id: 'huracan', name: 'Huracán', tier: 3, cost: 2600, from: ['celo', 'arco'], stats: { attackSpeed: 0.4, critChance: 0.25, moveSpeedPct: 0.07 },
      passive: { id: 'bolts', text: 'Vendaval: tus ataques a distancia disparan 2 rayos extra a enemigos cercanos (40% de daño).' } },
    { id: 'sombrero', name: 'Sombrero Mortal', tier: 3, cost: 3600, from: ['vara', 'vara', 'tomo'], stats: { ap: 120, apMult: 0.3 },
      passive: { id: 'apMult', text: 'Obra maestra: +30% de tu Poder de habilidad total.' } },
    { id: 'eco', name: 'Eco Multiversal', tier: 3, cost: 3000, from: ['capitulo', 'vara'], stats: { ap: 90, mana: 600, haste: 20 },
      passive: { id: 'echo', text: 'Eco: tu próxima habilidad que pegue hace 60 (+10% PH) de daño mágico extra (cada 6 s).' } },
    { id: 'egida', name: 'Égida Solar', tier: 3, cost: 2700, from: ['cinturon', 'cota'], stats: { hp: 450, armor: 45 },
      passive: { id: 'burn', text: 'Inmolación: quemás a los enemigos cerca tuyo (15 + 1,5 por nivel de daño mágico por segundo).' } },
    { id: 'espinas', name: 'Malla de Espinas', tier: 3, cost: 2700, from: ['cota', 'gema'], stats: { armor: 70, hp: 300 },
      passive: { id: 'thorns', text: 'Espinas: al recibir un ataque básico, devolvés 20 (+10% armadura adicional) de daño mágico.' } },
    { id: 'rostro', name: 'Rostro Espiritual', tier: 3, cost: 2900, from: ['negatron', 'gema'], stats: { hp: 400, mr: 55, haste: 10, hpRegen: 2 },
      passive: { id: 'spirit', text: 'Espíritu: tus curaciones y escudos recibidos son 25% más fuertes.' } }
  ];
  M.itemById = {};
  M.ITEMS.forEach(function (it) { M.itemById[it.id] = it; });
  // A qué objetos sirve cada componente (para el árbol de la tienda)
  M.ITEMS.forEach(function (it) { it.into = []; });
  M.ITEMS.forEach(function (it) { (it.from || []).forEach(function (f) { if (M.itemById[f].into.indexOf(it.id) < 0) M.itemById[f].into.push(it.id); }); });
  M.ITEMS.forEach(function (it) { it.combine = it.cost - (it.from || []).reduce(function (s, f) { return s + M.itemById[f].cost; }, 0); });

  const STAT_TEXT = {
    hp: ['Vida', ''], mana: ['Maná', ''], ad: ['Daño de ataque', ''], ap: ['Poder de habilidad', ''], armor: ['Armadura', ''], mr: ['Res. mágica', ''],
    attackSpeed: ['Vel. de ataque', '%'], critChance: ['Prob. de crítico', '%'], critDamage: ['Daño crítico', '%'], lifesteal: ['Robo de vida', '%'],
    haste: ['Aceleración', ''], moveSpeed: ['Velocidad', ''], moveSpeedPct: ['Velocidad', '%'], hpRegen: ['Regeneración de vida', '/s'], apMult: ['Poder total', '%']
  };
  /** Texto de estadísticas ("+25 Daño de ataque, +10 Aceleración"). */
  M.itemStatsText = function (it) {
    return Object.keys(it.stats).map(function (k) {
      const t = STAT_TEXT[k] || [k, ''];
      const v = t[1] === '%' ? Math.round(it.stats[k] * 100) : it.stats[k];
      return '+' + v + (t[1] === '%' ? '%' : '') + ' ' + t[0] + (t[1] === '/s' ? ' por s' : '');
    }).join(', ');
  };
  M.ITEMS.forEach(function (it) { it.desc = M.itemStatsText(it) + (it.passive ? '. ' + it.passive.text : ''); });

  /** Calcula una compra con la regla de LoL: qué componentes tuyos se consumen y cuánto se paga.
   *  Devuelve { cost, consume: [índices del inventario], slotsAfter }. */
  M.purchasePlan = function (items, id) {
    const it = M.itemById[id];
    const pool = items.map(function (x, i) { return { id: x, i: i, used: false }; });
    const consume = [];
    let cost = it.combine != null ? it.combine : it.cost;
    // busca recursivamente: si tenés el componente lo usás; si no, se "compra" (se suma su costo) y se buscan sus partes
    function need(cid, top) {
      if (!top) {
        const own = pool.find(function (p) { return !p.used && p.id === cid; });
        if (own) { own.used = true; consume.push(own.i); return; }
      }
      const c = M.itemById[cid];
      if (!top) cost += c.combine != null ? c.combine : c.cost;
      (c.from || []).forEach(function (f) { need(f, false); });
    }
    need(id, true);
    // corrección: arriba se sumó el combine de cada componente faltante y luego sus partes; el total queda bien
    return { cost: cost, consume: consume.sort(function (a, b) { return a - b; }), slotsAfter: items.length - consume.length + 1 };
  };
  /** ¿Ya tiene botas mejoradas o básicas? (solo se permite un par) */
  M.hasBoots = function (items) { return items.some(function (x) { return x === 'botas' || M.itemById[x].boots; }); };
  /** ¿El objeto `x` se arma (directa o indirectamente) con el componente `c`? */
  M.itemContains = function (x, c) {
    const it = M.itemById[x];
    return !!(it && it.from && it.from.some(function (f) { return f === c || M.itemContains(f, c); }));
  };
  M.isBoots = function (id) { return id === 'botas' || !!(M.itemById[id] && M.itemById[id].boots); };
  /** Valida una compra. Devuelve un texto de error o null. */
  M.canBuy = function (c, id, inShop) {
    const it = M.itemById[id];
    if (!it) return 'Objeto inexistente';
    if (!inShop) return 'Tenés que estar en la base para comprar';
    const plan = M.purchasePlan(c.items, id);
    if (M.isBoots(id) && M.hasBoots(c.items) && !plan.consume.some(function (i) { return M.isBoots(c.items[i]); })) return 'Ya tenés botas';
    if (plan.slotsAfter > M.MAX_ITEMS) return 'Inventario lleno';
    if (c.gold < plan.cost) return 'No te alcanza el oro';
    return null;
  };
  M.MAX_ITEMS = 6;
  M.SELL_RATIO = 0.7;

  // Recomendados por rol (los muestra la tienda) y rutas de compra de los bots (en orden de componentes → legendarios)
  M.RECOMMENDED = {
    Tanque: ['tabi', 'egida', 'espinas', 'rostro', 'mercurio', 'cuchilla'],
    Luchador: ['grebas', 'cuchilla', 'hidra', 'egida', 'mercurio', 'rostro'],
    Asesino: ['jonias', 'cuchilla', 'hidra', 'filo', 'eco', 'sombrero'],
    Mago: ['jonias', 'eco', 'sombrero', 'rostro', 'mercurio', 'egida'],
    Tirador: ['grebas', 'filo', 'huracan', 'hidra', 'tabi', 'rostro'],
    Soporte: ['jonias', 'capitulo', 'rostro', 'egida', 'eco', 'mercurio']
  };
  M.BOT_BUILDS = {
    Tanque: ['rubi', 'botas', 'tela', 'cinturon', 'cota', 'egida', 'tabi', 'gema', 'espinas', 'rostro'],
    Luchador: ['espada', 'botas', 'espada', 'martillo', 'gema', 'cuchilla', 'grebas', 'cetro', 'hidra', 'egida'],
    Asesino: ['espada', 'botas', 'espada', 'martillo', 'gema', 'cuchilla', 'jonias', 'cetro', 'hidra', 'filo'],
    Mago: ['tomo', 'botas', 'zafiro', 'capitulo', 'vara', 'eco', 'jonias', 'vara', 'sombrero', 'rostro'],
    Tirador: ['espada', 'daga', 'botas', 'pico', 'capa', 'filo', 'grebas', 'celo', 'huracan', 'hidra'],
    Soporte: ['zafiro', 'botas', 'tomo', 'capitulo', 'jonias', 'gema', 'rostro', 'cinturon', 'egida', 'eco']
  };
})(window.MOBA);
