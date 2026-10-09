/* Campeón: Ignis (Mago) */
MOBA.registerChampion({
  id: 'ignis',
  name: 'Ignis',
  title: 'El Hechicero de Brasas',
  role: 'Mago',
  description: 'Mago de fuego con mucho daño en área. Quema todo lo que toca.',
  color: '#ff6a1a', accent: '#ffd36b', shape: 'star',
  skillOrder: [0, 1, 2],
  stats: { hp: 570, hpPerLevel: 92, mana: 450, manaPerLevel: 30, ad: 52, adPerLevel: 3, armor: 20, armorPerLevel: 4.2, mr: 30, mrPerLevel: 1.3,
    attackRange: 525, attackSpeed: 0.625, attackSpeedPerLevel: 0.02, windup: 0.22, moveSpeed: 330, projectileSpeed: 1600, manaRegen: 2.4 },
  abilities: [
    { name: 'Bola de Fuego', desc: 'Dispara una bola de fuego que daña y quema al primer enemigo.',
      cast: 'skillshot', range: 1050, speed: 1400, width: 140, cd: [7, 6.5, 6, 5.5, 5], mana: [55, 60, 65, 70, 75],
      damage: { base: [80, 125, 170, 215, 260], ap: 0.75 }, damageType: 'magic',
      effects: [{ type: 'dot', dps: { base: [10, 15, 20, 25, 30], ap: 0.06 }, duration: 3 }] },
    { name: 'Pilar de Llamas', desc: 'Tras un instante, una columna de fuego daña y aturde en la zona.',
      cast: 'area', range: 900, radius: 200, delay: 0.75, cd: [13, 12, 11, 10, 9], mana: [70, 75, 80, 85, 90],
      damage: { base: [70, 110, 150, 190, 230], ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1, 1.1, 1.2, 1.3, 1.4] }] },
    { name: 'Combustión', desc: 'Explota en llamas, dañando y empujando a los enemigos cercanos.',
      cast: 'self', radius: 325, cd: [12, 11, 10, 9, 8], mana: 60,
      damage: { base: [60, 95, 130, 165, 200], ap: 0.5 }, damageType: 'magic',
      effects: [{ type: 'knockback', distance: 250 }] },
    { name: 'Meteoro', desc: 'DEFINITIVA: Invoca un meteoro gigante que cae sobre una gran área.',
      cast: 'area', range: 1300, radius: 400, delay: 1.1, cd: [110, 90, 70], mana: 100,
      damage: { base: [250, 375, 500], ap: 0.9 }, damageType: 'magic' }
  ]
});
