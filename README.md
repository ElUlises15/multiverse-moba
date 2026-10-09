# Browser Multiverse MOBA (prototipo)

MOBA 5 contra 5 en 3D que corre directo en el navegador: HTML + CSS + JavaScript, con **Three.js** para los gráficos
y **PeerJS** (WebRTC) para jugar con amigos. Sin paso de build y sin servidor propio.
Las dos librerías están copiadas dentro del proyecto (`vendor/`), así que el modo de un jugador funciona sin internet.

**Jugalo online:** https://elulises15.github.io/multiverse-moba/ · Código: https://github.com/ElUlises15/multiverse-moba

## Cómo jugar

- **Opción 0 (la más fácil):** entrá a https://elulises15.github.io/multiverse-moba/ desde el navegador.
- **Opción 1:** abrí `index.html` con doble clic.
- **Opción 2 (un solo archivo):** abrí `dist/multiverse-moba.html`. Tiene todo adentro, incluso Three.js y PeerJS (pesa ~1,6 MB), así que lo podés mandar como adjunto. La música no va adentro (pesa varios MB): el archivo la busca en `../assets/music/`, y si no la encuentra usa la música que genera el juego.
- Necesitás un navegador con **WebGL** (cualquier Chrome, Edge, Firefox o Safari actual). Si la compu es lenta, abrí `index.html?low=1` (sin sombras ni antialias).

### Novedades de la versión 0.5
- **Tienda estilo LoL con recetas:** los objetos básicos se combinan en intermedios y legendarios. Si ya tenés componentes, se usan y pagás solo la diferencia. La tienda muestra el árbol de construcción (lo que ya tenés en verde), recomendados por rol, y tiene **Deshacer** y venta.
- **Seis campeones nuevos:** T-Rex, Dragón, Zombie, Creeper, Enderman y Pikachu, más el rol **Asesino**.
- **Música y sonido:** banda sonora hecha con Suno AI por Ulises (tema de menú y tema de batalla) y efectos de sonido.
- **Menú de configuración** (⚙ o Esc): cambiás cualquier tecla, modo de lanzamiento, modos para daltonismo, colores de equipo, cámara, gráficos, interfaz y volumen.
- **Pulido:** indicador de último golpe en los súbditos, números de daño que "saltan", sacudón al recibir golpes, zoom suave, señales (pings) para tu equipo, tooltips con el valor de cada rango resaltado y bots que compran siguiendo las rutas.

En la pantalla de inicio tenés tres pestañas:

| Pestaña | Qué hace |
|---|---|
| **Jugar solo** | Elegís campeón y jugás con 4 bots aliados contra 5 bots enemigos. No necesita internet. |
| **Crear sala** | Abrís una sala online y te da un **código de 5 letras** para pasarle a tus amigos. |
| **Unirse a una sala** | Escribís el código que te pasaron (o abrís el link que te mandaron). |

Ganás cuando destruís el **nexo** enemigo.

## Multijugador con amigos

1. Uno hace de **anfitrión**: pone su nombre, va a **Crear sala** y toca **Crear sala**. Aparece la sala con un código (por ejemplo `K7QXM`) y un link.
2. Le pasa el **código** o el **link** a sus amigos (botón **Copiar**). El link es la dirección del juego con `?sala=K7QXM` al final y ya completa el código.
3. Los amigos abren el juego, van a **Unirse a una sala**, escriben el código y entran.
4. En la sala, cada uno elige **equipo** (Azul o Rojo, hasta 5 por equipo) y **campeón** (no se repite dentro del mismo equipo). Los lugares vacíos los ocupan **bots**.
5. El anfitrión toca **¡Empezar partida!**. Pueden jugar desde 1 contra bots hasta 5 contra 5 entre personas.

Cómo funciona por dentro:
- **El anfitrión manda.** Su navegador corre la simulación completa (la misma que el modo de un jugador). Los demás solo mandan sus órdenes (moverse, atacar, lanzar, comprar, subir habilidades…) y dibujan lo que les manda el anfitrión, unas **20 veces por segundo**, con interpolación de 100 ms para que se vea suave.
- **Conexión directa (P2P) por WebRTC.** El servidor público y gratuito de PeerJS (`0.peerjs.com`) solo se usa para que los navegadores se encuentren; después los datos van directo entre ustedes. No hay servidor nuestro.
- **El anfitrión tiene que dejar abierta su pestaña.** Si la cierra, se termina la partida para todos. Si la pone en segundo plano, el navegador frena la pestaña; el juego trata de seguir simulando con un temporizador aparte, pero lo más seguro es dejarla a la vista.
- **Si un amigo se desconecta, un bot toma su campeón** y la partida sigue.
- En la partida online no hay pausa: Esc abre un menú para salir.
- Cada cliente recibe solo lo que su equipo puede ver: un enemigo escondido en un arbusto no viaja en la foto de la red.
- Algunas redes muy cerradas (de empresa, o ciertos datos móviles) bloquean WebRTC sin un servidor TURN. En ese caso la conexión falla con un aviso. En casa o con wifi normal debería andar.

