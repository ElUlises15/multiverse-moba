/* Música del juego. Para cambiarla, poné tus archivos (.mp3 u .ogg) en esta carpeta
 * y escribí acá el nombre. Si un archivo falta o no carga, el juego usa la música
 * provisoria que genera solo (WebAudio). Poné null para usar siempre la generada. */
window.MOBA = window.MOBA || {};
window.MOBA.MUSIC_FILES = {
  menu: 'menu.mp3',      // pantalla de inicio / selección / sala
  match: 'batalla.mp3'   // durante la partida
};
