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
  check('16 campeones en la selección', (await page.$$eval('#select-layout .champ-card', (els) => els.length)) === 16);
  check('WebGL disponible (Three.js vendorizado cargado)', await page.evaluate(() => typeof THREE !== 'undefined' && MOBA.webglAvailable()));
  check('PeerJS vendorizado cargado', await page.evaluate(() => MOBA.Net.peerAvailable()));
  check('arte de los 16 campeones registrado', await page.evaluate(() => MOBA.champions.every((c) => MOBA.Art.champions[c.id])));
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

  // ---------- Ronda 5: tienda con recetas, configuración, audio y campeones nuevos ----------
  const p5 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  watch(p5, '[r5]');
  await p5.goto(url);
  await p5.waitForSelector('.champ-card');
  await p5.evaluate(() => { localStorage.clear(); MOBA.Settings.load(); });
  check('filtro de rol "Asesino" en la selección', await p5.evaluate(() => [...document.querySelectorAll('#role-filters button')].some((b) => /Asesino/.test(b.textContent))));
  check('música: menú y partida apuntan a los archivos de assets/music', await p5.evaluate(() => /menu\.mp3$/.test(MOBA.Audio.tracks.menu.url) && /batalla\.mp3$/.test(MOBA.Audio.tracks.match.url)));
  await p5.waitForTimeout(1500);
  check('los archivos de música cargan (sin caer al respaldo)', await p5.evaluate(() => MOBA.Audio.tracks.menu.ready && !MOBA.Audio.tracks.menu.failed && MOBA.Audio.source('match') === 'archivo'));
  const NEW = ['trex', 'dragon', 'zombie', 'creeper', 'enderman', 'pikachu'];
  check('los 6 campeones nuevos tienen datos, arte, historia y frase', await p5.evaluate((ids) => ids.every((id) => MOBA.championById[id] && MOBA.Art.champions[id] && MOBA.Art.champions[id].lore && MOBA.Art.champions[id].quote), NEW));
  await p5.click('#role-filters button[data-role="Asesino"]');
  check('el filtro Asesino muestra a Creeper y Enderman', JSON.stringify(await p5.$$eval('#select-layout .champ-card', (els) => els.map((e) => e.dataset.id).sort())) === '["creeper","enderman"]');
  await p5.click('#role-filters button[data-role="Todos"]');
  await p5.click('#select-layout .champ-card[data-id="dragon"]');
  await p5.waitForTimeout(1200);
  await shot('08-seleccion-nuevos.png', p5);

  // Recetas (regla de LoL)
  const recipe = await p5.evaluate(() => ({
    fromZero: MOBA.purchasePlan([], 'cuchilla').cost,
    withParts: MOBA.purchasePlan(['espada', 'espada', 'rubi'], 'cuchilla').cost,
    withMid: MOBA.purchasePlan(['martillo', 'botas'], 'cuchilla'),
  }));
  check('receta: legendario sin componentes cuesta el total', recipe.fromZero === 3000);
  check('receta: los componentes que tenés se descuentan', recipe.withParts === 1900 && recipe.withMid.cost === 1950 && recipe.withMid.consume.join() === '0');
  await p5.evaluate(() => MOBA.debug.start('trex'));
  await p5.waitForFunction(() => MOBA.game && MOBA.debug.renderer, null, { timeout: 15000 });
  const buy = await p5.evaluate(() => {
    const g = MOBA.game, p = g.player, f = g.map.fountains[p.team];
    p.x = f.x; p.y = f.y; p.items = ['espada', 'espada', 'rubi']; p.recalc(); p.gold = 1900;
    const err = MOBA.debug.cmd({ t: 'buy', item: 'cuchilla' });
    const after = { items: p.items.join(), gold: Math.round(p.gold) };
    const undoErr = MOBA.debug.cmd({ t: 'undo' });
    return { err, after, undoErr, undone: { items: p.items.join(), gold: Math.round(p.gold) } };
  });
  check('comprar el legendario consume los componentes y cobra solo la diferencia', !buy.err && buy.after.items === 'cuchilla' && buy.after.gold === 0);
  check('deshacer devuelve componentes y oro', !buy.undoErr && buy.undone.items === 'espada,espada,rubi' && buy.undone.gold === 1900);
  await p5.evaluate(() => { const p = MOBA.game.player; p.gold = 2400; p.items = ['espada', 'rubi', 'botas']; p.recalc(); MOBA.game.paused = true; });
  await p5.click('#shop-btn');
  await p5.waitForSelector('#shop .scard');
  await p5.click('#shop .scard[data-sel="cuchilla"]');
  await p5.waitForTimeout(300);
  const tree = await p5.evaluate(() => ({ owned: document.querySelectorAll('#shop .tree .tnode.owned').length, price: (document.querySelector('#shop .dprice') || {}).textContent || '' }));
  check('árbol de la tienda marca los componentes que ya tenés y el precio con descuento', tree.owned === 2 && /te sale 2250/.test(tree.price));
  await frames(p5, 2);
  await shot('09-tienda-arbol.png', p5);
  await p5.click('#shop .close-btn');

  // Bots compran siguiendo las rutas
  const bots = await p5.evaluate(() => { const g = MOBA.game; g.paused = false; MOBA.debug.simulate(600); return g.champions.filter((c) => !c.human).map((c) => c.items.map((x) => ({ id: x, tier: MOBA.itemById[x].tier, boots: !!MOBA.itemById[x].boots }))); });
  console.log('Objetos de bots (10 min):', bots.map((it) => it.map((x) => x.id).join('+')).join(' | '));
  check('los bots compran por rutas (sin intermedios repetidos de más y con al menos un objeto armado)',
    bots.every((it) => it.length > 0) && bots.some((it) => it.some((x) => x.tier >= 2)) && bots.every((it) => it.filter((x) => x.tier === 2 && !x.boots).length <= 2));

  // Configuración: abrir, reasignar tecla, persistir, daltonismo, modo de lanzamiento
  await p5.click('#hud-gear');
  await p5.waitForSelector('#settings .keybtn');
  check('el menú de configuración pausa la partida solo', await p5.evaluate(() => MOBA.game.paused === true));
  await frames(p5, 2);
  await shot('10-configuracion.png', p5);
  await p5.click('#settings .keybtn[data-bind="recall"][data-i="0"]');
  await p5.keyboard.press('KeyH');
  check('reasignar: la nueva tecla queda guardada', await p5.evaluate(() => MOBA.Settings.get('keys').recall[0] === 'KeyH' && JSON.parse(localStorage.getItem('mvmoba-settings-v1')).keys.recall[0] === 'KeyH'));
  await p5.click('#settings .set-done');
  const rb = await p5.evaluate(() => { const g = MOBA.game, p = g.player; g.paused = false; p.recalling = null; p.lastCombat = -99; p.dead = false; return 1; });
  await p5.mouse.move(800, 450);
  await p5.keyboard.press('KeyB');
  const recB = await p5.evaluate(() => !!MOBA.game.player.recalling);
  await p5.keyboard.press('KeyH');
  const recH = await p5.evaluate(() => !!MOBA.game.player.recalling);
  check('reasignar: la tecla nueva funciona y la vieja ya no', !recB && recH);
  await p5.evaluate(() => { MOBA.game.player.recalling = null; MOBA.Settings.set('castMode', 'quick'); const p = MOBA.game.player; while (p.level < 3) p.gainXp(MOBA.game, p.xpToNext() - p.xp); p.skillPoints++; p.learn(1); p.cds[1] = 0; p.mana = p.maxMana; p.buffs = []; });
  await p5.keyboard.down('KeyW');
  const quick = await p5.evaluate(() => MOBA.game.player.cds[1] > 0 && MOBA.debug.aiming == null);
  await p5.keyboard.up('KeyW');
  check('lanzamiento rápido: la habilidad sale al apretar la tecla', quick);
  await p5.evaluate(() => MOBA.Settings.set('castMode', 'indicator'));
  const cb = await p5.evaluate(() => {
    MOBA.Settings.set('colorblind', 'deuteranopia');
    const g = MOBA.game, r = MOBA.debug.renderer, enemy = g.champions.find((c) => c.team === 1);
    MOBA.debug.simulate(0.05); r.draw(0.016);
    const v = r.views.get(enemy.id);
    const ring = '#' + v.ring.material.color.getHexString();
    return { team1: MOBA.TEAM_COLORS[1], bar: r.barColor(enemy), ring, css: getComputedStyle(document.documentElement).getPropertyValue('--team1').trim() };
  });
  check('modo daltonismo cambia colores de equipo, barras, anillos y minimapa', cb.team1 === '#ff9a1f' && cb.bar === '#ff9a1f' && cb.ring === '#ff9a1f' && cb.css === '#ff9a1f');
  await p5.evaluate(() => { MOBA.Settings.set('camPitch', 48); MOBA.Settings.set('teamShapes', true); });
  check('la inclinación de cámara se aplica en vivo', await p5.evaluate(() => Math.abs(MOBA.debug.renderer.pitch - 48 * Math.PI / 180) < 1e-6));
  await p5.reload();
  await p5.waitForSelector('.champ-card');
  check('la configuración persiste al recargar', await p5.evaluate(() => MOBA.Settings.get('camPitch') === 48 && MOBA.Settings.get('colorblind') === 'deuteranopia' && MOBA.Settings.get('keys').recall[0] === 'KeyH' && MOBA.TEAM_COLORS[1] === '#ff9a1f'));
  await p5.click('#menu-gear');
  check('configuración también desde el menú principal', await p5.evaluate(() => MOBA.SettingsUI.isOpen()));
  await p5.keyboard.press('Escape');
  await p5.evaluate(() => { MOBA.Settings.reset(); });

  // Campeones nuevos: cargan, se dibujan y lanzan las 4 habilidades
  const casts = await p5.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      MOBA.debug.startWith([id, 'granito', 'lyra', 'bolt', 'sol', 'bastion', 'ignis', 'kaida', 'vex', 'mora']);
      const g = MOBA.game, p = g.player, r = MOBA.debug.renderer;
      while (p.level < 18) p.gainXp(g, p.xpToNext() - p.xp);
      for (let k = 0; k < 18; k++) for (const s of [3, 0, 1, 2]) p.learn(s);
      const e = g.champions.find((c) => c.team === 1);
      const res = [];
      for (let s = 0; s < 4; s++) {
        p.x = p.px = 7000; p.y = p.py = 7000; e.x = e.px = 7250; e.y = e.py = 7000; e.dead = false; e.hp = e.maxHp;
        p.buffs = []; p.mana = p.maxMana; p.cds = [0, 0, 0, 0]; p.hp = p.maxHp; p.knock = null;
        const ok = MOBA.debug.cast(s, e.x, e.y);
        MOBA.debug.simulate(0.6);
        res.push(ok && p.cds[s] > 0);
      }
      r.draw(0.016);
      const v = r.views.get(p.id);
      out[id] = { casts: res, art: !!v && v.artId === 'champ:' + id && !v.broken && !r.artErrors['champ:' + id] && ![0, 1, 2, 3].some((k) => r.artErrors['fx:' + id + k]) };
    }
    return out;
  }, NEW);
  console.log('Campeones nuevos:', JSON.stringify(casts));
  check('los 6 campeones nuevos cargan con su arte y lanzan Q/W/E/R', NEW.every((id) => casts[id].art && casts[id].casts.every(Boolean)));

  // Captura: pelea con los campeones nuevos
  await p5.evaluate(() => {
    MOBA.debug.startWith(['dragon', 'trex', 'pikachu', 'zombie', 'sol', 'creeper', 'enderman', 'kaida', 'vex', 'mora']);
    const g = MOBA.game, r = MOBA.debug.renderer;
    const cx = 7000, cy = 7000;
    const spots = [[-260, 60], [-120, -170], [-380, -120], [-150, 190], [-480, 120], [200, -60], [150, 140], [330, -170], [340, 120], [480, 0]];
    g.champions.forEach((c, i) => {
      const s = MOBA.MAP.nav.nearestFree(cx + spots[i][0], cy + spots[i][1]);
      c.x = c.px = s.x; c.y = c.py = s.y; c.moveTarget = null;
      while (c.level < 11) c.gainXp(g, c.xpToNext() - c.xp);
      for (let k = 0; k < 12; k++) for (const sl of [3, 0, 1, 2]) c.learn(sl);
      c.mana = c.maxMana;
    });
    const by = (id) => g.champions.find((c) => c.def.id === id);
    const cast = (id, s, t) => { const c = by(id), tt = by(t); MOBA.Abilities.cast(g, c, s, tt.x, tt.y); };
    MOBA.debug.simulate(1.3);   // que se vayan los anillos de "subiste de nivel"
    g.champions.forEach((c) => { c.mana = c.maxMana; c.cds = [0, 0, 0, 0]; });
    cast('pikachu', 0, 'enderman'); cast('zombie', 0, 'creeper'); cast('enderman', 1, 'trex');
    MOBA.debug.simulate(0.3);
    cast('dragon', 0, 'creeper'); cast('creeper', 2, 'zombie');
    MOBA.debug.simulate(0.2);
    r.camLocked = false; r.cam.x = cx; r.cam.y = cy + 80; r.userZoom = r.zoomTarget = 1.3; r.updateZoom();
    g.paused = true;
  });
  await frames(p5, 3);
  await shot('11-pelea-nuevos.png', p5);
  await p5.close();

  // ---------- Multijugador ----------
  // ---------- HUD estilo LoL: anuncios, panel de objetivo, resumen de muerte, compra parcial ----------
  {
    const ph = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    watch(ph, '[hud]');
    await ph.goto(url);
    await ph.evaluate(() => MOBA.debug.startWith(['ignis', 'sol', 'bolt', 'bastion', 'rorik', 'pikachu', 'kaida', 'vex', 'mora', 'creeper']));
    await frames(ph, 3);
    const ann = await ph.evaluate(() => {
      const g = MOBA.game, me = g.player, hud = MOBA.debug.hud();
      const en = g.champions.filter((c) => c.team !== me.team), al = g.champions.filter((c) => c.team === me.team && c !== me);
      const take = () => { hud.extra.pullFeed(); const q = hud.extra.queue.map((a) => a.title + ' | ' + a.sub); hud.extra.queue = []; return q.join(' || '); };
      const dmg = (v, k) => { v.lastDamagers[k.id] = g.time; };
      take();
      const out = {};
      dmg(en[0], me); g.kill(en[0], me); out.mineFirst = take();
      dmg(en[1], al[0]); g.kill(en[1], al[0]); out.allyKill = take();
      dmg(al[1], en[2]); g.kill(al[1], en[2]); out.allySlain = take();
      g.time += 30;
      dmg(en[3], me); g.kill(en[3], me); out.mine = take();
      g.time += 30;
      dmg(me, en[4]); me.recap = [{ t: g.time, s: en[4].id, l: 'Ataque básico', a: 420, k: 'physical' }, { t: g.time, s: en[4].id, l: en[4].def.abilities[0].name, a: 310, k: 'magic' }, { t: g.time, s: en[2].id, l: en[2].def.abilities[1].name, a: 200, k: 'magic' }];
      g.kill(me, en[4]); out.died = take();
      out.recap = hud.extra.lastRecap && hud.extra.lastRecap.total;
      g.time += 30;
      const k = al[2]; [en[1], en[2], en[3]].forEach((v) => { v.dead = false; v.hp = v.maxHp; });
      dmg(en[1], k); g.kill(en[1], k); take(); dmg(en[2], k); g.kill(en[2], k); out.double = take();
      dmg(en[3], k); g.kill(en[3], k); out.triple = take();
      const t = MOBA.announceText;
      out.towerOwn = t({ k: 'tower', team: me.team, lane: 'mid' }, me).title;
      out.towerEnemy = t({ k: 'tower', team: 1 - me.team, lane: 'top' }, me).title;
      out.ace = t({ k: 'ace', team: 1 - me.team }, me).title + ' / ' + t({ k: 'ace', team: me.team }, me).sub;
      out.nexus = (t({ k: 'nexus', team: me.team }, me) || {}).title + ' / ' + t({ k: 'nexus', team: 1 - me.team }, me);
      out.enemyView = t({ k: 'kill', killer: al[0].id, victim: en[0].id, team: me.team }, en[1], (id) => g.champions.find((c) => c.id === id)).title;
      return out;
    });
    console.log('Anuncios:', JSON.stringify(ann));
    check('anuncio: vos matás primero → "¡Primera sangre!" + "¡Has asesinado a un enemigo!"', /^¡Primera sangre! \| ¡Has asesinado a un enemigo!/.test(ann.mineFirst));
    check('anuncio: un aliado mata → "¡Un enemigo ha sido asesinado!"', /^¡Un enemigo ha sido asesinado!/.test(ann.allyKill));
    check('anuncio: matan a un aliado → "¡Un aliado ha sido asesinado!"', /^¡Un aliado ha sido asesinado!/.test(ann.allySlain));
    check('anuncio: matás de nuevo → "¡Has asesinado a un enemigo!"', /^¡Has asesinado a un enemigo!/.test(ann.mine));
    check('anuncio: te matan → "¡Has sido asesinado!"', /^¡Has sido asesinado!/.test(ann.died));
    check('anuncio: asesinato doble y triple', /^¡Asesinato doble!/.test(ann.double) && /^¡Asesinato triple!/.test(ann.triple));
    check('anuncio: torres, as y nexo según tu equipo', ann.towerOwn === '¡Destruyeron una de tus torres!' && ann.towerEnemy === '¡Tu equipo destruyó una torre!' && /^¡As! \/ Cayó todo tu equipo$/.test(ann.ace) && ann.nexus === '¡Tu nexo está bajo ataque! / null');
    check('anuncio: el mismo asesinato visto por el enemigo dice "¡Un aliado ha sido asesinado!"', ann.enemyView === '¡Un aliado ha sido asesinado!');
    check('resumen de muerte: suma el daño recibido (930)', ann.recap === 930);
    await ph.evaluate(() => { const hud = MOBA.debug.hud(); hud.extra.recapShown = false; hud.slowTimer = 0; hud.update(0.3); });
    await frames(ph, 3);
    await shot('14-resumen-muerte.png', ph);
    const recapTxt = await ph.textContent('#death-recap');
    check('resumen de muerte visible al morir, con fuentes y habilidades', await ph.isVisible('#death-recap') && /Resumen de muerte/.test(recapTxt) && /Ataque básico/.test(recapTxt));
    await ph.evaluate(() => {
      const g = MOBA.game, me = g.player, hud = MOBA.debug.hud();
      me.dead = false; me.hp = me.maxHp; me.respawnTimer = 0; hud.extra.lastRecap = null;
      hud.extra.queue = []; hud.extra.cur = null; hud.extra.gap = 0;
      const v = g.champions.find((c) => c.team !== me.team);
      v.dead = false; v.lastDamagers[me.id] = g.time; me.lastKillAt = g.time - 2; me.multi = 1; g.kill(v, me);
      g.paused = true;
    });
    for (let i = 0; i < 8; i++) await ph.evaluate(() => { MOBA.debug.hud().update(0.03); });
    await ph.waitForTimeout(350);
    const bannerTxt = await ph.textContent('#announce');
    check('anuncio grande en pantalla con retratos', /¡Asesinato doble!/.test(bannerTxt) && (await ph.$$('#announce .ann-pic img')).length === 2);
    await shot('12-anuncio.png', ph);
    const tp = await ph.evaluate(() => {
      const g = MOBA.game, me = g.player, r = MOBA.debug.renderer, hud = MOBA.debug.hud();
      hud.extra.queue = []; hud.extra.cur = null; document.getElementById('announce').className = 'hidden';
      const e = g.champions.find((c) => c.team !== me.team && c.def.id === 'vex');
      e.dead = false; e.items = ['filo', 'grebas', 'daga']; e.recalc(false); e.hp = Math.round(e.maxHp * 0.62);
      e.x = me.x + 250; e.y = me.y - 60; e.px = e.x; e.py = e.y; e.moveTarget = null; e.target = null;
      if (g.units.indexOf(e) < 0) g.units.push(e);
      e.addBuff({ type: 'slow', amount: 0.3, duration: 3 }); e.addBuff({ type: 'attackSpeed', amount: 0.4, duration: 5 });
      r.camLocked = false; r.cam.x = me.x + 120; r.cam.y = me.y; r.userZoom = r.zoomTarget = 1.4; r.updateZoom();
      return { id: e.id, x: e.x, y: e.y };
    });
    await frames(ph, 4);
    const scr = await ph.evaluate((t) => MOBA.debug.renderer.worldToScreen(t.x, t.y, 60), tp);
    await ph.mouse.click(scr.x, scr.y, { button: 'left' });
    await ph.evaluate(() => { const h = MOBA.debug.hud(); h.slowTimer = 0; h.update(0.3); });
    const panel = await ph.evaluate((id) => {
      const g = MOBA.game, e = g.champions.find((c) => c.id === id), el = document.getElementById('target-panel');
      const val = (lab) => { const s = [...el.querySelectorAll('.tp-stats span')].find((x) => x.querySelector('em').textContent === lab); return s ? s.querySelector('b').textContent : null; };
      return { vis: !el.classList.contains('hidden'), sel: MOBA.debug.hud().extra.selected === e, name: (el.querySelector('.tp-name') || {}).textContent, hp: (el.querySelector('.tp-bar.hp span') || {}).textContent,
        expHp: Math.ceil(e.hp) + ' / ' + Math.round(e.maxHp), ad: val('Daño'), expAd: String(Math.round(e.ad)), armor: val('Armadura'), expArmor: String(Math.round(e.getArmor())),
        as: val('Vel. at.'), expAs: e.getAttackSpeed().toFixed(2), crit: val('Crítico'), expCrit: Math.round(e.critChance * 100) + '%', range: val('Alcance'), expRange: String(Math.round(e.attackRange)),
        items: el.querySelectorAll('.tp-items img').length, buffs: el.querySelectorAll('.tp-buffs .buff').length, targetAfter: !!g.player.target };
    }, tp.id);
    console.log('Panel de objetivo:', JSON.stringify(panel));
    check('panel de objetivo: clic izquierdo selecciona sin atacar', panel.vis && panel.sel && !panel.targetAfter && /Vex/.test(panel.name));
    check('panel de objetivo: vida, daño, armadura, vel. de ataque, crítico y alcance correctos', panel.hp === panel.expHp && panel.ad === panel.expAd && panel.armor === panel.expArmor && panel.as === panel.expAs && panel.crit === panel.expCrit && panel.range === panel.expRange);
    check('panel de objetivo: objetos y efectos con tiempo', panel.items === 3 && panel.buffs >= 2);
    await frames(ph, 2);
    await shot('13-panel-objetivo.png', ph);
    await ph.keyboard.press('Escape');
    check('Esc deselecciona la unidad', await ph.evaluate(() => !MOBA.debug.hud().extra.selected));
    const pb = await ph.evaluate(() => {
      const g = MOBA.game, p = g.player;
      const f = g.map.fountains[p.team]; p.x = f.x; p.y = f.y; p.dead = false;
      const out = {};
      p.items = []; p.gold = 1000; p.undo = [];
      out.msg1 = MOBA.debug.cmd({ t: 'buyPartial', item: 'filo' }); out.items1 = p.items.join(','); out.gold1 = p.gold;
      p.items = []; p.gold = 500;
      out.msg2 = MOBA.debug.cmd({ t: 'buyPartial', item: 'cuchilla' }); out.items2 = p.items.join(','); out.gold2 = p.gold;
      p.items = ['espada']; p.gold = 1100;
      out.msg3 = MOBA.debug.cmd({ t: 'buyPartial', item: 'cuchilla' }); out.items3 = p.items.join(','); out.gold3 = p.gold;
      p.items = []; p.gold = 100;
      out.msg4 = MOBA.debug.cmd({ t: 'buyPartial', item: 'filo' }); out.gold4 = p.gold;
      return out;
    });
    console.log('Compra parcial:', JSON.stringify(pb));
    check('compra parcial: con 1000 de oro para el Filo compra Espada (350) y Capa (600), queda 50', pb.items1 === 'espada,capa' && pb.gold1 === 50 && /compraste/.test(pb.msg1) && /faltan 2400 de oro/.test(pb.msg1));
    check('compra parcial: baja por la receta (Cuchilla con 500 → Cristal de Rubí, queda 100)', pb.items2 === 'rubi' && pb.gold2 === 100);
    check('compra parcial: respeta lo que ya tenés (Espada + 1100 → Gema 800, queda 300)', pb.items3 === 'espada,gema' && pb.gold3 === 300);
    check('compra parcial: sin nada que alcance → "Oro insuficiente" y el oro no cambia', /^Oro insuficiente/.test(pb.msg4) && pb.gold4 === 100);
    await ph.evaluate(() => { const p = MOBA.game.player, hud = MOBA.debug.hud(); p.items = []; p.gold = 1300; hud.shopTab = 'all'; hud.toggleShop(true); });
    await ph.dblclick('#shop .scard[data-sel="filo"]');
    await ph.waitForTimeout(300);
    const toast = await ph.textContent('#shop .shop-toast').catch(() => '');
    check('tienda: doble clic en un objeto caro muestra el aviso de compra parcial', /No te alcanza para .*compraste .* \(faltan \d+ de oro\)/.test(toast));
    await shot('15-tienda-compra-parcial.png', ph);
    await ph.close();
  }
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

      // ---------- Regresión: asesinatos del cliente por la red (antes desconectaba al que se unió) ----------
      {
        // los anuncios que muestra cada pantalla, desde su propio punto de vista
        const spy = () => { const h = MOBA.debug.hud().extra; window._anns = []; const o = h.showBanner.bind(h); h.showBanner = function (a) { window._anns.push(a.title + ' | ' + a.sub); return o(a); };
          window._annText = () => { const w = MOBA.debug.game, me = w.player, hx = MOBA.debug.hud().extra; return w.feed.filter((f) => f.ann).map((f) => { const a = MOBA.announceText(f.ann, me, hx.byId.bind(hx)); return a ? a.title + ' | ' + a.sub : null; }).filter(Boolean); }; };
        await cli.evaluate(spy); await host.evaluate(spy);
        await cli.evaluate(() => { const s = MOBA.debug.session, o = s.onMessage.bind(s); s.onMessage = function (m) { if (m && m.k === 's') window._lastSnap = m; return o(m); }; });
        const VEX = (g) => g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
        // 1) el cliente mata con un ataque básico a un enemigo aturdido y con poca vida
        const eid = await host.evaluate(() => {
          const g = MOBA.debug.game, v = g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
          v.x = M_W(); v.y = M_W(); v.moveTarget = null; v.target = null;
          function M_W() { return MOBA.MAP.width / 2; }
          const e = g.champions.find((c) => c.team === 0 && !c.human && !c.dead);
          e.x = v.x + 120; e.y = v.y; e.hp = 6; e.addBuff({ type: 'stun', amount: 1, duration: 8 }); e.lastDamagers = {};
          return e.id;
        });
        await cli.evaluate((id) => MOBA.debug.cmd({ t: 'attack', id: id }), eid);
        await host.waitForFunction((id) => MOBA.debug.game.champions.find((c) => c.id === id).dead, eid, { timeout: 30000 });
        // 2) ataque con habilidad que mata (crédito del cliente) y 3) asesinato doble
        await host.evaluate(() => {
          const g = MOBA.debug.game, v = g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
          const e = g.champions.find((c) => c.team === 0 && !c.human && !c.dead); e.hp = 1; g.damage(v, e, 500, 'magic', { label: 'Prueba de habilidad' });
        });
        // 4) un bot aliado mata con asistencia del cliente
        await host.evaluate(() => {
          const g = MOBA.debug.game, v = g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
          const ally = g.champions.find((c) => c.team === 1 && !c.human && !c.dead), e = g.champions.find((c) => c.team === 0 && !c.human && !c.dead);
          g.damage(v, e, 50, 'magic'); g.damage(ally, e, 99999, 'true');
        });
        // 5) el cliente tira una torre
        await host.evaluate(() => {
          const g = MOBA.debug.game, v = g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
          const tw = g.structures.find((s) => s.type === 'tower' && s.team === 0 && !s.dead && s.vulnerable !== false && s.isTargetable()); tw.hp = 1; g.damage(v, tw, 100, 'true');
        });
        // 6) el cliente muere (con varias fuentes de daño para el resumen de muerte)
        await host.evaluate(() => {
          const g = MOBA.debug.game, v = g.champions.find((c) => c.def.id === 'vex' && c.team === 1);
          const host = g.champions.find((c) => c.human && c.team === 0), bot = g.champions.find((c) => c.team === 0 && !c.human && !c.dead);
          if (bot) g.damage(bot, v, 120, 'physical', { basic: true });
          g.damage(host, v, 99999, 'magic', { label: 'Bola de Fuego' });
        });
        await cli.waitForFunction(() => MOBA.debug.game.player.dead && window._annText().length >= 5, null, { timeout: 20000 });
        await cli.waitForTimeout(800);
        const cs = await cli.evaluate(() => ({ texts: window._annText(), sess: !!MOBA.debug.session && !MOBA.debug.session.local, game: !document.getElementById('game-screen').classList.contains('hidden'),
          k: MOBA.debug.game.player.kills, a: MOBA.debug.game.player.assists, d: MOBA.debug.game.player.deaths, recap: !document.getElementById('death-recap').classList.contains('hidden'), recapTxt: document.getElementById('death-recap').textContent }));
        const hs = await host.evaluate(() => ({ texts: window._annText(), human: MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1).human, clients: Object.keys(MOBA.debug.session.clients || {}).length }));
        console.log(tag + ' anuncios cliente:', JSON.stringify(cs.texts));
        console.log(tag + ' anuncios anfitrión:', JSON.stringify(hs.texts));
        const has = (arr, re) => arr.some((t) => re.test(t));
        check(tag + ': el cliente mata y sigue conectado (no lo desconecta)', cs.sess && cs.game && hs.human && hs.clients === 1);
        check(tag + ': el cliente ve "¡Has asesinado a un enemigo!" (primera sangre) al matar', has(cs.texts, /^¡Primera sangre! \| ¡Has asesinado a un enemigo! · Vex eliminó a /));
        check(tag + ': el cliente ve su asesinato doble', has(cs.texts, /^¡Asesinato doble! \| ¡Has asesinado a un enemigo!/));
        check(tag + ': asistencia del cliente: ve "¡Un enemigo ha sido asesinado!" y suma la asistencia', has(cs.texts, /\| ¡Un enemigo ha sido asesinado!|^¡Un enemigo ha sido asesinado!/) && cs.a >= 1);
        check(tag + ': torre tirada por el cliente: "¡Tu equipo destruyó una torre!"', has(cs.texts, /^¡Tu equipo destruyó una torre!/));
        check(tag + ': el cliente muere: "¡Has sido asesinado!" y ve el resumen de muerte', has(cs.texts, /^¡Has sido asesinado! \| Ignis eliminó a Vex/) && cs.recap && /Bola de Fuego/.test(cs.recapTxt));
        check(tag + ': el anfitrión ve lo mismo desde su lado ("¡Un aliado ha sido asesinado!" / "¡Has asesinado a un enemigo!")', has(hs.texts, /¡Un aliado ha sido asesinado! · Vex eliminó a |^¡Un aliado ha sido asesinado! \| Vex eliminó a /) && has(hs.texts, /^¡Has asesinado a un enemigo! \| Ignis eliminó a Vex/));
        check(tag + ': marcadores del cliente correctos (2 asesinatos, 1 asistencia, 1 muerte)', cs.k === 2 && cs.a === 1 && cs.d === 1);
        // un evento roto no corta la sesión: se ignora con un aviso
        const robust = await cli.evaluate(() => {
          const s = MOBA.debug.session, w = s.world, before = w.feed.length, warn = console.warn; let warned = 0; console.warn = function () { warned++; };
          try {
            s.onMessage({ k: 's', s: null, e: null });
            const last = window._lastSnap;
            s.onMessage({ k: 's', s: last.s, e: { fx: [null, 5], tx: [null], fd: [{ text: 'aviso raro', ann: { k: 'kill', killer: 'raro', victim: { a: 1 }, recap: 7, assists: 'x' } }, null, { text: 'otro', ann: { k: 'tower', lane: { x: 1 } } }] } });
            MOBA.debug.hud().extra.update(0.016); MOBA.debug.hud().extra.slowUpdate();
          } finally { console.warn = warn; }
          return { ok: !!MOBA.debug.session && w.feed.some((f) => f.text === 'aviso raro'), feed: w.feed.length };
        });
        check(tag + ': un mensaje o anuncio con datos raros se ignora sin cortar la sesión', robust.ok);
        // que el cliente reaparezca para seguir con el resto de la prueba
        await host.evaluate(() => { const v = MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1); v.respawnTimer = 0.05; });
        await cli.waitForFunction(() => !MOBA.debug.game.player.dead, null, { timeout: 20000 });
      }
      if (mode === 'peer') {
        await cli.evaluate(() => { const r = MOBA.debug.renderer; r.camLocked = true; });
        await cli.waitForTimeout(800);
        await shot('07-cliente-online.png', cli);
      }

      // ---------- Después de la partida: revancha en la misma sala y sala nueva, sin recargar ----------
      if (mode === 'peer') {
        const dg = await cli.evaluate(() => MOBA.Lobby.transport.diag());
        check(tag + ': diagnóstico de conexión (directa o relé) disponible', !!(dg && dg.kind));
        console.log('Conexión normal:', JSON.stringify(dg));
      }
      for (let i = 0; i < 300; i++) { if (await host.evaluate(() => { MOBA.debug.simulate(20); return MOBA.debug.game.over; })) break; await host.waitForTimeout(30); }
      await host.waitForSelector('#endscreen [data-end="0"]', { timeout: 20000 });
      await cli.waitForSelector('#endscreen [data-end="0"]', { timeout: 20000 });
      const endBtns = await Promise.all([host, cli].map((pg) => pg.$$eval('#endscreen [data-end]', (b) => b.map((x) => x.textContent))));
      check(tag + ': pantalla final con "Volver a la sala" y "Menú principal" (anfitrión y cliente)', /Volver a la sala/.test(endBtns[0][0]) && /Menú principal/.test(endBtns[0][1]) && /Volver a la sala/.test(endBtns[1][0]) && /Menú principal/.test(endBtns[1][1]));
      await cli.click('#endscreen [data-end="0"]');      // el cliente vuelve primero: espera al anfitrión
      await cli.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden') && /Esperando a que el anfitrión vuelva/.test(document.getElementById('lobby-wait').textContent), null, { timeout: 10000 });
      await host.click('#endscreen [data-end="0"]');
      await host.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden') && !MOBA.debug.session && !MOBA.Lobby.session, null, { timeout: 10000 });
      await cli.waitForFunction(() => /empiece/.test(document.getElementById('lobby-wait').textContent) && !MOBA.debug.session && MOBA.Lobby.state.players.length === 2, null, { timeout: 10000 });
      check(tag + ': revancha: los dos vuelven a la misma sala sin recargar', true);
      await host.click('#lobby-start');
      await cli.waitForFunction(() => MOBA.debug.session && !MOBA.debug.session.local && MOBA.debug.game.units.length > 20 && !MOBA.debug.game.over, null, { timeout: 20000 });
      const re = await cli.evaluate(() => { const p = MOBA.debug.game.player; return { def: p.def.id, team: p.team, canvases: document.querySelectorAll('#game-canvas').length }; });
      check(tag + ': la revancha arranca y el cliente vuelve a controlar a Vex', re.def === 'vex' && re.team === 1 && re.canvases === 1);
      // el anfitrión abandona a mitad de partida: el cliente vuelve al menú con un aviso
      await host.keyboard.press('Escape');
      await host.click('#quit-btn');
      await host.waitForFunction(() => !document.getElementById('select-screen').classList.contains('hidden') && !MOBA.Lobby.transport && !MOBA.debug.session, null, { timeout: 10000 });
      await cli.waitForFunction(() => !document.getElementById('select-screen').classList.contains('hidden') && !MOBA.debug.session && !MOBA.Lobby.state, null, { timeout: 20000 });
      check(tag + ': si el anfitrión abandona, el cliente vuelve al menú con aviso', /anfitrión/.test(await cli.textContent('#menu-msg')));
      // sala nueva y el amigo se une, sin recargar ninguna de las dos páginas
      await host.click('#mode-host');
      await host.click('#create-room-btn');
      await host.waitForFunction((old) => { const c = document.getElementById('lobby-code').textContent; return /^[A-Z0-9]{5}$/.test(c) && c !== old && !document.getElementById('lobby-screen').classList.contains('hidden'); }, code, { timeout: 25000 });
      const code2 = await host.textContent('#lobby-code');
      check(tag + ': el anfitrión muestra "Esperando jugadores…" con el código', (await host.textContent('#lobby-status')).includes('Esperando jugadores') && (await host.textContent('#lobby-status')).includes(code2));
      check(tag + ': el código viejo se sacó de la dirección', !/sala=/.test(await cli.evaluate(() => location.search)));
      await cli.click('#mode-join');
      await cli.fill('#join-code', code2);
      await cli.click('#join-room-btn');
      await cli.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden') && MOBA.Lobby.state && MOBA.Lobby.state.players.length === 2, null, { timeout: 25000 });
      await host.waitForFunction(() => MOBA.Lobby.state.players.length === 2, null, { timeout: 10000 });
      check(tag + ': sala nueva ' + code2 + ' después de la partida: el amigo entra sin recargar', true);
      await cli.click('#lobby-red');
      await cli.waitForTimeout(300);
      await cli.click('#lobby-grid .champ-card[data-id="vex"]');
      await host.waitForFunction(() => { const p = MOBA.Lobby.state.players; return p.length === 2 && p[1].champ === 'vex' && p[1].team === 1; }, null, { timeout: 10000 });
      await host.click('#lobby-start');
      await cli.waitForFunction(() => MOBA.debug.session && !MOBA.debug.session.local && MOBA.debug.game.units.length > 20, null, { timeout: 20000 });
      check(tag + ': partida nueva en la sala nueva', await cli.evaluate(() => MOBA.debug.game.player.def.id === 'vex'));
      await cli.close();
      await host.waitForFunction(() => { const c = MOBA.debug.game.champions.find((c) => c.def.id === 'vex' && c.team === 1); return !c.human && !!c.ai; }, null, { timeout: 15000 });
      check(tag + ': si el amigo se va, un bot toma su campeón', true);
    } catch (e) {
      check(tag + ': ' + e.message.split('\n')[0], false);
      const st = (pg) => pg.evaluate(() => ({ scr: ['select-screen', 'lobby-screen', 'game-screen'].filter((i) => !document.getElementById(i).classList.contains('hidden')), role: MOBA.Lobby.role, sess: !!MOBA.debug.session, over: !!(MOBA.debug.game && MOBA.debug.game.over), players: MOBA.Lobby.state && MOBA.Lobby.state.players.map((p) => p.id), wait: document.getElementById('lobby-wait').textContent, msg: document.getElementById('menu-msg').textContent, end: !!document.querySelector('#endscreen [data-end]') })).catch((x) => x.message);
      console.log('Estado al fallar:', JSON.stringify({ host: await st(host), cli: await st(cli) }));
    }
    await host.close();
    if (bB !== browser) await bB.close(); else await ctxA.close();
  }

  /** Solo por relé TURN (?relay=1): dos navegadores separados, sin conexión directa posible. */
  async function relayOnly() {
    const tag = 'PeerJS solo relé TURN (?relay=1)';
    const bA = await chromium.launch({ args: ARGS }), bB = await chromium.launch({ args: ARGS });
    const host = await (await bA.newContext()).newPage(), cli = await (await bB.newContext()).newPage();
    watch(host, '[relé anfitrión]'); watch(cli, '[relé cliente]');
    try {
      await host.goto(url + '?relay=1');
      await host.click('#mode-host');
      await host.click('#create-room-btn');
      await host.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-code').textContent), null, { timeout: 25000 });
      const code = await host.textContent('#lobby-code');
      await cli.goto(url + '?relay=1&sala=' + code);
      await cli.click('#join-room-btn');
      await cli.waitForFunction(() => !document.getElementById('lobby-screen').classList.contains('hidden'), null, { timeout: 30000 });
      const d = await cli.evaluate(() => MOBA.Lobby.transport.diag());
      console.log('Conexión solo relé:', JSON.stringify(d));
      check(tag + ': el amigo entra a la sala pasando por el relé TURN', !!d && d.kind === 'relay');
      await host.waitForFunction(() => /relé/.test(document.getElementById('lobby-net').textContent), null, { timeout: 8000 });
      check(tag + ': el diagnóstico de la sala muestra "por relé TURN"', true);
      await host.click('#lobby-start');
      await cli.waitForFunction(() => MOBA.debug.session && MOBA.debug.game.units.length > 20, null, { timeout: 30000 });
      check(tag + ': la partida arranca y llegan las fotos por el relé', true);
      // código inexistente: error claro y botón Reintentar
      await cli.evaluate(() => MOBA.Lobby.toMenu());
      await cli.click('#mode-join');
      await cli.fill('#join-code', 'ZZZZ9');
      await cli.click('#join-room-btn');
      await cli.waitForFunction(() => { const b = document.getElementById('join-status'); return b.classList.contains('error'); }, null, { timeout: 20000 });
      const err = await cli.textContent('#join-status-text');
      check(tag + ': sala inexistente → "no existe o el anfitrión cerró la pestaña" con Reintentar', /no existe o el anfitrión cerró la pestaña/.test(err) && await cli.isVisible('#join-retry'));
    } catch (e) {
      check(tag + ': ' + e.message.split('\n')[0], false);
    }
    await bA.close(); await bB.close();
  }
  const peerOk = await (async () => { try { const r = await fetch('https://0.peerjs.com/peerjs/id'); return r.ok; } catch (e) { return false; } })();
  if (!skipPeer && peerOk && !fileArg) { await multiplayer('peer'); await relayOnly(); }
  else console.log('Multijugador PeerJS: no probado (' + (skipPeer ? '--sin-peer' : fileArg ? 'test del dist' : 'servidor de PeerJS inalcanzable') + ')');
  await multiplayer('local');

  console.log('Chequeos:', JSON.stringify(checks, null, 1));
  console.log('Total:', Object.values(checks).filter(Boolean).length + '/' + Object.keys(checks).length);
  console.log('Errores/advertencias de consola:', errors.length ? errors : 'ninguno');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