**Modo local (sin internet):** tildá *Modo local* (o abrí `index.html?net=local`). Las pestañas del **mismo navegador** se conectan entre sí con `BroadcastChannel`. Sirve para probar el multijugador en una sola compu.

**GitHub Pages:** el juego está publicado en https://elulises15.github.io/multiverse-moba/ (la rama `main`, carpeta raíz). Como es todo estático, no hace falta nada más. El link de la sala que genera el juego apunta a esa dirección (si abriste el juego como archivo local, igual comparte el link publicado, así tus amigos no necesitan bajarse nada).

### Conexión entre redes distintas (STUN/TURN)

Los navegadores intentan conectarse **directo** (con ayuda de STUN). Cuando los routers no lo permiten (CGNAT, NAT simétrico, redes de oficina), el juego usa un **relé TURN** que pasa los datos. El TURN que traía PeerJS por defecto ya no existe; por eso antes muchas uniones se quedaban en "Conectando…" para siempre.

- Servidores que se usan (todo en `js/net.js`, objeto `Net.ICE`): STUN de Google y Cloudflare, TURN público gratuito `turn.evan-brass.net` (UDP/TCP/TLS 443) y credenciales TURN temporales de `turn.elixir-webrtc.org` (se piden al conectar; si fallan, se sigue sin ellas).
- **Tu propio TURN:** agregá una entrada en `Net.ICE.servers`, por ejemplo `{ urls: ['turn:mi-turn.example.com:3478', 'turns:mi-turn.example.com:443?transport=tcp'], username: 'yo', credential: 'clave' }` (Metered, ExpressTURN o tu propio coturn).
- En la sala se ve si la conexión quedó **directa P2P** o **por relé TURN**, con la latencia.
- Para probar el relé: agregá `?relay=1` a la dirección (fuerza usar solo TURN).
- Al unirte se muestran las etapas (servidor → sala → conexión). Si en 15 s no conecta, aparece un mensaje con las causas posibles y **Reintentar**. Si el código no existe: "La sala no existe o el anfitrión cerró la pestaña".
- El anfitrión ve "Esperando jugadores…", un aviso si su pestaña queda en segundo plano, y se reconecta solo al servidor de salas si se corta.

### Después de la partida

Al terminar aparecen **Volver a la sala (revancha)** —el anfitrión vuelve a la misma sala con los mismos amigos y puede empezar otra— y **Menú principal**. Todo se cierra prolijo (conexiones, simulación, escena 3D, `?sala=` de la dirección), así que se puede crear o unirse a otra sala sin recargar la página. Si el anfitrión abandona, los demás vuelven al menú con un aviso.

### Controles

| Tecla | Acción |
|---|---|
| Clic derecho | Moverse o atacar. No hace falta acertarle justo al enemigo: se elige el más cercano al cursor (unos 50 px, se ajusta al zoom), y los campeones tienen prioridad sobre los súbditos. El enemigo que vas a atacar se ve resaltado en rojo y el cursor cambia a una espada. Podés mantener el clic apretado |
| A | Atacar-mover hacia el cursor: ataca al enemigo más cercano a ese punto o camina hasta ahí atacando lo que encuentre. También funciona con A + clic izquierdo (en el mapa o en el minimapa) |
| Shift (mantener) | Apuntar solo a campeones (ignora súbditos) |
| Q W E R | Mantené apretada la tecla para ver el alcance y la dirección, y soltala para lanzar hacia el mouse. Si el cursor está sobre un enemigo, la habilidad apunta a su centro. Clic derecho o Esc cancelan |
| Botón **+** / Ctrl + Q W E R | Subir de nivel una habilidad (también funciona Alt + Q W E R) |
| C (mantener) | Ver tu alcance de ataque |
| B | Volver a la base (8 s; se corta si te pegan o te movés) |
| P | Tienda (solo en tu base o mientras estás muerto) |
| Tab (mantener) | Marcador (con los nombres de los jugadores y quién es bot) |
| Y | Fijar o soltar la cámara (con la cámara suelta, la movés con los bordes de la pantalla o las flechas) |
| Espacio (mantener) | Centrar la cámara en tu campeón |
| S | Frenar |
| Rueda del mouse | Zoom |
| Clic izquierdo en el minimapa | Mover la cámara · Clic derecho: mandar a tu campeón ahí |
| G + clic izquierdo (o Alt + clic) | Señal "¡vamos!" para tu equipo (G + clic derecho o Ctrl: "¡peligro!"). También sobre el minimapa |
| Esc | Pausa (solo jugando solo) / menú en partidas online. Desde ahí, o con el botón ⚙, abrís la **Configuración** |

