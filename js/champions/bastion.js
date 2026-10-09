/* Campeón: Bastión (Tanque) */
MOBA.registerChampion({
  id: 'bastion',
  name: 'Bastión',
  title: 'El Escudo del Alba',
  role: 'Tanque',
  description: 'Caballero de armadura pesada que protege a sus aliados y encierra a los enemigos.',
  color: '#5b6f9a', accent: '#f0d98a', shape: 'hexagon',
  skillOrder: [0, 2, 1],
  stats: { hp: 640, hpPerLevel: 108, mana: 350, manaPerLevel: 50, ad: 64, adPerLevel: 3.5, armor: 36, armorPerLevel: 4.7, mr: 32, mrPerLevel: 2,
    attackRange: 150, attackSpeed: 0.65, attackSpeedPerLevel: 0.025, windup: 0.3, moveSpeed: 340, hpRegen: 1.7 },
  abilities: [
    { name: 'Golpe de Escudo', desc: 'Golpea con el escudo a un enemigo cercano, dañándolo y aturdiéndolo.',
      cast: 'target', range: 350, cd: [10, 9.5, 9, 8.5, 8], mana: 50,
      damage: { base: [60, 95, 130, 165, 200], ad: 0.6 }, damageType: 'physical',
      effects: [{ type: 'stun', duration: [1, 1.1, 1.2, 1.3, 1.4] }] },
    { name: 'Muralla de Fe', desc: 'Otorga un escudo a sí mismo y a los aliados cercanos.',
      cast: 'self', allyRadius: 700, cd: [18, 17, 16, 15, 14], mana: [70, 75, 80, 85, 90],
      allyEffects: [{ type: 'shield', amount: { base: [60, 90, 120, 150, 180], maxHp: 0.05 }, duration: 3 }] },
    { name: 'Carga', desc: 'Embiste hacia adelante, dañando y empujando a los enemigos en el camino.',
      cast: 'dash', range: 650, speed: 1400, hitAlongPath: true, radius: 110, cd: [14, 13, 12, 11, 10], mana: 60,
      damage: { base: [55, 90, 125, 160, 195], ad: 0.5 }, damageType: 'physical',
      effects: [{ type: 'knockback', distance: 300 }] },
    { name: 'Juramento Inquebrantable', desc: 'DEFINITIVA: Aturde a los enemigos alrededor y gana un enorme escudo.',
      cast: 'self', radius: 450, cd: [130, 110, 90], mana: 100,
      damage: { base: [150, 250, 350], maxHp: 0.06 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1.25, 1.5, 1.75] }],
      selfEffects: [{ type: 'shield', amount: { base: [200, 300, 400], maxHp: 0.12 }, duration: 4 }] }
  ]
});
