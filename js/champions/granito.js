/* Campeón: Granito (Tanque). Valores en arreglos = por rango de habilidad (Q/W/E: 5 rangos, R: 3). */
MOBA.registerChampion({
  id: 'granito',
  name: 'Granito',
  title: 'El Gólem de la Cantera',
  role: 'Tanque',
  description: 'Un gólem de piedra milenaria que aguanta todo y frena a los enemigos con temblores.',
  color: '#8a7f72', accent: '#e3d3a8', shape: 'square',
  skillOrder: [0, 2, 1],
  stats: { hp: 650, hpPerLevel: 104, mana: 340, manaPerLevel: 50, ad: 62, adPerLevel: 3.5, armor: 38, armorPerLevel: 4.5, mr: 32, mrPerLevel: 2,
    attackRange: 125, attackSpeed: 0.625, attackSpeedPerLevel: 0.022, windup: 0.3, moveSpeed: 335, hpRegen: 1.7 },
  abilities: [
    { name: 'Roca Lanzada', desc: 'Lanza una roca en línea recta que daña y ralentiza al primer enemigo.',
      cast: 'skillshot', range: 1100, speed: 1300, width: 140, cd: [10, 9.5, 9, 8.5, 8], mana: [60, 65, 70, 75, 80],
      damage: { base: [70, 115, 160, 205, 250], ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: [0.25, 0.3, 0.35, 0.4, 0.45], duration: 2 }] },
    { name: 'Piel de Piedra', desc: 'Se cubre de piedra: gana un escudo y armadura extra por unos segundos.',
      cast: 'self', cd: [16, 15, 14, 13, 12], mana: 60,
      selfEffects: [{ type: 'shield', amount: { base: [70, 100, 130, 160, 190], maxHp: 0.08 }, duration: 3 },
        { type: 'armor', amount: [20, 25, 30, 35, 40], duration: 4 }] },
    { name: 'Temblor', desc: 'Golpea el suelo, dañando y ralentizando a los enemigos cercanos.',
      cast: 'self', radius: 350, cd: [9, 8.5, 8, 7.5, 7], mana: [45, 50, 55, 60, 65],
      damage: { base: [60, 95, 130, 165, 200], ap: 0.4, maxHp: 0.03 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: 0.3, duration: 2 }] },
    { name: 'Avalancha', desc: 'DEFINITIVA: Salta hacia una zona y aturde a todos los enemigos al caer.',
      cast: 'dash', range: 800, speed: 1500, radius: 375, cd: [120, 100, 80], mana: 100,
      damage: { base: [200, 300, 400], ap: 0.8 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1.25, 1.5, 1.75] }] }
  ]
});
