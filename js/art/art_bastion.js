(function () {
  'use strict';
  var BLUE = 0x5b6f9a, GOLD = 0xf0d98a, DARK = 0x202b46, LIGHT = 0xfff2c2;
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function pulse(p) { return Math.sin(Math.PI * clamp(p)); }

  MOBA.defineChampionArt('bastion', {
    lore: 'Cuando cayó la última muralla del alba, Bastión se la puso al hombro y juró que nadie volvería a pelear sin refugio.',
    quote: 'Vení atrás mío. De acá no nos mueve nadie.',
    build: function (THREE, ctx) {
      ctx = ctx || {};
      var cache = ctx.cache;
      var object = new THREE.Group(), rig = new THREE.Group();
      object.add(rig);
      var armor = cache.mat(BLUE, { metalness: 0.55, roughness: 0.55 });
      var gold = cache.mat(GOLD, { metalness: 0.65, roughness: 0.4 });
      var dark = cache.mat(DARK), light = cache.basic(LIGHT);
      var team = cache.basic(ctx.teamColor || 0x38a3ff);
      function group(parent, x, y, z) {
        var g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
      }
      function mesh(parent, key, factory, mat, x, y, z) {
        var m = new THREE.Mesh(cache.geo('bastion:' + key, factory), mat);
        m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m;
      }
      function box(parent, w, h, d, mat, x, y, z) {
        return mesh(parent, 'box:' + [w,h,d].join(':'), function () { return new THREE.BoxGeometry(w,h,d); }, mat,x,y,z);
      }
      function hex(parent, r, depth, mat, x,y,z) {
        var m = mesh(parent, 'hex:' + r + ':' + depth, function () { return new THREE.CylinderGeometry(r,r,depth,6); }, mat,x,y,z);
        m.rotation.x = Math.PI / 2; return m;
      }
      var legs = [];
      [-1,1].forEach(function (s) {
        var leg = group(rig, s*36, 66, 0); legs.push(leg);
        box(leg, 36,52,38,dark,0,-19,0);
        box(leg, 48,32,57,armor,0,-46,10);
        box(leg, 50,9,59,gold,0,-61,10);
        hex(leg,23,12,gold,0,-6,24);
      });
      var body = group(rig,0,104,0);
      var belly = mesh(body,'belly',function () { return new THREE.CylinderGeometry(65,48,82,6); },armor,0,31,0);
      belly.rotation.y = Math.PI/6;
      box(body,107,17,70,gold,0,0,0);
      hex(body,43,13,gold,0,47,43);
      hex(body,33,16,dark,0,47,51);
      hex(body,19,18,light,0,47,61);
      // Rear buttresses rise beyond the shoulders: an unmistakable miniature keep.
      [-1,1].forEach(function (s) {
        box(body,27,135,32,armor,s*46,78,-36);
        box(body,33,12,38,gold,s*46,141,-36);
        box(body,20,24,24,gold,s*46,158,-36);
      });
      var head = group(body,0,114,3);
      hex(head,34,43,armor,0,0,0);
      box(head,52,11,9,dark,0,1,26);
      box(head,36,5,11,light,0,1,31);
      box(head,12,36,13,gold,0,-5,30);
      var crest = mesh(head,'crest',function () { return new THREE.ConeGeometry(19,39,4); },gold,0,42,0);
      crest.rotation.y = Math.PI/4;
      var halo = mesh(head,'halo',function () { return new THREE.TorusGeometry(43,5,6,12); },gold,0,4,-27);
      var left = group(body,-61,64,0), right = group(body,61,64,0);
      [left,right].forEach(function (arm) {
        box(arm,48,42,59,armor,0,6,0);
        box(arm,52,9,63,gold,0,29,0);
        [-16,16].forEach(function (x) { box(arm,15,17,59,armor,x,42,0); });
        box(arm,33,52,35,dark,0,-36,0);
      });
      var shield = group(left,-7,-24,35);
      hex(shield,83,22,gold,0,0,0);
      hex(shield,72,25,armor,0,0,7);
      hex(shield,49,28,dark,0,0,14);
      hex(shield,28,31,gold,0,0,20);
      box(shield,13,112,9,gold,0,0,40);
      box(shield,92,13,9,gold,0,0,41);
      hex(shield,18,12,light,0,0,49);
      var fist = group(right,0,-58,8);
      box(fist,44,37,47,armor,0,0,0);
      box(body,25,45,8,team,0,-11,-48);
      // A broad rear pennant carries the team color above it.
      var tail = box(body,32,55,7,armor,0,-56,-45);
      return {
        object: object,
        update: function (state) {
          state = state || {};
          var time = state.time || 0, t = state.t || 0, p = clamp(state.progress || 0);
          var anim = state.anim || 'idle', hit = pulse(p);
          rig.position.set(0,0,0); rig.rotation.set(0,0,0); rig.scale.set(1,1,1);
          body.position.set(0,104,0); body.rotation.set(0,0,0);
          head.rotation.set(0,0,0); halo.rotation.z = 0;
          left.rotation.set(0,0,0); right.rotation.set(0,0,0);
          shield.rotation.set(0,0,0); shield.position.set(-7,-24,35);
          legs.forEach(function (leg) { leg.rotation.set(0,0,0); leg.position.y=66; });
          tail.rotation.x = 0;
          if (anim === 'idle') {
            body.position.y += Math.sin(time*1.7)*1.8;
            head.rotation.y = Math.sin(time*0.6)*0.10;
            left.rotation.z = -0.045 + Math.sin(time*1.7)*0.02;
          } else if (anim === 'walk') {
            var stride = t * (5.5 * Math.max(0.25, (state.speed || 340)/340));
            legs.forEach(function (leg,i) {
              var wave = Math.sin(stride+i*Math.PI);
              leg.rotation.x = wave*0.34; leg.position.y = 66+Math.max(0,wave)*9;
            });
            body.position.y += Math.abs(Math.cos(stride))*4;
            body.rotation.z = Math.sin(stride)*0.055;
            body.rotation.x = 0.08;
            right.rotation.x = -Math.sin(stride)*0.18;
            left.rotation.x = 0.12;
            tail.rotation.x = -0.1+Math.sin(stride)*0.1;
          } else if (anim === 'attack') {
            // Pull the entire shield back, then punch it forward in a short hard beat.
            var wind = clamp(p/0.38), slam = clamp((p-0.38)/0.15), recover = clamp((p-0.60)/0.40);
            var force = (-0.40*wind+1.12*slam)*(1-recover);
            left.rotation.x = -force;
            shield.position.z = 35 + force*49;
            body.rotation.y = force*0.30;
            body.rotation.x = force*0.16;
            right.rotation.x = 0.25*hit;
          } else if (anim === 'cast') {
            var slot = state.slot == null ? 0 : state.slot;
            if (slot === 0) {
              var bash = Math.sin(Math.PI*clamp((p-0.2)/0.65));
              left.rotation.x = -bash*1.05; shield.position.z = 35+bash*65;
              body.rotation.y = bash*0.3; body.position.z = bash*14;
            } else if (slot === 1) {
              left.rotation.z = -hit*0.65; right.rotation.z = hit*0.65;
              shield.rotation.y = hit*0.6; head.rotation.x = -hit*0.18;
              halo.rotation.z = p*Math.PI/3;
            } else if (slot === 2) {
              body.rotation.x = hit*0.38; body.position.y -= hit*14;
              shield.position.set(-7,-24+hit*16,35+hit*30);
              right.rotation.x = hit*0.85; legs[0].rotation.x = -hit*0.4; legs[1].rotation.x = hit*0.35;
            } else {
              var rise = pulse(p), crash = clamp((p-0.58)/0.12)*(1-clamp((p-0.75)/0.25));
              left.rotation.x = -rise*1.65+crash*0.8;
              right.rotation.x = -rise*1.8;
              shield.rotation.z = rise*0.35;
              body.position.y += rise*18-crash*28;
              body.rotation.x = crash*0.25;
              head.rotation.x = -rise*0.3;
              halo.rotation.z = p*Math.PI*2;
            }
          } else if (anim === 'recall') {
            var kneel = clamp(t/0.8);
            body.position.y -= kneel*23; body.rotation.x = kneel*0.12;
            shield.position.y -= kneel*17; shield.rotation.y = kneel*0.28;
            right.rotation.x = -kneel*0.9; head.rotation.x = kneel*0.2;
            halo.rotation.z = t*1.6; halo.scale.setScalar(1+0.12*Math.sin(t*3));
          } else if (anim === 'dead') {
            var fall = clamp(t/0.65);
            rig.position.y = 134*fall;
            rig.rotation.z = -Math.PI/2*fall;
            left.rotation.z = -fall*0.6; right.rotation.z = fall*0.85;
            shield.rotation.y = fall*0.6; head.rotation.z = -fall*0.2;
          }
          if (anim !== 'recall') halo.scale.setScalar(1);
        }
      };
    },
    fx: {
      Q: function (THREE,ctx,info) { return signature(THREE,info,0); },
      W: function (THREE,ctx,info) { return signature(THREE,info,1); },
      E: function (THREE,ctx,info) { return signature(THREE,info,2); },
      R: function (THREE,ctx,info) { return signature(THREE,info,3); }
    }
  });

  function signature(THREE, info, slot) {
    info = info || {};
    var kind = info.kind || ['target','self','dash','self'][slot];
    var radius = Math.max(12,info.radius || (slot === 3 ? 450 : 110));
    var width = Math.max(12,info.width || 100), length = Math.max(20,info.length || 650);
    var axial = kind === 'line' || kind === 'projectile';
    var span = axial ? width*0.5 : radius;
    var object = new THREE.Group(), core = new THREE.Group(); object.add(core);
    var mats = [
      new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),
      new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),
      new THREE.MeshBasicMaterial({color:LIGHT,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide})
    ];
    var parts = [];
    function add(geo,mat,x,y,z) {
      var m = new THREE.Mesh(geo,mats[mat]); m.position.set(x,y,z); core.add(m); return m;
    }
    function ring(r,tube,y,mat) {
      var m=add(new THREE.TorusGeometry(r,tube,4,6),mat,0,y,0); m.rotation.x=Math.PI/2; return m;
    }
    var rim = ring(span,Math.max(3,span*0.027),5,0);
    var inner = ring(span*0.63,Math.max(2,span*0.018),8,2);
    if (slot === 0) {
      // A shield-shaped seal slams down; six blunt rays mark the stun.
      var stamp = add(new THREE.CylinderGeometry(span*0.46,span*0.46,12,6),0,0,span*0.46+14,0);
      stamp.rotation.x = Math.PI/2;
      var face=add(new THREE.CylinderGeometry(span*0.35,span*0.35,14,6),1,0,span*0.46+14,5); face.rotation.x=Math.PI/2;
      add(new THREE.BoxGeometry(span*0.09,span*0.62,7),2,0,span*0.46+14,14);
      add(new THREE.BoxGeometry(span*0.52,span*0.09,7),2,0,span*0.46+14,15);
      for(var q=0;q<6;q++) {
        var qa=q*Math.PI/3;
        var spark=add(new THREE.BoxGeometry(span*0.09,12,span*0.26),2,Math.sin(qa)*span*0.7,12,Math.cos(qa)*span*0.7);
        spark.rotation.y=qa; parts.push({mesh:spark,a:qa});
      }
    } else if (slot === 1 || slot === 3) {
      // W shelters behind broad translucent shields; R closes a crenellated prison.
      for(var j=0;j<6;j++) {
        var a=j*Math.PI/3;
        var panel=new THREE.Group(); core.add(panel);
        panel.position.set(Math.sin(a)*span*0.87,0,Math.cos(a)*span*0.87); panel.rotation.y=a;
        var h=span*(slot===3?0.66:0.45), w=span*(slot===3?0.30:0.63);
        function piece(geo,mi,x,y,z) { var m=new THREE.Mesh(geo,mats[mi]); m.position.set(x,y,z); panel.add(m); return m; }
        piece(new THREE.BoxGeometry(w,h,8),1,0,h/2,0);
        piece(new THREE.BoxGeometry(w+5,8,12),0,0,h,0);
        if(slot===1) piece(new THREE.BoxGeometry(8,h,12),0,0,h/2,5);
        if(slot===3) {
          piece(new THREE.BoxGeometry(w*0.24,h*0.20,15),0,-w*0.36,h*1.10,0);
          piece(new THREE.BoxGeometry(w*0.24,h*0.20,15),0,w*0.36,h*1.10,0);
        }
        parts.push({mesh:panel,a:a});
      }
      if(slot===3) {
        var sun=add(new THREE.OctahedronGeometry(span*0.14),2,0,span*0.65,0);
        parts.push({mesh:sun,sun:true});
      }
    } else {
      // Broad paired chevrons leave a readable, directional wake behind the charge.
      for(var k=0;k<4;k++) {
        var arrow = new THREE.Group(); core.add(arrow);
        arrow.position.z=-k*span*0.5;
        [-1,1].forEach(function (s) {
          var m=new THREE.Mesh(new THREE.BoxGeometry(span*0.13,12,span*0.75),mats[k%2?0:2]);
          m.position.set(s*span*0.25,12,0); m.rotation.y=s*0.7; arrow.add(m);
        });
        parts.push({mesh:arrow,index:k});
      }
    }
    if (kind === 'line') {
      add(new THREE.BoxGeometry(width*0.72,5,length),1,0,3,length/2);
      add(new THREE.BoxGeometry(width*0.06,7,length),0,-width*0.45,5,length/2);
      add(new THREE.BoxGeometry(width*0.06,7,length),0,width*0.45,5,length/2);
    }
    if (kind === 'projectile') { core.rotation.x = Math.PI/2; core.position.y=35; }
    return {
      object: object,
      update: function (progress) {
        var p=clamp(progress || 0);
        var fade=clamp(p/0.12)*clamp((1-p)/0.24);
        mats[0].opacity=fade*0.85; mats[1].opacity=fade*0.30; mats[2].opacity=fade*0.95;
        rim.scale.setScalar(0.70+0.30*clamp(p/0.35));
        inner.scale.setScalar(slot===3 ? 0.30+p*1.5 : 0.65+p*0.50);
        inner.rotation.z = p*(slot===3 ? Math.PI/3 : 0.25);
        if(slot===0) {
          parts.forEach(function (part) {
            var r=span*(0.52+p*0.55);
            part.mesh.position.set(Math.sin(part.a)*r,12+Math.sin(p*Math.PI)*20,Math.cos(part.a)*r);
          });
          core.scale.setScalar(0.8+0.2*clamp(p/0.2));
        } else if(slot===1 || slot===3) {
          parts.forEach(function (part) {
            if(part.sun) { part.mesh.rotation.y=p*Math.PI*2; part.mesh.scale.setScalar(0.7+p); }
            else {
              var growth=clamp((p-(slot===3?0.12:0))/0.25);
              part.mesh.scale.y=0.03+growth*0.97;
              var r=span*(slot===3 ? 0.92-0.12*growth : 0.80+0.12*p);
              part.mesh.position.x=Math.sin(part.a)*r; part.mesh.position.z=Math.cos(part.a)*r;
            }
          });
        } else {
          parts.forEach(function (part) {
            part.mesh.position.z=-part.index*span*0.5-p*span*0.65;
            part.mesh.scale.setScalar(1-p*0.3);
          });
        }
      }
    };
  }
})();
