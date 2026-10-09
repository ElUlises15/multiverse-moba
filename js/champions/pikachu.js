/* Campeón: Pikachu (Tirador) */
MOBA.registerChampion({
  id: 'pikachu',
  name: 'Pikachu',
  title: 'La Chispa Amarilla',
  role: 'Tirador',
  description: 'Ratoncito eléctrico veloz: dispara rayos, se lanza con Ataque Rápido y llama a un trueno devastador.',
  color: '#ffd629', accent: '#ff5a3a', shape: 'star',
  passive: { id: 'static', name: 'Electricidad Estática', desc: 'Cada 4º ataque básico hace 30 (+20% PH) de daño mágico extra y ralentiza 30%.' },
  skillOrder: [0, 2, 1],
  stats: { hp: 560, hpPerLevel: 95, mana: 330, manaPerLevel: 42, ad: 58, adPerLevel: 3.1, ap: 0, armor: 25, armorPerLevel: 4.2, mr: 30,
    attackRange: 550, attackSpeed: 0.66, attackSpeedPerLevel: 0.03, windup: 0.2, moveSpeed: 335, projectileSpeed: 2000 },
  abilities: [
    { name: 'Impactrueno', desc: 'Dispara un rayo que atraviesa enemigos, dañándolos y aturdiéndolos un instante.',
      cast: 'skillshot', range: 950, speed: 2200, width: 70, pierce: true, cd: [8, 7.5, 7, 6.5, 6], mana: [50, 55, 60, 65, 70], color: '#fff15a',
      damage: { base: [60, 100, 140, 180, 220], ad: 0.6, ap: 0.5 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: 0.3 }] },
    { name: 'Ataque Rápido', desc: 'Se lanza a toda velocidad dañando a quien atraviese, y gana velocidad de ataque.',
      cast: 'dash', range: 450, speed: 1900, hitAlongPath: true, radius: 90, cd: [14, 13, 12, 11, 10], mana: 40,
      damage: { base: [40, 65, 90, 115, 140], ad: 0.5 }, damageType: 'physical',
      selfEffects: [{ type: 'attackSpeed', amount: [0.25, 0.3, 0.35, 0.4, 0.45], duration: 3 }] },
    { name: 'Bola Voltio', desc: 'Lanza una bola eléctrica a un enemigo que daña y ralentiza.',
      cast: 'target', range: 600, cd: [11, 10, 9, 8, 7], mana: 50, color: '#ffe94a',
      damage: { base: [60, 95, 130, 165, 200], ap: 0.6, bonusAd: 0.4 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: [0.25, 0.3, 0.35, 0.4, 0.45], duration: 1.5 }] },
    { name: 'Trueno', desc: 'DEFINITIVA: Tras un instante, un trueno enorme cae en la zona: mucho daño y aturdimiento.',
      cast: 'area', range: 1000, radius: 375, delay: 0.75, cd: [100, 85, 70], mana: 100, color: '#fff7a0',
      damage: { base: [200, 325, 450], ad: 0.6, ap: 0.8 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1, 1.25, 1.5] }] }
  ]
});