**Todas estas teclas se pueden cambiar** en ⚙ Configuración → Controles (cada acción tiene una tecla principal y una alternativa).

> Ojo: Chrome no deja que una página use **Ctrl+W** (cierra la pestaña). Para subir la W usá **Alt+W** o el botón **+**.

**Ataque automático:** cuando estás quieto o llegás a donde hiciste clic, tu campeón ataca solo al enemigo más cercano que tenga en rango (primero campeones, después súbditos; nunca empieza solo con torres ni monstruos). Si elegiste un objetivo a mano, lo persigue hasta una distancia razonable.

### Configuración (⚙)
Se abre con el botón ⚙ (arriba en el menú y en la partida) o con Esc → Configuración. Todo se aplica en el momento y se guarda en el navegador (localStorage).

| Pestaña | Opciones |
|---|---|
| Controles | Cambiar la tecla de cada acción: Q, W, E, R, subir Q/W/E/R, atacar-mover, frenar, volver a la base, tienda, fijar cámara, centrar cámara, marcador, ver alcance y señal. **Modo de lanzamiento:** rápido (sale al apretar), rápido con indicador (sale al soltar; el de siempre) o normal (apretás y confirmás con clic izquierdo) |
| Juego | Números de daño, barras de vida de súbditos (solo dañados o siempre), indicador de último golpe, marcas cada 100 de vida, nombres sobre los campeones, mostrar FPS |
| Cámara | Zoom inicial, inclinación, velocidad de paneo por los bordes (o apagado), suavidad del seguimiento, cámara fija al empezar |
| Gráficos | Calidad baja / media / alta (resolución interna), sombras sí/no, tamaño de la interfaz (75–150 %) |
| Audio | Volumen general, música, efectos y silenciar todo |
| Accesibilidad | Modos para **protanopía, deuteranopía y tritanopía** (cambian colores de equipo, aros, barras de vida y minimapa), **formas por equipo** (aliados con círculo y enemigos con triángulo en barras y minimapa) y colores de equipo a elección |

### Música y sonido
- **Música:** *menu.mp3* (pantalla de inicio y sala) y *batalla.mp3* (durante la partida), **generadas con Suno AI por Ulises**. Están en `assets/music/`, recodificadas a 112 kbps (unos 2,5 MB cada una), y al terminar vuelven a empezar con un fundido de 3 s.
- **Cambiar la música:** poné tus archivos (.mp3 u .ogg) en `assets/music/` y escribí sus nombres en `assets/music/tracks.js`.
- **Respaldo:** si un archivo no carga, el juego genera una música provisoria con WebAudio (`js/audio.js`), así nunca queda en silencio.
- **Efectos:** ataques cuerpo a cuerpo y a distancia, habilidades, explosiones, torres, subir de nivel, comprar/vender, muertes y señales. Se sintetizan en el momento, sin archivos, y bajan de volumen con la distancia a la cámara.
- Los navegadores no dejan reproducir audio hasta el primer clic o tecla, así que la música arranca ahí.

### Subir habilidades (como en LoL)
- Arrancás en nivel 1 con **1 punto** y todas las habilidades bloqueadas (se ven grises). Una habilidad sin aprender no se puede lanzar.
- Cada nivel te da 1 punto. Cuando tenés puntos, aparece un botón **+** amarillo arriba de cada habilidad que podés subir.
- Q, W y E llegan a rango 5, pero nunca pueden pasar de ⌈nivel/2⌉.
- La R tiene 3 rangos y se aprende en los niveles **6, 11 y 16**.
- Daño, enfriamiento y maná de cada habilidad cambian según el rango (el tooltip muestra los valores de cada rango).

## Campeones

