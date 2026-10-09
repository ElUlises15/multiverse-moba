/* Campeón: T-Rex (Luchador) */
MOBA.registerChampion({
  id: 'trex',
  name: 'T-Rex',
  title: 'El Rey del Cretácico',
  role: 'Luchador',
  description: 'Bestia prehistórica que muerde para curarse, aterroriza con su rugido y embiste sin frenar.',
  color: '#5f8f3a', accent: '#ffcf4a', shape: 'pentagon',
  skillOrder: [0, 2, 1],
  stats: { hp: 660, hpPerLevel: 110, mana: 280, manaPerLevel: 38, ad: 68, adPerLevel: 3.6, armor: 34, armorPerLevel: 4.5, mr: 32,
    attackRange: 175, attackSpeed: 0.64, attackSpeedPerLevel: 0.025, windup: 0.3, moveSpeed: 340 },
  abilities: [
    { name: 'Mordisco', desc: 'Muerde al enemigo más cercano al cursor y se cura una parte del daño. Cura el doble contra campeones con poca vida.',
      cast: 'target', range: 275, cd: [8, 7.5, 7, 6.5, 6], mana: [30, 35, 40, 45, 50],
      damage: { base: [70, 110, 150, 190, 230], bonusAd: 1.1 }, damageType: 'physical', executeBonus: 0.5,
      selfEffects: [{ type: 'heal', amount: { base: [30, 45, 60, 75, 90], bonusAd: 0.3 } }] },
    { name: 'Rugido Ancestral', desc: 'Ruge y hace huir de miedo a los enemigos cercanos.',
      cast: 'self', radius: 375, cd: [16, 15, 14, 13, 12], mana: 60,
      damage: { base: [40, 65, 90, 115, 140], ad: 0.4 }, damageType: 'physical',
      effects: [{ type: 'fear', duration: [1, 1.1, 1.2, 1.3, 1.4] }] },
    { name: 'Embestida', desc: 'Carga hacia una dirección, arrollando y empujando a los enemigos en el camino.',
      cast: 'dash', range: 600, speed: 1300, hitAlongPath: true, radius: 120, cd: [14, 13, 12, 11, 10], mana: 45,
      damage: { base: [60, 95, 130, 165, 200], bonusAd: 0.8 }, damageType: 'physical',
      effects: [{ type: 'knockback', distance: 200 }] },
    { name: 'Furia Jurásica', desc: 'DEFINITIVA: Crece, gana velocidad de ataque, velocidad y robo de vida, y aplasta a los enemigos alrededor.',
      cast: 'self', radius: 450, cd: [110, 95, 80], mana: 100,
      damage: { base: [150, 250, 350], bonusAd: 0.9 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: 0.4, duration: 1.5 }],
      selfEffects: [{ type: 'attackSpeed', amount: [0.4, 0.6, 0.8], duration: 8 }, { type: 'haste', amount: 0.2, duration: 8 },
        { type: 'lifesteal', amount: [0.15, 0.2, 0.25], duration: 8 }, { type: 'grow', amount: 0.35, duration: 8 }] }
  ]
});
