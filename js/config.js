/* Configuración del juego en línea.
 * SERVER_URL: el servidor dedicado (ver server/README.md). Se puede cambiar sin tocar esto con ?server=wss://otro.servidor
 * Si el juego lo sirve el mismo servidor (por ejemplo http://localhost:8080), se usa esa misma dirección. */
window.MOBA = window.MOBA || {};
window.MOBA.CONFIG = {
  SERVER_URL: 'wss://multiverse-moba-server.onrender.com/ws',
  /** Primer intento de conexión: el servidor gratis "duerme" y puede tardar hasta un minuto en despertar. */
  CONNECT_TIMEOUT_MS: 70000
};
