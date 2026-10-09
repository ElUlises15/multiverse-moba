/* Campeón: Zombie (Tanque) */
MOBA.registerChampion({
  id: 'zombie',
  name: 'Zombie',
  title: 'El Que No Se Queda Abajo',
  role: 'Tanque',
  description: 'Muerto viviente duro de matar: agarra enemigos, contagia a todos y vuelve a levantarse.',
  color: '#6f9a5a', accent: '#b7ff5a', shape: 'square',
  passive: { id: 'revive', name: 'Volver a Levantarse', desc: 'Al morir se vuelve a levantar con 30% de vida tras 2 s (cada 150 s).' },
  skillOrder: [2, 0, 1],
  stats: { hp: 690, hpPerLevel: 115, mana: 300, manaPerLevel: 40, ad: 62, adPerLevel: 3.2, armor: 38, armorPerLevel: 4.8, mr: 32, mrPerLevel: 1.5,
    attackRange: 150, attackSpeed: 0.62, windup: 0.3, moveSpeed: 330 },
  abilities: [
    { name: 'Agarre Putrefacto', desc: 'Estira el brazo: el primer enemigo alcanzado es arrastrado hacia el Zombie y aturdido.',
      cast: 'skillshot', range: 950, speed: 1600, width: 90, cd: [16, 15, 14, 13, 12], mana: [60, 65, 70, 75, 80],
      damage: { base: [70, 115, 160, 205, 250], ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'pull' }, { type: 'stun', duration: 0.6 }] },
    { name: 'No-Muerto', desc: 'Durante unos segundos no puede morir y se cura según la vida que le falta.',
      cast: 'self', cd: [24, 22, 20, 18, 16], mana: 50,
      selfEffects: [{ type: 'undying', amount: 1, duration: [2, 2.25, 2.5, 2.75, 3] }, { type: 'heal', amount: { base: [50, 80, 110, 140, 170], maxHp: 0.06 } }] },
    { name: 'Infección', desc: 'Contagia a los enemigos cercanos: daño en el tiempo y ralentización.',
      cast: 'self', radius: 325, cd: [9, 8.5, 8, 7.5, 7], mana: 40, color: '#9dff4a',
      damage: { base: [30, 50, 70, 90, 110], maxHp: 0.02 }, damageType: 'magic',
      effects: [{ type: 'dot', dps: { base: [12, 18, 24, 30, 36], maxHp: 0.005 }, duration: 3 }, { type: 'slow', amount: [0.2, 0.24, 0.28, 0.32, 0.36], duration: 2 }] },
    { name: 'La Horda', desc: 'DEFINITIVA: Una horda de manos sale del suelo en una zona: daña, ralentiza mucho y aturde al comienzo.',
      cast: 'area', range: 800, radius: 425, delay: 0.5, duration: 3, tick: 0.5, cd: [120, 105, 90], mana: 100, color: '#7aff3a',
      damage: { base: [40, 60, 80], ap: 0.15, maxHp: 0.01 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: 0.5, duration: 0.6 }, { type: 'stun', duration: 0.25 }] }
  ]
});
