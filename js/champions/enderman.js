/* Campeón: Enderman (Asesino), inspirado en Minecraft */
MOBA.registerChampion({
  id: 'enderman',
  name: 'Enderman',
  title: 'El Que Te Mira Desde el Vacío',
  role: 'Asesino',
  description: 'Criatura alta del Fin que se teletransporta, tira bloques y debilita a quien lo mira.',
  color: '#1c1426', accent: '#d36bff', shape: 'diamond',
  skillOrder: [0, 2, 1],
  stats: { hp: 600, hpPerLevel: 98, mana: 300, manaPerLevel: 40, ad: 64, adPerLevel: 3.5, armor: 30, armorPerLevel: 4.3, mr: 32,
    attackRange: 175, attackSpeed: 0.67, attackSpeedPerLevel: 0.028, windup: 0.25, moveSpeed: 350 },
  abilities: [
    { name: 'Teletransporte', desc: 'Desaparece y reaparece en el lugar marcado, dañando a los enemigos donde aparece.',
      cast: 'dash', blink: true, range: 475, radius: 200, cd: [10, 9, 8, 7, 6], mana: [40, 45, 50, 55, 60],
      damage: { base: [60, 95, 130, 165, 200], bonusAd: 0.7 }, damageType: 'physical' },
    { name: 'Bloque Lanzado', desc: 'Arroja un bloque que daña y ralentiza al primer enemigo.',
      cast: 'skillshot', range: 850, speed: 1500, width: 80, cd: [8, 7.5, 7, 6.5, 6], mana: 40, color: '#8a6a4a',
      damage: { base: [70, 110, 150, 190, 230], bonusAd: 0.9 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: [0.3, 0.35, 0.4, 0.45, 0.5], duration: 1.5 }] },
    { name: 'Mirada del Fin', desc: 'Clava la mirada en un enemigo: le baja la armadura y la resistencia mágica y lo deja paralizado un instante.',
      cast: 'target', range: 650, cd: [14, 13, 12, 11, 10], mana: 50,
      damage: { base: [30, 50, 70, 90, 110], bonusAd: 0.3 }, damageType: 'magic',
      effects: [{ type: 'armorShred', amount: [0.15, 0.18, 0.21, 0.24, 0.27], duration: 4 }, { type: 'stun', duration: 0.5 }] },
    { name: 'Robo del Vacío', desc: 'DEFINITIVA: Se teletransporta junto al campeón enemigo más cercano al cursor y le asesta un golpe que hace más daño cuanta menos vida tenga.',
      cast: 'target', blinkToTarget: true, championsOnly: true, range: 750, cd: [100, 80, 60], mana: 100,
      damage: { base: [150, 250, 350], bonusAd: 1.0 }, damageType: 'physical', executeBonus: 1.0 }
  ]
});
