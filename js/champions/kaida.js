/* Campeón: Kaida (Luchador) */
MOBA.registerChampion({
  id: 'kaida',
  name: 'Kaida',
  title: 'La Hoja Carmesí',
  role: 'Luchador',
  description: 'Espadachina veloz que se cura con cada golpe y entra y sale de las peleas.',
  color: '#c23b5a', accent: '#ffd1dc', shape: 'diamond',
  skillOrder: [0, 2, 1],
  stats: { hp: 630, hpPerLevel: 105, mana: 300, manaPerLevel: 40, ad: 66, adPerLevel: 3.5, armor: 33, armorPerLevel: 4.2,
    attackRange: 175, attackSpeed: 0.69, attackSpeedPerLevel: 0.03, windup: 0.25, moveSpeed: 345 },
  abilities: [
    { name: 'Corte Doble', desc: 'Corta en línea recta frente a ella, dañando a todos los enemigos.',
      cast: 'line', range: 450, width: 160, cd: [7, 6.5, 6, 5.5, 5], mana: [30, 35, 40, 45, 50],
      damage: { base: [70, 110, 150, 190, 230], ad: 1.0 }, damageType: 'physical' },
    { name: 'Furia Carmesí', desc: 'Gana velocidad de ataque y robo de vida durante unos segundos.',
      cast: 'self', cd: [16, 15, 14, 13, 12], mana: 40,
      selfEffects: [{ type: 'attackSpeed', amount: [0.3, 0.4, 0.5, 0.6, 0.7], duration: 4 },
        { type: 'lifesteal', amount: [0.15, 0.18, 0.21, 0.24, 0.27], duration: 4 }] },
    { name: 'Paso Veloz', desc: 'Se desliza hacia una dirección dañando a quien atraviese.',
      cast: 'dash', range: 475, speed: 1500, hitAlongPath: true, radius: 100, cd: [12, 11, 10, 9, 8], mana: 40,
      damage: { base: [50, 80, 110, 140, 170], ad: 0.6 }, damageType: 'physical' },
    { name: 'Tormenta de Acero', desc: 'DEFINITIVA: Gira con sus espadas dañando a todos alrededor y curándose.',
      cast: 'self', radius: 400, cd: [100, 85, 70], mana: 100,
      damage: { base: [150, 275, 400], ad: 1.2 }, damageType: 'physical',
      selfEffects: [{ type: 'heal', amount: { base: [100, 175, 250], ad: 0.4 } }] }
  ]
});
