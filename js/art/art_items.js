(function () {
  'use strict';

  // Coordenadas de diseño 0–100; también los trazos escalan con el tamaño.
  var palettes = {
    damage: ['#531626', '#160e20', '#fb6b66'],
    magic: ['#164d80', '#0b132e', '#60ceff'],
    defense: ['#315a50', '#121e29', '#93cbb2'],
    gold: ['#70501b', '#24172d', '#ffd36a']
  };
  function gradient(c, x, y, xx, yy, a, b) {
    var g = c.createLinearGradient(x, y, xx, yy);
    g.addColorStop(0, a); g.addColorStop(1, b); return g;
  }
  function polygon(c, points, fill, stroke, width) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 2; c.stroke(); }
  }
  function line(c, points, color, width) {
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.strokeStyle = color; c.lineWidth = width || 3; c.stroke();
  }
  function circle(c, x, y, r, fill, stroke, width) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 2; c.stroke(); }
  }
  function rounded(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function star(c, x, y, r, color) {
    polygon(c, [[x,y-r],[x+r*0.28,y-r*0.28],[x+r,y],[x+r*0.28,y+r*0.28],
      [x,y+r],[x-r*0.28,y+r*0.28],[x-r,y],[x-r*0.28,y-r*0.28]], color);
  }
  function frame(c, type) {
    var p = palettes[type];
    rounded(c, 2, 2, 96, 96, 15);
    c.fillStyle = gradient(c, 5, 0, 85, 100, p[0], p[1]); c.fill();
    c.strokeStyle = '#090e19'; c.lineWidth = 4; c.stroke();
    rounded(c, 5, 5, 90, 90, 12); c.strokeStyle = p[2]; c.lineWidth = 2.5; c.stroke();
    var halo = c.createRadialGradient(49, 43, 4, 49, 43, 48);
    halo.addColorStop(0, p[2] + '55'); halo.addColorStop(1, p[2] + '00');
    circle(c, 49, 43, 46, halo);
    // Órbita tenue: lenguaje compartido del multiverso, detrás de cada objeto.
    c.save(); c.translate(50, 50); c.rotate(-0.55); c.scale(1, 0.63);
    circle(c, 0, 0, 36, null, p[2] + '55', 2); c.restore();
    star(c, 17, 22, 4, p[2]); star(c, 82, 77, 3, p[2]);
    if (type === 'gold') {
      polygon(c, [[42,6],[50,12],[58,6]], '#fff1b1');
      polygon(c, [[42,94],[50,88],[58,94]], '#d79935');
    }
  }
  function gem(c, x, y, r, color, light) {
    polygon(c, [[x,y-r],[x+r,y-r*0.25],[x+r*0.72,y+r*0.65],[x,y+r],
      [x-r*0.72,y+r*0.65],[x-r,y-r*0.25]],
      gradient(c,x-r,y-r,x+r,y+r,light,color), '#101b2c', 3);
    polygon(c, [[x,y-r],[x+r,y-r*0.25],[x,y],[x-r,y-r*0.25]], light);
    polygon(c, [[x,y],[x+r,y-r*0.25],[x+r*0.72,y+r*0.65],[x,y+r]], color);
    line(c, [[x,y-r],[x,y+r]], '#ffffff99', 2);
    star(c, x-r*0.3, y-r*0.24, r*0.19, '#fffbea');
  }
  function blade(c, variant) {
    c.save(); c.translate(50, 50); c.rotate(0.62); c.translate(-50, -50);
    var legendary = variant === 'rift' || variant === 'critical';
    var edge = legendary ? '#ffe8a3' : '#e2faff';
    var metal = gradient(c, 36, 15, 63, 61, edge, '#65859c');
    if (variant === 'rift') {
      polygon(c, [[45,60],[31,48],[34,21],[49,12],[48,31],[64,22],[64,49],[55,60]],
        gradient(c,32,20,64,60,'#69547d','#151f33'), '#f4ce74', 3);
      line(c, [[49,18],[43,36],[54,42],[48,58]], '#f78387', 4);
    } else {
      var tip = variant === 'quick' ? 26 : 12;
      polygon(c, [[43,61],[40,tip+15],[50,tip],[60,tip+15],[57,61]], metal, '#152638', 3);
      polygon(c, [[50,tip],[60,tip+15],[57,61],[50,56]], legendary ? '#d69d40' : '#829eaf');
      line(c, [[50,tip+9],[50,53]], '#fff7d7', 2);
      if (variant === 'critical') gem(c,50,41,8,'#db5744','#fff3c0');
    }
    polygon(c, [[29,58],[39,55],[50,59],[61,55],[71,58],[67,66],[50,64],[33,66]],
      gradient(c,30,55,70,67,'#fff0aa','#b57636'), '#302231', 2.5);
    polygon(c, [[44,65],[56,65],[55,83],[45,83]], '#6e2946', '#171d2b', 2);
    line(c, [[45,70],[55,73],[45,77]], '#e8ad76', 2.5);
    circle(c,50,85,6,'#e3b65d','#35233b',2);
    c.restore();
    if (variant === 'quick') {
      line(c,[[17,49],[31,35]],'#ffaba0',4); line(c,[[19,63],[29,53]],'#ffaba0',3);
    }
    if (variant === 'critical') star(c,74,25,9,'#fff3b5');
  }
  function book(c, open) {
    if (open) {
      polygon(c,[[16,30],[40,25],[50,32],[60,25],[84,30],[82,73],[60,69],[50,77],[40,69],[18,73]],
        '#235b96','#0d2035',4);
      polygon(c,[[21,25],[41,23],[50,31],[59,23],[79,25],[77,66],[59,65],[50,73],[41,65],[23,66]],
        gradient(c,20,25,80,70,'#fff3c9','#a8c5d7'),'#74d9ff',2);
      line(c,[[50,32],[50,71]],'#405b8a',3);
      // Gros sigil de reloj: aceleración, sin letras ni texto.
      circle(c,64,47,10,'#1e5183','#64eaff',2);
      line(c,[[64,40],[64,47],[70,50]],'#e4fcff',3);
      line(c,[[29,38],[39,35],[35,49],[43,55],[30,57]],'#487cb0',3);
      star(c,50,16,7,'#b5f5ff');
    } else {
      polygon(c,[[27,18],[69,14],[78,25],[77,78],[34,85],[25,76]],'#bddae6','#142437',3);
      polygon(c,[[25,18],[68,14],[70,72],[27,80]],
        gradient(c,25,20,70,70,'#407ec4','#243458'),'#8cddff',3);
      polygon(c,[[25,18],[34,17],[36,79],[27,80]],'#142c58');
      circle(c,51,46,16,'#142a4c','#56dfff',3);
      gem(c,51,46,10,'#3a76cf','#bbfaff');
      polygon(c,[[61,60],[77,57],[77,65],[61,68]],'#d6b867','#1a2941',2);
    }
  }
  function cloak(c, critical) {
    c.beginPath(); c.moveTo(36,21); c.quadraticCurveTo(50,12,64,21);
    c.bezierCurveTo(67,40,72,58,84,77); c.quadraticCurveTo(66,87,50,77);
    c.quadraticCurveTo(33,89,16,77); c.bezierCurveTo(30,56,32,40,36,21); c.closePath();
    c.fillStyle = gradient(c,25,20,76,80,critical?'#f27785':'#c2e5d4',critical?'#5a204b':'#375e67');
    c.fill(); c.strokeStyle='#122334'; c.lineWidth=3; c.stroke();
    polygon(c,[[36,21],[50,34],[64,21],[57,45],[43,45]],critical?'#471d40':'#1e424a');
    line(c,[[39,42],[32,73]],critical?'#ffb4ae':'#e6fff1',3);
    line(c,[[62,42],[71,72]],critical?'#972e60':'#517984',4);
    gem(c,50,36,7,critical?'#dca345':'#39a994',critical?'#fff2a5':'#bdffed');
    if(critical) {
      star(c,50,62,13,'#ffe3a3');
      polygon(c,[[48,52],[58,61],[48,71],[52,61]],'#c0425a');
    } else {
      circle(c,50,61,12,null,'#9aefe0',3);
      line(c,[[43,61],[50,68],[57,55]],'#e8fff4',3);
    }
  }
  function boot(c, kind) {
    // Un solo perfil grande para que el calzado se reconozca incluso a 40 px.
    var col = kind === 'speed' ? '#bd5a52' : kind === 'time' ? '#3c82bc' : '#667b73';
    polygon(c,[[34,18],[62,18],[60,53],[76,62],[84,63],[86,78],[75,83],[25,83],
      [22,71],[32,56]],gradient(c,28,20,78,82,'#d7e2ce',col),'#152331',3);
    polygon(c,[[24,75],[83,73],[86,78],[75,85],[24,85]],'#202c3d','#bdc9c8',2);
    polygon(c,[[32,18],[64,18],[63,31],[32,31]],col,'#d8cba2',3);
    line(c,[[43,39],[55,39],[42,47],[54,47],[40,55]],'#efe7c2',3);
    if (kind === 'speed') {
      polygon(c,[[56,53],[76,35],[72,51],[87,44],[71,67]],'#ffe4aa','#a45144',2);
      line(c,[[13,46],[27,46]],'#ff9b88',4); line(c,[[12,58],[23,58]],'#ff9b88',3);
    } else if(kind === 'time') {
      circle(c,63,62,12,'#163f69','#a9eaff',3);
      line(c,[[63,54],[63,62],[70,64]],'#fff3b8',3);
      c.beginPath(); c.arc(51,48,34,3.55,5.4); c.strokeStyle='#61d7ff'; c.lineWidth=3; c.stroke();
    } else {
      polygon(c,[[57,57],[70,63],[70,72],[57,70]],'#e5c588','#343c3a',2);
      line(c,[[14,56],[26,47]],'#9fe2c5',3);
    }
  }
  function shield(c, solar) {
    polygon(c,[[50,15],[79,26],[75,61],[65,76],[50,88],[35,76],[25,61],[21,26]],
      gradient(c,25,20,78,85,solar?'#ffe0a0':'#c1d9d4',solar?'#9d612b':'#47616a'),
      '#112333',4);
    polygon(c,[[50,23],[70,31],[66,58],[50,76],[34,58],[30,31]],solar?'#743934':'#35554d');
    if(solar) {
      for(var i=0;i<8;i++) {
        var a=i*Math.PI/4;
        line(c,[[50+Math.cos(a)*17,48+Math.sin(a)*17],
          [50+Math.cos(a)*24,48+Math.sin(a)*24]],'#ffdc73',4);
      }
      circle(c,50,48,13,gradient(c,42,35,59,60,'#fff8c4','#ff9d39'),'#ffed9d',2);
      star(c,50,48,8,'#fff9d7');
    } else {
      // Tissu tressé sur une cuirasse légère.
      line(c,[[39,34],[39,58],[50,68],[61,58],[61,34]],'#a9cbb5',4);
      line(c,[[34,43],[66,43]],'#709b87',4);
      line(c,[[34,54],[66,54]],'#709b87',4);
      circle(c,50,47,6,'#d6e8cf','#263c45',2);
    }
  }
  function scepter(c) {
    c.save(); c.translate(50,50); c.rotate(0.48); c.translate(-50,-50);
    polygon(c,[[45,43],[55,43],[54,85],[46,85]],gradient(c,44,40,56,80,'#edbe83','#624055'),'#172131',3);
    circle(c,50,85,6,'#b84565','#ffac98',2);
    polygon(c,[[30,19],[39,24],[38,37],[50,44],[62,37],[61,24],[70,19],[69,43],[50,56],[31,43]],
      gradient(c,30,20,70,56,'#f6c091','#91426a'),'#192238',3);
    gem(c,50,28,14,'#a61d4b','#ff8d90');
    c.restore();
    c.beginPath(); c.moveTo(25,63); c.bezierCurveTo(7,45,23,35,25,32);
    c.bezierCurveTo(27,42,40,50,25,63); c.closePath(); c.fillStyle='#f46c7c'; c.fill();
  }
  function hat(c) {
    c.beginPath(); c.moveTo(19,69); c.bezierCurveTo(30,43,39,20,70,14);
    c.lineTo(61,33); c.quadraticCurveTo(68,49,76,68); c.closePath();
    c.fillStyle=gradient(c,32,18,74,72,'#699de2','#442958'); c.fill();
    c.strokeStyle='#121a30'; c.lineWidth=4; c.stroke();
    polygon(c,[[26,57],[69,52],[76,67],[21,71]],'#ba8250','#f3ce87',2);
    c.beginPath(); c.ellipse(50,74,37,12,-0.07,0,Math.PI*2);
    c.fillStyle=gradient(c,19,63,80,87,'#91b7ed','#352953'); c.fill();
    c.strokeStyle='#f7cd77'; c.lineWidth=3; c.stroke();
    gem(c,49,61,9,'#396bcd','#d5f6ff');
    star(c,49,37,9,'#ffdf8b'); star(c,77,26,7,'#c9eeff');
  }
  function mask(c) {
    // Visage spectral creux et volutes de régénération.
    c.beginPath(); c.moveTo(31,77); c.bezierCurveTo(12,51,31,23,41,14);
    c.bezierCurveTo(29,47,24,51,39,61); c.closePath(); c.fillStyle='#58c4ae'; c.fill();
    c.beginPath(); c.moveTo(66,80); c.bezierCurveTo(86,55,68,30,77,19);
    c.bezierCurveTo(52,42,80,52,61,64); c.closePath(); c.fillStyle='#77dcca'; c.fill();
    polygon(c,[[31,28],[50,20],[69,28],[73,53],[63,71],[50,85],[37,71],[27,53]],
      gradient(c,30,25,68,79,'#e0ffe1','#558a80'),'#192b32',3);
    polygon(c,[[34,43],[47,49],[44,57],[33,52]],'#153b49','#d2fcec',2);
    polygon(c,[[66,43],[53,49],[56,57],[67,52]],'#153b49','#d2fcec',2);
    polygon(c,[[50,50],[56,65],[44,65]],'#2b555b');
    line(c,[[42,70],[50,74],[58,70]],'#e2ffcf',3);
    gem(c,50,32,7,'#3f9c91','#e3ffe3');
  }
  function register(id, name, flavor, type, paint) {
    MOBA.defineItemArt(id, {
      name: name, flavor: flavor,
      draw: function (ctx, size) {
        if (!ctx) return;
        var side = typeof size === 'number' && isFinite(size) && size > 0 ? size : 64;
        ctx.save();
        try {
          ctx.scale(side / 100, side / 100);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          frame(ctx, type); paint(ctx);
        } finally { ctx.restore(); }
      }
    });
  }

  register('espada', 'Tajo de la Otra Cuadra', 'En otro universo sos pacífico. Acá, agarrá por el mango.', 'damage', function(c) { blade(c,'basic'); });
  register('tomo', 'Manual del Mundo B', 'Si este mundo no te da bola, probá el hechizo de la página de al lado.', 'magic', function(c) { book(c,false); });
  register('tela', 'Trama de Mil Yos', 'Tejida por tus otros yos: por una vez, todos pusieron el hombro.', 'defense', function(c) { shield(c,false); });
  register('manto', 'Poncho del Deshechizo', 'Ponételo: los hechizos ajenos se bajan en otra dimensión.', 'defense', function(c) { cloak(c,false); });
  register('rubi', 'Latido de Repuesto', 'Si te falta vida, pedile un latido al universo de al lado.', 'defense', function(c) {
    gem(c,50,49,29,'#b83256','#ffadab');
    line(c,[[28,52],[39,52],[45,42],[52,62],[59,52],[72,52]],'#fff2cb',3);
  });
  register('zafiro', 'Reserva del Cielo Doble', 'Guardá un cielo de repuesto; los hechizos también tienen sed.', 'magic', function(c) {
    gem(c,50,49,29,'#2869be','#a4f3ff');
    c.beginPath(); c.arc(51,44,13,0.4,4.8); c.strokeStyle='#e0ffff'; c.lineWidth=3; c.stroke();
  });
  register('daga', 'Atajo entre Segundos', 'Meté otro pinchazo antes de que este segundo se avive.', 'damage', function(c) { blade(c,'quick'); });
  register('capa', 'Suerte de Otro Yo', 'Tu otro yo ganó la lotería. Vos ligaste el golpe de suerte.', 'damage', function(c) { cloak(c,true); });
  register('botas', 'Botas de la Vereda Paralela', 'Caminá tranquilo: la otra vereda siempre queda un poco más cerca.', 'defense', function(c) { boot(c,'basic'); });
  register('cetro', 'Sorbo de la Grieta', 'Pegá y servite: del otro lado siempre queda un poquito de vida.', 'damage', scepter);
  register('capitulo', 'Almanaque del Nunca', 'Acá figura mañana dos veces. Aprovechá y tirá otro hechizo.', 'magic', function(c) { book(c,true); });
  register('grebas', 'Pisotón de Universos', 'Apurá las patas: hay mundos que romper antes de la merienda.', 'damage', function(c) { boot(c,'speed'); });
  register('jonias', 'Botines del Ya Fue', 'Llegás antes y el hechizo ya volvió. Mirá qué cómodo el tiempo doblado.', 'magic', function(c) { boot(c,'time'); });
  register('cuchilla', 'Hachazo del Mundo Terco', 'Si el universo no afloja, bancá el golpe y abrile una puerta a los hachazos.', 'gold', function(c) { blade(c,'rift'); });
  register('filo', 'Filo del Casi Imposible', 'En un millón de mundos erraste. En este, hacé que duela el doble.', 'gold', function(c) { blade(c,'critical'); });
  register('sombrero', 'Galera del Cosmos Inflado', 'Ponétela: cada yo que hace magia te presta un poco de cabeza.', 'gold', hat);
  register('egida', 'Sol de Bolsillo Blindado', 'Traé tu propio sol: calienta el pecho y se banca los golpes.', 'gold', function(c) { shield(c,true); });
  register('rostro', 'Cara del Yo que Volvió', 'La magia te pega y tu otro yo te remienda. No le debés ni un mate.', 'gold', mask);
})();
