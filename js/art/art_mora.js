(function () {
  'use strict';

  const GREEN = 0x3c9a5f, MINT = 0xc7f5a8, BARK = 0x563747, SAP = 0xffc768;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const pulse = (p, center, width) => Math.max(0, 1 - Math.abs(p - center) / width);

  MOBA.defineChampionArt('mora', {
    lore: 'Mora lleva el último bosque en una semilla y planta sus raíces donde alguien todavía necesita refugio.',
    quote: 'Vení, que bajo mis ramas hay lugar.',
    build: function (THREE, ctx) {
      ctx = ctx || {};
      const cache = ctx.cache;
      const mat = (c, o) => cache ? cache.mat(c, o) : new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true }, o));
      const geo = (key, f) => cache ? cache.geo('mora:' + key, f) : f();
      const wood = mat(BARK), green = mat(GREEN), mint = mat(MINT);
      const gold = mat(SAP, { emissive: SAP, emissiveIntensity: 0.35 });
      const glow = cache ? cache.basic(MINT) : new THREE.MeshBasicMaterial({ color: MINT });
      const object = new THREE.Group(), body = new THREE.Group();
      object.add(body);
      function mesh(parent, geometry, material, x, y, z, sx, sy, sz) {
        const m = new THREE.Mesh(geometry, material);
        m.position.set(x || 0, y || 0, z || 0);
        m.scale.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
        parent.add(m); return m;
      }
      const orb = geo('orb', () => new THREE.IcosahedronGeometry(1, 1));
      const cone = geo('cone', () => new THREE.ConeGeometry(1, 1, 6));
      const cylinder = geo('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 7));
      function branch(parent, points, radius, material, key) {
        return mesh(parent, geo(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 12, radius, 5, false)), material);
      }
      // A broad seed body, four articulated roots, and a crown much wider than the face.
      mesh(body, orb, wood, 0, 106, 0, 48, 66, 38);
      mesh(body, cone, green, 0, 93, 0, 66, 88, 48).rotation.z = Math.PI;
      const roots = [];
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1, front = i < 2 ? 1 : -1;
        const pivot = new THREE.Group(); pivot.position.set(side * 30, 68, front * 25); body.add(pivot);
        branch(pivot, [[0,0,0], [side*22,-25,front*6], [side*29,-56,front*16]], 11, wood, 'root' + i);
        mesh(pivot, orb, mint, side*29, -60, front*23, 20, 8, 26);
        roots.push(pivot);
      }
      const head = new THREE.Group(); head.position.y = 170; body.add(head);
      mesh(head, orb, green, 0, 13, 0, 49, 46, 38);
      mesh(head, orb, mint, 0, 7, 33, 36, 33, 16);
      for (let s = -1; s <= 1; s += 2) {
        mesh(head, orb, wood, s*15, 10, 47, 7, 12, 3).rotation.z = -s * 0.18;
        mesh(head, orb, gold, s*15, 12, 50, 3, 6, 2);
      }
      const crown = new THREE.Group(); body.add(crown);
      for (let s = -1; s <= 1; s += 2) {
        branch(crown, [[s*26,176,-14],[s*65,200,-20],[s*92,246,-19],[s*70,280,-10]], 10, wood, 'antler' + s);
        branch(crown, [[s*66,213,-20],[s*107,231,-10],[s*108,257,0]], 6, wood, 'twig' + s);
      }
      const leaves = [];
      for (let i = 0; i < 5; i++) {
        const x = (i-2)*37, y = 265 - Math.abs(i-2)*13;
        const l = mesh(crown, orb, i % 2 ? mint : green, x, y, -16, 27, 34, 12);
        l.rotation.z = -(i-2)*0.36; leaves.push(l);
      }
      // Asymmetric seed sling: its round luminous muzzle reads as a ranged weapon.
      const sling = new THREE.Group(); sling.position.set(66, 135, 24); body.add(sling);
      mesh(sling, cylinder, wood, 0, 8, 0, 8, 123, 8).rotation.z = -0.12;
      for (let s = -1; s <= 1; s += 2) {
        branch(sling, [[0,43,0],[s*24,63,0],[s*24,85,0]], 6, wood, 'fork'+s);
      }
      mesh(sling, geo('sling-ring', () => new THREE.TorusGeometry(23, 3, 5, 16)), mint, 0, 72, 3);
      const seed = mesh(sling, orb, gold, 0, 72, 5, 13, 18, 13);
      const shot = mesh(sling, orb, glow, 0, 72, 5, 8, 13, 8); shot.scale.setScalar(0);
      const leftArm = new THREE.Group(); leftArm.position.set(-38, 145, 0); body.add(leftArm);
      branch(leftArm, [[0,0,0],[-26,-17,8],[-24,-32,27]], 10, wood, 'left-arm');
      mesh(leftArm, orb, mint, -24,-32,27, 16,12,14);
      branch(body, [[36,145,0],[52,128,13],[66,140,24]], 10, wood, 'right-arm');
      const gourd = new THREE.Group(); gourd.position.set(-61, 91, 13); body.add(gourd);
      mesh(gourd, orb, gold, 0,0,0, 21,28,21);
      mesh(gourd, cylinder, wood, 0,24,0, 8,15,8);
      for (let i = 0; i < 3; i++) mesh(body, orb, gold, (i-1)*20, 142-Math.abs(i-1)*6, 39, 7,10,6);
      const halo = mesh(body, geo('halo', () => new THREE.TorusGeometry(66, 3, 5, 32)), glow, 0, 8, 0);
      halo.rotation.x = Math.PI/2; halo.scale.setScalar(0);

      return { object: object, update: function (state) {
        state = state || {};
        const time = state.time || 0, t = state.t || 0, p = clamp(state.progress || 0);
        const anim = state.anim || 'idle';
        body.position.set(0,0,0); body.rotation.set(0,0,0); body.scale.set(1,1,1);
        head.rotation.set(0, Math.sin(time*0.8)*0.08, 0);
        crown.rotation.set(0,0,Math.sin(time*1.5)*0.025);
        sling.rotation.set(0,0,0); leftArm.rotation.set(0,0,0); gourd.rotation.set(0,0,Math.sin(time*2)*0.06);
        seed.scale.set(13,18,13); shot.scale.setScalar(0); halo.scale.setScalar(0);
        roots.forEach(r => r.rotation.set(0,0,0));
        leaves.forEach((l,i) => { l.rotation.x = Math.sin(time*1.7+i)*0.08; });
        if (anim === 'idle') {
          body.position.y = 2 + Math.sin(time*1.8)*2;
          body.rotation.z = Math.sin(time*0.9)*0.018;
        } else if (anim === 'walk') {
          const gait = t*7.5*Math.max(0.25, (state.speed === undefined ? 335 : state.speed)/335);
          roots.forEach((r,i) => { const wave = Math.sin(gait + (i===0 || i===3 ? 0 : Math.PI)); r.rotation.x = wave*0.35; r.rotation.z = wave*(i%2?1:-1)*0.12; });
          body.position.y = 5 + Math.abs(Math.sin(gait))*5;
          body.rotation.z = Math.cos(gait)*0.045; body.rotation.x = 0.08;
          sling.rotation.x = Math.sin(gait)*0.09;
        } else if (anim === 'attack') {
          const pull = pulse(p,0.27,0.27), release = pulse(p,0.58,0.18);
          sling.rotation.x = -pull*0.48 + release*0.35;
          body.rotation.x = -pull*0.10 + release*0.14;
          leftArm.rotation.y = -pull*0.8;
          seed.scale.multiplyScalar(1 - release*0.85);
          const travel = clamp((p-0.42)/0.38);
          shot.position.set(0,72,5+travel*155);
          shot.scale.set(8,10,22); shot.scale.multiplyScalar(p>0.42 && p<0.8 ? Math.sin(travel*Math.PI) : 0);
        } else if (anim === 'cast') {
          const effort = Math.sin(p*Math.PI), slot = state.slot || 0;
          if (slot === 0) { sling.rotation.x = -0.9*effort; body.rotation.x = 0.15*effort; roots.forEach(r => r.rotation.x = -0.16*effort); }
          if (slot === 1) { leftArm.rotation.z = -1.4*effort; gourd.rotation.z = -0.8*effort; halo.scale.setScalar(effort); halo.position.y = 18 + 45*effort; }
          if (slot === 2) { body.rotation.y = Math.sin(p*Math.PI*2)*0.42; crown.rotation.z = -0.22*effort; leftArm.rotation.x = -1.6*effort; sling.rotation.z = 0.55*effort; }
          if (slot === 3) {
            body.position.y = effort*24; body.rotation.x = -0.18*effort;
            crown.scale.set(1+0.18*effort,1+0.12*effort,1);
            leftArm.rotation.z = -1.9*effort; sling.rotation.z = 0.75*effort;
            roots.forEach((r,i) => { r.rotation.z = (i%2?1:-1)*0.48*effort; });
            halo.scale.setScalar(1.7*effort); halo.position.y = 8;
          }
        } else if (anim === 'recall') {
          body.position.y = 10 + Math.sin(t*2)*6; body.rotation.y = t*0.7;
          leftArm.rotation.z = -1.1; sling.rotation.z = 0.55;
          halo.scale.setScalar(1+0.15*Math.sin(t*4)); halo.position.y = 25+(t*35)%210;
          crown.rotation.y = -t*0.4;
        } else if (anim === 'dead') {
          const fall = clamp(t*2);
          body.rotation.z = -fall*1.28; body.position.set(-15*fall,90*fall + Math.sin(fall*Math.PI)*10,0);
          leftArm.rotation.z = -0.6*fall; sling.rotation.z = -0.7*fall;
          roots.forEach((r,i) => { r.rotation.x = (i<2?1:-1)*0.55*fall; });
          head.rotation.z = -0.35*fall;
        }
        if (!(anim === 'cast' && state.slot === 3)) crown.scale.set(1,1,1);
      } };
    },
    fx: {
      Q: function (THREE, ctx, info) { return forestFX(THREE, info, 0, 'projectile'); },
      W: function (THREE, ctx, info) { return forestFX(THREE, info, 1, 'self'); },
      E: function (THREE, ctx, info) { return forestFX(THREE, info, 2, 'self'); },
      R: function (THREE, ctx, info) { return forestFX(THREE, info, 3, 'area'); }
    }
  });

  function forestFX(THREE, info, style, mainKind) {
    info = info || {};
    const kind = info.kind || mainKind, radius = Math.max(12, info.radius || 180);
    const width = Math.max(12, info.width || 100), length = Math.max(20, info.length || 650);
    const missile = kind === 'projectile', line = kind === 'line';
    const span = missile ? width*0.48 : radius;
    const object = new THREE.Group(), moving = [], materials = [];
    function material(color, alpha, additive) {
      const m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      materials.push({ m:m, alpha:alpha }); return m;
    }
    const leaf = material(GREEN,0.8,false), light = material(MINT,0.85,true);
    const sap = material(SAP,0.9,true), bark = material(BARK,0.9,false);
    function add(g,m,parent) { const o = new THREE.Mesh(g,m); (parent||object).add(o); return o; }
    function ring(r,y,m) { const o = add(new THREE.TorusGeometry(r, Math.max(2,r*0.015), 5, 48),m); o.rotation.x = Math.PI/2; o.position.y = y; return o; }
    const sphere = new THREE.IcosahedronGeometry(1,0);
    if (style === 0 && missile) {
      // Three corkscrew roots make a pointed binding bolt rather than an energy ball.
      for (let j=0;j<3;j++) {
        const points=[];
        for (let i=0;i<=18;i++) { const z = (i/18-0.5)*width*1.8, a=i/18*Math.PI*2+j*Math.PI*2/3; points.push(new THREE.Vector3(Math.cos(a)*span*0.55,Math.sin(a)*span*0.55,z)); }
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,width*0.055,5,false),j===0?light:leaf);
      }
      const tip = add(new THREE.ConeGeometry(width*0.18,width*0.5,6),sap); tip.rotation.x=Math.PI/2; tip.position.z=width;
      return { object:object, update:function(p) { p=clamp(p||0); object.rotation.z=p*4; materials.forEach(v=>{v.m.opacity=v.alpha*Math.sin(Math.PI*p);}); } };
    }
    const layout = new THREE.Group(); object.add(layout);
    if (missile) { layout.rotation.x=Math.PI/2; }
    if (line) { layout.position.z=length/2; layout.scale.set(width/(radius*2),1,length/(radius*2)); }
    const rim = ring(span,4,light); object.remove(rim); layout.add(rim);
    const inner = ring(span*0.64,7,style===1?sap:leaf); object.remove(inner); layout.add(inner);
    const count = style===3 ? 6 : 8;
    for (let i=0;i<count;i++) {
      const a=i/count*Math.PI*2, pivot=new THREE.Group(); layout.add(pivot);
      pivot.position.set(Math.sin(a)*span*0.72,0,Math.cos(a)*span*0.72);
      pivot.rotation.y=a;
      if (style===3) {
        const trunk=add(new THREE.CylinderGeometry(span*0.025,span*0.045,span*0.52,5),bark,pivot); trunk.position.y=span*0.26;
        const bough=add(sphere,leaf,pivot); bough.position.y=span*0.50; bough.scale.set(span*0.17,span*0.24,span*0.14);
        const bud=add(sphere,light,pivot); bud.position.set(0,span*0.66,0); bud.scale.set(span*0.08,span*0.11,span*0.08);
      } else if (style===2) {
        const arc=add(new THREE.TorusGeometry(span*0.24,Math.max(2,span*0.018),4,14,Math.PI*1.2),light,pivot);
        arc.rotation.x=Math.PI/2; arc.position.y=16+i%2*20;
        const feather=add(sphere,leaf,pivot); feather.position.set(span*0.18,20,0); feather.scale.set(span*0.11,span*0.025,span*0.045); feather.rotation.y=-0.5;
      } else if (style===1) {
        const drop=add(sphere,sap,pivot); drop.position.y=20; drop.scale.set(span*0.045,span*0.08,span*0.045);
        const petal=add(sphere,light,pivot); petal.position.y=7; petal.scale.set(span*0.06,span*0.018,span*0.12);
      } else {
        const pts=[new THREE.Vector3(0,0,0),new THREE.Vector3(span*0.08,span*0.15,0),new THREE.Vector3(0,span*0.34,span*0.03)];
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,span*0.022,5,false),leaf,pivot);
      }
      moving.push({ pivot:pivot, angle:a });
    }
    if (style===3) {
      const heart=add(sphere,sap,layout); heart.position.y=span*0.12; heart.scale.set(span*0.12,span*0.12,span*0.12);
    }
    return { object:object, update:function(p) {
      p=clamp(p||0);
      const fade=Math.min(1,p*8)*Math.min(1,(1-p)*6);
      materials.forEach(v=>{v.m.opacity=v.alpha*fade;});
      rim.scale.setScalar(style===3?1:0.72+p*0.28);
      inner.scale.setScalar(style===1?0.3+p*1.1:0.85+Math.sin(p*Math.PI*4)*0.08);
      moving.forEach((v,i)=> {
        if (style===3) { v.pivot.scale.setScalar(0.06+0.94*clamp((p-i*0.025)*5)); v.pivot.rotation.z=Math.sin(p*10+i)*0.04; }
        else if (style===1) { v.pivot.position.y=Math.sin(p*Math.PI)*span*0.30; v.pivot.scale.setScalar(0.7+Math.sin(p*Math.PI)*0.3); }
        else if (style===2) { const a=v.angle+p*Math.PI*1.6; v.pivot.position.set(Math.sin(a)*span*(0.4+p*0.5),p*span*0.12,Math.cos(a)*span*(0.4+p*0.5)); v.pivot.rotation.y=a; }
        else { v.pivot.scale.y=0.15+Math.sin(p*Math.PI)*1.15; }
      });
    } };
  }
})();
