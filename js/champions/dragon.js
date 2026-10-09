/* Campeón: Dragón (Mago) */
MOBA.registerChampion({
  id: 'dragon',
  name: 'Dragón',
  title: 'La Llama de los Cielos',
  role: 'Mago',
  description: 'Dragón antiguo que quema todo con su aliento, vuela sobre la batalla y hace llover meteoros.',
  color: '#b8322a', accent: '#ffb347', shape: 'triangle',
  skillOrder: [0, 2, 1],
  stats: { hp: 590, hpPerLevel: 100, mana: 400, manaPerLevel: 48, ad: 54, adPerLevel: 3, armor: 24, armorPerLevel: 4.3, mr: 30,
    attackRange: 525, attackSpeed: 0.63, windup: 0.25, moveSpeed: 335, projectileSpeed: 1500 },
  abilities: [
    { name: 'Aliento de Fuego', desc: 'Escupe un cono de fuego que daña y deja quemaduras.',
      cast: 'cone', range: 650, angle: 50, cd: [7, 6.5, 6, 5.5, 5], mana: [60, 65, 70, 75, 80], color: '#ff7a1a',
      damage: { base: [70, 110, 150, 190, 230], ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'dot', dps: { base: [10, 15, 20, 25, 30], ap: 0.05 }, duration: 3 }] },
    { name: 'Vuelo', desc: 'Levanta vuelo hacia una dirección, pasando por encima de las paredes, y gana velocidad.',
      cast: 'dash', blink: true, flight: true, range: 550, cd: [20, 18, 16, 14, 12], mana: 70,
      selfEffects: [{ type: 'haste', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 2 }] },
    { name: 'Escamas Ígneas', desc: 'Sus escamas se encienden: gana un escudo y quema a los enemigos cercanos.',
      cast: 'self', radius: 300, cd: [14, 13, 12, 11, 10], mana: 60, color: '#ffcf4a',
      damage: { base: [40, 60, 80, 100, 120], ap: 0.3 }, damageType: 'magic',
      selfEffects: [{ type: 'shield', amount: { base: [70, 105, 140, 175, 210], ap: 0.4 }, duration: 3 }] },
    { name: 'Lluvia de Meteoros', desc: 'DEFINITIVA: Invoca meteoros en una gran zona que golpean varias veces y aturden al primer impacto.',
      cast: 'area', range: 1100, radius: 450, delay: 0.8, duration: 2.5, tick: 0.5, cd: [120, 100, 80], mana: 100, color: '#ff4a1a',
      damage: { base: [60, 95, 130], ap: 0.2 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: 0.4 }] }
  ]
});
