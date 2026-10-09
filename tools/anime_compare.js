// Capturas en el juego del Ignis anime: v2 (GLB actual) y, opcional, otra versión del GLB para comparar.
// Uso: NODE_PATH=<node_modules con playwright> node tools/anime_compare.js <salida-prefijo> [otro.glb <prefijo-otro> [inclinación-cabeza-otro]]
// Ej.: node tools/anime_compare.js screenshots/anime/ignis-v2 /tmp/ignis_v1.glb /tmp/v1 -0.3
// Levanta un servidor estático propio; para la versión alternativa sirve ese GLB en lugar de assets/models/ignis_anime.glb.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' };
function serve(glbOverride) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(root, u);
    if (glbOverride && u.endsWith('/models/ignis_anime.glb')) f = glbOverride;
    if ((!glbOverride || f !== glbOverride) && !f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}
const args = process.argv.slice(2);
const runs = [{ prefix: args[0] || 'screenshots/anime/ignis-v2', glb: null }];
if (args[1]) runs.push({ prefix: args[2] || 'screenshots/anime/ignis-alt', glb: path.resolve(args[1]), tilt: args[3] != null ? parseFloat(args[3]) : null });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  for (const run of runs) {
    const srv = await serve(run.glb);
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    const tag = '[' + path.basename(run.prefix) + '] ';
    p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text()))) errors.push(tag + m.text()); });
    p.on('pageerror', (e) => errors.push(tag + e.message));
    await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html?anime=1');
    await p.evaluate(() => MOBA.debug.startWith(['ignis', 'sol', 'bolt', 'bastion', 'rorik', 'pikachu', 'kaida', 'vex', 'mora', 'creeper']));
    await p.waitForFunction(() => MOBA.Anime.has('champ:ignis'), null, { timeout: 20000 });
    if (run.tilt != null) await p.evaluate((t) => { MOBA.Anime.MODELS['champ:ignis'].headTilt = t; }, run.tilt);
    const info = await p.evaluate(() => {
      // misma escena que tools/anime_shots.js (nivel 9, todos juntos en el centro del mapa)
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
      g.paused = true;
      const v = [...r.views.values()].find((x) => x.u.def && x.u.def.id === 'ignis');
      const clips = MOBA.Anime.gltf['champ:ignis'].animations.map((c) => c.name).sort().join(',');
      return { glb: !!(v && v.model.anime), clips, dead: g.champions[0].dead };
    });
    const frames = (n) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    // primer plano (zoom 2.6) — en reposo y mirando un poco hacia la cámara
    const shot = async (name, zoom, setup) => {
      await p.evaluate(([zoom, setup]) => {
        const r = MOBA.debug.renderer, g = MOBA.game, c = g.champions[0];
        c.castAt = null; c.facing = Math.PI / 2 - 0.35;
        r.camLocked = false; r.cam.x = c.x; r.cam.y = c.y - 10; r.userZoom = r.zoomTarget = zoom; r.updateZoom();
      }, [zoom, setup]);
      await frames(6);
      await p.screenshot({ path: name });
    };
    await shot(run.prefix + '-ingame-cerca.png', 2.6, 'idle');
    await shot(run.prefix + '-ingame.png', 1.0, 'idle');
    console.log(run.prefix, JSON.stringify(info));
    await p.close(); srv.close();
  }
  console.log('errores:', errors.length ? errors : 'ninguno');
  await b.close();
})();
