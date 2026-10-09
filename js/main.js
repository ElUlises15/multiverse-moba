/* Arranque, entrada (mouse/teclado), cámara y bucle principal.
 * Toda acción del jugador se convierte en una ORDEN (session.cmd) que aplica la simulación local
 * o que se manda al anfitrión en una partida en red. */
(function (M) {
  'use strict';
  const U = M.util;
  const $ = function (id) { return document.getElementById(id); };
  const params = new URLSearchParams(location.search);
  const SPEED = Math.max(0.25, Math.min(8, parseFloat(params.get('speed')) || 1));
  const LOW = params.get('low') === '1';
  const STEP = 1 / 60;

  let session = null, world = null, renderer = null, hud = null;
  let mouse = { x: 0, y: 0, inside: false };
  let rightHeld = false, lastRightMove = 0, spaceHeld = false;
  const keysPan = {};
  let acc = 0, last = performance.now();

  function me() { return world ? world.player : null; }

  function showSelect() {
    if (renderer) { renderer.dispose(); }
    session = null; world = null; renderer = null; hud = null;
    $('game-screen').classList.add('hidden');
    $('lobby-screen').classList.add('hidden');
    $('select-screen').classList.remove('hidden');
    M.SelectScreen.init({ onPlay: startSolo });
  }

  function startSolo(defId) { return startView(new M.Net.LocalSession(new M.Game(defId))); }
  function startHosted(game, transport, clients) { startBackgroundTicker(); return startView(new M.Net.HostSession(game, transport, clients)); }
  function startClient(transport, startMsg) { return startView(new M.Net.ClientSession(transport, startMsg)); }

  function startView(s) {
    if (!M.webglAvailable()) {
      alert('Tu navegador no tiene WebGL activado: el juego en 3D no puede arrancar.');
      return null;
    }
    $('select-screen').classList.add('hidden');
    $('lobby-screen').classList.add('hidden');
    $('game-screen').classList.remove('hidden');
    session = s; world = s.world;
    renderer = new M.Renderer($('game-canvas'), $('overlay-canvas'), world, { low: LOW });
    renderer.camLocked = true;
    renderer.resize();
    hud = new M.HUD(session, renderer);
    s.onNotice = function (t) { if (hud) hud.showNotice(t); };
    world.onGameOver = function (winner) {
      setTimeout(function () { if (hud) hud.showEnd(winner, function () { M.Lobby.reset(); showSelect(); }); }, 1500);
    };
    M.game = world;
    acc = 0; attackArmed = false; setAiming(null); lastCO = null;
    $('pause-title').textContent = s.canPause ? 'Pausa' : 'Menú (la partida en red sigue corriendo)';
    $('resume-btn').textContent = s.canPause ? 'Continuar' : 'Volver a la partida';
    return s;
  }

  // ---------- Órdenes del jugador ----------
  const SWORD_CURSOR = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<path d="M4 4 L20 20" stroke="#300" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M4 4 L20 20" stroke="#ff4040" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M15 24 L24 15" stroke="#300" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M15 24 L24 15" stroke="#ffd54a" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M21 21 L28 28" stroke="#300" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M21 21 L28 28" stroke="#b07a3a" stroke-width="3" stroke-linecap="round"/></svg>') + '") 4 4, crosshair';
  const ABILITY_KEYS = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
  let shiftHeld = false, attackArmed = false, armedAt = 0, aiming = null, lastCO = null;

  function worldMouse() { return renderer.screenToWorld(mouse.x, mouse.y); }
  function targetRadius() { return M.TARGET_RADIUS_PX / renderer.cam.zoom; }
  function cmd(c) { return session ? session.cmd(c) : 'sin partida'; }

  /** Enemigo que se atacaría con clic derecho en la posición del mouse. */
  function hoverTarget() {
    const p = me();
    if (!world || !mouse.inside || !p || p.dead) return null;
    const w = worldMouse();
    return world.pickTarget(w.x, w.y, targetRadius(), p.team, { championsOnly: shiftHeld });
  }

  function issueRightClick(allowAttack) {
    const p = me();
    if (!p || p.dead || world.over) return;
    const w = worldMouse();
    const u = allowAttack ? hoverTarget() : null;
    if (u) {
      cmd({ t: 'attack', id: u.id });
      if (!session.local) p.targetId = u.id;
      renderer.clickMarker = { x: u.x, y: u.y, life: 0.5, attack: true };
    } else {
      cmd({ t: 'move', x: Math.round(w.x), y: Math.round(w.y) });
      if (!session.local) p.targetId = 0;
      if (allowAttack) renderer.clickMarker = { x: w.x, y: w.y, life: 0.5 };
    }
  }

  /** Ataque-movimiento: ataca al enemigo cerca del punto o camina hacia él atacando lo que encuentre. */
  function attackMoveTo(w) {
    const p = me();
    if (!p || p.dead || world.over) return;
    const r = Math.max(targetRadius(), 300);
    const u = world.pickTarget(w.x, w.y, r, p.team, { championsOnly: shiftHeld });
    cmd({ t: 'amove', x: Math.round(w.x), y: Math.round(w.y), id: u ? u.id : 0 });
    renderer.clickMarker = { x: u ? u.x : w.x, y: u ? u.y : w.y, life: 0.5, attack: true };
  }

  function castSlot(slot) {
    const p = me();
    if (!p || p.dead || world.over || world.paused) return false;
    const w = aimPoint(slot);
    return !cmd({ t: 'cast', s: slot, x: Math.round(w.x), y: Math.round(w.y) });
  }

  /** Punto de apuntado con una leve ayuda: si hay un enemigo bajo el cursor, se apunta a su centro. */
  function aimPoint(slot) {
    const p = me(), ab = p.def.abilities[slot];
    const w = worldMouse();
    if (ab && (ab.cast === 'skillshot' || ab.cast === 'line' || ab.cast === 'area' || ab.cast === 'target')) {
      const h = world.pickTarget(w.x, w.y, targetRadius() * 1.2, p.team, { noStructures: true, championsOnly: shiftHeld });
      if (h) return { x: h.x, y: h.y };
    }
    return w;
  }

  function setAiming(slot) { aiming = slot; if (renderer) renderer.aim = slot; }

  function togglePause(force) {
    if (!world || world.over) return;
    const show = force != null ? force : $('pause').classList.contains('hidden');
    if (session.canPause) world.paused = show;
    $('pause').classList.toggle('hidden', !show);
  }

  // ---------- Eventos ----------
  function bindInput() {
    const canvas = $('overlay-canvas');
    document.addEventListener('contextmenu', function (e) { if (world) e.preventDefault(); });
    canvas.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; shiftHeld = e.shiftKey;
      if (world && rightHeld && performance.now() - lastRightMove > 90) {
        lastRightMove = performance.now();
        const p = me();
        if (p && !p.target && !p.targetId) issueRightClick(false);
      }
    });
    canvas.addEventListener('mouseleave', function () { mouse.inside = false; });
    canvas.addEventListener('mousedown', function (e) {
      if (!world) return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; shiftHeld = e.shiftKey;
      if (e.button === 2) {
        if (aiming != null) { setAiming(null); return; }       // clic derecho cancela el apuntado
        if (attackArmed) { attackArmed = false; }
        rightHeld = true; lastRightMove = performance.now(); issueRightClick(true);
      } else if (e.button === 0 && attackArmed) {
        attackArmed = false;
        attackMoveTo(worldMouse());
      }
    });
    window.addEventListener('mouseup', function (e) { if (e.button === 2) rightHeld = false; });
    window.addEventListener('blur', function () { rightHeld = false; shiftHeld = false; setAiming(null); });
    canvas.addEventListener('wheel', function (e) {
      if (!renderer) return;
      e.preventDefault();
      renderer.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
    }, { passive: false });

    const mm = $('minimap');
    function minimapWorld(e) {
      const r = mm.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * M.MAP.width, y: (e.clientY - r.top) / r.height * M.MAP.height };
    }
    let mmDrag = false;
    mm.addEventListener('mousedown', function (e) {
      if (!world) return;
      e.preventDefault();
      const w = minimapWorld(e), p = me();
      if (e.button === 0 && attackArmed) { attackArmed = false; attackMoveTo(w); }
      else if (e.button === 0) { mmDrag = true; renderer.camLocked = false; renderer.cam.x = w.x; renderer.cam.y = w.y; }
      else if (e.button === 2 && p && !p.dead) {
        cmd({ t: 'move', x: Math.round(w.x), y: Math.round(w.y) });
        renderer.clickMarker = { x: w.x, y: w.y, life: 0.5 };
      }
    });
    mm.addEventListener('mousemove', function (e) { if (mmDrag && world) { const w = minimapWorld(e); renderer.cam.x = w.x; renderer.cam.y = w.y; } });
    window.addEventListener('mouseup', function () { mmDrag = false; });

    window.addEventListener('keydown', function (e) {
      if (!world) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = e.code;
      shiftHeld = e.shiftKey;
      if (code === 'Tab') { e.preventDefault(); hud.toggleScoreboard(true); return; }
      if (code === 'Escape') {
        if (aiming != null || attackArmed) { setAiming(null); attackArmed = false; return; }
        if (!$('shop').classList.contains('hidden')) hud.toggleShop(false); else togglePause();
        return;
      }
      if (world.paused) return;
      if (ABILITY_KEYS[code] != null && (e.ctrlKey || e.altKey)) {
        // Ctrl/Alt + Q/W/E/R: subir la habilidad (como en LoL)
        e.preventDefault();
        if (!e.repeat) hud.learn(ABILITY_KEYS[code]);
        return;
      }
      if (ABILITY_KEYS[code] != null) {
        if (!e.repeat) setAiming(ABILITY_KEYS[code]);
        return;
      }
      switch (code) {
        case 'KeyA':
          if (!e.repeat) { attackArmed = true; armedAt = performance.now(); attackMoveTo(worldMouse()); }
          break;
        case 'KeyB': cmd({ t: 'recall' }); break;
        case 'KeyC': renderer.showRange = true; break;
        case 'KeyP': hud.toggleShop(); break;
        case 'KeyY': renderer.camLocked = !renderer.camLocked; break;
        case 'KeyS': cmd({ t: 'stop' }); attackArmed = false; if (!session.local && me()) me().targetId = 0; break;
        case 'Space': e.preventDefault(); spaceHeld = true; break;
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': e.preventDefault(); keysPan[code] = true; break;
      }
    });
    window.addEventListener('keyup', function (e) {
      if (!world) return;
      shiftHeld = e.shiftKey;
      if (e.code === 'Tab') hud.toggleScoreboard(false);
      if (e.code === 'Space') spaceHeld = false;
      if (e.code === 'KeyC') renderer.showRange = false;
      if (ABILITY_KEYS[e.code] != null && aiming === ABILITY_KEYS[e.code]) {
        setAiming(null);
        if (!world.paused) castSlot(ABILITY_KEYS[e.code]);
      }
      keysPan[e.code] = false;
    });
    window.addEventListener('resize', function () { if (renderer) renderer.resize(); });
    $('resume-btn').onclick = function () { togglePause(false); };
    $('quit-btn').onclick = function () { togglePause(false); M.Lobby.reset(); showSelect(); };
  }

  /** Cada cuadro: enemigo resaltado bajo el cursor, cursor de espada e indicador de apuntado. */
  function updateHover() {
    if (attackArmed && performance.now() - armedAt > 3000) attackArmed = false;
    const h = hoverTarget();
    renderer.hoverTarget = h;
    renderer.attackArmed = attackArmed;
    renderer.mouseWorld = mouse.inside ? worldMouse() : null;
    renderer.aimPoint = aiming != null && mouse.inside ? aimPoint(aiming) : null;
    if (lastCO !== shiftHeld) { lastCO = shiftHeld; cmd({ t: 'co', v: shiftHeld }); }
    const cur = (h || attackArmed) ? SWORD_CURSOR : 'default';
    const cv = $('overlay-canvas');
    if (cv.style.cursor !== cur) cv.style.cursor = cur;
  }

  function updateCamera(dt) {
    const cam = renderer.cam, p = me();
    const pan = 1500 * dt / Math.max(0.5, renderer.userZoom);
    let panned = false;
    if (keysPan.ArrowUp) { cam.y -= pan; panned = true; }
    if (keysPan.ArrowDown) { cam.y += pan; panned = true; }
    if (keysPan.ArrowLeft) { cam.x -= pan; panned = true; }
    if (keysPan.ArrowRight) { cam.x += pan; panned = true; }
    if (panned) renderer.camLocked = false;
    if ((renderer.camLocked || spaceHeld) && p) {
      cam.x = U.lerp(cam.x, p.x, Math.min(1, dt * 10));
      cam.y = U.lerp(cam.y, p.y + 120, Math.min(1, dt * 10));
    } else if (mouse.inside) {
      const W = renderer.W, H = renderer.H, edge = 16;
      if (mouse.x < edge) cam.x -= pan; else if (mouse.x > W - edge) cam.x += pan;
      if (mouse.y < edge) cam.y -= pan; else if (mouse.y > H - edge) cam.y += pan;
    }
    renderer.clampCam();
  }

  /** Si el anfitrión pone la pestaña en segundo plano, el navegador frena requestAnimationFrame.
   *  Para que la partida no se congele para los demás, un Worker marca el ritmo y la simulación sigue. */
  let bgWorker = null, lastBg = 0;
  function startBackgroundTicker() {
    if (bgWorker || typeof Worker === 'undefined') return;
    try {
      const src = 'setInterval(function(){postMessage(0)},50);';
      bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      bgWorker.onmessage = function () {
        const now = performance.now();
        if (!document.hidden || !session || !session.transport || !session.local) { lastBg = now; return; }
        if (now - last < 200) return;            // requestAnimationFrame todavía anda
        const dt = Math.min(0.25, (now - (lastBg || now)) / 1000);
        lastBg = now;
        const g = session.game;
        if (!g.over) { acc += dt * SPEED; let steps = 0; while (acc >= STEP && steps < 60) { g.update(STEP); acc -= STEP; steps++; } if (steps >= 60) acc = 0; }
        session.step(dt);
      };
    } catch (e) { bgWorker = null; }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (session) {
      if (session.local) {
        const g = session.game;
        if (!g.paused && !g.over) {
          acc += dt * SPEED;
          let steps = 0;
          while (acc >= STEP && steps < 40) { g.update(STEP); acc -= STEP; steps++; }
          if (steps >= 40) acc = 0;
        } else {
          acc = 0;
          if (g.over) g.updateFx(dt);
        }
      } else {
        world.updateFx(dt);
      }
      session.step(dt);
      updateCamera(dt);
      updateHover();
      renderer.draw(dt);
      hud.update(dt);
    }
    requestAnimationFrame(frame);
  }

  M.App = { showSelect: showSelect, startSolo: startSolo, startHosted: startHosted, startClient: startClient,
    notice: function (t) { if (hud) hud.showNotice(t); } };

  // API de depuración (usada por los tests)
  M.debug = {
    start: function (id) { return startSolo(id); },
    simulate: function (seconds) { if (!session || !session.local) return; const g = session.game, n = Math.round(seconds / STEP), was = g.paused; g.paused = false; for (let i = 0; i < n && !g.over; i++) { g.update(STEP); if (i % 3 === 0) session.step(STEP * 3); } g.paused = was; },
    cast: function (slot, x, y) { return !cmd({ t: 'cast', s: slot, x: x, y: y }); },
    cmd: function (c) { return cmd(c); },
    get game() { return world; },
    get session() { return session; },
    get renderer() { return renderer; },
    hoverTarget: function () { return hoverTarget(); }
  };

  window.addEventListener('DOMContentLoaded', function () {
    bindInput();
    M.Lobby.initMenu();
    showSelect();
    requestAnimationFrame(frame);
  });
})(window.MOBA);
