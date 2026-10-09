"""Ignis anime (chibi) para Browser Multiverse MOBA: modelado + rig + animaciones + export GLB.
Uso:  blender -b -P tools/blender/ignis_anime.py -- <salida.glb> [<salida.blend>]
Todo es procedural (primitivas de Blender + modificadores), así se puede regenerar y ajustar.
Convención: Z arriba en Blender, el personaje mira hacia -Y (en glTF/three.js queda mirando a +Z). Altura ~2.3 m."""
import bpy, bmesh, math, sys
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_GLB = argv[0] if argv else '/tmp/ignis_anime.glb'
OUT_BLEND = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

# ---------------------------------------------------------------- paleta anime (plana, saturada)
PAL = {
    'skin':    (0.98, 0.72, 0.56),
    'hair':    (0.95, 0.16, 0.08),
    'hairtip': (1.00, 0.62, 0.10),
    'hairglow':(1.00, 0.90, 0.35),
    'robe':    (0.72, 0.06, 0.10),
    'robe2':   (0.30, 0.03, 0.06),
    'gold':    (1.00, 0.76, 0.22),
    'flame':   (1.00, 0.45, 0.05),
    'eyew':    (1.00, 1.00, 1.00),
    'iris':    (1.00, 0.55, 0.05),
    'pupil':   (0.20, 0.03, 0.02),
    'dark':    (0.10, 0.06, 0.07),
    'boot':    (0.22, 0.12, 0.10),
    'wood':    (0.42, 0.22, 0.12),
    'crystal': (1.00, 0.40, 0.05),
    'blush':   (1.00, 0.55, 0.55),
}
EMISSIVE = {'crystal': 4.0, 'hairglow': 1.2, 'flame': 0.6}
MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    c = PAL[name] + (1.0,)
    bsdf.inputs['Base Color'].default_value = c
    bsdf.inputs['Roughness'].default_value = 0.85
    if name in EMISSIVE:
        bsdf.inputs['Emission Color'].default_value = c
        bsdf.inputs['Emission Strength'].default_value = EMISSIVE[name]
    MATS[name] = m
    return m

PARTS = []   # (objeto, hueso)
def finish(obj, matname, bone, smooth=True):
    obj.data.materials.clear(); obj.data.materials.append(mat(matname))
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    PARTS.append((obj, bone))
    return obj

