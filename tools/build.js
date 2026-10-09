// Genera dist/multiverse-moba.html: un único archivo con todo el CSS y JS embebido.
// Uso: node tools/build.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + src + ' */\n' + js + '\n</script>';
});
// La música NO se embebe (pesa varios MB): el archivo único la busca en ../assets/music/ (la carpeta del repo).
// Si no la encuentra (por ejemplo, si copiás solo el .html), usa la música generada por el juego.
html = html.replace('<script>/* assets/music/tracks.js */', '<script>window.MOBA = window.MOBA || {}; window.MOBA.MUSIC_BASE = "../assets/music/";</script>\n<script>/* assets/music/tracks.js */');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'multiverse-moba.html');
fs.writeFileSync(out, html);
console.log('OK ->', out, (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
