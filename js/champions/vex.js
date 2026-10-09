/* Campeón: Vex (Tirador) */
MOBA.registerChampion({
  id: 'vex',
  name: 'Vex',
  title: 'La Arquera Errante',
  role: 'Tirador',
  description: 'Arquera de largo alcance que castiga desde lejos y se escapa con piruetas.',
  color: '#3fbf6a', accent: '#d6ffd9', shape: 'triangle',
  skillOrder: [0, 1, 2],
  stats: { hp: 600, hpPerLevel: 94, mana: 320, manaPerLevel: 40, ad: 60, adPerLevel: 2.8, armor: 26, armorPerLevel: 4.2,
    attackRange: 550, attackSpeed: 0.658, attackSpeedPerLevel: 0.033, windup: 0.18, moveSpeed: 330, projectileSpeed: 2000 },
  abilities: [
    { name: 'Flecha Perforante', desc: 'Dispara una flecha de largo alcance que atraviesa a todos los enemigos.',
      cast: 'skillshot', range: 1200, speed: 2000, width: 120, pierce: true, cd: [9, 8, 7, 6, 5], mana: [40, 45, 50, 55, 60],
      damage: { base: [20, 55, 90, 125, 160], ad: 1.1 }, damageType: 'physical' },
    { name: 'Concentración', desc: 'Aumenta mucho su velocidad de ataque durante unos segundos.',
      cast: 'self', cd: [16, 15, 14, 13, 12], mana: 40,
      selfEffects: [{ type: 'attackSpeed', amount: [0.3, 0.4, 0.5, 0.6, 0.7], duration: 4 }] },
    { name: 'Voltereta', desc: 'Rueda rápidamente hacia una dirección y gana velocidad.',
      cast: 'dash', range: 300, speed: 1500, cd: [14, 12, 10, 8, 6], mana: 30,
      selfEffects: [{ type: 'haste', amount: 0.3, duration: 1.5 }] },
    { name: 'Lluvia de Flechas', desc: 'DEFINITIVA: Una lluvia de flechas castiga una zona durante 3 segundos.',
      cast: 'area', range: 1100, radius: 400, delay: 0.25, duration: 3, tick: 0.5, cd: [100, 85, 70], mana: 100,
      damage: { base: [40, 60, 80], ad: 0.25 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: 0.3, duration: 0.6 }] }
  ]
});
