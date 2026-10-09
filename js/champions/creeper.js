/* Campeón: Creeper (Asesino), inspirado en Minecraft */
MOBA.registerChampion({
  id: 'creeper',
  name: 'Creeper',
  title: 'El Silencio Antes del Boom',
  role: 'Asesino',
  description: 'Se acerca sin hacer ruido y explota. Su explosión le cuesta vida, pero reaparece rápido.',
  color: '#4caf3a', accent: '#e8ffd0', shape: 'square',
  passive: { id: 'quickRespawn', name: 'Pólvora Inestable', desc: 'Reaparece 35% más rápido.' },
  skillOrder: [1, 0, 2],
  stats: { hp: 580, hpPerLevel: 95, mana: 320, manaPerLevel: 40, ad: 60, adPerLevel: 3.3, ap: 0, armor: 28, armorPerLevel: 4.2, mr: 30,
    attackRange: 150, attackSpeed: 0.66, windup: 0.25, moveSpeed: 345 },
  abilities: [
    { name: 'Siseo Sigiloso', desc: 'Se vuelve invisible y gana velocidad. Atacar o lanzar una habilidad lo revela.',
      cast: 'self', cd: [18, 17, 16, 15, 14], mana: 50,
      selfEffects: [{ type: 'stealth', amount: 1, duration: [3, 3.25, 3.5, 3.75, 4] }, { type: 'haste', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 3 }] },
    { name: '¡Ssss... BUM!', desc: 'Explota alrededor causando mucho daño. Le cuesta 10% de su vida actual.',
      cast: 'self', radius: 325, cd: [9, 8.5, 8, 7.5, 7], mana: 40, selfDamage: 0.1, color: '#ffffff',
      damage: { base: [90, 140, 190, 240, 290], bonusAd: 0.8, ap: 0.6 }, damageType: 'magic',
      effects: [{ type: 'knockback', distance: 150 }] },
    { name: 'Salto de Pólvora', desc: 'Salta hacia una dirección y deja pólvora que ralentiza al caer.',
      cast: 'dash', range: 500, speed: 1400, radius: 200, cd: [14, 13, 12, 11, 10], mana: 45,
      damage: { base: [50, 75, 100, 125, 150], bonusAd: 0.5 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: 0.35, duration: 1.5 }] },
    { name: 'Creeper Cargado', desc: 'DEFINITIVA: Se carga de electricidad y, tras un instante, explota en una zona enorme. Le cuesta 25% de su vida actual.',
      cast: 'area', range: 250, radius: 550, delay: 1.1, cd: [100, 85, 70], mana: 100, selfDamage: 0.25, color: '#7fd8ff',
      damage: { base: [250, 400, 550], bonusAd: 1.2, ap: 0.9 }, damageType: 'magic',
      effects: [{ type: 'knockback', distance: 300 }, { type: 'stun', duration: 0.5 }] }
  ]
});
