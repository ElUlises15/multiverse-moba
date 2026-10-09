/* IA simple de los bots: carril, pelea, retirada a baja vida y empuje de torres */
(function (M) {
  'use strict';
  const U = M.util;
  const A = M.Abilities;

  class BotAI {
    constructor(ch) {
      this.ch = ch;
      this.think = Math.random() * 0.3;
      this.state = 'lane';
      this.offset = { x: U.rand(-175, 175), y: U.rand(-175, 175) };
      this.recallTime = 0;
      this.aggression = U.rand(0.8, 1.15);
    }

    update(game, dt) {
      const c = this.ch;
      if (c.dead) { this.state = 'lane'; this.recallTime = 0; return; }
      this.think -= dt;
      if (this.think > 0) return;
      this.think = 0.18 + Math.random() * 0.1;

      const f = game.map.fountains[c.team];
      const hpPct = c.hp / c.maxHp;
      const atBase = U.dist(c, f) < game.map.fountainRadius + 120;
      if (atBase) game.botShop(c);

      const enemies = game.champions.filter(function (e) { return e.team !== c.team && !e.dead && U.dist(e, c) < 1300 && game.isVisibleTo(c.team, e); });
      const allies = game.champions.filter(function (a) { return a.team === c.team && !a.dead && U.dist(a, c) < 1400; });

      this.supportCheck(game, allies, enemies);

      // --- Retirada ---
      if (this.state === 'retreat') {
        if (atBase && hpPct > 0.92 && c.mana > c.maxMana * 0.5) { this.state = 'lane'; }
        else {
          c.target = null;
          if (!atBase && enemies.length === 0 && game.time - c.lastHurt > 2) {
            // volver a la base con "teletransporte" (como el recall)
            if (!c.recalling) game.startRecall(c);
            c.moveTarget = null;
          } else if (!c.recalling) {
            c.moveTarget = { x: f.x, y: f.y };
          }
          if (enemies.length) { c.recalling = null; c.moveTarget = { x: f.x, y: f.y }; this.escape(game, f); }
          return;
        }
      }
      if (hpPct < 0.28 || (hpPct < 0.4 && enemies.length > allies.length)) {
        this.state = 'retreat';
        c.target = null; c.moveTarget = { x: f.x, y: f.y };
        return;
      }

      const myTower = this.enemyStructureNear(game, c, 0);

      // --- Pelea contra campeones ---
      if (enemies.length) {
        let target = enemies[0];
        for (const e of enemies) if (e.hp < target.hp) target = e;
        const power = function (list) { return list.reduce(function (s, e) { return s + e.hp + e.level * 60 + e.ad * 3; }, 0); };
        const enemyPower = power(enemies), allyPower = power(allies) * this.aggression;
        let fight = allyPower >= enemyPower * 0.85 || target.hp / target.maxHp < 0.3;
        const cover = this.enemyStructureNear(game, target, 150);
        if (cover && cover.type === 'tower' && !this.towerSafe(game, cover) && target.hp / target.maxHp > 0.15) fight = false;
        if (fight) {
          c.target = target; c.moveTarget = null;
          this.useAbilities(game, target, false);
          return;
        }
        if (U.dist(target, c) < target.attackRange + 450) {
          c.target = null; c.moveTarget = game.lanePoint(c, -900);
          this.useAbilities(game, target, true);
          return;
        }
      }

      // --- Si una torre me apunta, salir de rango ---
      if (myTower && myTower.type === 'tower' && myTower.target === c) {
        c.target = null; c.moveTarget = game.lanePoint(c, -1000);
        return;
      }

      // --- Farmear súbditos ---
      let best = null, bestScore = Infinity;
      for (const u of game.units) {
        if (u.type !== 'minion' || u.dead || u.team === c.team) continue;
        const d = U.dist(u, c);
        if (d > 1200) continue;
        const score = d + (u.hp <= c.ad * 1.1 ? -1200 : 0);
        if (score < bestScore) { bestScore = score; best = u; }
      }
      if (best) {
        const cover = this.enemyStructureNear(game, best, 75);
        if (!cover || cover.type !== 'tower' || this.towerSafe(game, cover)) {
          c.target = best; c.moveTarget = null;
          if (c.mana > c.maxMana * 0.75 && Math.random() < 0.15) this.useAbilities(game, best, false, true);
          return;
        }
      }

      // --- Empujar estructuras ---
      const s = this.nearestEnemyStructure(game, c);
      if (s && s.isTargetable() && U.dist(c, s) < 1600 && (s.type === 'nexus' || this.towerSafe(game, s))) {
        c.target = s; c.moveTarget = null;
        return;
      }

      // --- Avanzar por el carril ---
      c.target = null;
      c.moveTarget = this.laneDestination(game);
    }

    /** Estructura enemiga (torre/nexo vivo) cuyo rango cubre la posición. */
    enemyStructureNear(game, pos, extra) {
      for (const t of game.structures) {
        if (t.dead || t.team === this.ch.team || t.type !== 'tower') continue;
        if (U.dist(pos, t) < t.attackRange + t.radius + (pos.radius || 0) + extra) return t;
      }
      return null;
    }
    nearestEnemyStructure(game, c) {
      let best = null, bd = Infinity;
      for (const t of game.structures) {
        if (t.dead || t.team === c.team || !t.isTargetable()) continue;
        const d = U.dist(c, t);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    }
    towerSafe(game, t) {
      if (t.type === 'nexus') return true;
      if (t.target && t.target.type === 'minion' && t.target.team === this.ch.team) return true;
      let n = 0;
      for (const u of game.units) {
        if (u.type === 'minion' && !u.dead && u.team === this.ch.team && U.dist(u, t) < t.attackRange + t.radius) n++;
      }
      return n >= 2;
    }

    laneDestination(game) {
      const c = this.ch;
      const path = game.map.pathFor(c.lane, c.team);
      const len = game.map.laneLength[c.lane];
      // frente de la oleada aliada
      let front = -1;
      for (const u of game.units) {
        if (u.type === 'minion' && !u.dead && u.team === c.team && u.lane === c.lane && u.progress > front) front = u.progress;
      }
      // primera torre propia viva más adelantada
      let ownD = 750;
      let enemyD = len;
      for (const t of game.structures) {
        if (t.dead || t.type !== 'tower' || t.lane !== c.lane) continue;
        const d = c.team === 0 ? t.distFromBlue : len - t.distFromBlue;
        if (t.team === c.team) ownD = Math.max(ownD, d);
        else enemyD = Math.min(enemyD, d);
      }
      let dest = front >= 0 ? front - 350 : ownD + 600;
      const enemySafeLimit = enemyD - 750 - 250;
      if (dest > enemySafeLimit && front < enemyD - 700) dest = enemySafeLimit;
      dest = U.clamp(dest, 500, len - 500);
      const p = game.map.pointAt(path, dest);
      return { x: p.x + this.offset.x, y: p.y + this.offset.y };
    }

    predict(target, time) {
      return { x: target.x + target.vx * time + U.rand(-50, 50), y: target.y + target.vy * time + U.rand(-50, 50) };
    }

    useAbilities(game, target, defensive, farm) {
      const c = this.ch;
      const d = U.dist(c, target);
      for (let slot = 0; slot < 4; slot++) {
        if (!c.abilityReady(slot)) continue;
        const ab = c.def.abilities[slot];
        if (farm && (slot === 3 || target.type !== 'minion')) continue;
        const kind = A.aiKind(ab);
        let ok = false;
        if (kind === 'damage') {
          if (defensive && !(ab.effects && ab.effects.some(function (e) { return e.type === 'stun' || e.type === 'slow'; }))) continue;
          let reach;
          if (ab.cast === 'self') reach = (ab.radius || 0) + target.radius;
          else if (ab.cast === 'target') reach = ab.range + target.radius;
          else if (ab.cast === 'area') reach = ab.range + (ab.radius || 0) * 0.5;
          else reach = ab.range * 0.92;
          if (d <= reach) {
            const time = ab.cast === 'skillshot' ? d / ab.speed : (ab.delay || 0);
            const p = this.predict(target, time);
            ok = A.cast(game, c, slot, p.x, p.y);
          }
        } else if (kind === 'engage') {
          if (!defensive && !farm && d > c.attackRange * 0.8 && d < ab.range + (ab.radius || 100)) ok = A.cast(game, c, slot, target.x, target.y);
        } else if (kind === 'escape') {
          if (defensive) {
            const f = game.map.fountains[c.team];
            ok = A.cast(game, c, slot, f.x, f.y);
          }
        } else if (kind === 'buff') {
          if (!farm && d < c.attackRange + 400) ok = A.cast(game, c, slot, target.x, target.y);
        } else if (kind === 'ally') {
          if (!farm && !defensive && d < 1000 && Math.random() < 0.5) ok = A.cast(game, c, slot, c.x, c.y);
        }
        if (ok) return true;
      }
      return false;
    }

    supportCheck(game, allies, enemies) {
      const c = this.ch;
      for (let slot = 0; slot < 4; slot++) {
        const ab = c.def.abilities[slot];
        if (!ab.allyEffects || ab.cast === 'area' || !c.abilityReady(slot)) continue;
        const heals = ab.allyEffects.some(function (e) { return e.type === 'heal'; });
        const r = ab.allyRadius || 400;
        const near = allies.filter(function (a) { return U.dist(a, c) < r; });
        let want = false;
        if (heals) want = near.some(function (a) { return a.hp / a.maxHp < 0.6; });
        else want = enemies.length > 0 && near.some(function (a) { return a.hp / a.maxHp < 0.8 || enemies.some(function (e) { return U.dist(e, a) < 900; }); });
        if (want && A.cast(game, c, slot, c.x, c.y)) return;
      }
    }

    escape(game, f) {
      const c = this.ch;
      for (let slot = 0; slot < 4; slot++) {
        if (!c.abilityReady(slot)) continue;
        const ab = c.def.abilities[slot];
        const kind = A.aiKind(ab);
        const hasHaste = ab.selfEffects && ab.selfEffects.some(function (e) { return e.type === 'haste' || e.type === 'shield'; });
        if (kind === 'escape' || (kind === 'buff' && hasHaste)) {
          if (A.cast(game, c, slot, f.x, f.y)) return;
        }
      }
    }
  }

  /** Subida de habilidades de los bots: R cuando se puede; una de cada básica al principio; después maximiza según skillOrder. */
  BotAI.levelUp = function (c) {
    const order = c.def.skillOrder || [0, 1, 2];
    let guard = 20;
    while (c.skillPoints > 0 && guard-- > 0) {
      if (c.learn(3)) continue;
      let done = false;
      if (c.level <= 3) {
        for (const s of order) if (c.ranks[s] === 0 && c.learn(s)) { done = true; break; }
      }
      if (!done) for (const s of order) if (c.learn(s)) { done = true; break; }
      if (!done) break;
    }
  };

  M.BotAI = BotAI;
})(window.MOBA);
