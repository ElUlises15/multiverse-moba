/* Sistema de habilidades genérico, dirigido por datos.
 * Tipos de lanzamiento (cast): skillshot, line, area, self, dash, target, cone.
 * Efectos: slow, stun, fear, knockback, pull, dot, armorShred, shield, haste, attackSpeed, armor, mr, lifesteal, heal, mana,
 *          stealth (invisible), undying (no puede morir), grow (crece).
 */
(function (M) {
  'use strict';
  const U = M.util;
  const A = M.Abilities = {};

  const R = U.rankVal;
  /** Resuelve un valor escalable: número, arreglo por rango o { base, lvl, ad, bonusAd, ap, maxHp }
   * (cada campo puede ser número o arreglo por rango). */
  A.value = function (v, c, rank) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return R(v, rank);
    return (R(v.base, rank) || 0) + (R(v.lvl, rank) || 0) * ((c.level || 1) - 1) + (R(v.ad, rank) || 0) * (c.ad || 0) +
      (R(v.bonusAd, rank) || 0) * Math.max(0, (c.ad || 0) - (c.baseAd || c.ad || 0)) +
      (R(v.ap, rank) || 0) * (c.ap || 0) + (R(v.maxHp, rank) || 0) * (c.maxHp || 0);
  };
  /** Rango actual de una habilidad del campeón (1 si no aplica). */
  A.rankOf = function (c, ab) { return (c && c.ranks && ab && ab.slot != null) ? Math.max(1, c.ranks[ab.slot]) : 1; };

  /** Texto con los números de la habilidad por rango, estilo tooltip de LoL. */
  A.statsText = function (ab, rank) {
    const parts = [];
    const ratio = function (d) {
      const r = [];
      if (d.ad) r.push('+' + U.fmtArr(Array.isArray(d.ad) ? d.ad.map(function (x) { return x * 100; }) : d.ad * 100) + '% DA');
      if (d.bonusAd) r.push('+' + U.fmtArr(d.bonusAd * 100) + '% DA adicional');
      if (d.ap) r.push('+' + U.fmtArr(Array.isArray(d.ap) ? d.ap.map(function (x) { return x * 100; }) : d.ap * 100) + '% PH');
      if (d.maxHp) r.push('+' + U.fmtArr(d.maxHp * 100) + '% vida máx.');
      return r.length ? ' (' + r.join(', ') + ')' : '';
    };
    const val = function (d) { return typeof d === 'object' && !Array.isArray(d) ? U.fmtArr(d.base || 0) + ratio(d) : U.fmtArr(d); };
    if (ab.damage) parts.push((ab.duration ? 'Daño por tick: ' : 'Daño: ') + val(ab.damage));
    const all = [].concat(ab.effects || [], ab.selfEffects || [], ab.allyEffects || []);
    for (const e of all) {
      if (e.type === 'heal') parts.push('Curación: ' + val(e.amount));
      else if (e.type === 'shield') parts.push('Escudo: ' + val(e.amount));
      else if (e.type === 'stun') parts.push('Aturdimiento: ' + U.fmtArr(e.duration) + ' s');
      else if (e.type === 'slow') parts.push('Ralentización: ' + U.fmtArr(Array.isArray(e.amount) ? e.amount.map(function (x) { return Math.round(x * 100); }) : Math.round(e.amount * 100)) + '%');
      else if (e.type === 'attackSpeed') parts.push('Vel. de ataque: +' + U.fmtArr(Array.isArray(e.amount) ? e.amount.map(function (x) { return Math.round(x * 100); }) : Math.round(e.amount * 100)) + '%');
      else if (e.type === 'haste') parts.push('Velocidad: +' + U.fmtArr(Array.isArray(e.amount) ? e.amount.map(function (x) { return Math.round(x * 100); }) : Math.round(e.amount * 100)) + '%');
      else if (e.type === 'lifesteal') parts.push('Robo de vida: ' + U.fmtArr(Array.isArray(e.amount) ? e.amount.map(function (x) { return Math.round(x * 100); }) : Math.round(e.amount * 100)) + '%');
      else if (e.type === 'armor') parts.push('Armadura: +' + U.fmtArr(e.amount));
      else if (e.type === 'dot') parts.push('Daño por s: ' + val(e.dps));
      else if (e.type === 'fear') parts.push('Miedo: ' + U.fmtArr(e.duration) + ' s');
      else if (e.type === 'armorShred') parts.push('Reducción de armadura y res.: ' + U.fmtArr(Array.isArray(e.amount) ? e.amount.map(function (x) { return Math.round(x * 100); }) : Math.round(e.amount * 100)) + '%');
      else if (e.type === 'stealth') parts.push('Invisibilidad: ' + U.fmtArr(e.duration) + ' s');
      else if (e.type === 'undying') parts.push('Inmortal: ' + U.fmtArr(e.duration) + ' s');
      else if (e.type === 'knockback') parts.push('Empuje: ' + (e.distance || 250));
      else if (e.type === 'pull') parts.push('Atrae al objetivo');
    }
    if (ab.selfDamage) parts.push('Costo: ' + Math.round(ab.selfDamage * 100) + '% de la vida actual');
    parts.push('Enfriamiento: ' + U.fmtArr(ab.cd) + ' s');
    if (ab.mana) parts.push('Maná: ' + U.fmtArr(ab.mana));
    if (ab.range) parts.push('Alcance: ' + ab.range);
    return parts;
  };

  A.isHittable = function (u) {
    return !u.dead && (u.type === 'champion' || u.type === 'minion' || u.type === 'monster');
  };

  /** Clasificación para la IA de los bots. */
  A.aiKind = function (ab) {
    if (ab.aiKind) return ab.aiKind;
    if (ab.allyEffects) return ab.damage && ab.cast !== 'self' ? 'damage' : 'ally';
    if (ab.cast === 'dash') return ab.damage ? 'engage' : 'escape';
    if (!ab.damage && !ab.effects && ab.selfEffects) return 'buff';
    if (ab.cast === 'self' && !ab.damage && ab.effects) return 'damage';
    return 'damage';
  };

  A.applyEffects = function (game, caster, effects, target, origin, rank) {
    if (!effects || !target || target.dead) return;
    rank = rank || 1;
    for (const e of effects) {
      switch (e.type) {
        case 'stun':
        case 'slow':
          if (target.type === 'tower' || target.type === 'nexus') break;
          target.addBuff({ type: e.type, amount: A.value(e.amount, caster, rank) || 1, duration: R(e.duration, rank) });
          break;
        case 'fear': {
          // Miedo: no puede actuar y huye despacio alejándose de quien lo asustó
          if (target.isStatic) break;
          const b = { type: 'stun', fear: true, amount: 1, duration: R(e.duration, rank) || 1 };
          target.addBuff(b);
          const o = origin || caster;
          let dx = target.x - o.x, dy = target.y - o.y; const d = Math.hypot(dx, dy) || 1;
          const sp = target.getMoveSpeed() * 0.55;
          target.knock = { vx: dx / d * sp, vy: dy / d * sp, t: b.duration, fear: true };
          target.windup = null; target.target = null;
          break;
        }
        case 'pull': {
          // Atraer hacia quien lanza (agarre)
          if (target.isStatic) break;
          let dx = caster.x - target.x, dy = caster.y - target.y; const d = Math.hypot(dx, dy) || 1;
          const dist = Math.max(0, d - caster.radius - target.radius - 20);
          target.knock = { vx: dx / d * dist / 0.25, vy: dy / d * dist / 0.25, t: 0.25 };
          target.dash = null; target.windup = null;
          break;
        }
        case 'armorShred':
          if (target.isStatic) break;
          target.addBuff({ type: 'armorShred', amount: A.value(e.amount, caster, rank), duration: R(e.duration, rank) || 3 });
          break;
        case 'knockback': {
          if (target.isStatic || target.dash) break;
          const o = origin || caster;
          let dx = target.x - o.x, dy = target.y - o.y; const d = Math.hypot(dx, dy) || 1;
          dx /= d; dy /= d;
          const dist = A.value(e.distance, caster, rank) || 250;
          target.knock = { vx: dx * dist / 0.2, vy: dy * dist / 0.2, t: 0.2 };
          break;
        }
        case 'dot':
          target.addBuff({ type: 'dot', amount: A.value(e.dps, caster, rank), duration: R(e.duration, rank), source: caster });
          break;
        case 'heal': {
          const amt = A.value(e.amount, caster, rank) * (target.passives && target.passives.spirit ? 1.25 : 1);
          const before = target.hp;
          target.hp = Math.min(target.maxHp, target.hp + amt);
          if (target.human && target.hp - before >= 1) {
            game.floatText(target.x, target.y - 120, '+' + Math.round(target.hp - before), '#5cff8a', false, [target.id]);
          }
          game.particles(target.x, target.y, '#7dff9c', 6, 200);
          break;
        }
        case 'mana':
          target.mana = Math.min(target.maxMana, target.mana + A.value(e.amount, caster, rank));
          break;
        default: // shield, haste, attackSpeed, armor, mr, lifesteal, stealth, undying, grow
          target.addBuff({ type: e.type, amount: A.value(e.amount, caster, rank) * (e.type === 'shield' && target.passives && target.passives.spirit ? 1.25 : 1),
            duration: R(e.duration, rank) || 3 });
      }
    }
  };

  /** Impacto de una habilidad sobre un enemigo. */
  A.hit = function (game, caster, ab, target, origin) {
    if (target.dead) return;
    const rank = A.rankOf(caster, ab);
    let dmg = A.value(ab.damage, caster, rank);
    if (ab.executeBonus) dmg *= 1 + ab.executeBonus * (1 - target.hp / target.maxHp);
    if (dmg > 0) game.damage(caster, target, dmg, ab.damageType || 'magic');
    // Pasiva única "Eco": daño mágico extra cada 6 s
    if (dmg > 0 && caster.passives && caster.passives.echo && game.time >= (caster.echoReady || 0) && !target.dead) {
      caster.echoReady = game.time + 6;
      game.damage(caster, target, 60 + 0.1 * caster.ap, 'magic');
      game.pushFx({ type: 'ring', x: target.x, y: target.y, r0: 20, r1: 160, color: '#9fe8ff', life: 0.35, max: 0.35 });
    }
    if (!target.dead && ab.effects) A.applyEffects(game, caster, ab.effects, target, origin || caster, rank);
    game.particles(target.x, target.y, ab.color, 6, 300);
  };

  A.hitCircle = function (game, caster, ab, x, y, r) {
    let n = 0;
    for (const u of game.units.slice()) {
      if (u.team === caster.team || !A.isHittable(u)) continue;
      if (U.distXY(u.x, u.y, x, y) <= r + u.radius) { A.hit(game, caster, ab, u, { x: x, y: y }); n++; }
    }
    return n;
  };

  /** Cono desde (x, y) en dirección `ang`: alcance r y apertura total `spread` (grados). */
  A.hitCone = function (game, caster, ab, x, y, ang, r, spread) {
    const half = spread * Math.PI / 360;
    for (const u of game.units.slice()) {
      if (u.team === caster.team || !A.isHittable(u)) continue;
      const dx = u.x - x, dy = u.y - y, d = Math.hypot(dx, dy);
      if (d > r + u.radius) continue;
      let da = Math.atan2(dy, dx) - ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) <= half + Math.atan2(u.radius, Math.max(1, d))) A.hit(game, caster, ab, u, { x: x, y: y });
    }
  };

  A.hitLine = function (game, caster, ab, x1, y1, x2, y2, width) {
    for (const u of game.units.slice()) {
      if (u.team === caster.team || !A.isHittable(u)) continue;
      if (U.pointSegDist(u.x, u.y, x1, y1, x2, y2) <= width / 2 + u.radius) A.hit(game, caster, ab, u, { x: x1, y: y1 });
    }
  };

  A.applyAllies = function (game, caster, ab, x, y, r) {
    if (!ab.allyEffects) return;
    for (const c of game.champions) {
      if (c.dead || c.team !== caster.team) continue;
      if (U.distXY(c.x, c.y, x, y) <= r + c.radius) A.applyEffects(game, caster, ab.allyEffects, c, null, A.rankOf(caster, ab));
    }
  };

  /** Lanza la habilidad `slot` del campeón hacia (tx, ty). Devuelve true si se lanzó. */
  A.cast = function (game, c, slot, tx, ty) {
    const ab = c.def.abilities[slot];
    if (!ab || c.dead || c.isStunned() || c.dash || c.knock) return false;
    if (!c.abilityReady(slot)) return false;
    let dx = tx - c.x, dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) { dx = Math.cos(c.facing); dy = Math.sin(c.facing); } else { dx /= d; dy /= d; }
    const color = ab.color;
    // lanzar una habilidad rompe la invisibilidad (salvo la que la da, que se aplica después)
    if (c.isStealthed()) c.buffs = c.buffs.filter(function (b) { return b.type !== 'stealth'; });

    switch (ab.cast) {
      case 'cone': {
        const ang = Math.atan2(dy, dx);
        c.facing = ang;
        A.hitCone(game, c, ab, c.x, c.y, ang, ab.range, ab.angle || 50);
        game.pushFx({ type: 'cone', x: c.x, y: c.y, angle: ang, range: ab.range, spread: ab.angle || 50, color: color, life: 0.5, max: 0.5, def: c.def.id, slot: ab.slot, impact: true });
        break;
      }
      case 'skillshot':
        game.projectiles.push({
          id: ++game.seq, kind: 'skill', x: c.x, y: c.y, vx: dx * ab.speed, vy: dy * ab.speed,
          range: ab.range, traveled: 0, width: ab.width || 40, pierce: !!ab.pierce,
          source: c, ability: ab, hit: new Set(), color: color
        });
        break;
      case 'line': {
        const x2 = c.x + dx * ab.range, y2 = c.y + dy * ab.range;
        if (ab.delay) {
          game.zones.push({ id: ++game.seq, shape: 'line', x: c.x, y: c.y, x2: x2, y2: y2, width: ab.width, delay: ab.delay, maxDelay: ab.delay, caster: c, ab: ab, team: c.team, color: color });
        } else {
          A.hitLine(game, c, ab, c.x, c.y, x2, y2, ab.width);
          game.pushFx({ type: 'beam', x1: c.x, y1: c.y, x2: x2, y2: y2, width: ab.width, color: color, life: 0.25, max: 0.25, def: c.def.id, slot: ab.slot, impact: true });
        }
        break;
      }
      case 'area': {
        const r = Math.min(d, ab.range);
        const px = c.x + dx * r, py = c.y + dy * r;
        game.zones.push({
          id: ++game.seq, shape: 'circle', x: px, y: py, radius: ab.radius, delay: ab.delay || 0, maxDelay: ab.delay || 0,
          duration: ab.duration || 0, tick: ab.tick || 0.5, caster: c, ab: ab, team: c.team, color: color
        });
        break;
      }
      case 'self':
        if (ab.radius) {
          A.hitCircle(game, c, ab, c.x, c.y, ab.radius);
          game.pushFx({ type: 'ring', x: c.x, y: c.y, r0: c.radius, r1: ab.radius, color: color, life: 0.4, max: 0.4, fill: true, def: c.def.id, slot: ab.slot, impact: true });
        } else {
          game.pushFx({ type: 'ring', x: c.x, y: c.y, r0: c.radius, r1: c.radius + 70, color: color, life: 0.4, max: 0.4, def: c.def.id, slot: ab.slot, impact: true });
        }
        break;
      case 'dash': {
        const r = Math.min(d, ab.range);
        let px = U.clamp(c.x + dx * r, 80, game.map.width - 80), py = U.clamp(c.y + dy * r, 80, game.map.height - 80);
        if (game.map.nav && game.map.nav.blocked(px, py)) { const f = game.map.nav.nearestFree(px, py); px = f.x; py = f.y; }
        c.facing = Math.atan2(dy, dx);
        if (ab.blink) {
          game.particles(c.x, c.y, color, 12, 400);
          c.x = px; c.y = py; c.px = px; c.py = py;
          game.particles(c.x, c.y, color, 12, 400);
          A.land(game, c, ab);
        } else {
          c.dash = { tx: px, ty: py, speed: ab.speed || 1200, ab: ab, hit: new Set(), t: 0 };
        }
        c.target = null; c.moveTarget = null;
        break;
      }
      case 'target': {
        const t = game.findAbilityTarget(c, tx, ty, ab.range, ab.championsOnly);
        if (!t) return false;
        c.facing = Math.atan2(t.y - c.y, t.x - c.x);
        if (ab.blinkToTarget) {
          // aparece al lado del objetivo, del lado de donde venía
          game.particles(c.x, c.y, color, 14, 400);
          const dd = U.dist(c, t) || 1, back = t.radius + c.radius + 10;
          let bx = t.x - (t.x - c.x) / dd * back, by = t.y - (t.y - c.y) / dd * back;
          if (game.map.nav && game.map.nav.blocked(bx, by)) { const f = game.map.nav.nearestFree(bx, by); bx = f.x; by = f.y; }
          game.pushFx({ type: 'beam', x1: c.x, y1: c.y, x2: bx, y2: by, width: 60, color: color, life: 0.25, max: 0.25 });
          c.x = c.px = bx; c.y = c.py = by;
          c.target = t; c.moveTarget = null;
        }
        A.hit(game, c, ab, t, c);
        game.pushFx({ type: 'beam', x1: c.x, y1: c.y, x2: t.x, y2: t.y, width: 40, color: color, life: 0.2, max: 0.2, def: c.def.id, slot: ab.slot, impact: true });
        game.pushFx({ type: 'ring', x: t.x, y: t.y, r0: 20, r1: 150, color: color, life: 0.3, max: 0.3, def: c.def.id, slot: ab.slot, impact: true });
        break;
      }
      default:
        console.warn('Tipo de habilidad desconocido: ' + ab.cast);
        return false;
    }

    c.mana -= c.manaCost(slot);
    if (ab.selfDamage) { c.hp = Math.max(1, c.hp - c.hp * ab.selfDamage); c.flash = 0.15; }
    c.cds[slot] = c.cooldown(slot);
    c.castAt = game.time; c.castSlot = slot; c.lastAttackAt = game.time;
    // Evento visual: animación de lanzamiento + efecto de firma del campeón
    game.pushFx({ type: 'cast', uid: c.id, def: c.def.id, slot: slot, cast: ab.cast, x: c.x, y: c.y, tx: tx, ty: ty,
      radius: ab.radius || ab.allyRadius || 0, width: ab.width || 0, range: ab.range || 0, color: color, life: 0.6, max: 0.6 });
    c.recalling = null;
    c.windup = null;
    if (ab.selfEffects) A.applyEffects(game, c, ab.selfEffects, c, null, A.rankOf(c, ab));
    if (ab.allyEffects && ab.cast !== 'area') {
      A.applyAllies(game, c, ab, c.x, c.y, ab.allyRadius || 400);
      game.pushFx({ type: 'ring', x: c.x, y: c.y, r0: 10, r1: ab.allyRadius || 400, color: color, life: 0.5, max: 0.5, def: c.def.id, slot: ab.slot, ally: true });
    }
    return true;
  };

  /** Al terminar un dash: daño en área de aterrizaje si corresponde. */
  A.land = function (game, c, ab) {
    if (ab.radius && !ab.hitAlongPath && ab.damage) {
      A.hitCircle(game, c, ab, c.x, c.y, ab.radius);
      game.pushFx({ type: 'ring', x: c.x, y: c.y, r0: 40, r1: ab.radius, color: ab.color, life: 0.45, max: 0.45, fill: true, def: c.def.id, slot: ab.slot, impact: true });
      game.shake = Math.max(game.shake, 8);
    }
  };

  /** Efecto de una zona (área con retraso, posiblemente persistente). */
  A.applyZone = function (game, z) {
    if (z.shape === 'line') {
      A.hitLine(game, z.caster, z.ab, z.x, z.y, z.x2, z.y2, z.width);
      game.pushFx({ type: 'beam', x1: z.x, y1: z.y, x2: z.x2, y2: z.y2, width: z.width, color: z.color, life: 0.4, max: 0.4, def: z.caster.def && z.caster.def.id, slot: z.ab.slot, impact: true });
      return;
    }
    if (z.ab.damage || z.ab.effects) A.hitCircle(game, z.caster, z.ab, z.x, z.y, z.radius);
    if (z.ab.allyEffects) A.applyAllies(game, z.caster, z.ab, z.x, z.y, z.radius);
  };
})(window.MOBA);
