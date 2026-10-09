/* Objetos de la tienda (costos y estadísticas inspirados en LoL, sin recetas) */
(function (M) {
  'use strict';
  // stats posibles: hp, mana, ad, ap, apMult, armor, mr, attackSpeed (fracción), critChance, critDamage,
  //                 lifesteal, haste (aceleración de habilidades), moveSpeed, hpRegen, manaRegen (por segundo)
  M.ITEMS = [
    { id: 'espada', name: 'Espada Larga', cost: 350, stats: { ad: 10 }, desc: '+10 Daño de ataque' },
    { id: 'tomo', name: 'Tomo Amplificador', cost: 400, stats: { ap: 20 }, desc: '+20 Poder de habilidad' },
    { id: 'tela', name: 'Armadura de Tela', cost: 300, stats: { armor: 15 }, desc: '+15 Armadura' },
    { id: 'manto', name: 'Manto Antimagia', cost: 450, stats: { mr: 25 }, desc: '+25 Resistencia mágica' },
    { id: 'rubi', name: 'Cristal de Rubí', cost: 400, stats: { hp: 150 }, desc: '+150 Vida' },
    { id: 'zafiro', name: 'Cristal de Zafiro', cost: 350, stats: { mana: 250 }, desc: '+250 Maná' },
    { id: 'daga', name: 'Daga', cost: 300, stats: { attackSpeed: 0.12 }, desc: '+12% Velocidad de ataque' },
    { id: 'capa', name: 'Capa de Agilidad', cost: 600, stats: { critChance: 0.15 }, desc: '+15% Probabilidad de crítico' },
    { id: 'botas', name: 'Botas', cost: 300, stats: { moveSpeed: 25 }, desc: '+25 Velocidad de movimiento' },
    { id: 'cetro', name: 'Cetro Vampírico', cost: 900, stats: { ad: 15, lifesteal: 0.07 }, desc: '+15 Daño de ataque, +7% Robo de vida' },
    { id: 'capitulo', name: 'Capítulo Perdido', cost: 1200, stats: { ap: 40, mana: 300, haste: 10 }, desc: '+40 Poder, +300 Maná, +10 Aceleración' },
    { id: 'grebas', name: 'Grebas del Berserker', cost: 1100, stats: { attackSpeed: 0.35, moveSpeed: 45 }, desc: '+35% Vel. de ataque, +45 Velocidad' },
    { id: 'jonias', name: 'Botas Jonias', cost: 900, stats: { haste: 20, moveSpeed: 45 }, desc: '+20 Aceleración, +45 Velocidad' },
    { id: 'cuchilla', name: 'Cuchilla Negra', cost: 3000, stats: { ad: 40, hp: 400, haste: 20 }, desc: '+40 Daño, +400 Vida, +20 Aceleración' },
    { id: 'filo', name: 'Filo del Infinito', cost: 3400, stats: { ad: 65, critChance: 0.25, critDamage: 0.4 }, desc: '+65 Daño, +25% Crítico, +40% daño crítico' },
    { id: 'sombrero', name: 'Sombrero Mortal', cost: 3600, stats: { ap: 120, apMult: 0.3 }, desc: '+120 Poder y +30% de Poder total' },
    { id: 'egida', name: 'Égida Solar', cost: 2700, stats: { hp: 450, armor: 45 }, desc: '+450 Vida, +45 Armadura' },
    { id: 'rostro', name: 'Rostro Espiritual', cost: 2900, stats: { hp: 400, mr: 55, haste: 10, hpRegen: 2 }, desc: '+400 Vida, +55 Res. mágica, +10 Aceleración' }
  ];
  M.itemById = {};
  M.ITEMS.forEach(function (it) { M.itemById[it.id] = it; });
  M.MAX_ITEMS = 6;
  M.SELL_RATIO = 0.7;
  // Orden de compra de los bots según el rol
  M.BOT_BUILDS = {
    Tanque: ['rubi', 'botas', 'tela', 'egida', 'jonias', 'rostro'],
    Luchador: ['espada', 'botas', 'cetro', 'cuchilla', 'grebas', 'egida'],
    Mago: ['tomo', 'botas', 'capitulo', 'sombrero', 'jonias', 'rostro'],
    Tirador: ['espada', 'daga', 'cetro', 'grebas', 'filo', 'capa'],
    Soporte: ['zafiro', 'botas', 'capitulo', 'jonias', 'rostro', 'egida']
  };
})(window.MOBA);
