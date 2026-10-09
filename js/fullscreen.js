/* Pantalla completa + bloqueo de teclado (para que Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Tab, Esc… no cierren la pestaña),
 * bloqueo de atajos del navegador que la página sí puede frenar y confirmación al salir durante una partida. */
(function (M) {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  let hintTimer = 0, pendingAuto = false;

  const FS = M.Fullscreen = {
    supported: function () { return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen); },
    isOn: function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    /** Tiene que llamarse desde un clic o una tecla (el navegador lo exige). */
    enter: function () {
      pendingAuto = false;
      if (FS.isOn() || !FS.supported()) { FS.lockKeys(); return; }
      const el = document.documentElement;
      try {
        const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
        if (p && p.then) p.then(function () { FS.lockKeys(); }).catch(function () { /* el navegador no lo permitió */ });
      } catch (e) { /* nada */ }
    },
    exit: function () {
      try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) { /* nada */ }
      try { if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { /* nada */ }
    },
    toggle: function () { if (FS.isOn()) FS.exit(); else FS.enter(); },
    /** Keyboard Lock (Chrome/Edge): con pantalla completa la página recibe Ctrl+W, Ctrl+T, Esc, etc. Para salir hay que MANTENER Esc. */
    lockKeys: function () {
      if (!navigator.keyboard || !navigator.keyboard.lock) { FS.hint('Pantalla completa · Esc para salir'); return; }
      navigator.keyboard.lock().then(function () { FS.locked = true; FS.hint('Mantené Esc para salir de pantalla completa'); })
        .catch(function () { FS.locked = false; FS.hint('Pantalla completa · Esc para salir'); });
    },
    hint: function (text) {
      let el = $('fs-hint');
      if (!el) { el = document.createElement('div'); el.id = 'fs-hint'; document.body.appendChild(el); }
      el.textContent = text; el.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { el.classList.remove('show'); }, 4500);
    },
    /** Al empezar una partida: si la opción está activada, entra (el clic de "Jugar"/"Empezar" ya lo hizo; si no, en el próximo clic o tecla). */
    matchStarted: function () { if (M.Settings && M.Settings.get('autoFullscreen') && !FS.isOn()) pendingAuto = true; },
    autoFromGesture: function () { if (M.Settings && M.Settings.get('autoFullscreen')) FS.enter(); },
    updateButtons: function () {
      const on = FS.isOn();
      document.querySelectorAll('.fs-btn').forEach(function (b) {
        b.classList.toggle('on', on);
        b.title = on ? 'Salir de pantalla completa' + (FS.locked ? ' (o mantené Esc)' : '') : 'Pantalla completa (evita que Ctrl+W y otros atajos cierren la pestaña)';
        if (b.dataset.label) b.textContent = on ? '⛶ Salir de pantalla completa' : '⛶ Pantalla completa';
      });
    }
  };

  function inMatch() { return !!(M.App && M.App.inMatch && M.App.inMatch()); }
  function onlineLobby() { return !!(M.Lobby && M.Lobby.transport && M.Lobby.state); }
  FS.inMatch = inMatch;

  document.addEventListener('fullscreenchange', function () {
    if (!FS.isOn()) { FS.locked = false; try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) { /* nada */ } }
    FS.updateButtons();
  });
  document.addEventListener('webkitfullscreenchange', function () { FS.updateButtons(); });

  // Botones (menú, partida y configuración) y entrada automática con el clic de empezar
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('.fs-btn');
    if (b) { e.preventDefault(); FS.toggle(); return; }
    if (e.target.closest && e.target.closest('.play-btn, #lobby-start')) FS.autoFromGesture();
  }, true);
  // Si la partida empezó sin un clic (por ejemplo, el cliente cuando el anfitrión arranca): primer clic o tecla
  const gesture = function (e) {
    if (!pendingAuto || !inMatch()) return;
    if (e.type === 'keydown' && (e.key === 'Escape' || e.target.tagName === 'INPUT')) return;
    FS.enter();
  };
  window.addEventListener('pointerdown', gesture, true);
  window.addEventListener('keydown', gesture, true);

  // Atajos del navegador que la página puede frenar mientras jugás (Ctrl+W/T/N solo se frenan con pantalla completa + bloqueo)
  const CTRL_BLOCK = { KeyS: 1, KeyP: 1, KeyF: 1, KeyD: 1, KeyR: 1, KeyQ: 1, KeyE: 1, KeyW: 1, KeyG: 1, KeyH: 1, KeyJ: 1, KeyK: 1, KeyL: 1, KeyO: 1, KeyU: 1, KeyB: 1, KeyN: 1, KeyT: 1, Digit1: 1, Digit2: 1, Digit3: 1, Digit4: 1, Digit5: 1, Digit6: 1, Digit7: 1, Digit8: 1, Digit9: 1, Tab: 1, PageUp: 1, PageDown: 1 };
  window.addEventListener('keydown', function (e) {
    if (!inMatch()) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const c = e.code;
    if ((e.ctrlKey || e.metaKey) && CTRL_BLOCK[c]) { e.preventDefault(); return; }
    if (e.altKey && (c === 'KeyW' || c === 'KeyD' || c === 'KeyF' || c === 'ArrowLeft' || c === 'ArrowRight' || c === 'Home')) { e.preventDefault(); return; }
    if (c === 'F5' || c === 'F3' || c === 'F6' || c === 'F7' || c === 'Backspace' || c === 'Space' || c === 'Tab' || c === 'Slash' || c === 'Quote' || c === 'BrowserBack') e.preventDefault();
  }, true);

  // Confirmación al cerrar o recargar durante una partida o en una sala en línea
  window.addEventListener('beforeunload', function (e) {
    if (!inMatch() && !onlineLobby()) return;
    e.preventDefault();
    e.returnValue = '¿Seguro que querés salir?';
    return '¿Seguro que querés salir?';
  });
})(window.MOBA);