| Campeón | Rol | En una línea |
|---|---|---|
| Granito | Tanque | Gólem de piedra: aguanta, aturde y protege |
| Bastión | Tanque | Escudo del Alba: escudos y control para el equipo |
| Rorik | Luchador | Hacha del Norte: daño sostenido cuerpo a cuerpo |
| Kaida | Luchador | Hoja Carmesí: entra, corta y sale |
| Ignis | Mago | Hechicero de Brasas: daño de área a distancia |
| Lyra | Mago | Tejedora de Escarcha: ralentiza y congela |
| Vex | Tirador | Arquera Errante: daño a distancia y movilidad |
| Bolt | Tirador | Artillero Mecánico: torreta andante |
| Sol | Soporte | Sacerdotisa Radiante: cura y escudos |
| Mora | Soporte | Chamana del Bosque: raíces y curación |
| **T-Rex** | Luchador | Q muerde (más daño a los que tienen poca vida y se cura), W ruge y da miedo, E embiste empujando, R se agranda y gana velocidad de ataque y robo de vida |
| **Dragón** | Mago | Q aliento de fuego en cono (quema), W vuela a otro lado, E escamas que dan escudo y queman cerca, R lluvia de meteoros que aturde |
| **Zombie** | Tanque | Pasiva: revive una vez cada 150 s. Q agarre que atrae y aturde, W no-muerto (no puede morir unos segundos y se cura), E infección alrededor, R la horda: zona que ralentiza y aturde |
| **Creeper** | Asesino | Pasiva: reaparece más rápido. Q sigilo, W explota cerca (le cuesta vida), E salto de pólvora, R se carga y hace una explosión enorme |
| **Enderman** | Asesino | Q se teletransporta, W tira un bloque que ralentiza, E mirada que baja la armadura y aturde, R roba del vacío: aparece sobre un campeón y lo remata |
| **Pikachu** | Tirador | Pasiva: cada 4.º ataque electrocuta y ralentiza. Q impactrueno que atraviesa, W ataque rápido, E bola voltio, R trueno que aturde |

Los valores de cada rango se ven en la selección y en el tooltip de cada habilidad durante la partida (el rango actual aparece resaltado).

> T-Rex, Dragón y Zombie son genéricos. **Creeper y Enderman (Minecraft) y Pikachu (Pokémon) son personajes con marca registrada de terceros**, incluidos como homenaje en un proyecto de fans sin fines de lucro. Si el proyecto se publica en serio, conviene cambiarlos por diseños propios.

## Gráficos 3D

- Todo se dibuja con **Three.js r180** (`vendor/three.min.js`), con cámara en ángulo estilo LoL (unos 56° de inclinación, se ven ~2300 unidades de ancho), sombras suaves, río animado, paredes de roca y escenografía (árboles, pasto alto en los arbustos, rocas, hongos, cristales, juncos, faroles…).
- **La simulación está separada del dibujo.** `js/game.js` y compañía no saben nada de Three.js. El dibujo (`js/render3d.js`) solo lee el estado del mundo, que puede ser la partida local o la réplica que arma un cliente online. Por eso el mismo código sirve para un jugador y para multijugador.
- Todos los modelos son **procedurales** (hechos con código, sin archivos de modelos ni texturas) y viven en `js/art/`. Cada campeón tiene silueta propia, animaciones de quieto, caminar, atacar, lanzar, volver a base y morir, una línea de historia, una frase y efectos propios para cada habilidad.
- Los retratos de la selección, la vista previa animada de la ficha y los íconos de los objetos también salen de esos modelos.

### Quién hizo cada parte del arte

Ulises pidió que el arte lo hicieran **Claude** y **Codex** (las dos herramientas de línea de comandos). Cada archivo se generó con una llamada propia, siguiendo la especificación de [`docs/ARTE-3D.md`](docs/ARTE-3D.md). Después se revisó, se validó con un chequeo automático (presupuesto de mallas, que no tire errores, tamaños) y se integró al juego.

| Archivo | Contenido | Hecho por |
|---|---|---|
| `js/art/art_granito.js` | Granito, el Gólem de la Cantera | Claude |
| `js/art/art_kaida.js` | Kaida, la Hoja Carmesí | Claude |
| `js/art/art_ignis.js` | Ignis, el Hechicero de Brasas | Claude |
| `js/art/art_vex.js` | Vex, la Arquera Errante | Claude |
| `js/art/art_sol.js` | Sol, la Sacerdotisa Radiante | Claude |
| `js/art/art_props.js` | Escenografía, suelo pintado del mapa, material de las paredes y fuente | Claude |
| `js/art/art_bastion.js` | Bastión, el Escudo del Alba | Codex |
| `js/art/art_rorik.js` | Rorik, el Hacha del Norte | Codex |
| `js/art/art_lyra.js` | Lyra, la Tejedora de Escarcha | Codex |
| `js/art/art_bolt.js` | Bolt, el Artillero Mecánico | Codex |
| `js/art/art_mora.js` | Mora, la Chamana del Bosque | Codex |
| `js/art/art_units.js` | Súbditos (cuerpo a cuerpo, hechicero, cañón), torre, nexo, gólem y lobo | Codex |
| `js/art/art_items.js` | Nombres, íconos y texto de sabor de los objetos originales | Codex |
| `js/art/art_trex.js` | T-Rex | Claude |
| `js/art/art_dragon.js` | Dragón | Claude |
| `js/art/art_creeper.js` | Creeper | Claude |
| `js/art/art_zombie.js` | Zombie | Codex |
| `js/art/art_enderman.js` | Enderman | Codex |
| `js/art/art_pikachu.js` | Pikachu | Codex |
| `js/art/art_items2.js` | Íconos, nombres y texto de sabor de los 15 objetos nuevos de la 0.5 | Codex |

