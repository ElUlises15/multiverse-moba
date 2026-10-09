/* Campeón: Bolt (Tirador) */
MOBA.registerChampion({
  id: 'bolt',
  name: 'Bolt',
  title: 'El Artillero Mecánico',
  role: 'Tirador',
  description: 'Robot artillero con disparos potentes y un cañón orbital que cruza el mapa.',
  color: '#c9b037', accent: '#fff6c2', shape: 'square',
  skillOrder: [0, 1, 2],
  stats: { hp: 610, hpPerLevel: 96, mana: 320, manaPerLevel: 40, ad: 59, adPerLevel: 3, armor: 27, armorPerLevel: 4.2,
    attackRange: 525, attackSpeed: 0.625, attackSpeedPerLevel: 0.03, windup: 0.2, moveSpeed: 325, projectileSpeed: 2000 },
  abilities: [
    { name: 'Disparo Cargado', desc: 'Dispara un proyectil potente que daña al primer enemigo.',
      cast: 'skillshot', range: 1150, speed: 2000, width: 120, cd: [9, 8.5, 8, 7.5, 7], mana: 50,
      damage: { base: [40, 80, 120, 160, 200], ad: 1.2 }, damageType: 'physical' },
    { name: 'Granada Pegajosa', desc: 'Lanza una granada que explota, dañando y ralentizando mucho.',
      cast: 'area', range: 900, radius: 225, delay: 0.6, cd: [14, 13, 12, 11, 10], mana: 60,
      damage: { base: [50, 85, 120, 155, 190], ad: 0.5 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: [0.3, 0.35, 0.4, 0.45, 0.5], duration: 2 }] },
    { name: 'Propulsores', desc: 'Activa los propulsores y gana mucha velocidad de movimiento.',
      cast: 'self', cd: [18, 17, 16, 15, 14], mana: 40,
      selfEffects: [{ type: 'haste', amount: [0.3, 0.35, 0.4, 0.45, 0.5], duration: 2.5 }] },
    { name: 'Cañón Orbital', desc: 'DEFINITIVA: Tras una breve carga, un rayo gigante atraviesa medio mapa.',
      cast: 'line', range: 3000, width: 200, delay: 0.8, cd: [120, 100, 80], mana: 100,
      damage: { base: [250, 400, 550], ad: 1.3 }, damageType: 'physical' }
  ]
});
