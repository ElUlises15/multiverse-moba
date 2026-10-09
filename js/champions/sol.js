/* Campeón: Sol (Soporte) */
MOBA.registerChampion({
  id: 'sol',
  name: 'Sol',
  title: 'La Sacerdotisa Radiante',
  role: 'Soporte',
  description: 'Sacerdotisa de luz que cura y protege a sus aliados y aturde a los enemigos.',
  color: '#ffcf3f', accent: '#fffbe0', shape: 'circle',
  skillOrder: [1, 0, 2],
  stats: { hp: 580, hpPerLevel: 90, mana: 450, manaPerLevel: 30, ad: 52, adPerLevel: 3, ap: 0, armor: 24, armorPerLevel: 4.2,
    attackRange: 525, attackSpeed: 0.625, attackSpeedPerLevel: 0.02, windup: 0.22, moveSpeed: 335, projectileSpeed: 1600, manaRegen: 2.4 },
  abilities: [
    { name: 'Rayo de Luz', desc: 'Dispara un rayo de luz que daña y aturde al primer enemigo.',
      cast: 'skillshot', range: 1100, speed: 1300, width: 140, cd: [14, 13, 12, 11, 10], mana: [60, 65, 70, 75, 80],
      damage: { base: [60, 100, 140, 180, 220], ap: 0.5 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1.2, 1.3, 1.4, 1.5, 1.6] }] },
    { name: 'Bendición', desc: 'Cura a sí misma y a los aliados cercanos.',
      cast: 'self', allyRadius: 700, cd: [12, 11.5, 11, 10.5, 10], mana: [70, 75, 80, 85, 90],
      allyEffects: [{ type: 'heal', amount: { base: [60, 85, 110, 135, 160], ap: 0.35 } }] },
    { name: 'Escudo Solar', desc: 'Protege a sí misma y a los aliados cercanos con un escudo.',
      cast: 'self', allyRadius: 700, cd: [14, 13, 12, 11, 10], mana: 60,
      allyEffects: [{ type: 'shield', amount: { base: [60, 90, 120, 150, 180], ap: 0.4 }, duration: 3 }] },
    { name: 'Amanecer', desc: 'DEFINITIVA: Estalla en luz: daña a los enemigos y cura mucho a los aliados.',
      cast: 'self', radius: 650, allyRadius: 800, cd: [130, 115, 100], mana: 100,
      damage: { base: [150, 225, 300], ap: 0.6 }, damageType: 'magic',
      allyEffects: [{ type: 'heal', amount: { base: [150, 250, 350], ap: 0.5 } }] }
  ]
});