El motor 3D, la integración, el mapa, el multijugador, la tienda, la configuración, el audio y la interfaz (`render3d.js`, `portraits.js`, `net.js`, `lobby.js`, `hud.js`, `settings.js`, `audio.js`, etc.) los escribió Grok Bot. La música es de Ulises, hecha con Suno AI.

**Objetos con personalidad:** cada objeto tiene nombre propio, ícono dibujado y texto de sabor. Por ejemplo: *Tajo de la Otra Cuadra* (Espada Larga), *Botas de la Vereda Paralela* (Botas), *Filo del Casi Imposible* (Filo del Infinito), *Galera del Cosmos Inflado* (Sombrero Mortal), *Sol de Bolsillo Blindado* (Égida).

## El mapa

- Mide **14.000 × 14.000** unidades (como la Grieta del Invocador). 1 unidad del juego = 1 unidad de LoL.
- **3 carriles**, **río** en diagonal, **jungla** con **20 paredes** de roca, **20 arbustos** y **8 campamentos** (4 de gólem y 4 de lobos; los lobos vienen en manada de 3).
- **Búsqueda de caminos:** grilla de navegación de 100 unidades con A*. Las unidades rodean las paredes solas, y los desplazamientos y empujones frenan contra la roca.
- **Arbustos:** si estás adentro de un arbusto, el equipo enemigo no te ve (ni te puede apuntar) salvo que tenga a alguien adentro del mismo arbusto. Atacar o lanzar una habilidad te revela por 1 segundo.
- **Tiempos de caminata** (a 340 de velocidad): carril central **14.700** unidades, unos **43 s**; carriles laterales **21.300**, unos **63 s**. Son parecidos a los de LoL.
- **Impulso de la base:** dentro de tu base, si no peleaste en los últimos 5 s, caminás un 75 % más rápido (como el *Homeguard* de LoL). Así volver a la línea no se hace eterno.
- Torres: 2 por carril (exterior e interior), más el nexo.

### Reglas y números (basados en League of Legends / Wild Rift)
- **Velocidades:** campeones 325–345, súbditos 325.
- **Alcances:** cuerpo a cuerpo 125–175, a distancia 500–550, torres 750.
- **Proyectiles:** ataques básicos 1600–2000, súbdito hechicero 650, súbdito de asedio y torres 1200, habilidades 1200–2000.
- **Ataques:** tienen tiempo de preparación (*windup*) y se repiten según la velocidad de ataque (máximo 2,5 por segundo). Hay críticos y robo de vida.
- **Daño:** daño × 100 / (100 + armadura), y lo mismo con resistencia mágica. La aceleración de habilidad reduce el enfriamiento: cd × 100 / (100 + aceleración).
- **Oleadas:** cada 30 s salen 3 súbditos cuerpo a cuerpo y 3 hechiceros; cada 3 oleadas se suma un cañón. La primera sale a los 30 s.
- **Oro:** empezás con 500. Oro pasivo (2 por segundo) y oro solo por el **último golpe** (21 / 14 / 60). La experiencia se reparte entre los aliados cercanos. Campeón: 300 de oro. Torre: 250 si estás cerca y 50 todo el equipo. Jungla: gólem 100, lobo grande 70, lobos chicos 30.
- **Torres:** atacan primero a súbditos, pero cambian a un campeón que le pegue a un campeón aliado dentro de su rango. Contra campeones cada disparo seguido pega más fuerte. Primero cae la exterior, después la interior, y el nexo se puede atacar cuando cae al menos una interior.
- **Muerte:** el tiempo de reaparición sube con el nivel (de 10 s a 52,5 s). Nivel máximo 18, con la curva de experiencia de LoL.
- **Objetos:** 33 objetos con costos parecidos a LoL: 11 básicos, 9 intermedios, 4 botas mejoradas (solo un par) y 9 legendarios con **pasivas únicas**. Al vender recuperás el 70 %. Hasta 6 objetos.

