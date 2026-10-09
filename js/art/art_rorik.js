(function () {
  'use strict';
  const COPPER = 0xa8652a, IVORY = 0xffe0a3, IRON = 0x29343c, EMBER = 0xe74d23;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pulse = p => Math.sin(Math.PI * clamp(p, 0, 1));

  // El filo ancho y mellado es parte de la silueta, no un detalle de superficie.
  function bladeGeometry(THREE, scale) {
    const shape = new THREE.Shape();
    shape.moveTo(-9 * scale, -26 * scale);
    [[22,-38],[61,-26],[72,4],[62,35],[28,48],[10,29],[-9,25]].forEach(v => shape.lineTo(v[0]*scale,v[1]*scale));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 12*scale, bevelEnabled: false });
    g.translate(0,0,-6*scale);
    return g;
  }

  MOBA.defineChampionArt('rorik', {
    lore: 'Rorik carga el cráneo del último mamut del norte; cuando ruge, hasta las montañas se corren de su camino.',
    quote: 'Corré si querés. El hacha llega igual.',
    build: function (THREE, ctx) {
      ctx = ctx || {};
      const cache = ctx.cache;
      const root = new THREE.Group(), body = new THREE.Group();
      root.add(body);
      const mat = (c,o) => cache.mat(c,o);
      const copper = mat(COPPER), ivory = mat(IVORY), iron = mat(IRON,{metalness:0.65,roughness:0.55});
      const fire = mat(EMBER,{emissive:EMBER,emissiveIntensity:0.55});
      const glow = cache.basic(IVORY);
      function mesh(parent,g,m,x,y,z,sx,sy,sz) {
        const a = new THREE.Mesh(g,m); a.position.set(x||0,y||0,z||0);
        if (sx !== undefined) a.scale.set(sx,sy,sz);
        parent.add(a); return a;
      }
      const ball = cache.geo('rorik-ball',()=>new THREE.IcosahedronGeometry(1,1));
      const box = cache.geo('rorik-box',()=>new THREE.BoxGeometry(1,1,1));
      const cone = cache.geo('rorik-cone',()=>new THREE.ConeGeometry(1,1,6));
      function chunk(p,m,x,y,z,sx,sy,sz){return mesh(p,ball,m,x,y,z,sx,sy,sz);}
      function brick(p,m,x,y,z,sx,sy,sz){return mesh(p,box,m,x,y,z,sx,sy,sz);}
      function taper(p,m,x,y,z,sx,sy,sz){return mesh(p,cone,m,x,y,z,sx,sy,sz);}
      function joint(p,x,y,z){const j=new THREE.Group();j.position.set(x,y,z);p.add(j);return j;}
      const legs = [-1,1].map(s=>{
        const leg=joint(body,s*30,79,0);
        chunk(leg,copper,0,-23,0,24,36,24);
        brick(leg,iron,0,-58,12,43,42,62);
        brick(leg,ivory,0,-43,34,24,18,8);
        return leg;
      });
      chunk(body,copper,0,135,-3,66,62,45);
      brick(body,iron,0,99,8,105,22,76);
      const skirt=taper(body,copper,0,77,-13,55,55,36);skirt.rotation.z=Math.PI;
      const cloak=joint(body,0,173,-36);
      chunk(cloak,iron,0,-30,-11,62,55,19);
      taper(cloak,copper,-30,-76,-12,23,50,12).rotation.z=Math.PI;
      taper(cloak,copper,30,-76,-12,23,50,12).rotation.z=Math.PI;
      // Una gran placa cruzada y una hombrera de mamut asimétrica.
      const strap=brick(body,iron,0,150,39,20,106,10);strap.rotation.z=-0.62;
      brick(body,ivory,-15,168,46,25,20,9).rotation.z=-0.62;
      const left=joint(body,-59,168,0), right=joint(body,57,168,0);
      chunk(left,copper,-3,-25,4,28,41,28);
      brick(left,iron,-3,-51,18,38,34,34);
      chunk(left,ivory,-5,26,0,40,35,36);
      chunk(left,iron,-20,30,29,10,11,6);
      chunk(left,iron,9,30,29,10,11,6);
      [-1,1].forEach(s=>{
        const path=new THREE.CatmullRomCurve3([new THREE.Vector3(s*22,15,25),new THREE.Vector3(s*32,-8,42),new THREE.Vector3(s*27,-30,49),new THREE.Vector3(s*14,-34,51)]);
        mesh(left,cache.geo('rorik-tusk-'+s,()=>new THREE.TubeGeometry(path,8,6,5,false)),ivory);
      });
      chunk(right,iron,5,9,0,31,26,30);
      chunk(right,copper,5,-27,8,25,36,24);
      brick(right,iron,5,-47,24,33,29,34);
      const weapon=joint(right,5,-40,31);
      mesh(weapon,cache.geo('rorik-haft',()=>new THREE.CylinderGeometry(6,8,137,7)),copper,0,40,0);
      brick(weapon,iron,0,104,0,22,28,22);
      const blade=cache.geo('rorik-blade',()=>bladeGeometry(THREE,0.78));
      mesh(weapon,blade,iron,0,104,0);
      const edge=mesh(weapon,blade,ivory,4,104,0);edge.scale.set(0.94,0.85,1.06);
      brick(weapon,iron,13,104,0,30,28,21);
      brick(weapon,fire,32,105,7,12,32,3).rotation.z=-0.25;
      taper(weapon,iron,-16,109,0,13,40,11).rotation.z=1.1;
      const head=joint(body,0,213,10);
      chunk(head,ivory,0,1,8,32,31,27);
      chunk(head,iron,0,20,0,36,24,31);
      [-1,1].forEach(s=>{
        const horn=taper(head,ivory,s*33,35,-2,12,57,12);horn.rotation.z=-s*0.8;
        brick(head,iron,s*14,7,31,24,12,7).rotation.z=s*0.12;
        brick(head,glow,s*14,6,35,15,4,3);
      });
      chunk(head,copper,0,-21,27,34,25,21);
      taper(head,copper,0,-49,30,30,62,19).rotation.z=Math.PI;
      brick(head,iron,0,-49,45,21,12,9);
      chunk(head,ivory,0,-6,35,10,10,9);
      const team=brick(body,mat(ctx.teamColor || 0x38a3ff,{emissive:ctx.teamColor || 0x38a3ff,emissiveIntensity:0.4}),0,116,47,30,8,8);
      const aura=mesh(body,cache.geo('rorik-recall-ring',()=>new THREE.TorusGeometry(68,3,5,24)),glow,0,8,0);aura.rotation.x=Math.PI/2;aura.visible=false;

      return { object:root, update:function (state) {
        state=state||{};
        const t=state.t||0, time=state.time||0, p=clamp(state.progress||0,0,1), anim=state.anim||'idle';
        body.position.set(0,0,0);body.rotation.set(0,0,0);body.scale.set(1,1,1);
        legs.forEach(l=>{l.rotation.set(0,0,0);l.position.y=79;});
        left.rotation.set(0,0,0);right.rotation.set(0,0,-0.10);
        weapon.rotation.set(0,0,-0.18);head.rotation.set(0,0,0);cloak.rotation.set(0,0,0);
        aura.visible=false;team.scale.set(1,1,1);
        if(anim==='idle'){
          body.position.y=1.6*Math.sin(time*2.1);body.rotation.x=0.035;
          head.rotation.y=0.07*Math.sin(time*0.7);right.rotation.x=0.045*Math.sin(time*2.1);
          cloak.rotation.x=0.05*Math.sin(time*1.6);
        } else if(anim==='walk'){
          const stride=t*7.5*clamp((state.speed||340)/340,0.2,1.7), step=Math.sin(stride);
          legs[0].rotation.x=step*0.49;legs[1].rotation.x=-step*0.49;
          body.position.y=5*Math.abs(Math.cos(stride));body.rotation.z=step*0.075;body.rotation.x=0.12;
          left.rotation.x=-step*0.22;right.rotation.x=step*0.12;weapon.rotation.z=-0.28;
          cloak.rotation.x=-0.12+step*0.07;head.rotation.x=-0.10;
        } else if(anim==='attack'){
          // Levanta el filo durante el primer tercio y lo descarga con un golpe seco.
          const swing=p<0.33 ? p/0.33 : p<0.60 ? 1-(p-0.33)/0.27 : 0;
          const hit=p>=0.33 ? Math.sin(Math.PI*clamp((p-0.33)/0.30,0,1)) : 0;
          right.rotation.x=-1.75*swing+0.85*hit;weapon.rotation.z=-0.55*swing;
          body.rotation.y=-0.42*swing+0.36*hit;body.rotation.x=-0.12*swing+0.23*hit;
          left.rotation.z=-0.25*swing;head.rotation.x=-0.10*swing;
        } else if(anim==='cast'){
          const slot=state.slot===undefined?0:state.slot, v=pulse(p);
          if(slot===0){body.rotation.y=p*Math.PI*2;right.rotation.z=-1.05*v;right.rotation.x=-0.4*v;left.rotation.z=0.55*v;body.rotation.x=0.13*v;}
          else if(slot===1){body.scale.set(1+0.10*v,1+0.06*v,1+0.10*v);head.rotation.x=-0.45*v;left.rotation.z=0.60*v;right.rotation.z=-0.65*v;cloak.rotation.x=-0.22*v;}
          else if(slot===2){body.position.y=85*v;body.rotation.x=-0.35*v;legs[0].rotation.x=-0.80*v;legs[1].rotation.x=0.75*v;right.rotation.x=-2.2*v;left.rotation.z=0.65*v;cloak.rotation.x=-0.6*v;}
          else {
            const lift=clamp(p/0.55,0,1), strike=clamp((p-0.55)/0.17,0,1), recover=clamp((p-0.78)/0.22,0,1);
            right.rotation.x=(-2.65*lift+3.7*strike)*(1-recover);weapon.rotation.z=-0.40*v;
            left.rotation.x=-1.1*v;left.rotation.z=0.30*v;body.position.y=34*v;
            body.rotation.x=(-0.20*lift+0.55*strike)*(1-recover);head.rotation.x=-0.2*v;
            cloak.rotation.x=-0.5*v;legs.forEach(l=>{l.rotation.x=-0.22*v;});
          }
        } else if(anim==='recall'){
          const v=clamp(t/1.5,0,1);right.rotation.x=-2.65*v;left.rotation.x=-0.65*v;head.rotation.x=-0.25*v;
          body.position.y=3+4*Math.sin(t*3);cloak.rotation.x=0.12*Math.sin(t*3);
          aura.visible=true;aura.position.y=8+(t%2)*85;aura.scale.setScalar(1+0.1*Math.sin(t*4));aura.rotation.z=t*2;
          team.scale.setScalar(1+0.25*Math.sin(t*5));
        } else if(anim==='dead'){
          const fall=clamp(t/0.65,0,1);body.rotation.z=-1.42*fall;body.position.set(-17*fall,150*fall,0);
          right.rotation.z=-0.9*fall;weapon.rotation.z=-0.8*fall;left.rotation.x=0.4*fall;head.rotation.z=-0.25*fall;
        }
      }};
    },
    fx: {
      Q:function(THREE,ctx,info){return signatureFX(THREE,info,0,'self');},
      W:function(THREE,ctx,info){return signatureFX(THREE,info,1,'self');},
      E:function(THREE,ctx,info){return signatureFX(THREE,info,2,'dash');},
      R:function(THREE,ctx,info){return signatureFX(THREE,info,3,'target');}
    }
  });

  function signatureFX(THREE, info, slot, fallback) {
    info=info||{};
    const kind=info.kind||fallback, radius=Math.max(12,info.radius||[325,450,250,100][slot]);
    const r=kind==='projectile'?Math.max(12,(info.width||80)*0.5):radius;
    const root=new THREE.Group(), form=new THREE.Group();root.add(form);
    const materials=[], pieces=[];
    function material(color,opacity){const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});materials.push({m:m,opacity:opacity});return m;}
    const gold=material(IVORY,0.9), orange=material(EMBER,0.7), brown=material(COPPER,0.8);
    function add(g,m,x,y,z){const a=new THREE.Mesh(g,m);a.position.set(x||0,y||0,z||0);form.add(a);return a;}
    function ring(rad,tube,m,y,arc,turn){const a=add(new THREE.TorusGeometry(rad,tube,5,40,arc||Math.PI*2),m,0,y,0);a.rotation.x=Math.PI/2;a.rotation.z=turn||0;return a;}
    const boundary=ring(r,Math.max(2,r*0.015),brown,5);
    // El contorno marca el alcance mientras las piezas internas cuentan el impacto.
    if(slot===0){
      for(let i=0;i<3;i++){
        const arc=ring(r*(0.66+i*0.10),r*0.028,i===1?orange:gold,15+i*9,Math.PI*0.95,i*Math.PI*2/3);
        pieces.push({mesh:arc,angle:i*Math.PI*2/3,type:'spin'});
      }
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3, tooth=add(new THREE.ConeGeometry(r*0.045,r*0.18,3),gold,Math.cos(a)*r*0.83,20,Math.sin(a)*r*0.83);
        tooth.rotation.z=Math.PI/2;tooth.rotation.y=-a;pieces.push({mesh:tooth,angle:a,type:'tooth'});
      }
    } else if(slot===1){
      for(let i=0;i<3;i++){const a=ring(r*(0.45+i*0.2),r*0.019,i===1?orange:gold,25+i*30);pieces.push({mesh:a,index:i,type:'sound'});}
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4, shard=add(new THREE.ConeGeometry(r*0.045,r*0.23,3),gold,Math.cos(a)*r*0.55,r*0.16,Math.sin(a)*r*0.55);
        shard.rotation.z=-0.45;pieces.push({mesh:shard,angle:a,type:'cry'});
      }
    } else if(slot===2){
      const shock=ring(r*0.5,r*0.05,gold,9);pieces.push({mesh:shock,type:'shock'});
      for(let i=0;i<10;i++){
        const a=i*Math.PI/5, rock=add(new THREE.IcosahedronGeometry(r*(i%2?0.05:0.075),0),i%2?brown:orange);
        pieces.push({mesh:rock,angle:a,index:i,type:'rock'});
        const crack=add(new THREE.BoxGeometry(r*0.025,3,r*0.45),gold,Math.sin(a)*r*0.5,5,Math.cos(a)*r*0.5);crack.rotation.y=a;
      }
    } else {
      const axe=new THREE.Group();form.add(axe);
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(r*0.025,r*0.035,r*1.55,6),orange);shaft.position.y=r*0.8;axe.add(shaft);
      const blade=new THREE.Mesh(bladeGeometry(THREE,r/105),gold);blade.position.y=r*1.15;axe.add(blade);
      axe.rotation.z=-0.28;pieces.push({mesh:axe,type:'execute'});
      for(let i=0;i<2;i++){
        const scar=add(new THREE.BoxGeometry(r*0.075,5,r*1.55),gold,0,7,0);scar.rotation.y=(i?1:-1)*Math.PI/4;pieces.push({mesh:scar,type:'scar'});
      }
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4, shard=add(new THREE.OctahedronGeometry(r*0.06,0),i%2?orange:gold);
        pieces.push({mesh:shard,angle:a,type:'executeShard'});
      }
    }
    if(kind==='line'){
      const length=Math.max(20,info.length||700), width=Math.max(12,info.width||100);
      form.scale.set(width/(2*r),1,length/(2*r));form.position.z=length/2;
    } else if(kind==='projectile') {
      form.position.y=r*0.7;form.rotation.x=Math.PI/2;
    }
    return {object:root,update:function(p,dt){
      p=clamp(p||0,0,1);
      const fade=clamp(p/0.09,0,1)*clamp((1-p)/0.24,0,1);
      materials.forEach(a=>{a.m.opacity=a.opacity*fade;});
      boundary.scale.setScalar(slot===1?0.7+0.3*p:1);
      pieces.forEach(a=>{
        const m=a.mesh, blast=clamp((p-0.40)/0.60,0,1);
        if(a.type==='spin'){m.rotation.z=a.angle+p*Math.PI*3;m.scale.setScalar(0.85+0.15*pulse(p));}
        else if(a.type==='tooth'){const angle=a.angle+p*Math.PI*3;m.position.set(Math.cos(angle)*r*0.83,20,Math.sin(angle)*r*0.83);m.rotation.y=-angle;}
        else if(a.type==='sound'){const s=0.3+0.7*clamp(p*1.7-a.index*0.16,0,1);m.scale.setScalar(s);m.position.y=15+a.index*26+p*35;}
        else if(a.type==='cry'){const distance=r*(0.3+0.65*p);m.position.set(Math.cos(a.angle)*distance,r*(0.10+0.2*pulse(p)),Math.sin(a.angle)*distance);m.scale.setScalar(1-p*0.5);}
        else if(a.type==='shock'){m.scale.setScalar(0.3+1.7*p);}
        else if(a.type==='rock'){const distance=r*(0.16+0.77*p);m.position.set(Math.cos(a.angle)*distance,12+r*0.08+r*0.55*pulse(p)*(a.index%2?0.6:1),Math.sin(a.angle)*distance);m.rotation.set(p*4+a.index,p*3,0);m.scale.setScalar(1-p*0.65);}
        else if(a.type==='execute'){m.position.y=r*(1.8*(1-clamp(p/0.52,0,1)));m.rotation.z=-0.65+0.9*clamp(p/0.52,0,1);m.scale.setScalar(1-blast*0.6);}
        else if(a.type==='scar'){m.scale.set(0.4+blast*0.6,1,0.2+0.8*clamp(p/0.5,0,1));}
        else if(a.type==='executeShard'){const distance=r*(0.10+0.85*blast);m.position.set(Math.cos(a.angle)*distance,r*0.8*pulse(blast),Math.sin(a.angle)*distance);m.scale.setScalar(0.3+0.7*pulse(blast));m.rotation.y=p*6;}
      });
    }};
  }
})();
