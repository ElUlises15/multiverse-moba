/* Campeón: Lyra (Mago) */
MOBA.registerChampion({
  id: 'lyra',
  name: 'Lyra',
  title: 'La Tejedora de Escarcha',
  role: 'Mago',
  description: 'Maga de hielo que controla el campo con ralentizaciones y congelamientos.',
  color: '#4fb4ff', accent: '#e0f6ff', shape: 'pentagon',
  skillOrder: [0, 1, 2],
  stats: { hp: 560, hpPerLevel: 90, mana: 480, manaPerLevel: 28, ad: 50, adPerLevel: 3, armor: 20, armorPerLevel: 4.2, mr: 30, mrPerLevel: 1.3,
    attackRange: 550, attackSpeed: 0.625, attackSpeedPerLevel: 0.02, windup: 0.22, moveSpeed: 330, projectileSpeed: 1700, manaRegen: 2.4 },
  abilities: [
    { name: 'Lanza de Hielo', desc: 'Lanza de hielo que atraviesa enemigos, dañándolos y ralentizándolos.',
      cast: 'skillshot', range: 1100, speed: 1700, width: 120, pierce: true, cd: [8, 7.5, 7, 6.5, 6], mana: [60, 65, 70, 75, 80],
      damage: { base: [70, 110, 150, 190, 230], ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 1.5 }] },
    { name: 'Prisión Glacial', desc: 'Congela una zona tras un instante, aturdiendo a los enemigos.',
      cast: 'area', range: 850, radius: 175, delay: 0.6, cd: [14, 13, 12, 11, 10], mana: 70,
      damage: { base: [60, 90, 120, 150, 180], ap: 0.4 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1.2, 1.3, 1.4, 1.5, 1.6] }] },
    { name: 'Parpadeo Arcano', desc: 'Se teletransporta una corta distancia y gana velocidad.',
      cast: 'dash', blink: true, range: 450, cd: [20, 18, 16, 14, 12], mana: 60,
      selfEffects: [{ type: 'haste', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 1.5 }] },
    { name: 'Ventisca', desc: 'DEFINITIVA: Crea una tormenta de nieve que daña y ralentiza constantemente.',
      cast: 'area', range: 1000, radius: 450, delay: 0.3, duration: 4, tick: 0.5, cd: [120, 100, 80], mana: 100,
      damage: { base: [30, 45, 60], ap: 0.12 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: 0.4, duration: 0.6 }] }
  ]
});