### Tienda y recetas
- Cada objeto armado tiene **componentes**. Por ejemplo, *Cuchilla Negra* = Martillo de Guerra (Espada + Espada) + Gema Avivadora (Rubí) + 950 de oro.
- **Regla de LoL:** al comprar, los componentes que ya tenés (aunque estén adentro de otro intermedio tuyo) se consumen y pagás solo lo que falta. Cuchilla Negra sale 3000 si no tenés nada, y 1900 si ya tenés Espada, Espada y Rubí.
- **La tienda** tiene categorías (recomendados para tu rol, todos, básicos, intermedios, legendarios, botas), un árbol con lo que ya tenés en verde, "sirve para", el precio con descuento, comprar con clic derecho, vender y **Deshacer** (la última compra o venta, mientras sigas en la base).
- **Pasivas únicas:** Cuchilla Negra (cada golpe a un campeón le baja la armadura), Filo del Infinito (críticos 40 % más fuertes), Hidra (golpe en área cuerpo a cuerpo), Huracán (2 rayos extra a distancia), Sombrero (+30 % de poder), Eco (daño extra en tu próxima habilidad, cada 6 s), Égida (quema alrededor), Malla de Espinas (devuelve daño), Rostro Espiritual (+25 % de curas y escudos), Botas de Acero (−12 % de daño de básicos), Botas de Mercurio (tenacidad).
- **Los bots** compran siguiendo una ruta por rol: primero componentes, después los arman.

## Estructura

```
index.html            Página principal (carga los scripts en orden)
css/style.css         Estilos de la interfaz
vendor/               Three.js r180 y PeerJS 1.5.5 (copiados, con sus licencias MIT)
js/core.js            Registro de campeones (MOBA.registerChampion) y utilidades
js/settings.js        Configuración (localStorage) y su menú
js/audio.js           Música (archivos o generada) y efectos de sonido
assets/music/         menu.mp3, batalla.mp3 y tracks.js (qué archivo usar)
js/art.js             Registro del arte 3D (MOBA.defineChampionArt, defineUnitArt, defineProp, defineItemArt…)
js/champions/*.js     UN ARCHIVO POR CAMPEÓN (datos y habilidades)
js/art/art_*.js       Arte 3D: un archivo por campeón + unidades, escenografía y objetos
js/items.js           Objetos, recetas (MOBA.purchasePlan), pasivas, recomendados y rutas de los bots
js/map.js             Mapa: carriles, río, paredes, arbustos, campamentos y búsqueda de caminos (A*)
js/entities.js        Unidades: campeones, súbditos, torres, nexos, monstruos
js/abilities.js       Sistema genérico de habilidades (dirigido por datos)
js/ai.js              IA de los bots
js/game.js            Simulación de la partida (sin nada de dibujo)
js/net.js             Multijugador: transportes (PeerJS / BroadcastChannel), fotos del mundo, réplica y sesiones
js/render3d.js        Dibujo 3D con Three.js, indicadores, barras de vida y minimapa
js/portraits.js       Retratos 3D, vista previa animada e íconos de objetos
js/hud.js             HUD, tienda, marcador y pantalla final
js/ui.js              Selección de campeón (con historia, frase y vista previa)
js/lobby.js           Menú de inicio y sala multijugador
js/main.js            Arranque, controles, cámara y bucle principal
docs/ARTE-3D.md       Especificación del arte 3D (la que siguieron Claude y Codex)
tools/build.js        Genera dist/multiverse-moba.html (node tools/build.js)
tools/test.js         Test automático con Playwright
dist/                 Versión en un solo archivo
screenshots/          Capturas del test
```

## Cómo agregar un campeón nuevo (por ejemplo, Goku o Pikachu)

1. Copiá cualquier archivo de `js/champions/`, por ejemplo `kaida.js`, y renombralo (`goku.js`).
2. Cambiá los datos. Este es el formato completo:

