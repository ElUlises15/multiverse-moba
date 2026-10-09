/* Entidades: unidades genéricas, campeones, súbditos, torres, nexos y monstruos.
 * Todas las distancias y velocidades están en unidades de LoL. */
(function (M) {
  'use strict';
  const U = M.util;
  let NEXT_ID = 1;

  class Unit {
    constructor(o) {
      this.id = NEXT_ID++;
      this.team = 0; this.type = 'minion'; this.name = '';
      this.x = 0; this.y = 0; this.px = 0; this.py = 0; this.vx = 0; this.vy = 0; this.radius = 48;
      this.maxHp = 100; this.hp = 100; this.maxMana = 0; this.mana = 0;
      this.ad = 10; this.ap = 0; this.armor = 0; this.mr = 0;
      this.attackRange = 100; this.attackSpeed = 1; this.bonusAS = 0; this.moveSpeed = 325;
      this.windupFrac = 0.25; this.windup = null; this.projectileSpeed = 1500;
      this.critChance = 0; this.critDamage = 1.75; this.lifesteal = 0;
      this.hpRegen = 0; this.manaRegen = 0;
      this.ranged = false; this.projectileColor = '#ffffff';
      this.attackCd = 0; this.target = null; this.moveTarget = null;
      this.buffs = []; this.dead = false; this.knock = null; this.dash = null;
      this.facing = 0; this.flash = 0; this.lastDamagers = {}; this.isStatic = false;
      this.vulnerable = true; this.lastHurt = -99; this.lastCombat = -99;
      Object.assign(this, o || {});
      this.px = this.x; this.py = this.y;
    }
    hasBuff(t) { for (const b of this.buffs) if (b.type === t) return true; return false; }
    buffSum(t) { let s = 0; for (const b of this.buffs) if (b.type === t) s += b.amount; return s; }
    buffMax(t) { let s = 0; for (const b of this.buffs) if (b.type === t && b.amount > s) s = b.amount; return s; }
    isStunned() { return this.hasBuff('stun'); }
    getMoveSpeed() {
      const slow = Math.min(0.75, this.buffMax('slow'));
      const haste = this.buffSum('haste');
      return this.moveSpeed * (M.PACE ? M.PACE.move : 1) * Math.max(0.2, (1 + haste) * (1 - slow)) * (this.baseBoost ? 1.75 : 1);
    }
    /** Velocidad de ataque estilo LoL: base × (1 + bonificación), tope 2.5 ataques/s. */
    getAttackSpeed() { return Math.min(2.5, this.attackSpeed * (1 + this.bonusAS + this.buffSum('attackSpeed'))); }
    shredMult() { return 1 - Math.min(0.6, this.buffSum('armorShred')); }
    getArmor() { return (this.armor + this.buffSum('armor')) * this.shredMult(); }
    getMr() { return (this.mr + this.buffSum('mr')) * this.shredMult(); }
    isStealthed() { return this.hasBuff('stealth'); }
    sizeMult() { return 1 + this.buffMax('grow'); }
    getLifesteal() { return this.lifesteal + this.buffSum('lifesteal'); }
    shieldAmount() { return this.buffSum('shield'); }
    addBuff(b) {
      // Tenacidad (Botas de Mercurio): los controles duran menos
      if (this.tenacity && (b.type === 'stun' || b.type === 'slow' || b.type === 'fear') && b.duration) b.duration *= 1 - this.tenacity;
      b.remaining = b.duration || 0.01;
      if (b.type === 'stun' || b.type === 'slow') {
        for (const o of this.buffs) {
          if (o.type === b.type && o.amount === b.amount) { o.remaining = Math.max(o.remaining, b.remaining); return; }
        }
      }
      this.buffs.push(b);
    }
    updateBuffs(game, dt) {
      for (let i = this.buffs.length - 1; i >= 0; i--) {
        const b = this.buffs[i];
        if (!b) continue;
        b.remaining -= dt;
        if (b.type === 'dot') {
          b.tick = (b.tick || 0) + dt;
          if (b.tick >= 0.5) {
            b.tick -= 0.5;
            game.damage(b.source, this, b.amount * 0.5, 'magic');
            if (this.dead) return;
          }
        }
        if (b.remaining <= 0 || (b.type === 'shield' && b.amount <= 0)) this.buffs.splice(i, 1);
      }
    }
    /** Alcance de borde a borde, como en LoL. */
    inRangeOf(t, extra) { return U.dist(this, t) <= this.attackRange + this.radius + t.radius + (extra || 0); }
    isTargetable() { return !this.dead && this.vulnerable !== false; }
  }

  class Champion extends Unit {
    constructor(def, team, isPlayer) {
      super({ type: 'champion', team: team, name: def.name, radius: 65 });
      this.def = def; this.human = !!isPlayer; this.isPlayer = this.human;
      this.level = 1; this.xp = 0; this.gold = 500; this.items = [];
      this.cds = [0, 0, 0, 0];
      this.ranks = [0, 0, 0, 0]; this.skillPoints = 1;
      this.kills = 0; this.deaths = 0; this.assists = 0; this.cs = 0;
      this.respawnTimer = 0; this.ai = null; this.lane = 'mid';
      this.recalling = null; this.haste = 0; this.passives = {}; this.undo = []; this.reviveReady = 0;
      this.ranged = def.ranged; this.projectileColor = def.accent;
      this.recalc(true);
    }
    /** Curva de experiencia de LoL: 280 XP para el nivel 2 y +100 por nivel (1880 para el 18). */
    xpToNext() { return 180 + this.level * 100; }
    recalc(full) {
      const s = this.def.stats, n = this.level, g = function (b, gr) { return M.growth(b, gr || 0, n); };
      const it = { hp: 0, mana: 0, ad: 0, ap: 0, apMult: 0, armor: 0, mr: 0, attackSpeed: 0, critChance: 0, critDamage: 0,
        lifesteal: 0, haste: 0, moveSpeed: 0, moveSpeedPct: 0, manaRegen: 0, hpRegen: 0 };
      this.passives = {};
      for (const id of this.items) {
        const item = M.itemById[id];
        if (!item) continue;
        for (const k in item.stats) it[k] = (it[k] || 0) + item.stats[k];
        if (item.passive) this.passives[item.passive.id] = true;   // las pasivas únicas no se acumulan
      }
      this.tenacity = this.passives.tenacity ? 0.3 : 0;
      const oldMax = this.maxHp, oldMana = this.maxMana;
      this.maxHp = g(s.hp, s.hpPerLevel) + it.hp;
      this.maxMana = g(s.mana, s.manaPerLevel) + it.mana;
      this.baseAd = g(s.ad, s.adPerLevel);
      this.ad = this.baseAd + it.ad;
      this.ap = (s.ap + it.ap) * (1 + it.apMult);
      this.armor = g(s.armor, s.armorPerLevel) + it.armor;
      this.mr = g(s.mr, s.mrPerLevel) + it.mr;
      this.attackSpeed = s.attackSpeed;
      this.bonusAS = g(0, s.attackSpeedPerLevel) + it.attackSpeed;
      this.windupFrac = s.windup;
      this.projectileSpeed = s.projectileSpeed;
      this.critChance = Math.min(1, it.critChance);
      this.critDamage = 1.75 + it.critDamage;
      this.lifesteal = it.lifesteal;
      this.haste = it.haste;
      this.moveSpeed = (s.moveSpeed + it.moveSpeed) * (1 + it.moveSpeedPct);
      this.attackRange = s.attackRange;
      this.hpRegen = g(s.hpRegen, s.hpRegenPerLevel) + it.hpRegen;
      this.manaRegen = g(s.manaRegen, s.manaRegenPerLevel) + it.manaRegen;
      if (full) { this.hp = this.maxHp; this.mana = this.maxMana; }
      else {
        this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
        this.mana = Math.min(this.maxMana, this.mana + Math.max(0, this.maxMana - oldMana));
      }
    }
    gainXp(game, amount) {
      if (this.level >= M.MAX_LEVEL) return;
      this.xp += amount;
      while (this.level < M.MAX_LEVEL && this.xp >= this.xpToNext()) {
        this.xp -= this.xpToNext();
        this.level++;
        this.skillPoints++;
        this.recalc(false);
        game.onLevelUp(this);
      }
      if (this.level >= M.MAX_LEVEL) this.xp = 0;
    }
    gainGold(game, amount, show) {
      this.gold += amount;
      if (show && this.human) game.floatText(this.x, this.y - 120, '+' + Math.round(amount) + ' oro', '#ffd54a', false, [this.id]);
    }
    // ---- Habilidades por rangos (reglas de LoL) ----
    /** ¿Puede subir un rango en esta habilidad? Básicas: máx. 5 y nunca más que ⌈nivel/2⌉. R: niveles 6/11/16. */
    canLearn(slot) {
      if (this.skillPoints <= 0) return false;
      const r = this.ranks[slot];
      if (slot === 3) return r < M.MAX_RANK[3] && this.level >= M.R_LEVELS[r];
      return r < M.MAX_RANK[slot] && r < Math.ceil(this.level / 2);
    }
    learn(slot) {
      if (!this.canLearn(slot)) return false;
      this.ranks[slot]++; this.skillPoints--;
      return true;
    }
    manaCost(slot) { return U.rankVal(this.def.abilities[slot].mana, this.ranks[slot]) || 0; }
    /** Enfriamiento con aceleración de habilidades: cd × 100 / (100 + aceleración). */
    cooldown(slot) { return U.rankVal(this.def.abilities[slot].cd, this.ranks[slot]) * 100 / (100 + this.haste); }
    abilityReady(slot) {
      return this.ranks[slot] > 0 && this.cds[slot] <= 0 && this.mana >= this.manaCost(slot);
    }
  }

  const MINIONS = {
    melee: { name: 'Súbdito', radius: 48, hp: 477, ad: 12, armor: 0, range: 110, as: 1.25, gold: 21, xp: 60, windup: 0.25 },
    caster: { name: 'Súbdito hechicero', radius: 48, hp: 296, ad: 23, armor: 0, range: 550, as: 0.667, gold: 14, xp: 30, windup: 0.25, proj: 650 },
    cannon: { name: 'Súbdito de asedio', radius: 65, hp: 912, ad: 41, armor: 0, range: 300, as: 1.0, gold: 60, xp: 93, windup: 0.25, proj: 1200 }
  };

  function createMinion(team, lane, kind, minuteScale) {
    const d = MINIONS[kind] || MINIONS.melee;
    const m = new Unit({
      type: 'minion', team: team, kind: kind, lane: lane, name: d.name,
      radius: d.radius,
      maxHp: d.hp + minuteScale * (kind === 'cannon' ? 40 : 15),
      ad: d.ad + minuteScale * (kind === 'cannon' ? 2 : 0.8),
      armor: d.armor, mr: 0,
      attackRange: d.range, attackSpeed: d.as, moveSpeed: 325, windupFrac: d.windup,
      ranged: kind !== 'melee', projectileSpeed: d.proj || 1200,
      projectileColor: team === 0 ? '#9fd4ff' : '#ffb0b0',
      gold: d.gold, xp: d.xp,
      aggro: 700, think: 0, wp: 1, progress: 0
    });
    m.hp = m.maxHp;
    m.path = M.MAP.pathFor(lane, team);
    return m;
  }

  function createTower(team, lane, tier, pos, distFromBlue) {
    const t = new Unit({
      type: 'tower', team: team, lane: lane, tier: tier,
      name: 'Torre', x: pos.x, y: pos.y, radius: 88,
      maxHp: tier === 'outer' ? 3500 : 4000, ad: 160, armor: 40, mr: 40,
      // 750 de alcance desde el centro de la torre hasta el borde del objetivo
      attackRange: 750 - 88, attackSpeed: 0.833, windupFrac: 0.1, ranged: true, isStatic: true, projectileSpeed: 1200,
      projectileColor: team === 0 ? '#7cc7ff' : '#ff8080',
      distFromBlue: distFromBlue, aggroLock: 0, heat: 0, heatTarget: null
    });
    t.hp = t.maxHp;
    return t;
  }

  function createNexus(team, pos) {
    const n = new Unit({
      type: 'nexus', team: team, name: 'Nexo', x: pos.x, y: pos.y, radius: 160,
      maxHp: 5500, armor: 0, mr: 0, attackRange: 0, isStatic: true
    });
    n.hp = n.maxHp;
    return n;
  }

  function createMonster(camp, minuteScale, small) {
    const wolf = camp.kind === 'wolf';
    const m = wolf ? new Unit({
      type: 'monster', kind: small ? 'wolf_small' : 'wolf', team: 2, name: small ? 'Lobezno Espectral' : 'Lobo Espectral',
      x: camp.x, y: camp.y, radius: small ? 50 : 70,
      maxHp: (small ? 500 : 1100) + minuteScale * (small ? 25 : 55), ad: (small ? 18 : 38) + minuteScale * 2, armor: 10, mr: 10,
      attackRange: 150, attackSpeed: 1.0, moveSpeed: 380, windupFrac: 0.25, home: { x: camp.x, y: camp.y },
      gold: small ? 30 : 70, xp: small ? 35 : 100, csValue: small ? 1 : 2, camp: camp, returning: false
    }) : new Unit({
      type: 'monster', kind: 'golem', team: 2, name: 'Gólem del Bosque', x: camp.x, y: camp.y, radius: 80,
      maxHp: 1800 + minuteScale * 90, ad: 50 + minuteScale * 3, armor: 20, mr: 20,
      attackRange: 175, attackSpeed: 0.75, moveSpeed: 350, windupFrac: 0.3, home: { x: camp.x, y: camp.y },
      gold: 100, xp: 160, csValue: 4, camp: camp, returning: false
    });
    m.hp = m.maxHp;
    return m;
  }

  M.MINION_TYPES = MINIONS;
  M.Unit = Unit;
  M.Champion = Champion;
  M.createMinion = createMinion;
  M.createTower = createTower;
  M.createNexus = createNexus;
  M.createMonster = createMonster;
})(window.MOBA);
