// Test headless con Playwright (WebGL por software con SwiftShader).
// Uso: NODE_PATH=<node_modules con playwright> node tools/test.js [archivo.html] [--sin-peer]
// Sin archivo prueba index.html y guarda capturas en screenshots/.
// Multijugador: se prueba con DOS navegadores Chromium separados por PeerJS (WebRTC real, servidor público)
// y con dos pestañas del mismo navegador en modo local (BroadcastChannel).
const { chromium } = require('playwright');
const path = require('path');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const root = path.join(__dirname, '..');
  const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const file = fileArg ? path.resolve(fileArg) : path.join(root, 'index.html');
  const url = 'file://' + file;
  const shots = path.join(root, 'screenshots');
  const takeShots = !fileArg;
  const skipPeer = process.argv.includes('--sin-peer');
  const browser = await chromium.launch({ args: ARGS });
  const errors = [];
  const checks = {};
  const check = (name, ok) => { checks[name] = !!ok; if (!ok) errors.push('FALLÓ: ' + name); };
  const watch = (page, tag) => {
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(tag + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message + '\n' + e.stack));
  };
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  watch(page, '[solo]');
  const shot = async (name, p) => { if (takeShots) await (p || page).screenshot({ path: path.join(shots, name) }); };
  const frames = (p, n) => (p || page).evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n || 2);

  // ---------- Selección ----------
  await page.goto(url);
  await page.waitForSelector('.champ-card');
  check('10 campeones en la selección', (await page.$$eval('#select-layout .champ-card', (els) => els.length)) === 10);
  check('WebGL disponible (Three.js vendorizado cargado)', await page.evaluate(() => typeof THREE !== 'undefined' && MOBA.webglAvailable()));
  check('PeerJS vendorizado cargado', await page.evaluate(() => MOBA.Net.peerAvailable()));
  check('arte de los 10 campeones registrado', await page.evaluate(() => MOBA.champions.every((c) => MOBA.Art.champions[c.id])));
  check('arte de unidades, props y objetos registrado', await page.evaluate(() =>
    ['minion_melee', 'minion_caster', 'minion_cannon', 'tower', 'nexus', 'golem', 'wolf'].every((k) => MOBA.Art.units[k]) &&
    ['tree', 'rock', 'grassTuft'].every((k) => MOBA.Art.props[k]) && MOBA.ITEMS.every((i) => MOBA.Art.items[i.id])));
  await page.click('#select-layout .champ-card[data-id="ignis"]');
  await page.waitForTimeout(1200);
  const lore = await page.evaluate(() => ({ lore: (document.querySelector('#select-layout .lore') || {}).textContent || '', quote: (document.querySelector('#select-layout .quote') || {}).textContent || '' }));
  check('ficha con historia y frase', lore.lore.length > 20 && lore.quote.length > 5);
  await shot('01-seleccion.png');
  await page.click('#select-layout .play-btn');
  await page.waitForFunction(() => MOBA.game && MOBA.debug.renderer, null, { timeout: 15000 });
  await frames(page, 3);
  check('partida iniciada con 10 campeones', await page.evaluate(() => MOBA.game.champions.length === 10 && MOBA.game.player.def.id === 'ignis'));
  check('el renderer 3D dibuja la escena', await page.evaluate(() => { const r = MOBA.debug.renderer; return r.gl.info.render.triangles > 1000; }));
  console.log('Equipos:', await page.evaluate(() => MOBA.game.champions.map((c) => (c.team ? 'R:' : 'A:') + c.name + '(' + c.def.role + ',' + c.lane + ')').join(' ')));

  // ---------- Subida de habilidades (reglas de LoL) ----------
  const lvl1 = await page.evaluate(() => { const p = MOBA.game.player; return { level: p.level, sp: p.skillPoints, ranks: p.ranks.join(','), mana: p.mana }; });
  check('nivel 1 con 1 punto y todas las habilidades bloqueadas', lvl1.level === 1 && lvl1.sp === 1 && lvl1.ranks === '0,0,0,0');
  const plusVisible = async () => { await frames(page, 2); return page.$$eval('.skill-up', (els) => els.map((e) => !e.classList.contains('hidden'))); };
  check('botones + visibles en Q/W/E y no en R', JSON.stringify(await plusVisible()) === '[true,true,true,false]');
  await page.mouse.move(1000, 300);
  await page.keyboard.press('KeyQ');
  await frames(page, 2);
  check('no se puede lanzar una habilidad sin aprender', await page.evaluate((m) => { const p = MOBA.game.player; return p.cds[0] === 0 && p.mana === m; }, lvl1.mana));
  await shot('02-nivel1-subir-habilidad.png');
  await page.keyboard.press('Control+KeyQ');
  check('Ctrl+Q aprende Q', await page.evaluate(() => { const p = MOBA.game.player; return p.ranks[0] === 1 && p.skillPoints === 0; }));
  check('sin puntos no hay botones +', JSON.stringify(await plusVisible()) === '[false,false,false,false]');
  const levelTo = (n) => page.evaluate((n) => { const g = MOBA.game, p = g.player; while (p.level < n) p.gainXp(g, p.xpToNext() - p.xp); }, n);
  await levelTo(2);
  await plusVisible();
  await page.click('.skill-up[data-slot="1"]');
  check('el botón + aprende W', await page.evaluate(() => MOBA.game.player.ranks[1] === 1));
  await levelTo(3);
  await page.keyboard.press('Alt+KeyR');
  check('la R está bloqueada antes del nivel 6', await page.evaluate(() => { const p = MOBA.game.player; return p.ranks[3] === 0 && p.skillPoints === 1 && !p.canLearn(3); }));
  await page.keyboard.press('Alt+KeyE');
  check('Alt+E aprende E', await page.evaluate(() => MOBA.game.player.ranks[2] === 1));
  await levelTo(4);
  await page.keyboard.press('Control+KeyQ');
  const cap = await page.evaluate(() => {
    const p = MOBA.game.player;
    const q2 = p.ranks[0];
    p.skillPoints += 1;
    const learned = p.learn(0);
    const after = p.ranks[0];
    p.learn(1);
    return { q2, learned, after, w: p.ranks[1] };
  });
  check('tope de rango: básica ≤ ⌈nivel/2⌉', cap.q2 === 2 && cap.learned === false && cap.after === 2 && cap.w === 2);
  await levelTo(5);
  await page.keyboard.press('Control+KeyQ');
  await levelTo(6);
  check('al nivel 6 aparece el + de la R', (await plusVisible())[3] === true);
  await page.click('.skill-up[data-slot="3"]');
  check('R aprendida en nivel 6', await page.evaluate(() => { const p = MOBA.game.player; return p.ranks[3] === 1 && p.ranks.join(',') === '3,2,1,1'; }));
  check('lanzar Q con rango funciona', await page.evaluate(() => { const p = MOBA.game.player; return MOBA.debug.cast(0, p.x + 500, p.y - 300) && p.cds[0] > 0; }));
  check('impulso de velocidad en la base', await page.evaluate(() => { const g = MOBA.game, p = g.player; p.lastCombat = -99; MOBA.debug.simulate(0.1); return p.baseBoost && p.getMoveSpeed() > 500; }));

  // ---------- Apuntado generoso, prioridad de campeones, Shift, atacar-mover y ataque automático ----------
  const setup = await page.evaluate(() => {
    const g = MOBA.game, p = g.player, r = MOBA.debug.renderer;
    g.paused = true;
    // un punto del carril central sin arbustos ni paredes cerca
    const N = MOBA.MAP.nav, clear = (x, y) => !N.blocked(x, y) && MOBA.MAP.brushAt(x, y) < 0;
    let sx = 5000;
    for (let x = 4000; x < 10000; x += 100) { let ok = true; for (let dx = -100; dx <= 1000 && ok; dx += 50) for (const dy of [-150, 0, 150]) if (!clear(x + dx, 14000 - x + dy)) ok = false; if (ok) { sx = x; break; } }
    p.x = p.px = sx; p.y = p.py = 14000 - sx; p.target = null; p.moveTarget = null; p.windup = null;
    const m = MOBA.createMinion(1, 'mid', 'melee', 0);
    m.x = m.px = p.x + 600; m.y = m.py = p.y;
    g.units.push(m);
    const ec = g.champions.find((c) => c.team === 1 && !c.dead);
    ec.x = ec.px = m.x + 200; ec.y = ec.py = m.y; ec.target = null; ec.moveTarget = null; ec.hiddenFrom = null;
    r.camLocked = false; r.cam.x = p.x + 300; r.cam.y = p.y;
    window.__t = { m: m, ec: ec };
    return { radius: MOBA.TARGET_RADIUS_PX / r.cam.zoom, free: clear(p.x, p.y) && clear(m.x, m.y) && clear(ec.x, ec.y) };
  });
  check('zona de prueba de apuntado libre de paredes', setup.free);
  const scr = (dx, dy) => page.evaluate(([dx, dy]) => { const m = window.__t.m, r = MOBA.debug.renderer; r.cam.x = MOBA.game.player.x + 300; r.cam.y = MOBA.game.player.y; return r.worldToScreen(m.x + dx, m.y + dy); }, [dx, dy]);
  const rclick = async (pt) => { await page.mouse.move(pt.x, pt.y); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); };
  let pt = await scr(-60, 10);
  await page.mouse.move(pt.x, pt.y);
  await frames(page, 3);
  check('resaltado al pasar el mouse cerca de un súbdito', await page.evaluate(() => MOBA.debug.renderer.hoverTarget === window.__t.m));
  check('cursor de espada sobre enemigo', await page.evaluate(() => document.getElementById('overlay-canvas').style.cursor.indexOf('svg') >= 0));
  await rclick(pt);
  check('clic derecho cerca (no encima) del súbdito lo ataca', await page.evaluate(() => MOBA.game.player.target === window.__t.m));
  pt = await scr(80, 10);
  await rclick(pt);
  check('prioridad de campeón sobre súbdito', await page.evaluate(() => MOBA.game.player.target === window.__t.ec));
  pt = await scr(-60, 10);
  await page.keyboard.down('Shift');
  await rclick(pt);
  await page.keyboard.up('Shift');
  check('Shift: solo campeones (el clic cerca del súbdito solo mueve)', await page.evaluate(() => MOBA.game.player.target === null && !!MOBA.game.player.moveTarget));
  await page.evaluate(() => { const t = window.__t, p = MOBA.game.player; t.ec.x = t.ec.px = 9000; t.ec.y = t.ec.py = 1000; p.target = null; p.moveTarget = null; });
  pt = await scr(-200, 80);
  await page.mouse.move(pt.x, pt.y);
  await frames(page, 2);
  await page.evaluate(() => { MOBA.game.paused = false; });
  await page.keyboard.press('KeyA');
  check('A: atacar-mover toma al súbdito cercano al cursor', await page.evaluate(() => { MOBA.game.paused = true; return MOBA.game.player.target === window.__t.m; }));
  const hpBefore = await page.evaluate(() => {
    const g = MOBA.game, p = g.player, t = window.__t;
    p.target = null; p.moveTarget = null; p.attackMove = false;
    t.m.x = t.m.px = p.x + 450; t.m.y = t.m.py = p.y;
    return t.m.hp;
  });
  await page.mouse.move(800, 300);
  check('ataque automático al estar quieto', await page.evaluate((hp) => { MOBA.debug.simulate(2.5); const p = MOBA.game.player, m = window.__t.m; return (p.target === m && m.hp < hp) || m.dead; }, hpBefore));
  await page.evaluate(() => { MOBA.game.paused = false; MOBA.debug.renderer.camLocked = true; });

  // ---------- Oro por último golpe, XP compartida y agro de torre ----------
  const econ = await page.evaluate(() => {
    const g = MOBA.game, p = g.player;
    g.paused = true;
    const mk = (team, dx) => { const m = MOBA.createMinion(team, 'mid', 'melee', 0); m.x = m.px = p.x + dx; m.y = m.py = p.y + 200; g.units.push(m); return m; };
    const enemy1 = mk(1, 300), ally = mk(0, 200), enemy2 = mk(1, 350);
    const g0 = p.gold, xp0 = p.xp + p.level * 10000;
    g.damage(ally, enemy1, 99999, 'true');      // lo mata un súbdito aliado
    const g1 = p.gold, xp1 = p.xp + p.level * 10000;
    const cs0 = p.cs;
    g.damage(p, enemy2, 99999, 'true');         // golpe final del jugador
    return { noGoldFromOthers: g1 === g0, sharedXp: xp1 > xp0, lastHitGold: Math.round(p.gold - g1), expected: enemy2.gold, cs: p.cs - cs0 };
  });
  check('sin oro si el golpe final no es tuyo (pero sí XP)', econ.noGoldFromOthers && econ.sharedXp);
  check('oro por último golpe', econ.lastHitGold === econ.expected && econ.cs === 1);
  const tower = await page.evaluate(() => {
    const g = MOBA.game, p = g.player;
    const T = g.towers.find((t) => t.team === 1 && t.lane === 'mid' && t.tier === 'outer');
    const E = g.champions.find((c) => c.team === 1 && !c.dead);
    const bm = MOBA.createMinion(0, 'mid', 'melee', 0);
    bm.x = bm.px = T.x - 300; bm.y = bm.py = T.y + 300; g.units.push(bm);
    p.x = p.px = T.x - 500; p.y = p.py = T.y + 450; p.hp = p.maxHp; p.target = null; p.moveTarget = null;
    E.x = E.px = T.x - 350; E.y = E.py = T.y + 150;
    T.target = null; T.aggroLock = 0;
    g.towerThink(T, 1 / 60);
    const first = T.target === bm ? 'minion' : (T.target ? T.target.name : 'nada');
    g.damage(p, E, 10, 'physical');            // el jugador pega a un campeón enemigo dentro del rango de la torre
    const switched = T.target === p;
    const hits = [];
    for (let i = 0; i < 4; i++) { const hp = p.hp; g.fireAttack(T, p); g.projectiles.length = 0; hits.push(T.heat); }
    const out = { first, switched, heat: hits.join(',') };
    // restaurar
    p.x = p.px = g.map.fountains[0].x; p.y = p.py = g.map.fountains[0].y; p.hp = p.maxHp; T.target = null; bm.hp = 0; bm.dead = true;
    g.paused = false;
    return out;
  });
  check('la torre apunta primero a súbditos', tower.first === 'minion');
  check('la torre cambia al campeón que agrede a un aliado', tower.switched);
  check('el daño de torre escala con disparos consecutivos', tower.heat === '0,1,2,3');
  console.log('Torre:', JSON.stringify(tower), 'Economía:', JSON.stringify(econ));

  // ---------- Mapa: paredes, búsqueda de caminos y arbustos ----------
  const nav = await page.evaluate(() => {
    const g = MOBA.game, p = g.player, M = MOBA.MAP;
    const inside = (x, y) => M.walls.some((poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; });
    g.paused = true;
    const from = { x: 1900, y: 9600 }, to = { x: 3500, y: 9600 };     // hay una pared redonda en (2700, 9600)
    const straightBlocked = !M.nav.lineClear(from.x, from.y, to.x, to.y);
    const path = M.nav.findPath(from.x, from.y, to.x, to.y) || [];
    let len = 0, prev = from; for (const q of path) { len += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
    p.x = p.px = from.x; p.y = p.py = from.y; p.target = null; p.lastCombat = -99;
    MOBA.debug.cmd({ t: 'move', x: to.x, y: to.y });
    let inWall = 0, t = 0;
    for (; t < 10 && Math.hypot(p.x - to.x, p.y - to.y) > 30; t += 0.1) { MOBA.debug.simulate(0.1); if (inside(p.x, p.y)) inWall++; }
    const res = { straightBlocked, pathLen: Math.round(len), straight: 1600, arrived: Math.hypot(p.x - to.x, p.y - to.y) <= 30, inWall, secs: t.toFixed(1) };
    // arbustos
    const b = M.brush[0], E = g.champions.find((c) => c.team === 1 && !c.dead);
    E.x = E.px = b.x; E.y = E.py = b.y; E.target = null; E.moveTarget = null; E.lastAttackAt = -99; E.castAt = -99;
    p.x = p.px = b.x + 1400; p.y = p.py = b.y + 200;
    for (const c of g.champions) if (c.team === 0 && c !== p && Math.hypot(c.x - b.x, c.y - b.y) < 2500) { c.x = c.px = M.fountains[0].x; c.y = c.py = M.fountains[0].y; }
    g.updateVision();
    const snap = MOBA.Net.snapshot(g, 0);
    const so = snap.u.find((o) => o.i === E.id);
    res.hiddenInBrush = !g.isVisibleTo(0, E);
    res.snapshotHidesPos = !!so && so.hid === 1 && so.x == null;
    res.cantTargetHidden = !g.validTarget(p, E);
    p.x = p.px = b.x + 60; p.y = p.py = b.y;
    g.updateVision();
    res.visibleWhenInside = g.isVisibleTo(0, E);
    p.x = p.px = M.fountains[0].x; p.y = p.py = M.fountains[0].y;
    g.paused = false;
    return res;
  });
  console.log('Mapa:', JSON.stringify(nav), 'carriles:', JSON.stringify(await page.evaluate(() => MOBA.MAP.laneLength)));
  check('la línea recta cruza la pared y el camino la rodea', nav.straightBlocked && nav.pathLen > nav.straight);
  check('el jugador rodea la pared y llega sin atravesarla', nav.arrived && nav.inWall === 0);
  check('un enemigo en un arbusto queda oculto (y la foto de red no manda su posición)', nav.hiddenInBrush && nav.snapshotHidesPos && nav.cantTargetHidden);
  check('al entrar al arbusto se lo ve', nav.visibleWhenInside);

  // ---------- Partida: acelerada hasta ~2 min ----------
  const s1 = await page.evaluate(() => {
    const g = MOBA.game;
    MOBA.debug.simulate(Math.max(0, 120 - g.time));
    return { time: g.time.toFixed(0), minions: g.units.filter((u) => u.type === 'minion' && !u.dead).length,
      cannons: g.units.filter((u) => u.kind === 'cannon' && !u.dead).length, waves: g.waveCount, score: g.score,
      bots: g.champions.filter((c) => !c.human).map((c) => c.name + ' nv' + c.level + ' [' + c.ranks.join('') + '] ' + Math.round(c.gold) + 'o') };
  });
  console.log('Estado ~2 min:', JSON.stringify(s1));
  check('hay súbditos y oleadas a los 2 min', s1.minions > 10 && s1.waves >= 3);
  check('los bots subieron habilidades', s1.bots.every((b) => /\[(?!0000)/.test(b)));

  // Captura: pelea en 3D con efectos de habilidades
  const fight = await page.evaluate(() => {
    const g = MOBA.game, r = MOBA.debug.renderer;
    let found = null;
    for (let step = 0; step < 240 && !found; step++) {
      MOBA.debug.simulate(0.5);
      for (const c of g.champions) {
        if (c.dead || c.human) continue;
        const near = (u) => !u.dead && Math.hypot(u.x - c.x, u.y - c.y) < 900;
        const champs = g.champions.filter(near).length;
        const enemies = g.champions.filter((u) => near(u) && u.team !== c.team).length;
        const minions = g.units.filter((u) => u.type === 'minion' && near(u)).length;
        if (champs >= 3 && enemies >= 1 && minions >= 5 && g.fx.some((f) => f.type === 'cast' && Math.hypot(f.x - c.x, f.y - c.y) < 900)) { found = c; break; }
      }
    }
    const c = found || g.champions[1];
    r.camLocked = false; r.cam.x = c.x; r.cam.y = c.y + 100;
    g.paused = true;
    return { found: !!found, time: g.time.toFixed(0) };
  });
  console.log('Pelea para captura:', fight);
  await frames(page, 3);
  await shot('03-partida-pelea-3d.png');
  await page.evaluate(() => { MOBA.game.paused = false; });
  // Captura: el jugador en la pelea, con indicador de Q y resaltado
  await page.evaluate(() => {
    const g = MOBA.game, p = g.player, r = MOBA.debug.renderer;
    if (p.dead) { p.respawnTimer = 0; MOBA.debug.simulate(0.05); }
    let enemy = null, ed = 1e9;
    for (const u of g.units) if (!u.dead && u.team === 1 && (u.type === 'champion' || u.type === 'minion') && g.isVisibleTo(0, u)) {
      const dd = Math.hypot(u.x - r.cam.x, u.y - r.cam.y) - (u.type === 'champion' ? 600 : 0);
      if (dd < ed) { ed = dd; enemy = u; }
    }
    const f = g.map.fountains[0];
    const dx = f.x - enemy.x, dy = f.y - enemy.y, d = Math.hypot(dx, dy) || 1;
    const spot = MOBA.MAP.nav.nearestFree(enemy.x + dx / d * 600, enemy.y + dy / d * 600);
    p.x = p.px = spot.x; p.y = p.py = spot.y;
    p.hp = p.maxHp; p.mana = p.maxMana; p.cds = [0, 0, 0, 0];
    p.target = enemy; MOBA.debug.cast(1, enemy.x, enemy.y);
    r.camLocked = true; r.cam.x = p.x; r.cam.y = p.y + 120;
    MOBA.debug.simulate(0.3);
    g.paused = true;
    window.__enemy = enemy;
  });
  const es = await page.evaluate(() => { const e = window.__enemy, r = MOBA.debug.renderer; r.cam.x = MOBA.game.player.x; r.cam.y = MOBA.game.player.y + 120; return r.worldToScreen(e.x, e.y); });
  await page.mouse.move(es.x + 30, es.y + 20);
  await page.evaluate(() => { MOBA.game.paused = false; });
  await page.keyboard.down('KeyQ');
  await frames(page, 2);
  await page.evaluate(() => { MOBA.game.paused = true; });
  await frames(page, 2);
  await shot('04-partida-jugador.png');
  await page.keyboard.press('Escape');     // cancela el lanzamiento (no queremos gastar la Q)
  await page.keyboard.up('KeyQ');
  await page.evaluate(() => { const g = MOBA.game; g.paused = false; if (MOBA.debug.renderer) MOBA.debug.renderer.camLocked = true; });

  // ---------- Partida completa acelerada ----------
  const s2 = await page.evaluate(() => {
    const g = MOBA.game;
    const t0 = performance.now();
    for (let i = 0; i < 120 && !g.over; i++) MOBA.debug.simulate(30);
    return { minutes: (g.time / 60).toFixed(1), over: g.over, winner: g.winner, score: g.score, towersDead: g.towers.filter((t) => t.dead).length,
      levels: g.champions.map((c) => c.name + ':' + c.level + ' ' + c.kills + '/' + c.deaths + '/' + c.assists + ' obj' + c.items.length), ms: Math.round(performance.now() - t0) };
  });
  console.log('Partida completa:', JSON.stringify(s2));
  check('la partida acelerada termina (nexo destruido)', s2.over);
  await page.waitForTimeout(1500);
  await frames(page, 3);
  await shot('05-final.png');
  await page.close();

  // ---------- Multijugador ----------
  async function multiplayer(mode) {
    const tag = mode === 'peer' ? 'PeerJS (2 navegadores)' : 'local (BroadcastChannel)';
    const bB = mode === 'peer' ? await chromium.launch({ args: ARGS }) : browser;
    const ctxA = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const ctxB = mode === 'peer' ? await bB.newContext({ viewport: { width: 1600, height: 900 } }) : ctxA;
    const host = await ctxA.newPage(), cli = await ctxB.newPage();
    watch(host, '[' + mode + ' anfitrión]'); watch(cli, '[' + mode + ' cliente]');
    const q = mode === 'local' ? '?net=local' : '?x=1';
    try {
      await host.goto(url + q);
      await host.fill('#player-name', 'Ulises');
      await host.click('#mode-host');
      await host.click('#create-room-btn');
      await host.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-code').textContent), null, { timeout: 25000 });
      const code = await host.textContent('#lobby-code');
      await cli.goto(url + q + '&sala=' + code);
      check(tag + ': el link con ?sala= completa el código', (await cli.inputValue('#join-code')) === code);
      await cli.fill('#player-name', 'Amigo');
      await cli.click('#join-room-btn');
      await cli.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden'), null, { timeout: 25000 });
      await host.waitForFunction(() => MOBA.Lobby.state.players.length === 2, null, { timeout: 10000 });
      check(tag + ': el amigo entra a la sala con el código ' + code, true);
      await cli.click('#lobby-red');
      await cli.waitForTimeout(300);
      await cli.click('#lobby-grid .champ-card[data-id="vex"]');
      await host.click('#lobby-grid .champ-card[data-id="ignis"]');
      await host.waitForFunction(() => { const p = MOBA.Lobby.state.players; return p.length === 2 && p[0].champ === 'ignis' && p[1].champ === 'vex' && p[1].team === 1; }, null, { timeout: 10000 });
      await cli.waitForFunction(() => { const p = MOBA.Lobby.state.players; return p.length === 2 && p[1].champ === 'vex'; }, null, { timeout: 10000 });
      check(tag + ': elección de equipo y campeón sincronizada', true);
      await host.waitForTimeout(1200);
      if (mode === 'peer') await shot('06-sala-con-codigo.png', host);
      await host.click('#lobby-start');
      await cli.waitForFunction(() => MOBA.debug.session && !MOBA.debug.session.local && MOBA.debug.game.units.length > 20, null, { timeout: 20000 });
      const st = await host.evaluate(() => { const g = MOBA.debug.game; return { n: g.champions.length, humans: g.champions.filter((c) => c.human).map((c) => c.playerName + ':' + c.def.id + ':' + c.team), bots: g.champions.filter((c) => !c.human).length }; });
      check(tag + ': partida con 2 humanos y 8 bots', st.n === 10 && st.humans.length === 2 && st.bots === 8);
      const a = await cli.evaluate(() => { const g = MOBA.debug.game, p = g.player; return { def: p.def.id, team: p.team, x: p.x, y: p.y }; });
      check(tag + ': el cliente controla a Vex del equipo rojo', a.def === 'vex' && a.team === 1);
      const target = { x: a.x - 700, y: a.y + 250 };
      await cli.evaluate((t) => MOBA.debug.cmd({ t: 'move', x: t.x, y: t.y }), target);
      await host.waitForFunction((t) => { const c = MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1); return Math.hypot(c.x - t.x, c.y - t.y) < 60; }, target, { timeout: 40000 });
      await cli.waitForFunction((t) => { const p = MOBA.debug.game.player; return Math.hypot(p.x - t.x, p.y - t.y) < 80; }, target, { timeout: 15000 });
      check(tag + ': la orden del cliente mueve su campeón en el anfitrión y la foto vuelve al cliente', true);
      await cli.evaluate(() => MOBA.debug.cmd({ t: 'learn', s: 0 }));
      await host.waitForFunction(() => MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1).ranks[0] === 1, null, { timeout: 10000 });
      check(tag + ': el cliente aprende una habilidad', true);
      if (mode === 'peer') {
        await cli.evaluate(() => { const r = MOBA.debug.renderer; r.camLocked = true; });
        await cli.waitForTimeout(800);
        await shot('07-cliente-online.png', cli);
      }
      await cli.close();
      await host.waitForFunction(() => { const c = MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1); return !c.human && !!c.ai; }, null, { timeout: 15000 });
      check(tag + ': si el amigo se va, un bot toma su campeón', true);
    } catch (e) {
      check(tag + ': ' + e.message.split('\n')[0], false);
    }
    await host.close();
    if (bB !== browser) await bB.close(); else await ctxA.close();
  }
  const peerOk = await (async () => { try { const r = await fetch('https://0.peerjs.com/peerjs/id'); return r.ok; } catch (e) { return false; } })();
  if (!skipPeer && peerOk && !fileArg) await multiplayer('peer');
  else console.log('Multijugador PeerJS: no probado (' + (skipPeer ? '--sin-peer' : fileArg ? 'test del dist' : 'servidor de PeerJS inalcanzable') + ')');
  await multiplayer('local');

  console.log('Chequeos:', JSON.stringify(checks, null, 1));
  console.log('Total:', Object.values(checks).filter(Boolean).length + '/' + Object.keys(checks).length);
  console.log('Errores/advertencias de consola:', errors.length ? errors : 'ninguno');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