```js
MOBA.registerChampion({
  id: 'goku',                    // único, sin espacios
  name: 'Goku',
  title: 'El Saiyajin',
  role: 'Luchador',              // Tanque | Luchador | Mago | Tirador | Soporte
  description: 'Texto corto para la pantalla de selección.',
  color: '#ff8c1a',              // color principal del cuerpo
  accent: '#1a4dff',             // color secundario (borde, proyectiles, habilidades)
  shape: 'star',                 // forma del retrato de respaldo (si no hay WebGL): circle | square | triangle | diamond | pentagon | hexagon | star
  skillOrder: [0, 2, 1],         // opcional: qué básica maximizan los bots (0=Q, 1=W, 2=E)
  stats: {                       // podés omitir lo que quieras: toma el valor por defecto de core.js
    hp: 650, hpPerLevel: 105, mana: 300, manaPerLevel: 40,
    ad: 64, adPerLevel: 3.5, ap: 0, armor: 32, armorPerLevel: 4.2, mr: 32, mrPerLevel: 1.3,
    attackRange: 175,            // más de 300 = ataca a distancia (proyectil)
    attackSpeed: 0.68, attackSpeedPerLevel: 0.03, windup: 0.25,
    moveSpeed: 345, projectileSpeed: 1800, hpRegen: 1.5, manaRegen: 1.6
  },
  abilities: [                   // exactamente 4: Q, W, E, R (en ese orden)
    { name: 'Kamehameha', desc: 'Rayo de energía en línea recta.',
      cast: 'line', range: 900, width: 140, delay: 0.4,
      cd: [9, 8, 7, 6, 5], mana: [50, 55, 60, 65, 70],          // un valor por rango (Q/W/E: 5)
      damage: { base: [80, 120, 160, 200, 240], bonusAd: 0.8, ap: 0.5 }, damageType: 'magic' },
    { name: 'Teletransportación', desc: 'Aparece en otro lugar.',
      cast: 'dash', blink: true, range: 450, cd: [18, 16, 14, 12, 10], mana: 50 },
    { name: 'Ráfaga', desc: 'Golpes alrededor.',
      cast: 'self', radius: 300, cd: 7, mana: 40,
      damage: { base: [60, 90, 120, 150, 180], ad: 0.8 }, damageType: 'physical',
      effects: [{ type: 'slow', amount: [0.2, 0.25, 0.3, 0.35, 0.4], duration: 1.5 }] },
    { name: 'Genkidama', desc: 'DEFINITIVA: esfera gigante.',
      cast: 'area', range: 1200, radius: 400, delay: 1.2,
      cd: [120, 100, 80], mana: 100,                            // la R tiene 3 rangos
      damage: { base: [250, 400, 550], ap: 1.0 }, damageType: 'magic',
      effects: [{ type: 'stun', duration: [1, 1.25, 1.5] }] }
  ]
});
```

3. **Arte 3D (opcional pero recomendado):** creá `js/art/art_goku.js` con el modelo, las animaciones, la historia, la frase y los efectos de cada habilidad. El contrato completo está en [`docs/ARTE-3D.md`](docs/ARTE-3D.md); en resumen:

```js
(function () {
  'use strict';
  MOBA.defineChampionArt('goku', {
    lore: 'Una línea de historia para la ficha.',
    quote: '«Una frase que diga en el juego.»',
    build: function (THREE, ctx) {           // Y arriba, mira hacia +Z, unidades de LoL (180–320 de alto)
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(50, 90, 4, 8), ctx.cache.mat(ctx.color));
      body.position.y = 110; g.add(body);
      return { object: g, height: 230, update: function (s) {
        // s.anim: 'idle' | 'walk' | 'attack' | 'cast' | 'recall' | 'dead'; s.t, s.progress, s.time, s.slot
        body.position.y = 110 + Math.sin(s.time * 3) * 4;
      } };
    },
    fx: {                                      // efectos propios de Q, W, E, R (si falta uno, se usa uno genérico)
      Q: function (THREE, ctx, info) {         // info.kind: projectile | area | line | self | burst | dash | target
        const m = new THREE.Mesh(new THREE.SphereGeometry(40, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ccff }));
        return { object: m, update: function (p, dt) { m.scale.setScalar(1 + p); } };
      }
    }
  });
})();
```

   Si no hacés arte, el campeón igual funciona con un modelo genérico de sus colores.

4. Agregá los scripts en `index.html`: el campeón junto a los demás (`js/champions/`) y el arte junto a los demás `js/art/art_*.js`:

```html
<script src="js/champions/goku.js"></script>
<script src="js/art/art_goku.js"></script>
```

5. Si querés regenerar la versión de un solo archivo, corré `node tools/build.js`.

Listo: el campeón aparece en la selección (con su retrato 3D), en las salas multijugador, y los bots también lo usan.

### Referencia de habilidades

**Tipos de lanzamiento (`cast`):**

| cast | Qué hace | Parámetros |
|---|---|---|
| `skillshot` | Proyectil recto hacia el mouse | `range`, `speed`, `width`, `pierce` (atraviesa) |
| `line` | Golpe instantáneo en línea (con `delay`, primero muestra un aviso) | `range`, `width`, `delay` |
| `area` | Círculo en la posición del mouse | `range`, `radius`, `delay`, `duration` + `tick` (zona persistente) |
| `self` | Alrededor del propio campeón (o solo buffs si no tiene `radius`) | `radius`, `allyRadius` |
| `dash` | Desplazamiento hacia el mouse | `range`, `speed`, `blink` (teletransporte), `radius` (daño al caer), `hitAlongPath` (daña en el trayecto) |
| `target` | Golpe al enemigo más cercano al mouse dentro del alcance | `range`, `championsOnly`, `blinkToTarget` (aparece al lado) |
| `cone` | Cono desde el campeón hacia el mouse | `range`, `angle` (apertura en grados) |

**Comunes:** `cd` (segundos), `mana`, `damage`, `damageType` (`physical` | `magic` | `true`), `color`, `executeBonus` (más daño cuanta menos vida tenga el objetivo).

