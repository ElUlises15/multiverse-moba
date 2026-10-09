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

  function tool(c, hammer) {
    c.save(); c.translate(50,50); c.rotate(0.55); c.translate(-50,-50);
    polygon(c,[[45,31],[55,31],[56,84],[44,84]],gradient(c,44,32,56,84,'#e9b27b','#713d50'),'#172131',3);
    line(c,[[45,61],[55,65],[45,71],[55,75]],'#f4cc96',2.5);
    circle(c,50,85,5,'#dcac67','#302231',2);
    if (hammer) {
      polygon(c,[[23,19],[70,19],[78,27],[78,43],[70,49],[23,49],[19,42],[19,26]],
        gradient(c,22,19,73,49,'#e2faff','#65859c'),'#152638',3);
      polygon(c,[[23,19],[33,19],[33,49],[23,49],[19,42],[19,26]],'#829eaf','#152638',2);
      polygon(c,[[65,20],[70,19],[78,27],[78,43],[70,49],[65,48]],'#536d83');
      gem(c,49,34,9,'#bb3b58','#ffb0a0'); line(c,[[35,23],[61,23]],'#fff7d7',2);
    } else {
      c.beginPath(); c.moveTo(15,44); c.quadraticCurveTo(26,17,50,20);
      c.quadraticCurveTo(74,17,85,44); c.lineTo(68,34);
      c.quadraticCurveTo(50,28,32,34); c.closePath();
      c.fillStyle=gradient(c,22,19,77,44,'#e2faff','#65859c'); c.fill();
      c.strokeStyle='#152638'; c.lineWidth=3; c.stroke();
      line(c,[[27,30],[49,24],[71,30]],'#fff7d7',2);
      polygon(c,[[44,19],[56,19],[56,35],[44,35]],'#d6b867','#302231',2);
    }
    c.restore();
  }
  function wand(c) {
    c.save(); c.translate(50,50); c.rotate(0.5); c.translate(-50,-50);
    polygon(c,[[46,39],[54,39],[56,85],[44,85]],gradient(c,44,39,56,84,'#a6dafa','#315783'),'#142437',3);
    line(c,[[46,60],[54,65],[46,72]],'#f3ce87',3);
    polygon(c,[[31,24],[39,28],[40,42],[50,48],[60,42],[61,28],[69,24],[66,46],[50,56],[34,46]],'#d6b867','#192238',2.5);
    gem(c,50,28,17,'#396bcd','#d5f6ff'); circle(c,50,84,5,'#60ceff','#142437',2);
    c.restore(); star(c,24,31,6,'#b5f5ff'); star(c,75,47,5,'#b5f5ff');
  }
  function bow(c) {
    c.beginPath(); c.moveTo(36,17); c.bezierCurveTo(80,24,80,76,36,83);
    c.lineTo(40,73); c.bezierCurveTo(62,66,62,34,40,27); c.closePath();
    c.fillStyle=gradient(c,35,17,69,83,'#fff0aa','#b57636'); c.fill();
    c.strokeStyle='#302231'; c.lineWidth=3; c.stroke();
    line(c,[[36,18],[29,50],[36,82]],'#e2faff',2.5); line(c,[[19,50],[78,50]],'#e2faff',4);
    polygon(c,[[85,50],[72,41],[72,59]],'#e2faff','#152638',2);
    polygon(c,[[18,43],[28,50],[18,57],[23,50]],'#fb6b66','#302231',2);
    polygon(c,[[60,42],[66,42],[66,58],[60,58]],'#a63b52','#302231',2);
  }
  function zeal(c) {
    // Dos dagas cruzadas: velocidad y crítico.
    for(var i=0;i<2;i++) {
      c.save(); c.translate(50,51); c.rotate(i===0 ? -0.65 : 0.65); c.translate(-50,-51);
      polygon(c,[[44,58],[41,30],[50,15],[59,30],[56,58]],gradient(c,41,19,59,58,'#e2faff','#829eaf'),'#152638',3);
      line(c,[[50,26],[50,52]],'#fff7d7',2);
      polygon(c,[[35,57],[65,57],[63,64],[37,64]],'#e3b65d','#302231',2);
      polygon(c,[[45,64],[55,64],[55,83],[45,83]],'#6e2946','#171d2b',2);
      line(c,[[45,70],[55,74]],'#e8ad76',2.5); c.restore();
    }
    star(c,50,49,10,'#ffe3a3');
    line(c,[[16,36],[22,26]],'#ffaba0',3); line(c,[[78,26],[84,36]],'#ffaba0',3);
  }
  function vitality(c) {
    gem(c,50,49,28,'#39a994','#bdffed');
    c.beginPath(); c.arc(50,49,36,0.2,2.75); c.strokeStyle='#e6fff1'; c.lineWidth=3; c.stroke();
    c.beginPath(); c.arc(50,49,36,3.35,5.9); c.stroke();
    polygon(c,[[17,58],[16,71],[29,69]],'#93cbb2','#122334',2);
    polygon(c,[[83,40],[84,27],[71,29]],'#93cbb2','#122334',2);
    line(c,[[40,49],[47,49],[51,39],[56,59],[61,49]],'#fff2cb',3);
  }
  function belt(c) {
    c.beginPath(); c.moveTo(16,35); c.quadraticCurveTo(50,46,84,35);
    c.lineTo(84,66); c.quadraticCurveTo(50,81,16,66); c.closePath();
    c.fillStyle=gradient(c,16,35,84,73,'#a0bc9b','#375e67'); c.fill();
    c.strokeStyle='#122334'; c.lineWidth=3; c.stroke();
    line(c,[[19,41],[33,45]],'#e6fff1',3); line(c,[[67,45],[81,41]],'#e6fff1',3);
    for(var i=0;i<2;i++) circle(c,73+i*7,56,2.5,'#152331');
    rounded(c,33,35,34,38,6); c.fillStyle=gradient(c,33,35,67,73,'#fff0aa','#b57636'); c.fill();
    c.strokeStyle='#302231'; c.lineWidth=3; c.stroke();
    rounded(c,40,42,20,24,3); c.fillStyle='#253c43'; c.fill();
    line(c,[[35,54],[54,54]],'#fff0aa',4); gem(c,54,54,6,'#39a994','#bdffed');
  }
  function mail(c, thorns) {
    var edge=thorns?'#f4ce74':'#93cbb2';
    polygon(c,[[34,21],[42,21],[44,30],[56,30],[58,21],[66,21],[84,35],[76,50],
      [66,44],[70,82],[30,82],[34,44],[24,50],[16,35]],gradient(c,23,22,72,82,'#c1d9d4','#47616a'),'#112333',3);
    polygon(c,[[42,21],[44,30],[56,30],[58,21],[54,37],[46,37]],'#182f39',edge,2);
    // Argollas grandes para que la malla se lea a 40 px.
    for(var row=0;row<4;row++) for(var col=0;col<4;col++) {
      c.beginPath(); c.arc(38+col*8+(row%2)*3,44+row*9,4,0.15,Math.PI*1.85);
      c.strokeStyle=row%2?'#709b87':'#d6e8cf'; c.lineWidth=2.5; c.stroke();
    }
    line(c,[[32,79],[68,79]],edge,3);
    if(thorns) {
      var spikes=[[[19,34],[17,19],[32,29]],[[27,48],[16,59],[32,55]],
        [[68,29],[83,19],[81,34]],[[68,55],[84,59],[73,48]],
        [[35,69],[24,80],[35,78]],[[65,69],[76,80],[65,78]]];
      spikes.forEach(function(p){ polygon(c,p,'#fff0aa','#302231',2); });
      gem(c,50,50,9,'#39a994','#bdffed');
    }
  }
  function nullCape(c) {
    c.beginPath(); c.moveTo(36,21); c.quadraticCurveTo(50,12,64,21);
    c.bezierCurveTo(67,40,72,58,84,77); c.quadraticCurveTo(66,87,50,77);
    c.quadraticCurveTo(33,89,16,77); c.bezierCurveTo(30,56,32,40,36,21); c.closePath();
    c.fillStyle=gradient(c,25,20,76,80,'#c2e5d4','#375e67'); c.fill();
    c.strokeStyle='#122334'; c.lineWidth=3; c.stroke();
    polygon(c,[[36,21],[50,34],[64,21],[57,45],[43,45]],'#1e424a');
    line(c,[[39,42],[32,73]],'#e6fff1',3); line(c,[[62,42],[71,72]],'#517984',4);
    gem(c,50,36,7,'#39a994','#bdffed'); circle(c,50,61,13,'#173442','#9aefe0',3);
    circle(c,50,61,5,'#b5f5ff'); line(c,[[39,71],[61,51]],'#e8fff4',3);
  }
  function boot(c, mercury) {
    var col=mercury?'#568fa6':'#667b73';
    polygon(c,[[34,18],[62,18],[60,53],[76,62],[84,63],[86,78],[75,83],[25,83],
      [22,71],[32,56]],gradient(c,28,20,78,82,'#d7e2ce',col),'#152331',3);
    polygon(c,[[24,75],[83,73],[86,78],[75,85],[24,85]],'#202c3d','#bdc9c8',2);
    polygon(c,[[32,18],[64,18],[63,31],[32,31]],col,'#d8cba2',3);
    if(mercury) {
      line(c,[[43,39],[55,39],[42,47],[54,47],[40,55]],'#efe7c2',3);
      polygon(c,[[59,35],[78,28],[70,41],[85,36],[73,50],[60,54]],
        gradient(c,60,29,82,53,'#e2faff','#829eaf'),'#152638',2);
      line(c,[[61,45],[75,36]],'#fff7d7',2);
      circle(c,63,65,8,'#315783','#a9eaff',2); star(c,63,65,5,'#e2faff');
    } else {
      polygon(c,[[34,34],[60,34],[59,48],[31,48]],gradient(c,32,34,60,48,'#e2faff','#65859c'),'#152638',2);
      polygon(c,[[31,49],[58,49],[65,61],[28,65]],'#829eaf','#152638',2);
      polygon(c,[[58,62],[78,64],[82,74],[55,73]],'#c1d9d4','#152638',2);
      circle(c,39,40,2,'#fff7d7'); circle(c,53,40,2,'#fff7d7');
      line(c,[[14,56],[26,47]],'#9fe2c5',3);
    }
  }
  function hydra(c) {
    // Tres cuellos separados y tres bocas grandes.
    var necks=[[[44,78],[42,63],[29,57],[23,43]],[[50,78],[50,52],[50,33]],
      [[56,78],[58,63],[71,57],[77,43]]];
    necks.forEach(function(p){ line(c,p,'#192238',16); line(c,p,'#b84565',10); });
    [[24,35],[50,25],[76,35]].forEach(function(p){
      var x=p[0],y=p[1];
      polygon(c,[[x-11,y-4],[x-13,y-14],[x-3,y-8],[x+6,y-9],[x+15,y],
        [x+12,y+11],[x-9,y+11]],gradient(c,x-10,y-9,x+12,y+11,'#f6c091','#91426a'),'#192238',2.5);
      polygon(c,[[x-4,y+3],[x+13,y+3],[x+10,y+9],[x-3,y+8]],'#351e36');
      polygon(c,[[x+1,y+3],[x+5,y+3],[x+3,y+7]],'#fff0aa'); circle(c,x+2,y-3,3,'#fff3b5');
    });
    polygon(c,[[32,78],[41,68],[59,68],[68,78],[61,86],[39,86]],'#b57636','#302231',3);
    gem(c,50,77,8,'#bb3b58','#ffb0a0');
  }
  function hurricane(c) {
    c.beginPath(); c.moveTo(21,27); c.bezierCurveTo(8,8,92,8,82,29);
    c.bezierCurveTo(79,40,42,39,35,49); c.bezierCurveTo(29,56,68,53,66,61);
    c.bezierCurveTo(64,69,44,68,46,78); c.lineTo(54,88);
    c.bezierCurveTo(33,82,31,73,39,65); c.bezierCurveTo(14,64,19,48,31,42);
    c.bezierCurveTo(52,30,76,32,72,24); c.bezierCurveTo(61,17,33,19,21,27); c.closePath();
    c.fillStyle=gradient(c,25,16,64,87,'#e2faff','#65859c'); c.fill();
    c.strokeStyle='#152638'; c.lineWidth=3; c.stroke();
    c.beginPath(); c.ellipse(50,24,29,8,-0.03,0,Math.PI*2);
    c.strokeStyle='#fff0aa'; c.lineWidth=3; c.stroke();
    line(c,[[31,44],[63,42],[75,36]],'#fff7d7',3); line(c,[[36,59],[61,57]],'#fff7d7',3);
    polygon(c,[[18,48],[27,41],[26,50]],'#ffd36a','#302231',2);
    polygon(c,[[73,65],[85,58],[81,70]],'#ffd36a','#302231',2);
  }
  function echo(c) {
    gem(c,50,50,14,'#396bcd','#d5f6ff');
    [23,34].forEach(function(r){
      [0,Math.PI].forEach(function(a){
        c.beginPath(); c.arc(50,50,r,a-0.88,a+0.88);
        c.strokeStyle='#152638'; c.lineWidth=9; c.stroke();
        c.strokeStyle=r===23?'#60ceff':'#fff0aa'; c.lineWidth=5; c.stroke();
      });
    });
    star(c,50,19,6,'#b5f5ff'); star(c,50,81,6,'#b5f5ff');
  }
  register('pico', 'Pico del Mundo Hueco', 'Dale al suelo: tu otro yo dejó un universo lleno de escombros.', 'damage', function(c) { tool(c,false); });
  register('vara', 'Vara del Big Bang Chico', 'Agitá despacio: el último universo todavía está enfriándose.', 'magic', wand);
  register('martillo', 'Martillo del Cosmos Chueco', 'Si el mundo te quedó torcido, enderezalo a los golpes.', 'damage', function(c) { tool(c,true); });
  register('arco', 'Arco de la Flecha Paralela', 'Apuntá acá; en otra dimensión ya te están puteando.', 'damage', bow);
  register('celo', 'Dagas del Yo Apurado', 'Tu otro yo llegó tarde. Vos meté dos pinchazos y compensá.', 'damage', zeal);
  register('gema', 'Gema del Recreo Temporal', 'Tomate un respiro: en el mundo de al lado ya volvió el recreo.', 'defense', vitality);
  register('cinturon', 'Cinturón del Cosmos Panzón', 'Aflojá un agujerito: te trajiste la panza de tres universos.', 'defense', belt);
  register('cota', 'Cota de los Mil Vecinos', 'Cada argolla la puso otro yo. Mirá si justo hoy te van a dejar en banda.', 'defense', function(c) { mail(c,false); });
  register('negatron', 'Capa del Universo Mudo', 'Ponétela y hacé silencio: acá los hechizos no tienen señal.', 'defense', nullCape);
  register('tabi', 'Botas del Planeta Baldosa', 'Pisá firme: en ese mundo hasta las pantuflas vienen blindadas.', 'defense', function(c) { boot(c,false); });
  register('mercurio', 'Botas del Mercurio Paralelo', 'Rajá livianito: tu otro yo ya se escurrió del hechizo.', 'magic', function(c) { boot(c,true); });
  register('hidra', 'Hidra del Triple Yo', 'Tres cabezas, un solo mate. Pegá antes de que discutan quién ceba.', 'gold', hydra);
  register('huracan', 'Huracán del Cosmos Ventoso', 'Agarrate: tu otro yo abrió todas las ventanas del universo.', 'gold', hurricane);
  register('eco', 'Eco del Universo Charlatán', 'Decí una vez y cobrá tres: los mundos de al lado repiten todo.', 'gold', echo);
  register('espinas', 'Malla del Cosmos Pinchudo', 'Abrazame, decías. Bancate ahora a todos mis otros yos con espinas.', 'gold', function(c) { mail(c,true); });
})();
