/* Campeón: Mora (Soporte) */
MOBA.registerChampion({
  id: 'mora',
  name: 'Mora',
  title: 'La Chamana del Bosque',
  role: 'Soporte',
  description: 'Chamana de la naturaleza que inmoviliza enemigos y acelera a su equipo.',
  color: '#3c9a5f', accent: '#c7f5a8', shape: 'hexagon',
  skillOrder: [0, 1, 2],
  stats: { hp: 590, hpPerLevel: 92, mana: 430, manaPerLevel: 30, ad: 51, adPerLevel: 3, armor: 25, armorPerLevel: 4.2,
    attackRange: 500, attackSpeed: 0.625, attackSpeedPerLevel: 0.02, windup: 0.22, moveSpeed: 335, projectileSpeed: 1600, manaRegen: 2.4 },
  abilities: [
    { name: 'Raíces Trepadoras', desc: 'Lanza raíces que dañan e inmovilizan al primer enemigo.',
      cast: 'skillshot', range: 1100, speed: 1200, width: 140, cd: [13, 12.5, 12, 11.5, 11], mana: [60, 65, 70, 75, 80],
      damage: { base: [60, 100, 140, 180, 220], ap: 0.5 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1.25, 1.5, 1.75, 2, 2.25] }] },
    { name: 'Savia Curativa', desc: 'Cura a sí misma y a los aliados cercanos.',
      cast: 'self', allyRadius: 700, cd: [13, 12.5, 12, 11.5, 11], mana: 65,
      allyEffects: [{ type: 'heal', amount: { base: [55, 80, 105, 130, 155], ap: 0.3 } }] },
    { name: 'Viento Ágil', desc: 'Otorga velocidad de movimiento a sí misma y a los aliados cercanos.',
      cast: 'self', allyRadius: 700, cd: [16, 15, 14, 13, 12], mana: 50,
      allyEffects: [{ type: 'haste', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 2.5 }] },
    { name: 'Bosque Ancestral', desc: 'DEFINITIVA: Hace crecer un bosque que daña y ralentiza enemigos y cura aliados.',
      cast: 'area', range: 900, radius: 450, delay: 0.4, duration: 5, tick: 0.5, cd: [130, 115, 100], mana: 100,
      damage: { base: [20, 30, 40], ap: 0.08 }, damageType: 'magic',
      effects: [{ type: 'slow', amount: 0.35, duration: 0.6 }],
      allyEffects: [{ type: 'heal', amount: { base: [20, 30, 40], ap: 0.08 } }] }
  ]
});
