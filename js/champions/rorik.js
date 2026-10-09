/* Campeón: Rorik (Luchador) */
MOBA.registerChampion({
  id: 'rorik',
  name: 'Rorik',
  title: 'El Hacha del Norte',
  role: 'Luchador',
  description: 'Bárbaro brutal que salta sobre sus presas y remata a los heridos.',
  color: '#a8652a', accent: '#ffe0a3', shape: 'triangle',
  skillOrder: [0, 2, 1],
  stats: { hp: 660, hpPerLevel: 108, mana: 280, manaPerLevel: 40, ad: 68, adPerLevel: 3.8, armor: 34, armorPerLevel: 4.3,
    attackRange: 175, attackSpeed: 0.65, attackSpeedPerLevel: 0.028, windup: 0.3, moveSpeed: 340 },
  abilities: [
    { name: 'Hachazo Giratorio', desc: 'Gira su hacha dañando a todos los enemigos alrededor.',
      cast: 'self', radius: 325, cd: [8, 7.5, 7, 6.5, 6], mana: 35,
      damage: { base: [60, 100, 140, 180, 220], ad: 0.9 }, damageType: 'physical' },
    { name: 'Grito de Guerra', desc: 'Ruge: ralentiza a los enemigos cercanos y gana velocidad.',
      cast: 'self', radius: 450, cd: [14, 13, 12, 11, 10], mana: 45,
      effects: [{ type: 'slow', amount: [0.25, 0.3, 0.35, 0.4, 0.45], duration: 2 }],
      selfEffects: [{ type: 'haste', amount: 0.3, duration: 3 }] },
    { name: 'Salto Brutal', desc: 'Salta hacia una zona y daña a los enemigos al caer.',
      cast: 'dash', range: 700, speed: 1300, radius: 250, cd: [14, 13, 12, 11, 10], mana: 50,
      damage: { base: [60, 95, 130, 165, 200], ad: 0.7 }, damageType: 'physical' },
    { name: 'Ejecución', desc: 'DEFINITIVA: Golpe devastador a un enemigo; hace más daño cuanta menos vida le quede.',
      cast: 'target', range: 400, cd: [100, 80, 60], mana: 100,
      damage: { base: [175, 300, 425], ad: 1.0 }, damageType: 'physical', executeBonus: 1.0 }
  ]
});