**Valores por rango:** casi cualquier número (`cd`, `mana`, `amount`, `duration`, `base`…) puede ser una lista con un valor por rango: 5 valores para Q/W/E y 3 para la R.

**Valores escalables:** donde va un número también podés poner `{ base, lvl, ad, bonusAd, ap, maxHp }` (cada campo puede ser una lista por rango).
Esto se calcula como `base + lvl × (nivel − 1) + ad × Daño total + bonusAd × Daño adicional + ap × Poder + maxHp × VidaMáx`.

**Efectos:**
- `effects` → sobre los enemigos alcanzados: `slow {amount, duration}`, `stun {duration}`, `knockback {distance}`, `dot {dps, duration}`, `fear {duration}` (huyen), `pull` (los atrae), `armorShred {amount, duration}`.
- `selfEffects` → sobre quien lanza la habilidad.
- `allyEffects` → sobre los aliados en `allyRadius` (o dentro del área, si es `area`).
- Efectos de buff: `shield`, `haste`, `attackSpeed`, `armor`, `mr`, `lifesteal`, `stealth` (sigilo), `undying` (no puede morir), `grow` (crece) — todos con `amount` y `duration` —, más `heal {amount}` y `mana {amount}`.
- `selfDamage: 0.1` → la habilidad le cuesta al que la lanza ese porcentaje de su vida actual.
- Pasivas de campeón (`passive: { id }`): `revive`, `quickRespawn`, `static`.

**IA:** los bots deducen solos cómo usar cada habilidad (daño, entrar a pelear, escapar, buff, ayudar a aliados).
Si querés forzar un uso, agregá `aiKind: 'damage' | 'engage' | 'escape' | 'buff' | 'ally'`.

## Test automático

```
npm i playwright && npx playwright install chromium
node tools/test.js                                   # prueba index.html, multijugador incluido, y guarda capturas
node tools/test.js "$PWD/dist/multiverse-moba.html"  # prueba la versión de un solo archivo
node tools/test.js --sin-peer                        # sin la prueba online (por ejemplo, sin internet)
```

El test usa WebGL por software (SwiftShader), así que anda en una compu sin placa de video. Revisa:
- Que carguen Three.js, PeerJS y el arte de los 16 campeones, unidades, escenografía y objetos, y que la escena 3D se dibuje.
- **0.5:** descuento de recetas (3000 → 1900), comprar consume los componentes, Deshacer, árbol de la tienda con lo que tenés, bots que compran por rutas, filtro Asesino, que carguen los archivos de música, reasignar una tecla (la nueva anda y la vieja no), lanzamiento rápido, modo daltonismo en colores de equipo, barras, aros y minimapa, inclinación de cámara en vivo, que la configuración sobreviva a recargar la página, y que los 6 campeones nuevos carguen con su arte y lancen Q/W/E/R.
- La ficha de campeón con historia y frase.
- Subida de habilidades: 1 punto en nivel 1, Ctrl+Q, botón +, Alt+E, R bloqueada hasta nivel 6, tope de rango.
- Apuntado generoso, cursor de espada, prioridad de campeones, Shift, atacar-mover y ataque automático.
- Último golpe, experiencia compartida, agro y daño creciente de torres, impulso de la base.
- Mapa: el camino rodea una pared y el campeón llega sin atravesarla; un enemigo en un arbusto queda oculto (y la foto de red no manda su posición) hasta que entrás.
- Una partida completa acelerada termina.
- **Multijugador online con dos navegadores Chromium separados** (WebRTC real por PeerJS): crear sala, entrar con el código y con el link, elegir equipo y campeón, empezar, que la orden del cliente mueva su campeón en el anfitrión y vuelva en la foto, subir una habilidad, y que un bot reemplace al que se va.
- Lo mismo en **modo local** (dos pestañas, BroadcastChannel).
- Que no haya errores ni advertencias en la consola.

Para depurar, en la consola del navegador tenés `MOBA.debug.simulate(segundos)`. También podés abrir `index.html?speed=3` para acelerar el juego (solo jugando solo).

## Limitaciones conocidas
- No hay niebla de guerra general: solo se esconden las unidades dentro de arbustos.
- Hay 2 torres por carril (no 3 más inhibidores), no hay dragones ni barón.
- El multijugador depende del navegador del anfitrión: si se le cuelga o cierra la pestaña, se corta la partida. No hay reconexión ni servidor TURN propio, y los clientes ven el mundo con ~100 ms de retraso más la latencia.
- Solo algunos campeones (los nuevos) tienen pasiva propia.
- La IA es simple: no hace emboscadas ni juega la visión.
- En compus sin placa de video el 3D puede andar lento: probá `?low=1`.
- No hay balance fino. Los efectos de sonido son sintéticos y simples.
