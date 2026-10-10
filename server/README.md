# Servidor online de Browser Multiverse MOBA

Servidor dedicado y **autoritativo**: la partida corre acá (no en el navegador de nadie) y los navegadores solo mandan órdenes y dibujan.

## Cómo funciona (en criollo)

- `sim.js` carga **los mismos archivos del juego** (`../js/core.js`, `game.js`, `champions/*`, `ai.js`, `net.js`…) dentro de un "navegador de mentira" de Node. No hay una segunda copia de las reglas: si cambiás un campeón en `js/`, el servidor lo usa tal cual.
- `server.js` es un servidor HTTP + WebSocket (`ws`, en la ruta `/ws`):
  - **Salas**: crear, listar, unirse, elegir equipo y campeón, empezar (solo quien creó la sala, 👑).
  - **Partidas**: cada partida avanza 60 pasos de simulación por segundo (en tandas, 30 veces por segundo) y manda a cada equipo **su** foto del mundo 20 veces por segundo, con niebla de guerra (`Net.snapshot` / `Net.events`, lo mismo que usaba el modo anfitrión).
  - **Órdenes**: mismo formato que el modo anfitrión (`{k:'cmd', c:{…}}`).
  - **Se va alguien** → un bot toma su campeón y su lugar queda reservado 60 s. **Vuelve** (mismo navegador, guarda una ficha en `localStorage`) → recupera su campeón.
  - **Partida en curso**: cualquiera puede tomar un bot libre de cualquier equipo.
  - Partida sin personas → se cierra a los 2 minutos. Sala terminada sin uso → a los 10 minutos.
  - **A prueba de golpes**: mensajes JSON de hasta 32 KB, límite de mensajes por segundo, `try/catch` en cada mensaje y en cada partida (si una partida falla una y otra vez, se cierra solo esa), latidos (ping) para detectar conexiones muertas.
  - También sirve el juego estático (`index.html`, `js/`, `css/`, `assets/`, `vendor/`), así que `http://localhost:8080` ya es el juego conectado a ese servidor.
- `GET /health` → `{"ok":true,"rooms":N,"players":N,"uptime":s}`. `GET /rooms` → lista de salas.

## Correrlo en tu compu

```bash
cd server
npm install
npm start            # http://localhost:8080
```

Abrí `http://localhost:8080` en dos navegadores y listo. Para usar ese servidor desde la página publicada: `https://elulises15.github.io/multiverse-moba/?server=ws://localhost:8080/ws` (el navegador puede pedir permiso).

Test (necesita Playwright con Chromium instalado): `npm test`.

## Variables de entorno

| Variable | Para qué | De fábrica |
|---|---|---|
| `PORT` | Puerto HTTP/WebSocket | `8080` |
| `ALLOWED_ORIGINS` | Orígenes extra permitidos, separados por coma (ej. `https://mi-dominio.com`) | GitHub Pages, localhost y el propio servidor ya están permitidos |
| `MAX_ROOMS` | Máximo de salas a la vez | `30` |
| `SERVE_STATIC` | `0` para no servir el juego (solo WebSocket) | `1` |
| `GAME_DIR` | Carpeta del juego si no está en `..` | `..` |

## Publicarlo en Render (gratis)

1. Entrá a https://render.com y creá la cuenta con tu GitHub.
2. **New → Blueprint** y elegí el repo `ElUlises15/multiverse-moba`. Render lee `render.yaml` (en la raíz del repo) y propone el servicio web `multiverse-moba-server` (plan Free). Tocá **Apply**.
   - Si preferís hacerlo a mano: **New → Web Service** → el repo → Runtime **Node**, Branch `main`, **Root Directory vacío** (ver nota), Build Command `cd server && npm ci`, Start Command `cd server && npm start`, Instance Type **Free**, y en *Advanced* Health Check Path `/health`.
3. Esperá el primer deploy (2–4 min). Probá `https://multiverse-moba-server.onrender.com/health`: tiene que decir `"ok":true`.
4. Si Render te dio **otra dirección** (porque el nombre estaba tomado), cambiá `SERVER_URL` en `js/config.js` por `wss://TU-NOMBRE.onrender.com/ws`, corré `node tools/build.js` y subí el cambio. Mientras tanto podés probar con `?server=wss://TU-NOMBRE.onrender.com/ws`.
5. Listo: la página de GitHub Pages se conecta sola. También podés jugar directo en `https://TU-NOMBRE.onrender.com/`.

**Nota sobre Root Directory:** no pongas `server` como Root Directory: Render no deja ver archivos fuera de esa carpeta, y el servidor necesita `../js` (la simulación compartida). Por eso los comandos hacen `cd server`.

**Ojo con el plan gratis de Render:**
- Se **duerme** a los 15 minutos sin uso; la primera conexión tarda ~30–60 s en despertarlo (el menú muestra "Despertando el servidor…" y espera hasta 70 s). Al dormirse se pierden las partidas en curso (no debería pasar con gente jugando, porque las conexiones lo mantienen despierto).
- Tiene **0,1 CPU**. Una partida 5v5 usa ~12 % de un núcleo de una compu normal, así que en el plan gratis puede andar lenta o con saltos con más de una partida a la vez. Si pasa, opciones: plan **Starter** de Render (0,5 CPU), Fly.io, Koyeb, o una VM gratis de Oracle Cloud (Always Free, 4 núcleos ARM) con Docker.

## Alternativas

### Docker (cualquier lado)

El `Dockerfile` está en `server/`, pero se construye **desde la raíz del repo** (necesita `js/`, `css/`, etc.):

```bash
docker build -f server/Dockerfile -t multiverse-moba-server .
docker run -p 8080:8080 multiverse-moba-server
```

### Koyeb

1. https://app.koyeb.com → **Create Web Service** → GitHub → el repo.
2. Builder: **Dockerfile**, Dockerfile location `server/Dockerfile`, Work directory vacío (raíz del repo).
3. Puerto expuesto `8080` (HTTP), health check HTTP en `/health`.
4. Deploy. Tu dirección queda como `https://NOMBRE-USUARIO.koyeb.app` → `SERVER_URL = 'wss://NOMBRE-USUARIO.koyeb.app/ws'`.

### Fly.io

```bash
fly launch --no-deploy --dockerfile server/Dockerfile --name multiverse-moba-server   # desde la raíz del repo
```

En el `fly.toml` generado: `internal_port = 8080`, y agregá un chequeo `[[http_service.checks]]` con `path = "/health"`. Para que no se duerma con partidas en curso: `auto_stop_machines = "off"` (o `min_machines_running = 1`). Después `fly deploy` y usá `wss://multiverse-moba-server.fly.dev/ws` como `SERVER_URL`.
