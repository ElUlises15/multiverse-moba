// Capturas de comparación: Ignis anime (GLB de Blender + toon) vs Ignis procedural.
// Uso: node tools/anime_shots.js [url-base]   (servir la carpeta por http; por defecto http://localhost:8765/)
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  for (const mode of [1, 0]) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) errors.push('[anime=' + mode + '] ' + m.text()); });
    p.on('pageerror', (e) => errors.push('[anime=' + mode + '] ' + e.message));
    await p.goto(base + 'index.html?anime=' + mode);
    await p.evaluate(() => {
      MOBA.debug.startWith(['ignis', 'sol', 'bolt', 'bastion', 'rorik', 'pikachu', 'kaida', 'vex', 'mora', 'creeper']);
    });
    if (mode) await p.waitForFunction(() => MOBA.Anime.has('champ:ignis'), null, { timeout: 20000 });
    const info = await p.evaluate(() => {
      const g = MOBA.game, r = MOBA.debug.renderer;
      const cx = 7000, cy = 7000;
      const spots = [[-40, 330], [-330, -160], [-420, 60], [-180, -230], [-520, -60], [260, -120], [200, 80], [380, -220], [400, 40], [520, -80]];
      g.champions.forEach((c, i) => {
        const s = MOBA.MAP.nav.nearestFree(cx + spots[i][0], cy + spots[i][1]);
        c.x = c.px = s.x; c.y = c.py = s.y; c.moveTarget = null;
        while (c.level < 9) c.gainXp(g, c.xpToNext() - c.xp);
        for (let k = 0; k < 10; k++) for (const sl of [3, 0, 1, 2]) c.learn(sl);
        c.mana = c.maxMana;
      });
      MOBA.debug.simulate(1.3);
      g.champions.forEach((c) => { c.mana = c.maxMana; c.cds = [0, 0, 0, 0]; c.facing = 0; });
      const by = (id) => g.champions.find((c) => c.def.id === id);
      const cast = (id, s, t) => { const c = by(id), tt = by(t); MOBA.Abilities.cast(g, c, s, tt.x, tt.y); };
      cast('kaida', 0, 'rorik'); cast('pikachu', 0, 'bastion');
      MOBA.debug.simulate(0.15);
      r.camLocked = false; r.cam.x = cx - 20; r.cam.y = cy + 90; r.userZoom = r.zoomTarget = 1.0; r.updateZoom();
      const ig = by('ignis'); ig.facing = Math.PI / 2 - 0.5; ig.castAt = g.time - 0.17; ig.castSlot = 0;
      g.paused = true;
      const v = [...r.views.values()].find((x) => x.u.def && x.u.def.id === 'ignis');
      return { anime: r.anime, glb: !!(v && v.model.anime), height: v && Math.round(v.model.height) };
    });
    for (let i = 0; i < 4; i++) await p.evaluate(() => new Promise((res) => requestAnimationFrame(res)));
    const name = mode ? 'ignis-blender-ingame.png' : 'ignis-procedural-ingame.png';
    await p.screenshot({ path: 'screenshots/anime/' + name });
    // primer plano
    await p.evaluate(() => { const r = MOBA.debug.renderer, g = MOBA.game, c = g.champions[0]; r.cam.x = c.x; r.cam.y = c.y - 10; r.userZoom = r.zoomTarget = 2.6; r.updateZoom(); c.castAt = null; c.facing = Math.PI / 2 - 0.35; });
    for (let i = 0; i < 4; i++) await p.evaluate(() => new Promise((res) => requestAnimationFrame(res)));
    await p.screenshot({ path: 'screenshots/anime/' + name.replace('.png', '-cerca.png') });
    console.log('anime=' + mode, JSON.stringify(info));
    await p.close();
  }
  console.log('errores:', errors.length ? errors : 'ninguno');
  await b.close();
})();
