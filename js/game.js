/* Lógica principal de la partida */
(function (M) {
  'use strict';
  const U = M.util;
  const A = M.Abilities;

  class Game {
    /** new Game(defIdDelJugador) para un jugador, o new Game({ roster: [{ defId, team, human, slot, name }], localSlot })
     *  para partidas en red (el anfitrión simula; los demás solo mandan órdenes). */
    constructor(playerDefId, opts) {
      if (playerDefId && typeof playerDefId === 'object') { opts = playerDefId; playerDefId = null; }
      opts = opts || {};
      this.seq = 0;
      this.map = M.MAP;
      this.time = 0;
      this.units = []; this.champions = []; this.structures = []; this.towers = []; this.nexus = [];
      this.projectiles = []; this.zones = []; this.fx = []; this.texts = []; this.feed = [];
      this.score = [0, 0];
      this.over = false; this.winner = -1; this.paused = false;
      this.firstWave = opts.firstWave != null ? opts.firstWave : 30;
      this.nextWave = this.firstWave;
      this.waveInterval = 30;
      this.waveCount = 0;
      this.shake = 0;
      this.onGameOver = null;
      this.buildStructures();
      this.buildCamps();
      this.humans = {};
      this.buildTeams(opts.roster || M.Game.soloRoster(playerDefId), opts.localSlot || 'local');
      this.addFeed('¡Bienvenidos a la Grieta Multiversal! Los súbditos aparecen en ' + this.firstWave + ' segundos.', '#ffd54a');
    }

    // ---------- Construcción ----------
    buildStructures() {
      const map = this.map;
      for (let team = 0; team < 2; team++) {
        const n = M.createNexus(team, map.nexus[team]);
        this.nexus[team] = n; this.structures.push(n); this.units.push(n);
      }
      for (const lane of ['top', 'mid', 'bot']) {
        const path = map.lanes[lane], len = map.laneLength[lane];
        for (const tier of ['inner', 'outer']) {
          const d = (map.towerDistances[lane] || map.towerDistances)[tier];
          const blue = M.createTower(0, lane, tier, map.pointAt(path, d), d);
          const red = M.createTower(1, lane, tier, map.pointAt(path, len - d), len - d);
          for (const t of [blue, red]) { this.towers.push(t); this.structures.push(t); this.units.push(t); }
        }
      }
    }
    buildCamps() {
      this.camps = this.map.camps.map(function (c) { return { x: c.x, y: c.y, kind: c.kind || 'golem', monster: null, respawnAt: 60 }; });
    }
    buildTeams(roster, localSlot) {
      const self = this, count = [0, 0];
      roster.forEach(function (r) {
        const def = M.championById[r.defId] || M.champions[0];
        const team = r.team === 1 ? 1 : 0, i = count[team]++;
        const c = new M.Champion(def, team, !!r.human);
        c.lane = r.lane || M.ROLE_LANES[def.role] || 'mid';
        c.slot = r.slot || null; c.playerName = r.name || '';
        const f = self.map.fountains[team];
        c.x = f.x + Math.cos(i * 1.25) * 230; c.y = f.y + Math.sin(i * 1.25) * 230;
        c.px = c.x; c.py = c.y;
        if (c.human) { self.humans[c.slot] = c; if (c.slot === localSlot) self.player = c; }
        else { c.ai = new M.BotAI(c); M.BotAI.levelUp(c); }
        self.champions.push(c); self.units.push(c);
      });
      if (!this.player) this.player = this.champions.find(function (c) { return c.human; }) || this.champions[0];
    }

    // ---------- Utilidades ----------
    /** Aviso en el feed. `ann` (opcional) = anuncio grande estilo LoL ({ k: 'kill'|'ace'|'tower'|'nexus', … }); el texto según la perspectiva lo arma el HUD. */
    addFeed(text, color, to, ann) {
      this.feed.push({ id: ++this.seq, text: text, color: color || '#fff', time: this.time, to: to || null, ann: ann || null });
      if (this.feed.length > 30) this.feed.shift();
    }
    /** Texto flotante; `to` = ids de los campeones que lo ven (null = todos). */
    floatText(x, y, text, color, big, to) {
      this.texts.push({ id: ++this.seq, x: x, y: y, text: String(text), color: color, life: 1.1, max: 1.1, big: !!big, to: to || null });
      if (this.texts.length > 90) this.texts.shift();
    }
    /** Efecto visual (no afecta la simulación). Tipos: burst, ring, beam, swing, cast. Se mandan por red como eventos. */
    pushFx(f) {
      f.id = ++this.seq; f.t0 = this.time;
      this.fx.push(f);
      if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
      return f;
    }
    particles(x, y, color, n, speed) {
      this.pushFx({ type: 'burst', x: x, y: y, color: color, n: n, speed: speed || 120, life: 0.8, max: 0.8 });
    }
    /** Visión en arbustos: una unidad dentro de un arbusto solo se ve si el otro equipo tiene alguien en ese mismo arbusto
     *  (o si atacó hace menos de 1 s). Las torres y los súbditos no se ven afectados. */
    updateVision() {
      const occ = [new Set(), new Set()];
      for (const u of this.units) {
        if (u.dead || u.type === 'tower' || u.type === 'nexus') { u.brush = -1; continue; }
        u.brush = this.map.brushAt(u.x, u.y);
        if (u.brush >= 0 && u.team < 2) occ[u.team].add(u.brush);
      }
      for (const u of this.units) {
        if (u.brush >= 0 && u.team < 2 && this.time - (u.lastAttackAt || -9) > 1) {
          u.hiddenFrom = [u.team !== 0 && !occ[0].has(u.brush), u.team !== 1 && !occ[1].has(u.brush)];
        } else u.hiddenFrom = null;
        // Invisibilidad (sigilo): oculto para el otro equipo salvo que una torre o un campeón enemigo esté muy cerca
        if (u.type === 'champion' && !u.dead && u.isStealthed()) {
          const e = 1 - u.team;
          let seen = false;
          for (const o of this.units) {
            if (o.dead || o.team !== e || (o.type !== 'champion' && o.type !== 'tower')) continue;
            if (U.dist(o, u) < (o.type === 'tower' ? 700 : 250)) { seen = true; break; }
          }
          if (!seen) { u.hiddenFrom = u.hiddenFrom || [false, false]; u.hiddenFrom[e] = true; }
        }
      }
    }
    isVisibleTo(team, u) { return !u.hiddenFrom || !u.hiddenFrom[team]; }
    /** Órdenes de un campeón controlado por una persona (local o por red). */
    command(c, cmd) {
      if (!c || !cmd || this.over) return null;
      const byId = (id) => this.units.find(function (u) { return u.id === id; });
      const W = this.map.width, H = this.map.height;
      switch (cmd.t) {
        case 'move':
          if (c.dead) return null;
          c.recalling = null; c.attackMove = false; c.autoTarget = false; c.target = null;
          c.moveTarget = { x: U.clamp(+cmd.x || 0, 20, W - 20), y: U.clamp(+cmd.y || 0, 20, H - 20) };
          return null;
        case 'attack': {
          const t = byId(cmd.id);
          if (c.dead || !t || !this.validTarget(c, t)) return null;
          c.recalling = null; c.attackMove = false; c.autoTarget = false; c.target = t; c.moveTarget = null;
          return null;
        }
        case 'amove': {
          if (c.dead) return null;
          const t = cmd.id ? byId(cmd.id) : null;
          c.recalling = null; c.autoTarget = false;
          if (t && this.validTarget(c, t)) { c.target = t; c.moveTarget = null; c.attackMove = false; }
          else { c.target = null; c.attackMove = true; c.moveTarget = { x: U.clamp(+cmd.x || 0, 20, W - 20), y: U.clamp(+cmd.y || 0, 20, H - 20) }; }
          return null;
        }
        case 'stop': c.target = null; c.moveTarget = null; c.attackMove = false; return null;
        case 'cast': return A.cast(this, c, cmd.s | 0, +cmd.x || 0, +cmd.y || 0) ? null : 'no';
        case 'learn':
          if (c.learn(cmd.s | 0)) { this.particles(c.x, c.y, '#ffe45a', 10, 250); return null; }
          return 'no';
        case 'buy': return this.buyItem(c, String(cmd.item));
        case 'buyPartial': return this.buyPartial(c, String(cmd.item));
        case 'sell': return this.sellItem(c, cmd.i | 0);
        case 'undo': return this.undoShop(c);
        case 'ping': {
          if (this.time - (c.lastPing || -9) < 0.7) return 'Esperá un poco para volver a marcar';
          c.lastPing = this.time;
          const px = U.clamp(+cmd.x || 0, 0, M.MAP.width), py = U.clamp(+cmd.y || 0, 0, M.MAP.height);
          this.pushFx({ type: 'ping', x: px, y: py, kind: cmd.k === 'danger' ? 'danger' : 'go', team: c.team, name: c.playerName || c.name, life: 3, max: 3 });
          return null;
        }
        case 'recall': this.startRecall(c); return null;
        case 'co': c.championsOnly = !!cmd.v; return null;
      }
      return null;
    }
    validTarget(u, t) {
      return t && !t.dead && t.team !== u.team && t.isTargetable() && (u.type !== 'champion' || this.isVisibleTo(u.team, t));
    }
    findAbilityTarget(c, tx, ty, range, championsOnly) {
      let best = null, bd = Infinity;
      for (const u of this.units) {
        if (u.team === c.team || !A.isHittable(u)) continue;
        if (championsOnly && u.type !== 'champion') continue;
        if (!this.isVisibleTo(c.team, u)) continue;
        if (U.dist(c, u) > range + u.radius + c.radius) continue;
        const d = U.distXY(u.x, u.y, tx, ty) - (u.type === 'champion' ? 40 : 0);
        if (d < bd && d < 300 + u.radius) { bd = d; best = u; }
      }
      return best;
    }
    /** Enemigo más conveniente cerca de (x, y): prioriza campeones, luego súbditos/monstruos, luego estructuras. */
    pickTarget(x, y, radius, team, opts) {
      opts = opts || {};
      let best = null, bestScore = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team === team || !u.isTargetable()) continue;
        const structure = u.type === 'tower' || u.type === 'nexus';
        if (opts.championsOnly && u.type !== 'champion') continue;
        if (opts.noStructures && structure) continue;
        if (!this.isVisibleTo(team, u)) continue;
        const d = Math.max(0, U.distXY(u.x, u.y, x, y) - u.radius);
        if (d > radius) continue;
        const pri = u.type === 'champion' ? 0 : structure ? 2 : 1;
        const score = pri * 100000 + d;
        if (score < bestScore) { bestScore = score; best = u; }
      }
      return best;
    }
    /** Enemigo más cercano a la unidad dentro de un alcance (campeones primero). Sin estructuras ni monstruos. */
    nearestEnemyInRange(c, extra, championsOnly) {
      let bestC = null, bcd = Infinity, bestM = null, bmd = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team === c.team || u.team === 2 || !u.isTargetable()) continue;
        if (u.type !== 'champion' && u.type !== 'minion') continue;
        if (!this.isVisibleTo(c.team, u)) continue;
        const d = U.dist(c, u) - u.radius - c.radius;
        if (d > c.attackRange + extra) continue;
        if (u.type === 'champion') { if (d < bcd) { bcd = d; bestC = u; } }
        else if (d < bmd) { bmd = d; bestM = u; }
      }
      return bestC || (championsOnly ? null : bestM);
    }
    /** Control del jugador: ataque automático, ataque-movimiento y correa de persecución. */
    updatePlayerControl(p) {
      if (p.dead || p.dash || p.knock || p.recalling || p.isStunned()) return;
      if (p.target) {
        if (!this.validTarget(p, p.target)) { p.target = null; p.autoTarget = false; }
        else {
          const d = U.dist(p, p.target) - p.target.radius - p.radius;
          const leash = p.autoTarget ? p.attackRange + 200 : p.attackRange + 2500;
          if (d > leash) { p.target = null; p.autoTarget = false; }
        }
      }
      if (p.attackMove && !p.moveTarget) p.attackMove = false;
      if (!p.target && (p.attackMove || !p.moveTarget)) {
        const e = this.nearestEnemyInRange(p, p.attackMove ? 400 : 0, p.championsOnly);
        if (e) { p.target = e; p.autoTarget = !p.attackMove; }
      }
    }
    unitAt(x, y, team) {
      let best = null, bd = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team === team) continue;
        const d = U.distXY(u.x, u.y, x, y);
        if (d < u.radius + 14 && d < bd) { bd = d; best = u; }
      }
      return best;
    }
    lanePoint(c, delta) {
      const path = this.map.pathFor(c.lane, c.team);
      const d = this.map.progress(path, c) + delta;
      return this.map.pointAt(path, U.clamp(d, 0, this.map.laneLength[c.lane]));
    }
    atFountain(c) { return U.dist(c, this.map.fountains[c.team]) < this.map.fountainRadius + 150; }
    startRecall(c) {
      if (c.dead || c.recalling) return;
      c.recalling = { t: 8, max: 8 };   // volver a la base: 8 s como en LoL
      c.target = null; c.moveTarget = null;
    }

    // ---------- Tienda ----------
    canShop(c) { return c.dead || this.atFountain(c); }
    /** Compra con la regla de LoL: usa los componentes que ya tenés y cobra solo lo que falta. */
    buyItem(c, id) {
      const err = M.canBuy(c, id, this.canShop(c));
      if (err) return err;
      const plan = M.purchasePlan(c.items, id);
      const consumed = plan.consume.map(function (i) { return c.items[i]; });
      for (let k = plan.consume.length - 1; k >= 0; k--) c.items.splice(plan.consume[k], 1);
      c.items.push(id);
      c.gold -= plan.cost;
      c.recalc(false);
      c.undo.push({ t: 'buy', id: id, cost: plan.cost, consumed: consumed });
      if (c.undo.length > 20) c.undo.shift();
      return null;
    }
    /** Doble clic / clic derecho en un objeto que no te alcanza: compra los componentes que sí podés pagar.
     *  Devuelve el texto para mostrar (empieza con "✔" si compró algo). */
    buyPartial(c, id) {
      const it = M.itemById[id];
      if (!it) return 'Objeto inexistente';
      const direct = M.canBuy(c, id, this.canShop(c));
      if (!direct) { this.buyItem(c, id); return '✔ Compraste ' + M.itemName(id); }
      if (direct !== 'No te alcanza el oro') return direct;
      const plan = M.partialBuyPlan(c, id);
      if (!plan.buys.length) return 'Oro insuficiente: te faltan ' + Math.ceil(M.purchasePlan(c.items, id).cost - c.gold) + ' de oro para ' + M.itemName(id);
      for (const b of plan.buys) this.buyItem(c, b);
      const names = plan.buys.map(function (b) { return M.itemName(b); });
      const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] : names[0];
      return '✔ No te alcanza para ' + M.itemName(id) + ': compraste ' + list + ' (faltan ' + plan.missing + ' de oro)';
    }
    sellItem(c, index) {
      if (!this.canShop(c)) return 'Tenés que estar en la base para vender';
      const id = c.items[index];
      if (!id) return 'No hay objeto';
      const value = Math.floor(M.itemById[id].cost * M.SELL_RATIO);
      c.items.splice(index, 1); c.gold += value; c.recalc(false);
      c.hp = Math.min(c.hp, c.maxHp); c.mana = Math.min(c.mana, c.maxMana);
      c.undo.push({ t: 'sell', id: id, value: value, index: index });
      return null;
    }
    /** Deshacer la última compra o venta (solo mientras seguís en la tienda, como en LoL). */
    undoShop(c) {
      if (!this.canShop(c)) return 'Tenés que estar en la base';
      const u = c.undo.pop();
      if (!u) return 'No hay nada para deshacer';
      if (u.t === 'buy') {
        const i = c.items.lastIndexOf(u.id);
        if (i < 0) return 'No se puede deshacer';
        c.items.splice(i, 1);
        for (const x of u.consumed) c.items.push(x);
        c.gold += u.cost;
      } else {
        if (c.gold < u.value || c.items.length >= M.MAX_ITEMS) return 'No se puede deshacer';
        c.items.splice(Math.min(u.index, c.items.length), 0, u.id);
        c.gold -= u.value;
      }
      c.recalc(false);
      c.hp = Math.min(c.hp, c.maxHp); c.mana = Math.min(c.mana, c.maxMana);
      return null;
    }
    /** Los bots siguen su ruta de compra (componentes → intermedios → legendarios) y usan las recetas. */
    botShop(c) {
      const build = M.BOT_BUILDS[c.def.role] || M.BOT_BUILDS.Luchador;
      for (let guard = 0; guard < 12; guard++) {
        // siguiente paso de la ruta que todavía no tiene (ni como objeto ni dentro de uno mejor)
        const owned = c.items.slice();
        let next = null;
        for (const id of build) {
          // si lo tiene tal cual, ese objeto "cubre" este paso; si está dentro de uno mejor, el paso ya está hecho
          const k = owned.indexOf(id);
          if (k >= 0) { owned.splice(k, 1); continue; }
          if (owned.some(function (x) { return M.itemContains(x, id); })) continue;
          if (M.itemById[id].boots || id === 'botas') { if (M.hasBoots(c.items) && !(M.itemById[id].from || []).some(function (f) { return f === 'botas' && c.items.indexOf('botas') >= 0; })) continue; }
          next = id; break;
        }
        if (!next) return;
        if (this.buyItem(c, next)) return;
      }
    }

    // ---------- Bucle ----------
    update(dt) {
      if (this.over || this.paused) return;
      this.time += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 20);

      if (this.time >= this.nextWave) { this.spawnWave(); this.nextWave += this.waveInterval; }
      this.updateCamps();
      this.updateVulnerability();
      if (!this.visionTimer || this.time >= this.visionTimer) { this.visionTimer = this.time + 0.1; this.updateVision(); }

      for (const c of this.champions) this.updateChampion(c, dt);

      for (const u of this.units) {
        u.px = u.x; u.py = u.y;
        if (!u.dead) this.updateUnit(u, dt);
      }
      this.separate();
      this.resolveWalls();
      for (const u of this.units) {
        if (u.dead) continue;
        u.vx = (u.x - u.px) / dt; u.vy = (u.y - u.py) / dt;
      }
      this.updateProjectiles(dt);
      this.updateZones(dt);
      this.updateFx(dt);
      // limpiar súbditos y monstruos muertos
      this.units = this.units.filter(function (u) { return !(u.dead && (u.type === 'minion' || u.type === 'monster')); });
    }

    updateChampion(c, dt) {
      if (c.dead) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) this.respawn(c);
        return;
      }
      for (let i = 0; i < 4; i++) if (c.cds[i] > 0) c.cds[i] = Math.max(0, c.cds[i] - dt);
      // Impulso de base (como las Botas del Hogar): +75% de velocidad dentro de la base propia si no estás en combate
      c.baseBoost = U.dist(c, this.map.fountains[c.team]) < this.map.baseRadius && this.time - c.lastCombat > 5;
      // Regeneración: x2.5 fuera de combate (6 s sin dar ni recibir daño, al estilo Wild Rift)
      const ooc = this.time - c.lastCombat > 6 ? 2.5 : 1;
      c.hp = Math.min(c.maxHp, c.hp + c.hpRegen * ooc * dt);
      c.mana = Math.min(c.maxMana, c.mana + c.manaRegen * ooc * dt);
      // Oro pasivo de LoL: 20,4 cada 10 s desde que salen los súbditos
      if (this.time >= this.firstWave) c.gold += 2.04 * dt;
      // Fuente: cura aliados y castiga enemigos
      const fOwn = this.map.fountains[c.team], fEnemy = this.map.fountains[1 - c.team];
      if (U.dist(c, fOwn) < this.map.fountainRadius) {
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.15 * dt);
        c.mana = Math.min(c.maxMana, c.mana + c.maxMana * 0.15 * dt);
      }
      if (U.dist(c, fEnemy) < this.map.fountainRadius + 300) {
        this.damage(null, c, 1000 * dt, 'true', { noText: true });
        if (c.dead) return;
      }
      if (c.reviveAt && this.time >= c.reviveAt) { c.reviveAt = 0; c.hp = Math.max(c.hp, c.maxHp * 0.3); this.particles(c.x, c.y, '#b7ff5a', 20, 400); }
      // Égida Solar: inmolación
      if (c.passives.burn) {
        c.burnT = (c.burnT || 0) + dt;
        if (c.burnT >= 1) {
          c.burnT -= 1;
          for (const e of this.units.slice()) {
            if (e.dead || e.team === c.team || !A.isHittable(e) || U.dist(e, c) > 325 + e.radius) continue;
            this.damage(c, e, (15 + 1.5 * c.level) * (e.type === 'minion' || e.type === 'monster' ? 1.5 : 1), 'magic', { noText: true });
          }
        }
      }
      if (c.undo.length && !this.canShop(c)) c.undo = [];
      if (c.recalling) {
        c.recalling.t -= dt;
        if (c.recalling.t <= 0) {
          c.recalling = null;
          c.x = fOwn.x + U.rand(-100, 100); c.y = fOwn.y + U.rand(-100, 100); c.px = c.x; c.py = c.y;
          c.moveTarget = null; c.target = null;
          this.particles(c.x, c.y, '#9fe0ff', 20, 500);
        }
      }
      if (c.ai) c.ai.update(this, dt);
      else if (c.human) this.updatePlayerControl(c);
    }

    respawn(c) {
      const f = this.map.fountains[c.team];
      c.dead = false; c.hp = c.maxHp; c.mana = c.maxMana; c.buffs = [];
      c.x = f.x + U.rand(-120, 120); c.y = f.y + U.rand(-120, 120); c.px = c.x; c.py = c.y;
      c.target = null; c.moveTarget = null; c.dash = null; c.knock = null; c.recalling = null; c.windup = null;
      if (this.units.indexOf(c) < 0) this.units.push(c);
      if (c.human) this.addFeed('¡Reapareciste!', '#8fd3ff', [c.id]);
    }

    /** Oleada estilo LoL: 3 cuerpo a cuerpo + 3 hechiceros, y un súbdito de asedio cada 3 oleadas. */
    spawnWave() {
      this.waveCount++;
      const minute = this.time / 60;
      const kinds = ['melee', 'melee', 'melee'];
      if (this.waveCount % 3 === 0) kinds.push('cannon');
      kinds.push('caster', 'caster', 'caster');
      for (let team = 0; team < 2; team++) {
        for (const lane of ['top', 'mid', 'bot']) {
          const path = this.map.pathFor(lane, team);
          kinds.forEach((k, i) => {
            const m = M.createMinion(team, lane, k, minute);
            const p = this.map.pointAt(path, 700 - i * 110);
            const off = (i % 2 ? 1 : -1) * 35;
            m.x = p.x + off; m.y = p.y - off; m.px = m.x; m.py = m.y;
            m.think = i * 0.04;
            this.units.push(m);
          });
        }
      }
    }

    updateCamps() {
      for (const camp of this.camps) {
        if (camp.monster && !camp.monster.dead) continue;
        if (camp.pack && camp.pack.some(function (m) { return !m.dead; })) continue;
        if (camp.monster && camp.monster.dead && !camp.respawnAt) camp.respawnAt = this.time + 90;
        if (camp.respawnAt && this.time >= camp.respawnAt) {
          camp.respawnAt = 0;
          camp.monster = M.createMonster(camp, this.time / 60);
          this.units.push(camp.monster);
          if (camp.kind === 'wolf') {
            // los lobos vienen de a tres
            camp.pack = [camp.monster];
            for (let k = 0; k < 2; k++) {
              const pup = M.createMonster(camp, this.time / 60, true);
              pup.x += k ? 150 : -150; pup.y += 110; pup.home = { x: pup.x, y: pup.y }; pup.px = pup.x; pup.py = pup.y;
              camp.pack.push(pup); this.units.push(pup);
            }
          }
        }
      }
    }

    updateVulnerability() {
      for (const t of this.towers) {
        if (t.tier === 'outer') t.vulnerable = true;
        else {
          const outer = this.towers.find(function (o) { return o.team === t.team && o.lane === t.lane && o.tier === 'outer'; });
          t.vulnerable = !outer || outer.dead;
        }
      }
      for (let team = 0; team < 2; team++) {
        this.nexus[team].vulnerable = this.towers.some(function (t) { return t.team === team && t.tier === 'inner' && t.dead; });
      }
    }

    updateUnit(u, dt) {
      u.updateBuffs(this, dt);
      if (u.dead) return;
      if (u.flash > 0) u.flash -= dt;
      if (u.attackCd > 0) u.attackCd -= dt;
      if (u.knock) {
        const kx = u.x + u.knock.vx * dt, ky = u.y + u.knock.vy * dt;
        if (!this.map.nav.blocked(kx, ky)) { u.x = kx; u.y = ky; }
        u.knock.t -= dt;
        if (u.knock.t <= 0) u.knock = null;
        this.clampToMap(u);
        return;
      }
      if (u.dash) { this.updateDash(u, dt); return; }
      if (u.type === 'nexus') return;
      if (u.isStunned()) return;
      if (u.type === 'champion' && u.recalling) return;
      if (u.type === 'minion') this.minionThink(u, dt);
      else if (u.type === 'tower') this.towerThink(u, dt);
      else if (u.type === 'monster') this.monsterThink(u, dt);

      if (u.target && !this.validTarget(u, u.target)) u.target = null;
      // Preparación del ataque (windup): quieto; si cambia de objetivo o se le ordena moverse, se cancela
      if (u.windup) {
        const w = u.windup;
        if (!this.validTarget(u, w.target) || u.target !== w.target) {
          u.windup = null; u.attackCd = 0;
        } else {
          w.t -= dt;
          u.facing = Math.atan2(w.target.y - u.y, w.target.x - u.x);
          if (w.t <= 0) { u.windup = null; this.fireAttack(u, w.target); }
          return;
        }
      }
      if (u.target) {
        const t = u.target;
        if (u.inRangeOf(t)) {
          u.facing = Math.atan2(t.y - u.y, t.x - u.x);
          if (u.attackCd <= 0) this.startAttack(u, t);
        } else if (!u.isStatic) {
          this.moveToward(u, t.x, t.y, dt);
        } else {
          u.target = null;
        }
      } else if (u.moveTarget && !u.isStatic) {
        if (this.moveToward(u, u.moveTarget.x, u.moveTarget.y, dt)) u.moveTarget = null;
      }
    }

    clampToMap(u) {
      u.x = U.clamp(u.x, 50, this.map.width - 50);
      u.y = U.clamp(u.y, 50, this.map.height - 50);
    }

    /** Mueve la unidad hacia (x, y) esquivando paredes (A* sobre la grilla del mapa). Devuelve true al llegar. */
    moveToward(u, x, y, dt) {
      const nav = this.map.nav;
      let tx = x, ty = y;
      if (nav.blocked(x, y)) { const f = nav.nearestFree(x, y); tx = x = f.x; ty = y = f.y; }
      if (!nav.lineClear(u.x, u.y, x, y)) {
        let n = u.nav;
        if (!n || Math.hypot(n.gx - x, n.gy - y) > 150 || this.time > n.until || !n.pts || n.i >= n.pts.length) {
          n = u.nav = { gx: x, gy: y, pts: nav.findPath(u.x, u.y, x, y), i: 0, until: this.time + 1.5 };
        }
        if (n.pts && n.pts.length) {
          while (n.i < n.pts.length - 1 && (Math.hypot(n.pts[n.i].x - u.x, n.pts[n.i].y - u.y) < 60 || nav.lineClear(u.x, u.y, n.pts[n.i + 1].x, n.pts[n.i + 1].y))) n.i++;
          tx = n.pts[n.i].x; ty = n.pts[n.i].y;
        }
      } else u.nav = null;
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
      const step = u.getMoveSpeed() * dt;
      if (d <= step || d < 1) {
        u.x = tx; u.y = ty; this.clampToMap(u);
        return tx === x && ty === y;
      }
      const nx = u.x + dx / d * step, ny = u.y + dy / d * step;
      if (!nav.blocked(nx, ny)) { u.x = nx; u.y = ny; }
      else if (!nav.blocked(nx, u.y)) u.x = nx;          // deslizar contra la pared
      else if (!nav.blocked(u.x, ny)) u.y = ny;
      u.facing = Math.atan2(dy, dx);
      this.clampToMap(u);
      return false;
    }
    /** Ninguna unidad móvil puede quedar dentro de una pared (empujones, separación, etc.). */
    resolveWalls() {
      const nav = this.map.nav;
      for (const u of this.units) {
        if (u.dead || u.isStatic || u.dash) continue;
        if (nav.blocked(u.x, u.y)) {
          if (!nav.blocked(u.px, u.py)) { u.x = u.px; u.y = u.py; }
          else { const f = nav.nearestFree(u.x, u.y); u.x = f.x; u.y = f.y; }
        }
      }
    }

    updateDash(u, dt) {
      const d = u.dash;
      d.t += dt;
      const dx = d.tx - u.x, dy = d.ty - u.y, dist = Math.hypot(dx, dy);
      const step = d.speed * dt;
      if (d.ab.hitAlongPath) {
        for (const e of this.units.slice()) {
          if (e.team === u.team || !A.isHittable(e) || d.hit.has(e.id)) continue;
          if (U.dist(e, u) <= (d.ab.radius || 100) + e.radius) { d.hit.add(e.id); A.hit(this, u, d.ab, e, u); }
        }
      }
      const nx = dist > 0 ? u.x + dx / dist * step : u.x, ny = dist > 0 ? u.y + dy / dist * step : u.y;
      const wall = dist > step && this.map.nav.blocked(nx, ny) && !d.ab.overWalls;
      if (dist <= step || d.t > 1.5 || wall) {
        if (dist <= step) { u.x = d.tx; u.y = d.ty; }
        u.dash = null;
        A.land(this, u, d.ab);
      } else {
        u.x = nx; u.y = ny;
      }
      this.clampToMap(u);
    }

    /** Empieza un ataque básico: el temporizador depende de la velocidad de ataque y una fracción es preparación. */
    startAttack(u, t) {
      if (u.type === 'champion' && u.isStealthed()) u.buffs = u.buffs.filter(function (b) { return b.type !== 'stealth'; });
      const period = 1 / u.getAttackSpeed();
      u.lastAttackAt = this.time; u.attackStart = this.time; u.attackPeriod = period;
      u.attackCd = period;
      u.windup = { target: t, t: period * (u.windupFrac || 0.25) };
    }

    fireAttack(u, t) {
      let dmg = u.ad, crit = false;
      if (u.type === 'tower') {
        if (t.type === 'minion') {
          dmg = t.maxHp * (t.kind === 'cannon' ? 0.14 : t.kind === 'caster' ? 0.7 : 0.45);
          u.heatTarget = null; u.heat = 0;
        } else {
          // Los disparos consecutivos al mismo campeón hacen +40% cada uno (máx. +120%)
          if (u.heatTarget === t) u.heat = Math.min(3, u.heat + 1); else { u.heatTarget = t; u.heat = 0; }
          dmg = (u.ad + this.time / 60 * 9) * (1 + 0.4 * u.heat);
        }
      } else if (u.critChance > 0 && Math.random() < u.critChance) {
        dmg *= u.critDamage; crit = true;
      }
      if (u.ranged) {
        this.projectiles.push({
          id: ++this.seq, kind: 'homing', x: u.x, y: u.y, target: t, source: u, crit: crit, basic: true,
          speed: u.projectileSpeed * (M.PACE ? M.PACE.projectile : 1), damage: dmg,
          color: u.projectileColor, size: u.type === 'tower' ? 24 : (u.type === 'champion' ? 14 : 10)
        });
        // Pasiva "Vendaval" (Huracán): 2 rayos extra a enemigos cercanos
        if (u.passives && u.passives.bolts) {
          const extra = this.units.filter((e) => e !== t && !e.dead && e.team !== u.team && e.team !== 2 && (e.type === 'champion' || e.type === 'minion') &&
            this.isVisibleTo(u.team, e) && U.dist(e, u) < u.attackRange + 250).sort(function (a, b) { return U.dist(a, u) - U.dist(b, u); }).slice(0, 2);
          for (const e of extra) this.projectiles.push({ id: ++this.seq, kind: 'homing', x: u.x, y: u.y, target: e, source: u, crit: crit, bolt: true,
            speed: u.projectileSpeed, damage: dmg * 0.4, color: '#bff4ff', size: 9 });
        }
      } else {
        const dealt = this.damage(u, t, dmg, 'physical', { crit: crit, basic: true });
        this.lifesteal(u, dealt);
        this.onBasicHit(u, t, dmg, crit);
        this.pushFx({ type: 'swing', x: u.x, y: u.y, angle: u.facing, r: u.radius + 45, color: u.type === 'champion' ? u.def.accent : '#ddd', life: 0.15, max: 0.15 });
      }
    }

    /** Efectos al pegar un ataque básico: pasivas de objetos y de campeones. */
    onBasicHit(u, t, dmg, crit) {
      if (!u || u.type !== 'champion' || !t || t.dead) {
        return;
      }
      const P = u.passives || {};
      // Cuchilla Negra: reduce armadura (se acumula)
      if (P.shred && t.type === 'champion') {
        let b = t.buffs.find(function (x) { return x.type === 'armorShred' && x.shredItem; });
        if (!b) { b = { type: 'armorShred', amount: 0, shredItem: true, stacks: 0, duration: 6 }; t.addBuff(b); }
        b.stacks = Math.min(6, b.stacks + 1); b.amount = 0.05 * b.stacks; b.remaining = 6;
      }
      // Hidra: daño en área alrededor del objetivo (solo cuerpo a cuerpo)
      if (P.cleave && !u.ranged) {
        for (const e of this.units.slice()) {
          if (e === t || e.dead || e.team === u.team || !A.isHittable(e)) continue;
          if (U.dist(e, t) < 300 + e.radius) this.damage(u, e, dmg * 0.4, 'physical', { noText: !u.human });
        }
        this.pushFx({ type: 'ring', x: t.x, y: t.y, r0: 30, r1: 300, color: '#ff9a5a', life: 0.25, max: 0.25 });
      }
      // Pikachu: cada 4º ataque descarga electricidad
      if (u.def.passive && u.def.passive.id === 'static') {
        u.staticCount = (u.staticCount || 0) + 1;
        if (u.staticCount >= 4) {
          u.staticCount = 0;
          this.damage(u, t, 30 + 0.2 * u.ap + 4 * u.level, 'magic');
          if (!t.dead && !t.isStatic) t.addBuff({ type: 'slow', amount: 0.3, duration: 1 });
          this.pushFx({ type: 'ring', x: t.x, y: t.y, r0: 20, r1: 140, color: '#fff15a', life: 0.3, max: 0.3 });
        }
      }
    }

    lifesteal(u, dealt) {
      if (u.type !== 'champion' || !dealt) return;
      const ls = u.getLifesteal();
      if (ls > 0) u.hp = Math.min(u.maxHp, u.hp + dealt * ls);
    }

    minionThink(m, dt) {
      m.think -= dt;
      if (m.think > 0) return;
      m.think = 0.25;
      m.progress = this.map.progress(m.path, m);
      // mantener objetivo si sigue siendo válido y cercano
      if (m.target && (!this.validTarget(m, m.target) || U.dist(m, m.target) > m.aggro + 500 || m.target.team === 2)) m.target = null;
      if (m.target && m.target.type !== 'champion') { this.minionAdvance(m); return; }
      let best = null, bd = Infinity, bestPri = 9;
      for (const u of this.units) {
        if (u.dead || u.team === m.team || u.team === 2 || !u.isTargetable()) continue;
        const d = U.dist(m, u) - u.radius;
        if (d > m.aggro) continue;
        const pri = u.type === 'minion' ? 0 : (u.type === 'tower' || u.type === 'nexus') ? 1 : 2;
        if (pri < bestPri || (pri === bestPri && d < bd)) { bestPri = pri; bd = d; best = u; }
      }
      if (best) m.target = best;
      this.minionAdvance(m);
    }
    minionAdvance(m) {
      const wp = m.path[m.wp];
      if (wp && U.dist(m, wp) < 150 && m.wp < m.path.length - 1) m.wp++;
      const p = m.path[m.wp];
      m.moveTarget = { x: p.x, y: p.y };
    }

    towerThink(t, dt) {
      if (t.aggroLock > 0) t.aggroLock -= dt;
      if (t.target && (!this.validTarget(t, t.target) || !t.inRangeOf(t.target))) t.target = null;
      if (t.target) return;
      let bestM = null, bmd = Infinity, bestC = null, bcd = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team === t.team || u.team === 2) continue;
        if (u.type !== 'minion' && u.type !== 'champion') continue;
        if (!t.inRangeOf(u)) continue;
        const d = U.dist(t, u);
        if (u.type === 'minion') { if (d < bmd) { bmd = d; bestM = u; } }
        else if (d < bcd) { bcd = d; bestC = u; }
      }
      t.target = bestM || bestC;
    }

    monsterThink(m, dt) {
      if (m.returning) {
        m.target = null;
        m.moveTarget = { x: m.home.x, y: m.home.y };
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3 * dt);
        if (U.dist(m, m.home) < 25) { m.returning = false; m.moveTarget = null; m.hp = m.maxHp; }
        return;
      }
      if (U.dist(m, m.home) > 1000 || (m.target && m.target.dead)) {
        m.returning = true; m.target = null;
      }
    }

    towerAggro(src, victim) {
      for (const t of this.towers) {
        if (t.dead || t.team !== victim.team) continue;
        // Regla de LoL: si un campeón enemigo daña a un campeón aliado dentro del rango de la torre, la torre lo apunta
        if (t.inRangeOf(src) && t.inRangeOf(victim)) {
          if (t.target !== src) { t.target = src; t.aggroLock = 2; t.windup = null; }
        }
      }
    }

    separate() {
      const movers = [], statics = [];
      for (const u of this.units) {
        if (u.dead) continue;
        if (u.isStatic) statics.push(u); else if (!u.dash) movers.push(u);
      }
      for (let i = 0; i < movers.length; i++) {
        const a = movers[i];
        for (let j = i + 1; j < movers.length; j++) {
          const b = movers[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const min = (a.radius + b.radius) * 0.85;
          if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
          const d = Math.hypot(dx, dy);
          if (d >= min) continue;
          const nx = d > 0.01 ? dx / d : Math.random() - 0.5, ny = d > 0.01 ? dy / d : Math.random() - 0.5;
          const push = (min - d) * 0.5;
          // los campeones se empujan menos que los súbditos
          const wa = a.type === 'champion' ? 0.35 : 0.65, wb = b.type === 'champion' ? 0.35 : 0.65;
          a.x -= nx * push * wa / (wa + wb) * 2 * 0.5; a.y -= ny * push * wa / (wa + wb) * 2 * 0.5;
          b.x += nx * push * wb / (wa + wb) * 2 * 0.5; b.y += ny * push * wb / (wa + wb) * 2 * 0.5;
        }
        for (const s of statics) {
          const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy), min = a.radius + s.radius;
          if (d < min && d > 0.01) { a.x = s.x + dx / d * min; a.y = s.y + dy / d * min; }
        }
      }
    }

    updateProjectiles(dt) {
      const keep = [];
      for (const p of this.projectiles) {
        if (p.kind === 'homing') {
          const t = p.target;
          if (!t || t.dead) continue;
          const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
          const step = p.speed * dt;
          if (d <= step + t.radius * 0.5) {
            const dealt = this.damage(p.source, t, p.damage, 'physical', { crit: p.crit, basic: p.basic || p.bolt });
            this.lifesteal(p.source, dealt);
            if (p.basic) this.onBasicHit(p.source, t, p.damage, p.crit);
            this.particles(t.x, t.y, p.color, 3, 150);
            continue;
          }
          p.x += dx / d * step; p.y += dy / d * step;
          keep.push(p);
        } else {
          const sx = p.vx * dt, sy = p.vy * dt;
          p.x += sx; p.y += sy; p.traveled += Math.hypot(sx, sy);
          let done = false;
          for (const u of this.units) {
            if (u.team === p.source.team || !A.isHittable(u) || p.hit.has(u.id)) continue;
            if (U.dist(p, u) <= p.width / 2 + u.radius) {
              p.hit.add(u.id);
              A.hit(this, p.source, p.ability, u, p);
              if (!p.pierce) { done = true; break; }
            }
          }
          if (!done && p.traveled < p.range) keep.push(p);
        }
      }
      this.projectiles = keep;
    }

    updateZones(dt) {
      const keep = [];
      for (const z of this.zones) {
        if (z.delay > 0) { z.delay -= dt; keep.push(z); continue; }
        if (!z.fired) {
          z.fired = true;
          if (!z.duration) {
            A.applyZone(this, z);
            if (z.shape === 'circle') {
              this.pushFx({ type: 'ring', x: z.x, y: z.y, r0: z.radius * 0.3, r1: z.radius, color: z.color, life: 0.45, max: 0.45, fill: true, def: z.caster.def && z.caster.def.id, slot: z.ab.slot, impact: true });
              this.particles(z.x, z.y, z.color, 18, z.radius * 1.2);
              if (z.radius > 350) this.shake = Math.max(this.shake, 8);
            }
            continue;
          }
          z.remaining = z.duration; z.tickTimer = 0;
        }
        z.tickTimer -= dt;
        if (z.tickTimer <= 0) { A.applyZone(this, z); z.tickTimer += z.tick; }
        z.remaining -= dt;
        if (z.remaining > 0) keep.push(z);
      }
      this.zones = keep;
    }

    updateFx(dt) {
      for (const f of this.fx) f.life -= dt;
      this.fx = this.fx.filter(function (f) { return f.life > 0; });
      for (const t of this.texts) { t.life -= dt; t.y -= 90 * dt; }
      this.texts = this.texts.filter(function (t) { return t.life > 0; });
    }

    // ---------- Daño y muertes ----------
    damage(src, t, amount, kind, opts) {
      if (!t || t.dead || !t.isTargetable() || amount <= 0) return 0;
      const res = kind === 'physical' ? t.getArmor() : kind === 'magic' ? t.getMr() : 0;
      let dmg = amount * 100 / (100 + Math.max(0, res));
      const basic = opts && opts.basic;
      if (basic && t.passives && t.passives.tabi) dmg *= 0.88;
      // Malla de Espinas: devuelve daño mágico al atacante
      if (basic && t.passives && t.passives.thorns && src && !src.dead && src.type !== 'tower') {
        const bonusArmor = Math.max(0, t.armor - M.growth(t.def.stats.armor, t.def.stats.armorPerLevel, t.level));
        this.damage(t, src, 20 + 0.1 * bonusArmor, 'magic', { noText: !t.human && !src.human, label: 'Malla de Espinas' });
      }
      const total = dmg;
      for (const b of t.buffs) {
        if (b.type === 'shield' && b.amount > 0 && dmg > 0) { const a = Math.min(b.amount, dmg); b.amount -= a; dmg -= a; }
      }
      if (t.hasBuff('undying') && t.hp - dmg < 1) dmg = Math.max(0, t.hp - 1);
      t.hp -= dmg; t.flash = 0.1; t.lastHurt = this.time; t.lastCombat = this.time;
      // resumen de muerte: quién te pegó y con qué (últimos segundos)
      if (t.type === 'champion' && total > 0) {
        const r = t.recap || (t.recap = []);
        const label = (opts && opts.label) || (basic ? (opts.crit ? 'Ataque básico (crítico)' : 'Ataque básico') : !src ? 'Fuente enemiga' : src.type === 'tower' ? 'Disparo de torre' : src.type === 'minion' ? 'Ataque de súbdito' : src.type === 'monster' ? 'Ataque de monstruo' : 'Habilidad');
        r.push({ t: this.time, s: src ? src.id : 0, l: label, a: total, k: kind });
        if (r.length > 80) r.shift();
      }
      if (t.type === 'nexus' && src && this.time - (t.lastWarn || -99) > 20) {
        t.lastWarn = this.time;
        this.addFeed('¡El nexo ' + M.TEAM_NAMES[t.team] + ' está bajo ataque!', M.TEAM_COLORS[1 - t.team], null, { k: 'nexus', team: t.team });
      }
      t.lastHitBy = src ? src.id : 0;
      if (src) src.lastCombat = this.time;
      if (t.recalling && dmg > 0) t.recalling = null;
      if (src && src.type === 'champion') t.lastDamagers[src.id] = this.time;
      if (src && src.type === 'champion' && t.type === 'champion') this.towerAggro(src, t);
      if (t.type === 'monster' && src && !t.returning && !t.target) t.target = src;
      if (((src && src.human) || t.human) && total >= 1 && !(opts && opts.noText)) {
        const crit = opts && opts.crit;
        const to = [];
        if (src && src.human) to.push(src.id);
        if (t.human) to.push(t.id);
        // la víctima humana ve el número en rojo; quien pega, en blanco/violeta/naranja
        if (t.human) this.floatText(t.x + U.rand(-30, 30), t.y - t.radius - 30, Math.round(total), '#ff6b6b', false, [t.id]);
        if (src && src.human && src !== t) this.floatText(t.x + U.rand(-30, 30), t.y - t.radius - 30, Math.round(total) + (crit ? '!' : ''),
          crit ? '#ff9f1a' : (kind === 'magic' ? '#d6a8ff' : '#ffffff'), crit, [src.id]);
      }
      if (t.hp <= 0 && t.type === 'champion' && t.def.passive && t.def.passive.id === 'revive' && this.time >= t.reviveReady) {
        // Zombie: vuelve a levantarse
        t.reviveReady = this.time + 150;
        t.hp = 1; t.reviveAt = this.time + 2;
        t.buffs = t.buffs.filter(function (b) { return b.type !== 'dot'; });
        t.addBuff({ type: 'undying', amount: 1, duration: 2 });
        t.addBuff({ type: 'stun', amount: 1, duration: 2 });
        t.target = null; t.moveTarget = null; t.windup = null; t.dash = null; t.recalling = null;
        this.floatText(t.x, t.y - 170, '¡Se levanta!', '#b7ff5a', true);
        this.pushFx({ type: 'ring', x: t.x, y: t.y, r0: 20, r1: 260, color: '#b7ff5a', life: 0.8, max: 0.8 });
        return total;
      }
      if (t.hp <= 0) { t.hp = 0; this.kill(t, src); }
      return total;
    }

    kill(t, src) {
      t.dead = true; t.buffs = []; t.dash = null; t.knock = null; t.target = null; t.moveTarget = null; t.recalling = null;
      const killerChamp = src && src.type === 'champion' ? src : null;
      const tc = M.TEAM_COLORS[t.team];
      if (t.type === 'minion') {
        // Oro solo para quien da el golpe final (last hit); la XP se reparte entre los campeones cercanos
        if (killerChamp) { killerChamp.gainGold(this, t.gold, true); killerChamp.cs++; }
        const near = this.champions.filter(function (c) { return !c.dead && c.team !== t.team && U.dist(c, t) < 1600; });
        const share = [1, 0.652, 0.4343, 0.3257, 0.2606][Math.min(4, Math.max(0, near.length - 1))];
        for (const c of near) c.gainXp(this, t.xp * share);
        this.particles(t.x, t.y, tc, 8, 250);
      } else if (t.type === 'monster') {
        if (killerChamp) { killerChamp.gainGold(this, t.gold || 100, true); killerChamp.gainXp(this, t.xp || 160); killerChamp.cs += t.csValue || 4; }
        if (!t.camp.pack || t.camp.pack.every(function (m) { return m.dead; })) t.camp.respawnAt = this.time + 90;
        this.particles(t.x, t.y, '#b48cff', 20, 400);
      } else if (t.type === 'champion') {
        t.deaths++;
        t.respawnTimer = M.deathTimer(t.level, this.time) * (t.def.passive && t.def.passive.id === 'quickRespawn' ? 0.65 : 1);
        let killer = killerChamp && killerChamp.team !== t.team ? killerChamp : null;
        const assists = [];
        let latest = -1;
        for (const c of this.champions) {
          if (c.team === t.team) continue;
          const when = t.lastDamagers[c.id];
          if (when !== undefined && this.time - when < 10) {
            assists.push(c);
            if (!killer && when > latest) { latest = when; }
          }
        }
        if (!killer && assists.length) {
          killer = assists.reduce(function (b, c) { return t.lastDamagers[c.id] > t.lastDamagers[b.id] ? c : b; });
        }
        const bounty = 300, xp = 0.4 * t.xpToNext() + 30 * t.level;
        if (killer) { killer.kills++; killer.gainGold(this, bounty, true); killer.gainXp(this, xp); }
        const helpers = assists.filter(function (a) { return a !== killer; });
        for (const a of helpers) {
          // asistencias: se reparten el 50% de la recompensa
          a.assists++; a.gainGold(this, bounty * 0.5 / helpers.length, true); a.gainXp(this, xp * 0.5);
        }
        this.score[1 - t.team]++;
        const kc = M.TEAM_COLORS[1 - t.team];
        // anuncio: primera sangre, multiasesinatos (10 s entre muertes), rachas y "racha cortada"
        const first = !!killer && !this.firstBloodDone;
        if (first) this.firstBloodDone = true;
        let multi = 0, spree = 0;
        if (killer) {
          killer.multi = this.time - (killer.lastKillAt == null ? -99 : killer.lastKillAt) <= 10 ? (killer.multi || 0) + 1 : 1;
          killer.lastKillAt = this.time; killer.spree = (killer.spree || 0) + 1;
          multi = killer.multi; spree = killer.spree;
        }
        const ended = t.spree || 0;
        t.spree = 0; t.multi = 0;
        const by = killer ? '' : !src ? 'la fuente' : src.type === 'tower' ? 'una torre' : src.type === 'minion' ? 'los súbditos' : src.type === 'monster' ? 'un monstruo' : '';
        const ann = { k: 'kill', killer: killer ? killer.id : 0, by: by, victim: t.id, team: 1 - t.team, assists: helpers.map(function (a) { return a.id; }),
          first: first, multi: multi, spree: spree, shutdown: ended >= 3 ? ended : 0, recap: this.deathRecap(t) };
        if (killer) this.addFeed(killer.name + ' eliminó a ' + t.name, kc, null, ann);
        else this.addFeed(t.name + ' fue ejecutado por ' + (by || 'el entorno'), kc, null, ann);
        if (this.champions.every(function (c) { return c.team !== t.team || c.dead; })) this.addFeed('¡As! Cayó todo el equipo ' + M.TEAM_NAMES[t.team], kc, null, { k: 'ace', team: t.team });
        if (t.human) this.addFeed('Te eliminaron. Reaparecés en ' + Math.ceil(t.respawnTimer) + ' s', '#ff8a8a', [t.id]);
        t.lastDamagers = {}; t.recap = [];
        this.particles(t.x, t.y, t.def.color, 30, 500);
        this.pushFx({ type: 'ring', x: t.x, y: t.y, r0: 20, r1: 300, color: tc, life: 0.6, max: 0.6 });
      } else if (t.type === 'tower') {
        // Oro de torre: 50 global para todo el equipo + 250 repartidos entre los campeones cercanos
        const near = this.champions.filter(function (c) { return c.team !== t.team && !c.dead && U.dist(c, t) < 1600; });
        for (const c of this.champions) {
          if (c.team === t.team) continue;
          const local = near.indexOf(c) >= 0 ? 250 / near.length : 0;
          c.gainGold(this, 50 + local, c.human);
          if (local) c.gainXp(this, 150);
        }
        this.addFeed('Cayó una torre del carril ' + M.LANE_NAMES[t.lane] + ' (equipo ' + M.TEAM_NAMES[t.team] + ')', M.TEAM_COLORS[1 - t.team], null, { k: 'tower', team: t.team, lane: t.lane });
        this.particles(t.x, t.y, '#aaa', 40, 600);
        this.shake = Math.max(this.shake, 10);
      } else if (t.type === 'nexus') {
        this.over = true; this.winner = 1 - t.team;
        this.addFeed('¡El nexo ' + M.TEAM_NAMES[t.team] + ' fue destruido!', M.TEAM_COLORS[this.winner]);
        this.particles(t.x, t.y, tc, 80, 900);
        this.shake = 20;
        if (this.onGameOver) this.onGameOver(this.winner);
      }
    }

    /** Resumen de los últimos 15 s de daño recibido: por fuente y por habilidad. */
    deathRecap(t) {
      const since = this.time - 15, by = {};
      let total = 0;
      for (const e of t.recap || []) {
        if (e.t < since) continue;
        const key = e.s || ('x' + e.l);
        const src = e.s ? this.units.find(function (u) { return u.id === e.s; }) || this.champions.find(function (u) { return u.id === e.s; }) : null;
        const row = by[key] || (by[key] = { id: e.s, name: src ? (src.name || 'Unidad') : 'Fuente', type: src ? src.type : 'fountain', df: src && src.def ? src.def.id : '', team: src ? src.team : 1 - t.team, total: 0, parts: {} });
        row.total += e.a; total += e.a;
        const pk = e.l + '|' + e.k;
        row.parts[pk] = (row.parts[pk] || 0) + e.a;
      }
      const rows = Object.keys(by).map(function (k) {
        const r = by[k];
        r.total = Math.round(r.total);
        r.parts = Object.keys(r.parts).map(function (pk) { const sp = pk.split('|'); return { l: sp[0], k: sp[1], a: Math.round(r.parts[pk]) }; }).sort(function (a, b) { return b.a - a.a; }).slice(0, 5);
        return r;
      }).sort(function (a, b) { return b.total - a.total; }).slice(0, 6);
      return { total: Math.round(total), rows: rows };
    }

    onLevelUp(c) {
      if (c.human) {
        this.floatText(c.x, c.y - 160, '¡Nivel ' + c.level + '!', '#7fe3ff', true, [c.id]);
        if (M.R_LEVELS.indexOf(c.level) >= 0) this.addFeed('¡Podés subir tu DEFINITIVA (R)!', '#7fe3ff', [c.id]);
      } else if (c.ai) {
        M.BotAI.levelUp(c);
      }
      this.pushFx({ type: 'ring', x: c.x, y: c.y, r0: 20, r1: 170, color: '#7fe3ff', life: 0.5, max: 0.5 });
    }
  }

  /** Equipos para una partida de un jugador: el jugador en Azul y bots para cada rol, sin repetir campeones. */
  Game.soloRoster = function (playerDefId) {
    const pdef = M.championById[playerDefId] || M.champions[0];
    const roster = [{ defId: pdef.id, team: 0, human: true, slot: 'local', name: 'Vos' }];
    return Game.fillWithBots(roster);
  };
  /** Completa los equipos hasta 5 contra 5 con bots, cubriendo los roles que falten. */
  Game.fillWithBots = function (roster) {
    const used = [{}, {}];
    roster.forEach(function (r) { used[r.team === 1 ? 1 : 0][r.defId] = true; });
    const out = roster.slice();
    for (let team = 0; team < 2; team++) {
      const mine = out.filter(function (r) { return (r.team === 1 ? 1 : 0) === team; });
      const haveRoles = mine.map(function (r) { const d = M.championById[r.defId]; return d && d.role; });
      // un Asesino humano cuenta como Luchador o Mago (el que falte primero)
      haveRoles.forEach(function (r, i) { if (r === 'Asesino') haveRoles[i] = haveRoles.indexOf('Luchador') < 0 ? 'Luchador' : 'Mago'; });
      const missing = M.TEAM_ROLES.filter(function (role) {
        const i = haveRoles.indexOf(role); if (i >= 0) { haveRoles.splice(i, 1); return false; } return true;
      });
      while (mine.length < 5) {
        const role = missing.shift();
        const okRole = function (c) { return !role || c.role === role || (M.ROLE_ALT[role] || []).indexOf(c.role) >= 0; };
        let pool = M.champions.filter(function (c) { return okRole(c) && !used[0][c.id] && !used[1][c.id]; });
        if (!pool.length) pool = M.champions.filter(function (c) { return !used[team][c.id]; });
        if (!pool.length) pool = M.champions;
        const pick = U.pick(pool);
        used[team][pick.id] = true;
        const r = { defId: pick.id, team: team, human: false, slot: null, name: '', lane: pick.role === 'Asesino' ? M.ROLE_LANES[role] : undefined };
        out.push(r); mine.push(r);
      }
    }
    return out;
  };

  // Tiempo de reaparición por nivel (tabla de LoL) + extra a partir del minuto 15
  const DEATH_TABLE = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];
  M.deathTimer = function (level, time) {
    const base = DEATH_TABLE[Math.min(17, Math.max(0, level - 1))];
    const min = time / 60;
    return base * (1 + (min > 15 ? Math.min(0.5, (min - 15) * 0.0425) : 0));
  };

  M.Game = Game;
})(window.MOBA);