def sel(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj

def apply_all(obj):
    sel(obj); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def sphere(name, loc, scale, mname, bone, seg=24, rings=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale; apply_all(o)
    return finish(o, mname, bone)

def cyl(name, p0, p1, r0, r1, mname, bone, verts=16, cap=True):
    """Cono/cilindro entre dos puntos (r0 en p0, r1 en p1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length,
                                    end_fill_type='NGON' if cap else 'NOTHING', location=(p0 + p1) / 2)
    o = bpy.context.object; o.name = name
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    apply_all(o)
    return finish(o, mname, bone)

def spike(name, base, direction, length, radius, mname, bone, bend=(0, 0, 0), verts=6):
    """Mechón de pelo tipo llama: cono curvado (3 tramos) que se afina."""
    base = Vector(base); d = Vector(direction).normalized(); bend = Vector(bend)
    bm = bmesh.new()
    rings = []
    n = 4
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(base + d * length * t + bend * (t * t) * length)
    for i, p in enumerate(pts[:-1]):
        t = i / n
        r = radius * (1 - t) ** 0.9
        tang = (pts[i + 1] - p).normalized()
        a = tang.orthogonal().normalized(); b = tang.cross(a).normalized()
        ring = [bm.verts.new(p + (a * math.cos(k / verts * 2 * math.pi) + b * math.sin(k / verts * 2 * math.pi)) * r) for k in range(verts)]
        rings.append(ring)
    tip = bm.verts.new(pts[-1])
    for i in range(len(rings) - 1):
        for k in range(verts):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % verts], rings[i + 1][(k + 1) % verts], rings[i + 1][k]))
    for k in range(verts):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % verts], tip))
    bm.faces.new(list(reversed(rings[0])))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return finish(o, mname, bone)

def tri_flame(name, base, normal, h, w, mname, bone, thick=0.015):
    """Llamita plana (motivo de fuego) apoyada en una superficie: tres puntas."""
    base = Vector(base); nrm = Vector(normal).normalized(); up = Vector((0, 0, 1))
    side = up.cross(nrm).normalized()
    bm = bmesh.new()
    prof = [(-1, 0), (-0.55, 0.55), (-0.35, 0.35), (0, 1.0), (0.35, 0.35), (0.55, 0.55), (1, 0)]
    front = [bm.verts.new(base + side * x * w + up * y * h + nrm * thick) for x, y in prof]
    back = [bm.verts.new(base + side * x * w + up * y * h - nrm * thick * 0.2) for x, y in prof]
    bm.faces.new(front); bm.faces.new(list(reversed(back)))
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return finish(o, mname, bone, smooth=False)

# ---------------------------------------------------------------- cuerpo
HEAD_C = Vector((0, 0, 1.62)); HR = 0.44
# cabeza: un poco ancha, mentón suave (anime)
head = sphere('head', HEAD_C, (1.0, 0.93, 0.95), 'skin', 'head', seg=32, rings=16)
bm = bmesh.new(); bm.from_mesh(head.data)
for v in bm.verts:
    v.co = HEAD_C + (v.co - HEAD_C) * HR
    rel = v.co - HEAD_C
    if rel.z < -0.05 and rel.y < 0.1:   # mentón en punta, hacia adelante
        k = min(1, (-rel.z - 0.05) / 0.35)
        v.co.x *= 1 - 0.35 * k
        v.co.y -= 0.04 * k
bm.to_mesh(head.data); bm.free()
# orejas
for sx in (-1, 1):
    sphere('ear', (sx * 0.43, 0.02, 1.58), (0.05, 0.08, 0.11), 'skin', 'head', seg=10, rings=6)
# ojos grandes anime (en la cara, hacia -Y)
def eye(sx):
    cx = sx * 0.17; y = -0.385; z = 1.58
    rot = (0, 0, -sx * 0.25)
    sphere('eye_white', (cx, y, z), (0.12, 0.04, 0.15), 'eyew', 'head', seg=20, rings=10, rot=rot)
    sphere('iris', (cx * 0.96, y - 0.022, z - 0.01), (0.085, 0.03, 0.12), 'iris', 'head', seg=20, rings=10, rot=rot)
    sphere('pupil', (cx * 0.95, y - 0.04, z - 0.02), (0.05, 0.02, 0.075), 'pupil', 'head', seg=16, rings=8, rot=rot)
    sphere('shine', (cx * 0.9 - sx * 0.025, y - 0.058, z + 0.045), (0.028, 0.012, 0.034), 'eyew', 'head', seg=10, rings=6)
    sphere('shine2', (cx * 1.02 + sx * 0.02, y - 0.052, z - 0.06), (0.013, 0.008, 0.015), 'eyew', 'head', seg=8, rings=4)
    # pestañas superiores (arco grueso oscuro)
    cyl('lash', (cx - 0.13 * sx * -1 * -1, y - 0.01, z + 0.12), (cx + 0.12 * sx, y + 0.0, z + 0.14), 0.02, 0.012, 'dark', 'head', verts=6)
    # ceja decidida
    cyl('brow', (cx - sx * 0.08, y + 0.005, z + 0.22), (cx + sx * 0.09, y + 0.02, z + 0.25), 0.016, 0.01, 'hair', 'head', verts=6)
    sphere('blush', (sx * 0.27, -0.33, 1.44), (0.06, 0.015, 0.03), 'blush', 'head', seg=10, rings=6)
eye(-1); eye(1)
# boca: sonrisa confiada (curva fina)
spike('mouth', (-0.05, -0.405, 1.36), (1, 0, 0.12), 0.1, 0.012, 'dark', 'head', bend=(0, 0, 0.12), verts=5)

# ---------------------------------------------------------------- pelo de llamas
sphere('hair_cap', HEAD_C + Vector((0, 0.04, 0.07)), (0.47, 0.47, 0.44), 'hair', 'head', seg=28, rings=14)
cap = PARTS[-1][0]
bm = bmesh.new(); bm.from_mesh(cap.data)
kill = [v for v in bm.verts if (v.co - HEAD_C).y < -0.12 and (v.co - HEAD_C).z < 0.16 or (v.co - HEAD_C).z < -0.32]
bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(cap.data); bm.free()
import random
random.seed(7)
# corona de mechones hacia arriba y atrás (silueta de fuego)
crown = [  # (azimut grados desde el frente, elevación, largo)
    (0, 75, 0.62), (30, 65, 0.58), (-30, 65, 0.58), (60, 55, 0.55), (-60, 55, 0.55), (95, 40, 0.5), (-95, 40, 0.5),
    (130, 35, 0.55), (-130, 35, 0.55), (165, 30, 0.6), (-165, 30, 0.6), (180, 50, 0.7), (150, 60, 0.6), (-150, 60, 0.6),
    (15, 85, 0.75), (-20, 82, 0.7), (110, 70, 0.55), (-110, 70, 0.55)]
for i, (az, el, ln) in enumerate(crown):
    a = math.radians(az); e = math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    base = HEAD_C + Vector((d.x * 0.36, d.y * 0.36 + 0.04, 0.12 + d.z * 0.22))
    bend = Vector((0, 0.35, 0.25))  # las puntas se van hacia atrás y arriba, como llamas
    r = 0.14 + random.random() * 0.03
    s = spike('hair_spike', base, d, ln, r, 'hair', 'head', bend=bend, verts=7)
    # punta amarilla/naranja (gradiente de llama)
    tipbase = base + d * ln * 0.62 + bend * 0.62 * 0.62 * ln
    td = (d * ln + bend * 2 * 0.62 * ln).normalized()
    spike('hair_tip', tipbase, td, ln * 0.42, r * 0.42, 'hairtip' if i % 3 else 'hairglow', 'head', bend=bend * 0.3, verts=6)
# flequillo hacia adelante/abajo
for i, x in enumerate((-0.28, -0.15, 0.0, 0.14, 0.27)):
    base = Vector((x, -0.3, 1.93))
    spike('bang', base, (x * 0.6, -0.55, -0.85), 0.3 + (0.06 if i == 2 else 0), 0.09, 'hair', 'head', bend=(x * 0.4, -0.1, 0.0), verts=6)
# mechones laterales
for sx in (-1, 1):
    spike('side', (sx * 0.38, -0.12, 1.72), (sx * 0.35, -0.2, -1), 0.42, 0.08, 'hair', 'head', bend=(sx * 0.15, 0, 0), verts=6)

# ---------------------------------------------------------------- torso, túnica y capa
cyl('neck', (0, 0, 1.14), (0, 0, 1.26), 0.07, 0.07, 'skin', 'head', verts=12)
cyl('torso', (0, 0, 0.82), (0, 0, 1.2), 0.22, 0.25, 'robe', 'spine', verts=20)
cyl('collar', (0, 0, 1.13), (0, 0, 1.27), 0.25, 0.2, 'gold', 'spine', verts=20)
cyl('collar_in', (0, -0.005, 1.2), (0, -0.005, 1.29), 0.19, 0.17, 'robe2', 'spine', verts=20)
# túnica acampanada
robe = cyl('robe', (0, 0, 0.12), (0, 0, 0.86), 0.48, 0.22, 'robe', 'hips', verts=28, cap=False)
cyl('hem', (0, 0, 0.1), (0, 0, 0.18), 0.5, 0.47, 'gold', 'hips', verts=28, cap=False)
cyl('robe_under', (0, 0, 0.12), (0, 0, 0.125), 0.47, 0.47, 'robe2', 'hips', verts=28)
# abertura delantera: franja oscura
cyl('robe_front', (0, -0.3, 0.14), (0, -0.16, 0.84), 0.08, 0.06, 'robe2', 'hips', verts=8)
# llamas bordadas en el ruedo
for i in range(12):
    a = i / 12 * 2 * math.pi
    nrm = Vector((math.sin(a), -math.cos(a), 0.0))
    tri_flame('hem_flame', Vector((0, 0, 0.17)) + nrm * 0.475, nrm + Vector((0, 0, 0.6)), 0.16 + 0.05 * (i % 2), 0.075, 'flame', 'hips')
cyl('belt', (0, 0, 0.8), (0, 0, 0.88), 0.25, 0.25, 'gold', 'spine', verts=20)
sphere('belt_gem', (0, -0.255, 0.84), (0.05, 0.03, 0.05), 'crystal', 'spine', seg=10, rings=6)
# capa: superficie curva detrás con borde de llamas
bm = bmesh.new()
cols, rows = 9, 6
grid = []
for r in range(rows):
    t = r / (rows - 1)
    row = []
    for c in range(cols):
        u = c / (cols - 1) - 0.5
        ang = u * math.radians(150)
        rad = 0.28 + t * 0.22
        z = 1.2 - t * 1.02
        y = math.cos(ang) * rad + 0.02 + t * 0.06
        x = math.sin(ang) * rad
        if r == rows - 1: z += (0.1 if c % 2 == 0 else -0.04)   # borde dentado tipo llama
        row.append(bm.verts.new((x, y, z)))
    grid.append(row)
for r in range(rows - 1):
    for c in range(cols - 1):
        bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
me = bpy.data.meshes.new('cloak'); bm.to_mesh(me); bm.free()
cloak = bpy.data.objects.new('cloak', me); bpy.context.collection.objects.link(cloak)
sel(cloak)
mod = cloak.modifiers.new('solid', 'SOLIDIFY'); mod.thickness = 0.025; mod.material_offset = 1
sub = cloak.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
cloak.data.materials.append(mat('robe2')); cloak.data.materials.append(mat('flame'))
bpy.ops.object.modifier_apply(modifier='solid'); bpy.ops.object.modifier_apply(modifier='sub')
for p in cloak.data.polygons: p.use_smooth = True
PARTS.append((cloak, 'cloak'))
# hombreras doradas con forma de llama
for sx in (-1, 1):
    sphere('pauldron', (sx * 0.27, 0, 1.16), (0.13, 0.13, 0.08), 'gold', 'spine', seg=16, rings=8)
    spike('pauldron_flame', (sx * 0.3, 0.02, 1.2), (sx * 0.4, 0.2, 1), 0.2, 0.06, 'flame', 'spine', bend=(0, 0.2, 0), verts=5)

# ---------------------------------------------------------------- brazos (mangas anchas) y manos
for sx, side in ((1, 'L'), (-1, 'R')):
    sh = Vector((sx * 0.27, 0, 1.12)); el = Vector((sx * 0.4, -0.02, 0.88)); wr = Vector((sx * 0.46, -0.06, 0.66))
    cyl('upperarm', sh, el, 0.075, 0.07, 'robe', 'upperarm.' + side, verts=12)
    cyl('sleeve', el + (el - sh) * -0.1, wr, 0.08, 0.15, 'robe', 'forearm.' + side, verts=16, cap=False)
    cyl('cuff', wr + (wr - el).normalized() * -0.04, wr + (wr - el).normalized() * 0.01, 0.15, 0.155, 'gold', 'forearm.' + side, verts=16)
    sphere('hand', wr + (wr - el).normalized() * 0.07, (0.065, 0.065, 0.07), 'skin', 'hand.' + side, seg=14, rings=8)

# ---------------------------------------------------------------- piernas y botas (se asoman bajo la túnica)
for sx, side in ((1, 'L'), (-1, 'R')):
    cyl('leg', (sx * 0.12, 0, 0.5), (sx * 0.12, 0, 0.16), 0.075, 0.07, 'dark', 'thigh.' + side, verts=10)
    cyl('boot', (sx * 0.12, 0, 0.2), (sx * 0.12, -0.02, 0.04), 0.085, 0.095, 'boot', 'shin.' + side, verts=12)
    sphere('toe', (sx * 0.12, -0.09, 0.05), (0.09, 0.13, 0.06), 'boot', 'shin.' + side, seg=12, rings=6)
    cyl('boot_trim', (sx * 0.12, 0, 0.19), (sx * 0.12, 0, 0.23), 0.09, 0.09, 'gold', 'shin.' + side, verts=12)

# ---------------------------------------------------------------- báculo con cristal de fuego (mano derecha = -X)
hand_r = Vector((-0.46, -0.06, 0.66)) + (Vector((-0.46, -0.06, 0.66)) - Vector((-0.4, -0.02, 0.88))).normalized() * 0.07
s0 = hand_r + Vector((0, -0.02, -0.55)); s1 = hand_r + Vector((0, -0.02, 1.15))
cyl('staff', s0, s1, 0.028, 0.035, 'wood', 'hand.R', verts=10)
cyl('staff_ring', s1 - Vector((0, 0, 0.08)), s1 + Vector((0, 0, 0.0)), 0.06, 0.05, 'gold', 'hand.R', verts=12)
# horquilla dorada que abraza el cristal
for k in range(3):
    a = k / 3 * 2 * math.pi
    spike('prong', s1, (math.cos(a) * 0.5, math.sin(a) * 0.5, 1), 0.28, 0.025, 'gold', 'hand.R', bend=(-math.cos(a) * 0.4, -math.sin(a) * 0.4, 0), verts=5)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=s1 + Vector((0, 0, 0.22)))
cr = bpy.context.object; cr.name = 'crystal'; cr.scale = (0.1, 0.1, 0.19); apply_all(cr)
finish(cr, 'crystal', 'hand.R', smooth=False)
for k in range(3):
    a = k / 3 * 2 * math.pi + 0.5
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=s1 + Vector((math.cos(a) * 0.17, math.sin(a) * 0.17, 0.3 + 0.06 * k)))
    o = bpy.context.object; o.scale = (0.03, 0.03, 0.06); apply_all(o); finish(o, 'hairglow', 'hand.R', smooth=False)

# ---------------------------------------------------------------- armadura
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object; arm.name = 'IgnisRig'; arm.data.name = 'IgnisRig'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
eb.remove(eb[0])
def bone(name, h, t, parent=None, roll=0):
    b = eb.new(name); b.head = h; b.tail = t; b.roll = roll
    if parent: b.parent = eb[parent]; b.use_connect = False
    return b
bone('root', (0, 0, 0), (0, 0.3, 0))
bone('hips', (0, 0, 0.5), (0, 0, 0.82), 'root')
bone('spine', (0, 0, 0.82), (0, 0, 1.2), 'hips')
bone('head', (0, 0, 1.2), (0, 0, 1.9), 'spine')
bone('cloak', (0, 0.25, 1.18), (0, 0.4, 0.4), 'spine')
for sx, side in ((1, 'L'), (-1, 'R')):
    bone('upperarm.' + side, (sx * 0.27, 0, 1.12), (sx * 0.4, -0.02, 0.88), 'spine')
    bone('forearm.' + side, (sx * 0.4, -0.02, 0.88), (sx * 0.46, -0.06, 0.66), 'upperarm.' + side)
    bone('hand.' + side, (sx * 0.46, -0.06, 0.66), (sx * 0.49, -0.08, 0.56), 'forearm.' + side)
    bone('thigh.' + side, (sx * 0.12, 0, 0.5), (sx * 0.12, 0, 0.22), 'hips')
    bone('shin.' + side, (sx * 0.12, 0, 0.22), (sx * 0.12, -0.02, 0.02), 'thigh.' + side)
bpy.ops.object.mode_set(mode='OBJECT')

# unir todas las piezas en una malla con grupos de vértices (pesado rígido por pieza)
for o, b in PARTS:
    vg = o.vertex_groups.new(name=b); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o, b in PARTS: o.select_set(True)
body = PARTS[0][0]; bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'Ignis'; body.data.name = 'Ignis'
# limpiar: unir vértices duplicados por pieza (no entre piezas)
sel(body)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
body.parent = arm
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = arm

# ---------------------------------------------------------------- animaciones
pb = arm.pose.bones
for p in pb: p.rotation_mode = 'XYZ'
D = math.radians
def pose(frame, spec):
    """spec: { hueso: ((rx, ry, rz) en grados, (dx, dy, dz) opcional) }"""
    for name, val in spec.items():
        rot = val[0]; loc = val[1] if len(val) > 1 else None
        p = pb[name]
        p.rotation_euler = Euler((D(rot[0]), D(rot[1]), D(rot[2])), 'XYZ')
        p.keyframe_insert('rotation_euler', frame=frame)
        if loc is not None:
            p.location = Vector(loc); p.keyframe_insert('location', frame=frame)

def rest_all(frame):
    for p in pb:
        p.rotation_euler = Euler((0, 0, 0)); p.location = Vector((0, 0, 0))
        p.keyframe_insert('rotation_euler', frame=frame); p.keyframe_insert('location', frame=frame)

def action(name, length, keys, cyclic=True):
    arm.animation_data_create()
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    rest_all(1)
    for f, spec in keys: pose(f, spec)
    if cyclic:  # cerrar el ciclo copiando el primer cuadro
        pose(length + 1, keys[0][1])
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    act.use_fake_user = True
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 1, act); st.action_frame_end = length + 1
    arm.animation_data.action = None
    return act

# Los brazos cuelgan hacia afuera/abajo: en espacio local del hueso, X dobla hacia adelante/atrás.
idle = action('idle', 60, [
    (1,  {'hips': ((0, 0, 0), (0, 0, 0)), 'spine': ((2, 0, 0),), 'head': ((-3, 0, 2),),
          'upperarm.L': ((0, 0, 6),), 'upperarm.R': ((-25, 0, -4),), 'forearm.R': ((-30, 0, 0),), 'forearm.L': ((-10, 0, 0),), 'cloak': ((0, 0, 0),)}),
    (31, {'hips': ((0, 0, 0), (0, 0.03, 0)), 'spine': ((-1, 0, 0),), 'head': ((2, 0, -2),),
          'upperarm.L': ((4, 0, 9),), 'upperarm.R': ((-22, 0, -6),), 'forearm.R': ((-34, 0, 0),), 'forearm.L': ((-14, 0, 0),), 'cloak': ((6, 0, 0),)}),
])
run = action('run', 18, [
    (1,  {'hips': ((0, 0, 8), (0, 0, 0)), 'spine': ((12, 8, 0),), 'head': ((-8, -6, 0),),
          'thigh.L': ((40, 0, 0),), 'shin.L': ((-20, 0, 0),), 'thigh.R': ((-35, 0, 0),), 'shin.R': ((-45, 0, 0),),
          'upperarm.L': ((-40, 0, 10),), 'forearm.L': ((-35, 0, 0),), 'upperarm.R': ((10, 0, -10),), 'forearm.R': ((-40, 0, 0),), 'cloak': ((25, 0, 0),)}),
    (5,  {'hips': ((0, 0, 0), (0, 0.07, 0)), 'cloak': ((32, 0, 4),)}),
    (10, {'hips': ((0, 0, -8), (0, 0, 0)), 'spine': ((12, -8, 0),), 'head': ((-8, 6, 0),),
          'thigh.L': ((-35, 0, 0),), 'shin.L': ((-45, 0, 0),), 'thigh.R': ((40, 0, 0),), 'shin.R': ((-20, 0, 0),),
          'upperarm.L': ((30, 0, 10),), 'forearm.L': ((-20, 0, 0),), 'upperarm.R': ((-35, 0, -10),), 'forearm.R': ((-50, 0, 0),), 'cloak': ((25, 0, 0),)}),
    (14, {'hips': ((0, 0, 0), (0, 0.07, 0)), 'cloak': ((32, 0, -4),)}),
])
attack = action('attack', 24, [
    (1,  {'spine': ((0, 0, 0),), 'upperarm.R': ((-25, 0, -4),), 'forearm.R': ((-30, 0, 0),)}),
    (9,  {'spine': ((-8, -25, 0),), 'head': ((5, 10, 0),), 'upperarm.R': ((-150, 0, -30),), 'forearm.R': ((-20, 0, 0),), 'hand.R': ((20, 0, 0),), 'upperarm.L': ((-20, 0, 25),)}),
    (14, {'spine': ((15, 25, 0),), 'head': ((-8, -10, 0),), 'upperarm.R': ((-80, 0, 10),), 'forearm.R': ((-5, 0, 0),), 'hand.R': ((-50, 0, 0),), 'upperarm.L': ((10, 0, 10),)}),
    (24, {'spine': ((0, 0, 0),), 'head': ((0, 0, 0),), 'upperarm.R': ((-25, 0, -4),), 'forearm.R': ((-30, 0, 0),), 'hand.R': ((0, 0, 0),), 'upperarm.L': ((0, 0, 6),)}),
], cyclic=False)
cast = action('cast', 24, [
    (1,  {'hips': ((0, 0, 0), (0, 0, 0)), 'spine': ((0, 0, 0),), 'upperarm.L': ((0, 0, 6),), 'upperarm.R': ((-25, 0, -4),)}),
    (8,  {'hips': ((0, 0, 0), (0, 0.12, 0)), 'spine': ((-15, 0, 0),), 'head': ((-15, 0, 0),),
          'upperarm.L': ((-160, 0, 35),), 'forearm.L': ((-10, 0, 0),), 'upperarm.R': ((-165, 0, -30),), 'forearm.R': ((-10, 0, 0),), 'hand.R': ((160, 0, 0),), 'cloak': ((35, 0, 0),)}),
    (13, {'hips': ((0, 0, 0), (0, 0.04, 0)), 'spine': ((18, 0, 0),), 'head': ((5, 0, 0),),
          'upperarm.L': ((-85, 0, -10),), 'forearm.L': ((0, 0, 0),), 'upperarm.R': ((-90, 0, 10),), 'forearm.R': ((0, 0, 0),), 'hand.R': ((40, 0, 0),), 'cloak': ((-10, 0, 0),)}),
    (24, {'hips': ((0, 0, 0), (0, 0, 0)), 'spine': ((0, 0, 0),), 'head': ((0, 0, 0),),
          'upperarm.L': ((0, 0, 6),), 'forearm.L': ((-10, 0, 0),), 'upperarm.R': ((-25, 0, -4),), 'forearm.R': ((-30, 0, 0),), 'hand.R': ((0, 0, 0),), 'cloak': ((0, 0, 0),)}),
], cyclic=False)
death = action('death', 36, [
    (1,  {'root': ((0, 0, 0), (0, 0, 0)), 'spine': ((0, 0, 0),), 'head': ((0, 0, 0),)}),
    (8,  {'root': ((0, 0, 0), (0, 0, 0)), 'spine': ((-20, 0, 0),), 'head': ((-25, 0, 0),), 'upperarm.L': ((-60, 0, 40),), 'upperarm.R': ((-70, 0, -40),)}),
    (22, {'root': ((-88, 0, 0), (0, 0, 0.12)), 'spine': ((-10, 0, 0),), 'head': ((-20, 0, 15),), 'upperarm.L': ((-20, 0, 70),), 'upperarm.R': ((-30, 0, -70),),
          'thigh.L': ((25, 0, 0),), 'thigh.R': ((10, 0, 0),), 'cloak': ((40, 0, 0),)}),
    (36, {'root': ((-90, 0, 0), (0, 0, 0.1)), 'spine': ((-5, 0, 0),), 'head': ((-10, 0, 20),), 'upperarm.L': ((-10, 0, 80),), 'upperarm.R': ((-20, 0, -80),),
          'thigh.L': ((20, 0, 0),), 'thigh.R': ((5, 0, 0),), 'cloak': ((20, 0, 0),)}),
], cyclic=False)
recall = action('recall', 60, [
    (1,  {'hips': ((0, 0, 0), (0, 0.1, 0)), 'spine': ((-5, 0, 0),), 'head': ((-10, 0, 0),),
          'upperarm.L': ((-60, 0, -30),), 'forearm.L': ((-60, 0, 0),), 'upperarm.R': ((-40, 0, 20),), 'forearm.R': ((-50, 0, 0),), 'cloak': ((15, 0, 0),)}),
    (31, {'hips': ((0, 0, 0), (0, 0.18, 0)), 'spine': ((-8, 0, 0),), 'head': ((-14, 0, 0),),
          'upperarm.L': ((-65, 0, -32),), 'forearm.L': ((-62, 0, 0),), 'upperarm.R': ((-45, 0, 22),), 'forearm.R': ((-52, 0, 0),), 'cloak': ((25, 0, 0),)}),
])
scene.frame_start = 1; scene.frame_end = 61

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('IGNIS_TRIS', tris, 'VERTS', len(body.data.vertices))

if OUT_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=False, export_draco_mesh_compression_enable=False,
                          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True,
                          export_materials='EXPORT', export_image_format='NONE')
print('EXPORTED', OUT_GLB)
