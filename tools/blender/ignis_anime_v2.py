"""Ignis anime v2 (chibi) para Browser Multiverse MOBA: modelado + cara pintada + rig con pesos suaves +
animaciones con movimiento secundario horneado (pelo, capa y falda con resortes) + export GLB.
Uso:  blender -b -P tools/blender/ignis_anime_v2.py -- <salida.glb> [<salida.blend>]
Todo es procedural (barridos con grosor variable, tornos con pliegues, cara pintada con funciones de distancia),
así se puede regenerar y ajustar. Convención: Z arriba en Blender, el personaje mira hacia -Y
(en glTF/three.js mira a +Z). +X es la izquierda del personaje. Altura ~2.35 m."""
import bpy, bmesh, math, sys, os, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_GLB = argv[0] if argv else '/tmp/ignis_anime.glb'
OUT_BLEND = argv[1] if len(argv) > 1 else None
TEX_DIR = os.path.dirname(os.path.abspath(OUT_BLEND or OUT_GLB))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
random.seed(11)
D = math.radians
TAU = 2 * math.pi

def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def sstep(a, b, x):
    t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t
def s2l(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

# ---------------------------------------------------------------- paleta (sRGB, se pasa a lineal)
PAL_SRGB = {
    'skin':     (1.00, 0.86, 0.75),
    'hair':     (0.86, 0.13, 0.10),   # rojo base
    'hair2':    (0.98, 0.36, 0.10),   # naranja (medio)
    'hairtip':  (1.00, 0.70, 0.22),   # puntas doradas
    'robe':     (0.80, 0.12, 0.16),
    'robe2':    (0.42, 0.06, 0.10),   # granate oscuro (panel, capa)
    'lining':   (1.00, 0.52, 0.14),   # forro naranja de la capa / faja
    'gold':     (1.00, 0.80, 0.30),
    'dark':     (0.20, 0.12, 0.14),
    'boot':     (0.38, 0.17, 0.12),
    'wood':     (0.50, 0.28, 0.16),
    'flame':    (1.00, 0.45, 0.06),
    'flamecore':(1.00, 0.88, 0.40),
    'crystal':  (1.00, 0.36, 0.08),
}
EMISSIVE = {'flame': 1.4, 'flamecore': 2.0, 'crystal': 4.0}
MAT_NAMES = list(PAL_SRGB.keys()) + ['face']
MI = {n: i for i, n in enumerate(MAT_NAMES)}
MATS = {}
for name in PAL_SRGB:
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = s2l(PAL_SRGB[name]) + (1.0,)
    b.inputs['Base Color'].default_value = c
    b.inputs['Roughness'].default_value = 0.85
    if name in EMISSIVE:
        b.inputs['Emission Color'].default_value = c
        b.inputs['Emission Strength'].default_value = EMISSIVE[name]
    MATS[name] = m

# ---------------------------------------------------------------- cabeza: medidas
HEAD_C = Vector((0, 0, 1.67)); HR = 0.5
HS = Vector((1.0, 0.93, 0.96))      # escala de la cabeza (un poco ancha)

# ---------------------------------------------------------------- textura de la cara (pintada con SDF)
FACE_S = 0.55 * HR / 0.47       # (rasgos definidos para una cabeza de radio 0.47 y escalados) la textura cubre x,z en [-S, S] alrededor del centro de la cabeza (vista frontal)
def paint_face(path, res=1024):
    lin = (np.arange(res) + 0.5) / res
    ax = (lin - 0.5) * 2 * 0.55
    X, Z = np.meshgrid(ax, ax)           # filas = Z (de abajo hacia arriba, como los píxeles de Blender)
    px = 2 * 0.55 / res
    img = np.zeros((res, res, 3)); img[:] = PAL_SRGB['skin']
    def cov(sd, soft=1.0): return np.clip(0.5 - sd / (px * soft), 0, 1)
    def paint(a, col):
        nonlocal img
        col = np.asarray(col, dtype=float)
        if col.ndim == 1: col = col[None, None, :]
        img = img * (1 - a[..., None]) + col * a[..., None]
    def ell(cx, cz, rx, rz, rot=0.0):
        c, s = math.cos(rot), math.sin(rot)
        dx, dz = X - cx, Z - cz
        u = dx * c + dz * s; v = -dx * s + dz * c
        return (np.sqrt((u / rx) ** 2 + (v / rz) ** 2) - 1) * min(rx, rz)
    def seg(x0, z0, x1, z1, r0, r1):
        vx, vz = x1 - x0, z1 - z0; L2 = vx * vx + vz * vz
        t = np.clip(((X - x0) * vx + (Z - z0) * vz) / L2, 0, 1)
        return np.sqrt((X - x0 - vx * t) ** 2 + (Z - z0 - vz * t) ** 2) - (r0 + (r1 - r0) * t)
    inter = np.maximum; union = np.minimum
    def sub(a, b): return np.maximum(a, -b)
    # rubor suave + rayitas
    for s in (-1, 1):
        paint(cov(ell(s * 0.265, -0.17, 0.062, 0.03), 10) * 0.55, (1.0, 0.58, 0.58))
        for k in range(3):
            x0 = s * (0.235 + k * 0.026)
            paint(cov(seg(x0 - 0.008, -0.185, x0 + 0.008, -0.155, 0.0035, 0.0035)) * 0.7, (0.93, 0.42, 0.45))
    # ojos grandes
    DARK = (0.16, 0.04, 0.05)
    for s in (-1, 1):
        cx, cz = s * 0.18, -0.035
        white = ell(cx, cz, 0.108, 0.128)
        paint(cov(white), (1, 1, 1))
        # iris con degradé (oscuro arriba -> naranja -> dorado abajo)
        icx, icz = cx - s * 0.010, cz - 0.016
        iris = inter(ell(icx, icz, 0.08, 0.106), white)
        t = np.clip((Z - (icz - 0.1)) / 0.2, 0, 1)[..., None]
        top = np.array((0.42, 0.06, 0.03)); mid = np.array((0.96, 0.36, 0.05)); bot = np.array((1.0, 0.82, 0.28))
        grad = np.where(t > 0.5, mid + (top - mid) * ((t - 0.5) * 2), bot + (mid - bot) * (t * 2))
        paint(cov(iris), grad)
        ring = sub(iris, ell(icx, icz, 0.066, 0.091))
        paint(cov(ring), (0.36, 0.05, 0.03))
        paint(cov(ell(icx, icz - 0.002, 0.036, 0.054)), (0.20, 0.02, 0.02))           # pupila
        paint(cov(inter(ell(icx, icz - 0.055, 0.05, 0.03), iris), 2) * 0.55, (1.0, 0.95, 0.55))  # brillo cálido abajo
        # sombra del párpado (media luna que sigue la curva del ojo)
        paint(cov(sub(white, ell(cx, cz - 0.03, 0.112, 0.128)), 1.5) * 0.4, (0.62, 0.30, 0.38))
        # pestaña superior gruesa (media luna que se afina a los costados) + ala exterior
        lash = sub(ell(cx, cz + 0.03, 0.112, 0.136), white)
        lash = inter(lash, (cz + 0.005) - Z)
        wing = seg(cx + s * 0.09, cz + 0.075, cx + s * 0.15, cz + 0.105, 0.017, 0.004)
        paint(cov(union(lash, wing)), DARK)
        # pestaña inferior fina (lado exterior)
        low = inter(sub(ell(cx, cz - 0.004, 0.112, 0.133), white), Z - (cz + 0.0))
        low = inter(sub(ell(cx, cz - 0.004, 0.112, 0.133), white), inter((cz - 0.06) - Z, s * (X - cx) - 0.03))
        paint(cov(low), DARK)
        # brillos
        paint(cov(ell(cx + s * 0.03, cz + 0.036, 0.029, 0.036, s * 0.3)), (1, 1, 1))
        paint(cov(ell(cx - s * 0.032, cz - 0.062, 0.013, 0.014)), (1, 1, 1))
        # cejas decididas (gruesas, extremo interior más bajo)
        brow = seg(cx - s * 0.07, cz + 0.165, cx + s * 0.095, cz + 0.2, 0.02, 0.009)
        paint(cov(brow), (0.55, 0.07, 0.05))
    # nariz (pequeño trazo)
    paint(cov(ell(0.006, -0.16, 0.009, 0.005)), (0.86, 0.56, 0.50))
    # boca: sonrisa abierta confiada (forma de D) con lengua y colmillo
    MZ = 0.02
    zline = -0.268 + MZ + 0.022 * (X / 0.062) ** 2 + 0.006 * (X / 0.062)
    mouth = inter(ell(0.0, -0.272 + MZ, 0.064, 0.048), Z - zline)
    paint(cov(mouth), (0.40, 0.06, 0.08))
    paint(cov(inter(ell(0.008, -0.312 + MZ, 0.036, 0.022), mouth)), (0.96, 0.45, 0.47))
    fang = np.maximum(np.maximum(-(Z - zline) - 0.0, (X - 0.034)), np.maximum(0.018 - X, (Z - (zline - 0.022 + 0.9 * np.abs(X - 0.026)))))
    fang = np.maximum(inter(-(zline - Z) + 0.0005, -(Z - (zline - 0.024 + 1.6 * np.abs(X - 0.026)))), np.abs(X - 0.026) - 0.009)
    paint(cov(inter(fang, ell(0.0, -0.272 + MZ, 0.066, 0.052))), (1, 1, 1))
    lip = np.maximum(np.abs(Z - zline) - 0.0045, np.abs(X) - 0.071)
    paint(cov(lip), DARK)
    rgba = np.concatenate([np.clip(img, 0, 1), np.ones((res, res, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new('ignis_face', res, res, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)
    im = bpy.data.images.load(path); im.name = 'ignis_face'; im.pack()
    return im

face_png = os.path.join(TEX_DIR, 'ignis_face.png')
face_img = paint_face(face_png)
fm = bpy.data.materials.new('face'); fm.use_nodes = True
nt = fm.node_tree; bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.85
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = face_img; tex.interpolation = 'Linear'
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
MATS['face'] = fm

# ---------------------------------------------------------------- esqueleto (definición en reposo)
BONES = []   # (nombre, cabeza, cola, padre)
def B(name, h, t, parent=None): BONES.append((name, Vector(h), Vector(t), parent))
B('root', (0, 0, 0), (0, 0.3, 0))
B('hips', (0, 0, 0.78), (0, 0, 0.9), 'root')
B('spine.01', (0, 0, 0.9), (0, 0, 1.0), 'hips')
B('spine.02', (0, 0, 1.0), (0, 0, 1.16), 'spine.01')
B('neck', (0, 0, 1.16), (0, 0, 1.26), 'spine.02')
B('head', (0, 0, 1.26), (0, 0, 1.84), 'neck')
SH = {}; EL = {}; WR = {}; HT = {}
for sx, sd in ((1, 'L'), (-1, 'R')):
    SH[sd] = Vector((sx * 0.25, 0.0, 1.11)); EL[sd] = Vector((sx * 0.36, -0.03, 0.88))
    WR[sd] = Vector((sx * 0.43, -0.07, 0.67)); HT[sd] = Vector((sx * 0.46, -0.09, 0.57))
    B('clavicle.' + sd, (sx * 0.04, 0.0, 1.12), SH[sd], 'spine.02')
    B('upperarm.' + sd, SH[sd], EL[sd], 'clavicle.' + sd)
    B('forearm.' + sd, EL[sd], WR[sd], 'upperarm.' + sd)
    B('hand.' + sd, WR[sd], HT[sd], 'forearm.' + sd)
    B('thigh.' + sd, (sx * 0.12, 0, 0.78), (sx * 0.12, -0.01, 0.44), 'hips')
    B('shin.' + sd, (sx * 0.12, -0.01, 0.44), (sx * 0.12, 0.0, 0.1), 'thigh.' + sd)
    B('foot.' + sd, (sx * 0.12, 0.0, 0.1), (sx * 0.12, -0.15, 0.03), 'shin.' + sd)
B('skirt.F', (0, -0.1, 0.84), (0, -0.42, 0.14), 'hips')
B('skirt.B', (0, 0.1, 0.84), (0, 0.42, 0.12), 'hips')
B('skirt.L', (0.1, 0, 0.84), (0.42, 0, 0.13), 'hips')
B('skirt.R', (-0.1, 0, 0.84), (-0.42, 0, 0.13), 'hips')
for sx, sd in ((1, 'L'), (-1, 'R')):
    B('cape.%s.1' % sd, (sx * 0.1, 0.2, 1.13), (sx * 0.17, 0.32, 0.8), 'spine.02')
    B('cape.%s.2' % sd, (sx * 0.17, 0.32, 0.8), (sx * 0.23, 0.44, 0.45), 'cape.%s.1' % sd)
    B('cape.%s.3' % sd, (sx * 0.23, 0.44, 0.45), (sx * 0.27, 0.52, 0.08), 'cape.%s.2' % sd)
    B('hair.back.%s.1' % sd, (sx * 0.18, 0.32, 1.95), (sx * 0.28, 0.56, 1.95), 'head')
    B('hair.back.%s.2' % sd, (sx * 0.28, 0.56, 1.95), (sx * 0.36, 0.76, 2.0), 'hair.back.%s.1' % sd)
    B('hair.side.%s.1' % sd, (sx * 0.44, -0.12, 1.74), (sx * 0.48, -0.16, 1.52), 'head')
    B('hair.side.%s.2' % sd, (sx * 0.48, -0.16, 1.52), (sx * 0.47, -0.2, 1.32), 'hair.side.%s.1' % sd)
B('hair.top.1', (0, 0.05, 2.12), (0, 0.25, 2.2), 'head')
B('hair.top.2', (0, 0.25, 2.2), (0, 0.45, 2.26), 'hair.top.1')
B('hair.bang', (0, -0.3, 2.02), (0, -0.48, 1.86), 'head')
B('hair.nape', (0, 0.38, 1.52), (0, 0.52, 1.3), 'head')
B('hair.ahoge', (0, -0.06, 2.15), (0, -0.1, 2.4), 'head')
REST_HT = {n: (h, t) for n, h, t, p in BONES}
GRIP = WR['R'] + (HT['R'] - WR['R']).normalized() * 0.065     # centro del puño derecho (donde pasa el báculo)
STAFF_BOT = GRIP + Vector((0, -0.01, -0.6)); STAFF_TOP = GRIP + Vector((0, -0.01, 1.02))
CRYSTAL_C = STAFF_TOP + Vector((0, 0, 0.21))
B('staff', GRIP, GRIP + Vector((0, 0, 0.5)), 'hand.R')
B('staff.flame', CRYSTAL_C + Vector((0, 0, 0.1)), CRYSTAL_C + Vector((0, 0, 0.35)), 'staff')
REST_HT = {n: (h, t) for n, h, t, p in BONES}

# ---------------------------------------------------------------- pesos
def dseg(p, a, b):
    ab = b - a; t = clamp((p - a).dot(ab) / max(1e-9, ab.length_squared)); return (a + ab * t - p).length
def norm_w(ws, top=4, cut=0.02):
    items = sorted(((b, w) for b, w in ws.items() if w > 0), key=lambda x: -x[1])[:top]
    tot = sum(w for _, w in items) or 1
    items = [(b, w / tot) for b, w in items if w / tot >= cut]
    tot = sum(w for _, w in items) or 1
    return {b: w / tot for b, w in items}
def w_auto(cands, power=5, eps=0.015):
    """Pesos automáticos por distancia a los huesos (falloff 1/d^p) + limpieza (máx. 3 huesos, poda < 3%)."""
    def f(co):
        return norm_w({b: 1.0 / (dseg(co, *REST_HT[b]) + eps) ** power for b in cands}, top=3, cut=0.03)
    return f
def w_rigid(b): return lambda co: {b: 1.0}
def chain_w(t, bones, knots, blend=0.12):
    """Partición suave a lo largo de una cadena: bones[i] domina en [knots[i], knots[i+1]]."""
    ws = {}
    for i, b in enumerate(bones):
        lo = knots[i]; hi = knots[i + 1]
        a = 1.0 if i == 0 else sstep(lo - blend, lo + blend, t)
        z = 1.0 if i == len(bones) - 1 else 1 - sstep(hi - blend, hi + blend, t)
        ws[b] = max(0.0, a * z)
    return norm_w(ws)
def w_robe(co):
    h = clamp((0.86 - co.z) / 0.74)
    r = math.hypot(co.x, co.y) or 1
    dx, dy = co.x / r, co.y / r
    dirs = {'skirt.F': max(0, -dy) ** 2, 'skirt.B': max(0, dy) ** 2, 'skirt.L': max(0, dx) ** 2, 'skirt.R': max(0, -dx) ** 2}
    s = sstep(0.0, 0.75, h)
    ws = {'hips': 1 - s}
    ws['spine.01'] = 0.0
    for k, v in dirs.items(): ws[k] = s * v
    return norm_w(ws)
def w_cape(co):
    t = clamp((1.13 - co.z) / 1.05)
    wl = sstep(-0.12, 0.12, co.x)
    out = {}
    for sd, k in (('L', wl), ('R', 1 - wl)):
        cw = chain_w(t, ['spine.02', 'cape.%s.1' % sd, 'cape.%s.2' % sd, 'cape.%s.3' % sd], [0, 0.04, 0.33, 0.66, 1.0], 0.1)
        for b, w in cw.items(): out[b] = out.get(b, 0) + w * k
    return norm_w(out)

# ---------------------------------------------------------------- utilidades de malla
PARTS = []
def add_part(name, bm, weights, smooth=True):
    """weights: función(co)->{hueso: peso} o dict {BMVert: {hueso: peso}}"""
    bm.verts.index_update()
    if isinstance(weights, dict):
        wl = [weights[v] for v in bm.verts]
    else:
        wl = [weights(v.co) for v in bm.verts]
    for f in bm.faces: f.smooth = smooth
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in MAT_NAMES: me.materials.append(MATS[m])
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    groups = {}
    for i, ws in enumerate(wl):
        for b, w in ws.items():
            if b not in groups: groups[b] = o.vertex_groups.new(name=b)
            groups[b].add([i], w, 'REPLACE')
    PARTS.append(o)
    return o

def frames_along(pts, normal_hint):
    n = len(pts); T = []
    for i in range(n):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        T.append(d.normalized())
    nh = Vector(normal_hint)
    N = nh - T[0] * nh.dot(T[0])
    if N.length < 1e-6: N = T[0].orthogonal()
    N.normalize(); out = []
    for i in range(n):
        if i > 0:
            N = T[i - 1].rotation_difference(T[i]) @ N
            N = (N - T[i] * N.dot(T[i])).normalized()
        out.append((T[i], N, T[i].cross(N).normalized()))
    return out

def sweep(bm, pts, shape, nv=8, normal_hint=(0, 0, 1), cap0=True, cap1=True, tip=False, mat='robe', twist=0.0):
    """Tubo a lo largo de pts. shape(t, a) -> (radio lateral, radio normal) o float. mat: nombre o fn(t, a)->nombre.
    Devuelve dict {BMVert: t}. Normales hacia afuera por construcción."""
    fr = frames_along(pts, normal_hint)
    L = [0.0]
    for i in range(1, len(pts)): L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    tot = L[-1] or 1
    rings = []; vt = {}
    for i, p in enumerate(pts):
        t = L[i] / tot; Tn, N, Bn = fr[i]
        if tip and i == len(pts) - 1:
            v = bm.verts.new(p); rings.append([v]); vt[v] = t; continue
        ring = []
        for k in range(nv):
            a = TAU * k / nv + twist * t
            r = shape(t, a)
            rx, rz = (r, r) if not isinstance(r, tuple) else r
            v = bm.verts.new(p + Bn * (math.cos(a) * rx) + N * (math.sin(a) * rz))
            ring.append(v); vt[v] = t
        rings.append(ring)
    mf = mat if callable(mat) else (lambda t, a: mat)
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        tc = (L[i] + L[i + 1]) / 2 / tot
        for k in range(nv):
            a = TAU * (k + 0.5) / nv
            if len(r1) == 1: f = bm.faces.new((r0[k], r1[0], r0[(k + 1) % nv]))
            else: f = bm.faces.new((r0[k], r1[k], r1[(k + 1) % nv], r0[(k + 1) % nv]))
            f.material_index = MI[mf(tc, a)]
    if cap0 and len(rings[0]) > 1:
        f = bm.faces.new(rings[0]); f.material_index = MI[mf(0, 0)]
    if cap1 and len(rings[-1]) > 1:
        f = bm.faces.new(list(reversed(rings[-1]))); f.material_index = MI[mf(1, 0)]
    return vt

def lathe(bm, rows, nseg, fn, mat='robe', cap_top=False, cap_bot=False):
    """Superficie de revolución: rows de arriba hacia abajo (param h), fn(h, a)->Vector; a=0 al frente (-Y), crece hacia +X."""
    grid = [[bm.verts.new(fn(h, TAU * s / nseg)) for s in range(nseg)] for h in rows]
    mf = mat if callable(mat) else (lambda h, a: mat)
    for r in range(len(rows) - 1):
        hc = (rows[r] + rows[r + 1]) / 2
        for s in range(nseg):
            a = TAU * (s + 0.5) / nseg
            a = a if a <= math.pi else a - TAU
            f = bm.faces.new((grid[r][s], grid[r + 1][s], grid[r + 1][(s + 1) % nseg], grid[r][(s + 1) % nseg]))
            f.material_index = MI[mf(hc, a)]
    if cap_top:
        f = bm.faces.new(list(reversed(grid[0]))); f.material_index = MI[mf(rows[0], 0)]
    if cap_bot:
        f = bm.faces.new(grid[-1]); f.material_index = MI[mf(rows[-1], 0)]
    return grid

def ellipsoid(bm, c, r, mat, seg=16, rings=10, rot=None):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    M = (rot.to_matrix() if rot is not None else Matrix.Identity(3)) @ Matrix.Diagonal(Vector(r))
    for v in res['verts']: v.co = Vector(c) + M @ v.co
    for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = MI[mat]
    return res['verts']

def orient_radial(bm, faces=None, axis_xy=(0, 0), inward=False):
    for f in (faces or bm.faces):
        c = f.calc_center_median(); rad = Vector((c.x - axis_xy[0], c.y - axis_xy[1], 0))
        if (f.normal.dot(rad) < 0) != inward: f.normal_flip()

def ring_dir(a): return Vector((math.sin(a), -math.cos(a), 0))

# ================================================================ CABEZA
bm = bmesh.new()
res = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
for v in bm.verts:
    x, y, z = v.co
    if z < 0:
        k = (-z) ** 1.6
        front = sstep(0.3, -0.6, y)
        x *= 1 - 0.30 * k * (0.5 + 0.5 * front)
        y = y * (1 - 0.18 * k) - 0.05 * k * front
    if y > 0.2: y *= 0.97
    v.co = HEAD_C + Vector((x * HR * HS.x, y * HR * HS.y, z * HR * HS.z))
bm.normal_update()
uv = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    f.material_index = MI['face']
    front = f.normal.y < -0.25 and f.calc_center_median().z > HEAD_C.z - 0.5
    for l in f.loops:
        if front:
            p = l.vert.co - HEAD_C
            l[uv].uv = (0.5 + p.x / (2 * FACE_S), 0.5 + p.z / (2 * FACE_S))
        else:
            l[uv].uv = (0.03, 0.97)
# orejitas puntiagudas
for sx in (-1, 1):
    vt = sweep(bm, [Vector((sx * 0.42, 0.04, 1.6)), Vector((sx * 0.48, 0.07, 1.63)), Vector((sx * 0.53, 0.12, 1.7))],
               lambda t, a: (0.05 * (1 - t) + 0.008, 0.022 * (1 - t) + 0.006), nv=8, normal_hint=(sx, 0, 0), tip=True, mat='skin')
add_part('head', bm, w_rigid('head'))

bm = bmesh.new()
sweep(bm, [Vector((0, 0.01, 1.08)), Vector((0, 0.01, 1.32))], lambda t, a: 0.068, nv=12, mat='skin')
add_part('neck', bm, w_auto(['spine.02', 'neck', 'head']))

# ================================================================ PELO
# casquete base (volumen) con hueco para la cara
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=18, radius=1.0)
kill = []
for v in bm.verts:
    d = v.co.copy()
    v.co = HEAD_C + Vector((0, 0.03, 0.035)) + Vector((d.x * HR * 1.07, d.y * HR * 1.03, d.z * HR * 1.04))
    rel = v.co - HEAD_C
    hairline = 0.17 + 0.22 * (abs(rel.x) / HR) ** 2
    if rel.y < 0.02 and rel.z < hairline and abs(rel.x) < 0.36: kill.append(v)
    elif rel.y < 0.0 and rel.z < -0.12: kill.append(v)
    elif rel.z < -0.36: kill.append(v)
bmesh.ops.delete(bm, geom=kill, context='VERTS')
for f in bm.faces: f.material_index = MI['hair']
bm.normal_update(); orient_radial(bm)
for f in bm.faces:
    c = f.calc_center_median() - HEAD_C
    if f.normal.dot(c) < 0: f.normal_flip()
add_part('hair_cap', bm, w_rigid('head'))

def hair_mat(tip0=0.5, tip1=0.78):
    return lambda t, a: 'hair' if t < tip0 else ('hair2' if t < tip1 else 'hairtip')

def lock(az, el, flow, L, W, Tk, curl, chain, nseg=10, nv=6, lift=0.1, tips=(0.5, 0.78), minr=1.06):
    a, e = D(az), D(el)
    n = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    root = HEAD_C + Vector((n.x * HS.x, n.y * HS.y, n.z * HS.z)) * HR * 0.92
    flow = Vector(flow).normalized(); curl = Vector(curl)
    pts = []
    for i in range(nseg + 1):
        t = i / nseg
        p = root + n * (HR * lift * math.sin(math.pi * min(1, t * 1.3))) + flow * L * t + curl * L * t ** 2.4
        rel = p - HEAD_C
        rr = HR * (minr + 0.04 * min(1, t * 3))
        if t > 0.05 and rel.length < rr: p = HEAD_C + rel.normalized() * rr
        pts.append(p)
    prof = lambda t: ((1 - t) ** 1.05) * (0.8 + 0.55 * math.sin(math.pi * min(1.0, t * 1.5)))
    bm = bmesh.new()
    vt = sweep(bm, pts, lambda t, a: (W * prof(t) + 0.004, Tk * prof(t) + 0.003), nv=nv, normal_hint=n, tip=True, cap1=False, mat=hair_mat(*tips))
    bones = chain if isinstance(chain, list) else [chain]
    if len(bones) == 1: knots = [0, 0.18, 1]
    else: knots = [0, 0.15, 0.55, 1]
    weights = {v: chain_w(t, ['head'] + bones, knots, 0.12) for v, t in vt.items()}
    add_part('hair_lock', bm, weights)

def chainLR(az, kind):
    s = 'L' if math.sin(D(az)) >= 0 else 'R'
    return ['hair.%s.%s.1' % (kind, s), 'hair.%s.%s.2' % (kind, s)]
TOP = ['hair.top.1', 'hair.top.2']
# Pelo compacto (v2): pocos mechones grandes y suaves que se pegan a la cabeza y fluyen hacia atrás con puntas que suben
# como llamas. Pensado para la cámara cenital del MOBA: nada tapa los ojos y el volumen no domina la silueta.
NV, NS = 8, 11
for az, el, fl, L, W in [(-30, 60, (-0.3, 0.75, 0.55), 0.44, 0.17), (-8, 70, (-0.06, 0.7, 0.7), 0.52, 0.18), (16, 69, (0.12, 0.72, 0.68), 0.5, 0.18), (38, 60, (0.32, 0.75, 0.55), 0.42, 0.16)]:
    lock(az, el, fl, L, W, 0.065, (0, 0.1, 0.3), TOP, nseg=NS, nv=NV, lift=0.07, minr=1.04)
for az, el, L in [(118, 34, 0.4), (149, 42, 0.46), (180, 46, 0.5), (211, 42, 0.46), (242, 34, 0.4)]:
    sn = math.sin(D(az))
    lock(az, el, (sn * 0.42, 0.88, 0.2), L, 0.17, 0.065, (sn * 0.05, 0.02, 0.36), chainLR(az, 'back'), nseg=NS, nv=NV, lift=0.06, minr=1.04)
for az, L in [(145, 0.32), (180, 0.34), (215, 0.32)]:
    sn = math.sin(D(az))
    lock(az, 4, (sn * 0.3, 0.78, -0.4), L, 0.16, 0.06, (sn * 0.03, 0.08, 0.24), chainLR(az, 'back'), nseg=NS, nv=NV, lift=0.05, minr=1.03)
for sx in (-1, 1):
    lock(sx * 98, 28, (sx * 0.72, 0.6, 0.02), 0.3, 0.15, 0.06, (sx * 0.03, 0.06, 0.22), chainLR(sx * 98, 'back'), nseg=NS, nv=NV, lift=0.05, minr=1.04)
# flequillo partido corto: termina por encima de las cejas, con huecos para que se lean
for az, el, L, sw in [(-36, 52, 0.27, -0.3), (-18, 57, 0.22, -0.12), (0, 59, 0.2, 0.1), (17, 57, 0.22, 0.28), (35, 52, 0.27, 0.32)]:
    lock(az, el, (sw, -0.38, -0.88), L, 0.12, 0.045, (0.05 * (1 if sw > 0 else -1), -0.03, 0.05), 'hair.bang', nseg=9, nv=NV, lift=0.03, tips=(0.75, 0.93), minr=1.03)
# mechones laterales largos que enmarcan la cara (patillas)
for sx in (-1, 1):
    sd = 'L' if sx > 0 else 'R'
    lock(sx * 76, 16, (sx * 0.12, -0.15, -1), 0.44, 0.12, 0.045, (-sx * 0.05, -0.1, 0.1), ['hair.side.%s.1' % sd, 'hair.side.%s.2' % sd], nseg=NS, nv=NV, lift=0.04, tips=(0.65, 0.88), minr=1.04)
    lock(sx * 58, 30, (sx * 0.22, -0.22, -0.95), 0.34, 0.11, 0.045, (-sx * 0.04, -0.08, 0.08), ['hair.side.%s.1' % sd, 'hair.side.%s.2' % sd], nseg=NS, nv=NV, lift=0.04, tips=(0.7, 0.9), minr=1.04)
# nuca
for az in (160, 200):
    sn = math.sin(D(az))
    lock(az, -14, (sn * 0.3, 0.45, -0.85), 0.3, 0.14, 0.05, (0, 0.18, 0.16), 'hair.nape', nseg=9, nv=NV, lift=0.04)
# "ahoge" (pelo antena) sobre la cabeza
lock(0, 84, (0, -0.45, 0.9), 0.3, 0.06, 0.025, (0, 0.5, -0.2), 'hair.ahoge', nseg=12, nv=6, lift=0.02, tips=(0.6, 0.85), minr=1.0)

# ================================================================ TORSO, CUELLO ALTO, CINTURÓN
def torso_pt(h, a):
    z = lerp(0.84, 1.17, h)
    rx = lerp(0.2, 0.235, sstep(0, 0.6, h)) * (1 - 0.35 * sstep(0.75, 1.0, h))
    ry = lerp(0.155, 0.18, sstep(0, 0.6, h)) * (1 - 0.3 * sstep(0.75, 1.0, h))
    return Vector((math.sin(a) * rx, -math.cos(a) * ry, z))
bm = bmesh.new()
rows = [1 - i / 10 for i in range(11)]
lathe(bm, rows, 40, torso_pt, mat=lambda h, a: 'gold' if abs(a) < 0.16 else 'robe', cap_top=True)
add_part('torso', bm, w_auto(['hips', 'spine.01', 'spine.02', 'clavicle.L', 'clavicle.R']))

# cuello alto dorado con puntas de llama atrás
def collar_pt(h, a):
    z = lerp(1.1, 1.28, h)
    back = sstep(0.9, 2.2, abs(a))
    if h > 0.99: z += 0.07 * back * max(0.0, math.cos(4 * a)) ** 3 + 0.02 * back
    r = lerp(0.215, 0.175, h) * (1 + 0.15 * back * h)
    return Vector((math.sin(a) * r, -math.cos(a) * r * 0.92 + 0.01, z))
bm = bmesh.new()
lathe(bm, [1.0, 0.66, 0.33, 0.0], 40, collar_pt, mat='gold')
g = [f for f in bm.faces]; orient_radial(bm)
# interior (granate) para que se vea grueso desde arriba
inner = lathe(bm, [1.0, 0.0], 40, lambda h, a: collar_pt(h, a) * 1.0 - ring_dir(a) * 0.018 + Vector((0, 0, 0)) , mat='robe2')
orient_radial(bm, faces=[f for f in bm.faces if f.material_index == MI['robe2']], inward=True)
add_part('collar', bm, w_rigid('spine.02'))

# cinturón con gema
def belt_pt(h, a):
    z = lerp(0.79, 0.895, h); bulge = math.sin(math.pi * h)
    return Vector((math.sin(a) * (0.228 + 0.012 * bulge), -math.cos(a) * (0.212 + 0.012 * bulge), z))
bm = bmesh.new()
lathe(bm, [1.0, 0.75, 0.5, 0.25, 0.0], 40, belt_pt, mat='gold')
orient_radial(bm)
add_part('belt', bm, w_auto(['hips', 'spine.01'], power=3))
bm = bmesh.new()
gv = ellipsoid(bm, (0, -0.232, 0.842), (0.042, 0.022, 0.05), 'crystal', seg=8, rings=6)
add_part('belt_gem', bm, w_rigid('hips'), smooth=False)
# faja (dos cintas que cuelgan del cinturón)
for k, (x0, sw) in enumerate(((0.07, 0.06), (0.12, 0.1))):
    pts = [Vector((x0 + sw * t * 0.6 + 0.015 * math.sin(t * 7), -0.235 - 0.03 * math.sin(t * 3.0) - 0.04 * t, 0.83 - 0.36 * t - 0.06 * k * t)) for t in [i / 8 for i in range(9)]]
    bm = bmesh.new()
    vt = sweep(bm, pts, lambda t, a: (0.04 * (1 - 0.4 * t) + 0.012, 0.008), nv=6, normal_hint=(0, -1, 0), mat=lambda t, a: 'lining' if t < 0.85 else 'gold')
    add_part('sash', bm, {v: w_robe(v.co) for v in vt})

# ================================================================ TÚNICA con pliegues y vuelo
def robe_pt(h, a):
    r = 0.215 + 0.30 * h ** 1.35
    fold = 0.55 * math.sin(6 * a + 0.4) + 0.3 * math.sin(11 * a + 1.3) + 0.15 * math.sin(17 * a)
    r *= 1 + 0.075 * h ** 1.5 * fold
    hem = 0.075 + 0.05 * (1 + math.cos(a)) / 2 + 0.018 * math.sin(6 * a + 0.4 + math.pi / 2)
    z = lerp(0.865, hem, h)
    return Vector((math.sin(a) * r, -math.cos(a) * r, z))
SEG = 48
def robe_mat(h, a):
    if h > 0.93: return 'gold'
    if abs(a) < TAU / SEG * 1.01 and h > 0.12: return 'robe2'
    if abs(a) < TAU / SEG * 2.01 and h > 0.12: return 'gold'
    return 'robe'
bm = bmesh.new()
rows = [i / 22 for i in range(23)]
lathe(bm, rows, SEG, robe_pt, mat=robe_mat)
orient_radial(bm)
# borde interior (se ve el grosor del ruedo)
lathe(bm, [0.93, 1.0], SEG, lambda h, a: robe_pt(h, a) - ring_dir(a) * 0.03 * (h - 0.93) / 0.07 - ring_dir(a) * 0.004, mat='robe2')
orient_radial(bm, faces=[f for f in bm.faces if f.material_index == MI['robe2'] and f.calc_center_median().z < 0.2], inward=True)
add_part('robe', bm, w_robe)
# llamas bordadas sobre el ruedo (calcomanías pegadas a la superficie: llama de tres lenguas + núcleo amarillo)
FLAME_OUT = [(-0.9, 0.0), (-0.97, 0.2), (-0.88, 0.45), (-0.66, 0.74), (-0.56, 0.56), (-0.42, 0.42), (-0.27, 0.6), (-0.12, 0.82),
             (0.04, 1.0), (0.12, 0.8), (0.21, 0.6), (0.31, 0.45), (0.47, 0.56), (0.63, 0.72), (0.72, 0.5), (0.86, 0.3), (0.94, 0.12), (0.86, 0.0)]
def flame_decal(bm, surf, scale_u=1.0, scale_v=1.0, mat='flame', vshift=0.0):
    c = bm.verts.new(surf(0.0, 0.18 * scale_v + vshift))
    ring = [bm.verts.new(surf(u * scale_u, v * scale_v + vshift)) for u, v in FLAME_OUT]
    n = len(ring)
    for k in range(n):
        f = bm.faces.new((c, ring[k], ring[(k + 1) % n])); f.material_index = MI[mat]
bm = bmesh.new()
nfl = 10
for i in range(1, nfl):
    ac = i / nfl * TAU
    wa = 0.48; hh = 0.3 + 0.06 * (i % 2)
    def surf(u, v, ac=ac, wa=wa, hh=hh, off=0.007):
        a = ac + u * wa / 2
        h = 0.93 - v * hh / 0.79
        return robe_pt(h, a) + ring_dir(a) * off
    flame_decal(bm, surf)
    flame_decal(bm, lambda u, v, ac=ac, wa=wa, hh=hh: surf(u, v, ac, wa, hh, 0.011), 0.5, 0.55, 'flamecore')
orient_radial(bm)
add_part('hem_flames', bm, w_robe, smooth=False)

# ================================================================ CAPA (con grosor, forro naranja, borde de llamas)
bm = bmesh.new()
cols, rws = 21, 14
grid = []
for r in range(rws):
    row = []
    for c in range(cols):
        u = c / (cols - 1) * 2 - 1
        tend = 1.0 + 0.09 * max(0.0, math.cos(2.5 * math.pi * u)) ** 3 - 0.05 * abs(u) ** 2
        t = r / (rws - 1) * tend
        a = math.pi + u * D(78) * (1 - 0.1 * t)
        rad = 0.2 + 0.36 * t ** 1.1
        rad *= 1 + 0.07 * t * math.sin(7 * u * math.pi / 2 + 0.6)
        z = 1.14 - 1.04 * t
        p = Vector((math.sin(a) * rad, -math.cos(a) * rad + 0.04 + 0.05 * t, z))
        row.append(bm.verts.new(p))
    grid.append(row)
for r in range(rws - 1):
    for c in range(cols - 1):
        bm.faces.new((grid[r][c], grid[r + 1][c], grid[r + 1][c + 1], grid[r][c + 1]))
bm.normal_update(); orient_radial(bm)
res = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.022)
bm.normal_update()
for f in bm.faces:
    c = f.calc_center_median(); rad = Vector((c.x, c.y - 0.04, 0)).normalized()
    f.material_index = MI['robe2'] if f.normal.dot(rad) > -0.2 else MI['lining']
add_part('cape', bm, w_cape)

# hombreras: cúpula dorada + llama
for sx, sd in ((1, 'L'), (-1, 'R')):
    bm = bmesh.new()
    rot = Euler((0, sx * D(-28), 0)).to_quaternion()
    ellipsoid(bm, SH[sd] + Vector((sx * 0.0, 0.005, 0.03)), (0.125, 0.12, 0.075), 'gold', seg=18, rings=10, rot=rot)
    ellipsoid(bm, SH[sd] + Vector((sx * 0.01, 0.005, 0.0)), (0.14, 0.13, 0.05), 'robe2', seg=18, rings=8, rot=rot)
    pts = [SH[sd] + Vector((sx * 0.06, 0.04, 0.05)) + Vector((sx * 0.08 * t + 0.0, 0.08 * t, 0.17 * t - 0.05 * t * t)) for t in [i / 6 for i in range(7)]]
    sweep(bm, pts, lambda t, a: (0.05 * (1 - t) ** 0.8 + 0.004, 0.03 * (1 - t) + 0.003), nv=6, normal_hint=(0, -1, 0), tip=True, mat='flame')
    add_part('pauldron', bm, w_auto(['clavicle.' + sd, 'upperarm.' + sd, 'spine.02'], power=4))

# ================================================================ BRAZOS: mangas acampanadas, antebrazo, manos
for sx, sd in ((1, 'L'), (-1, 'R')):
    sh, el, wr = SH[sd], EL[sd], WR[sd]
    end = wr + (wr - el).normalized() * 0.02
    pts = [sh + (sh - el).normalized() * 0.03]
    for i in range(1, 6): pts.append(sh.lerp(el, i / 5))
    for i in range(1, 7): pts.append(el.lerp(end, i / 6))
    def sl_shape(t, a):
        r = 0.082 - 0.012 * sstep(0.0, 0.45, t) + 0.078 * sstep(0.5, 1.0, t) ** 1.6
        r *= 1 + 0.09 * sstep(0.6, 1.0, t) * math.sin(5 * a + 0.5)
        return r
    bm = bmesh.new()
    vt = sweep(bm, pts, sl_shape, nv=16, normal_hint=(0, -1, 0), cap1=False,
               mat=lambda t, a: 'gold' if t > 0.9 else 'robe')
    # interior oscuro de la manga (se ve la boca de la campana)
    vt2 = sweep(bm, pts[6:], lambda t, a: sl_shape(0.5 + 0.5 * t, a) - 0.012, nv=16, normal_hint=(0, -1, 0), cap0=False, cap1=False, mat='robe2')
    for f in bm.faces:
        if f.material_index == MI['robe2']: f.normal_flip()
    # borde que une exterior e interior
    outer_last = [v for v, t in vt.items() if t > 0.999]; inner_last = [v for v, t in vt2.items() if t > 0.999]
    bmesh.ops.bridge_loops(bm, edges=list({e for v in outer_last + inner_last for e in v.link_edges if all(x in outer_last or x in inner_last for x in e.verts)}))
    for f in bm.faces:
        if f.material_index == MI['robe'] and all(v in outer_last or v in inner_last for v in f.verts): f.material_index = MI['gold']
    add_part('sleeve', bm, w_auto(['spine.02', 'clavicle.' + sd, 'upperarm.' + sd, 'forearm.' + sd], power=5))
    bm = bmesh.new()
    sweep(bm, [el, wr + (wr - el).normalized() * 0.02], lambda t, a: 0.045 - 0.008 * t, nv=10, mat='dark')
    add_part('forearm', bm, w_auto(['upperarm.' + sd, 'forearm.' + sd, 'hand.' + sd], power=6))

# mano izquierda: palma + dedos tipo mitón ligeramente curvados + pulgar
def hand_open(sd, sx):
    wr, ht = WR[sd], HT[sd]
    Y = (ht - wr).normalized(); Zp = Vector((-sx, 0.15, 0)); Zp = (Zp - Y * Zp.dot(Y)).normalized(); X = Y.cross(Zp)
    P = wr + Y * 0.045
    bm = bmesh.new()
    rot = Matrix((X, Y, Zp)).transposed().to_quaternion()
    ellipsoid(bm, P, (0.056, 0.056, 0.032), 'skin', seg=14, rings=8, rot=rot)
    for i, off in enumerate((-0.03, -0.01, 0.01, 0.029)):
        st = P + Y * 0.035 + X * off
        L = 0.06 - 0.007 * abs(i - 1.5)
        pts = [st + Y * (L * s) + Zp * (0.03 * s * s) for s in (0, 0.35, 0.7, 1.0)]
        sweep(bm, pts, lambda t, a: 0.0165 * (1 - 0.25 * t), nv=7, normal_hint=Zp, mat='skin')
    st = P - X * 0.04 + Zp * 0.012
    pts = [st + (Y * 0.4 - X * 0.6 + Zp * 0.35).normalized() * (0.04 * s) for s in (0, 0.5, 1.0)]
    sweep(bm, pts, lambda t, a: 0.015 * (1 - 0.2 * t), nv=7, normal_hint=Zp, mat='skin')
    add_part('hand', bm, w_auto(['forearm.' + sd, 'hand.' + sd], power=8))
hand_open('L', 1)
# mano derecha: puño que agarra el báculo (dedos enroscados alrededor del eje)
bm = bmesh.new()
ellipsoid(bm, GRIP + Vector((-0.03, 0.012, 0.005)), (0.05, 0.05, 0.065), 'skin', seg=14, rings=8)
for i, dz in enumerate((-0.036, -0.012, 0.012, 0.036)):
    pts = []
    for k in range(7):
        a = D(-70 + 200 * k / 6)    # rodea el eje por delante (desde afuera hacia adentro)
        pts.append(GRIP + Vector((-math.cos(a) * 0.046, -math.sin(a) * 0.046, dz)))
    sweep(bm, pts, lambda t, a: 0.0135, nv=7, normal_hint=(0, 0, 1), mat='skin')
pts = [GRIP + Vector((-math.cos(D(a)) * 0.05, -math.sin(D(a)) * 0.05, 0.055)) for a in (200, 150, 100, 70)]
sweep(bm, pts, lambda t, a: 0.015 * (1 - 0.2 * t), nv=7, normal_hint=(0, 0, 1), mat='skin')
add_part('fist', bm, w_auto(['forearm.R', 'hand.R'], power=8))

# ================================================================ PIERNAS Y BOTAS
for sx, sd in ((1, 'L'), (-1, 'R')):
    hip = Vector((sx * 0.12, 0, 0.8)); knee = Vector((sx * 0.12, -0.01, 0.44)); ank = Vector((sx * 0.12, 0, 0.12))
    bm = bmesh.new()
    sweep(bm, [hip, hip.lerp(knee, 0.5), knee, knee.lerp(ank, 0.5), ank], lambda t, a: 0.075 - 0.012 * t, nv=10, mat='dark')
    add_part('leg', bm, w_auto(['hips', 'thigh.' + sd, 'shin.' + sd], power=5))
    bm = bmesh.new()
    # caña de la bota con puño doblado
    def boot_pt(h, a):
        z = lerp(0.37, 0.07, h)
        r = 0.082 - 0.008 * h + 0.022 * (1 - sstep(0.0, 0.25, h))
        return Vector((sx * 0.12 + math.sin(a) * r, -math.cos(a) * r * 1.05 + 0.005, z))
    lathe(bm, [i / 8 for i in range(9)], 18, boot_pt, mat=lambda h, a: 'gold' if h < 0.12 else 'boot', cap_top=True)
    orient_radial(bm, axis_xy=(sx * 0.12, 0))
    for f in bm.faces:
        if abs(f.normal.z) > 0.9 and f.calc_center_median().z > 0.35 and f.normal.z < 0: f.normal_flip()
    # pie con punta curvada hacia arriba
    pts = [Vector((sx * 0.12, 0.055, 0.055)), Vector((sx * 0.12, 0.0, 0.06)), Vector((sx * 0.122, -0.08, 0.058)),
           Vector((sx * 0.125, -0.16, 0.06)), Vector((sx * 0.127, -0.215, 0.085)), Vector((sx * 0.128, -0.235, 0.125))]
    sweep(bm, pts, lambda t, a: (0.068 * (1 - 0.55 * t ** 1.5), 0.058 * (1 - 0.6 * t ** 1.3)), nv=12, normal_hint=(0, 0, 1), tip=True, mat='boot')
    add_part('boot', bm, w_auto(['shin.' + sd, 'foot.' + sd], power=5))

# ================================================================ BÁCULO
bm = bmesh.new()
pts = [STAFF_BOT.lerp(STAFF_TOP, i / 12) + Vector((0.006 * math.sin(i * 1.7), 0.005 * math.cos(i * 1.3), 0)) for i in range(13)]
sweep(bm, pts, lambda t, a: 0.026 + 0.008 * t, nv=10, mat='wood')
for tz in (0.0, 0.3, 0.55, 0.97):
    c = STAFF_BOT.lerp(STAFF_TOP, tz)
    sweep(bm, [c - Vector((0, 0, 0.022)), c + Vector((0, 0, 0.022))], lambda t, a: 0.044 + 0.006 * math.sin(math.pi * t), nv=12, mat='gold')
sweep(bm, [STAFF_BOT - Vector((0, 0, 0.06)), STAFF_BOT + Vector((0, 0, 0.02))], lambda t, a: 0.012 + 0.03 * t, nv=10, mat='gold')
# garras doradas en forma de medialuna que abrazan el cristal
for k in range(3):
    phi = TAU * k / 3 + 0.3
    dr = Vector((math.cos(phi), math.sin(phi), 0))
    pts = []
    for i in range(10):
        t = i / 9
        r = 0.05 + 0.13 * math.sin(math.pi * min(1, t * 1.15)) - 0.02 * t
        pts.append(STAFF_TOP + dr * r + Vector((0, 0, 0.44 * t)) + dr.cross(Vector((0, 0, 1))) * 0.05 * t * t)
    sweep(bm, pts, lambda t, a: 0.024 * (1 - t) ** 0.8 + 0.004, nv=7, normal_hint=dr, tip=True, mat='gold')
add_part('staff', bm, w_rigid('staff'))
bm = bmesh.new()
# cristal facetado (bipirámide de 6 lados, sombreado plano)
top = bm.verts.new(CRYSTAL_C + Vector((0, 0, 0.24))); bot = bm.verts.new(CRYSTAL_C - Vector((0, 0, 0.16)))
mid = [bm.verts.new(CRYSTAL_C + Vector((math.cos(TAU * k / 6) * 0.105, math.sin(TAU * k / 6) * 0.105, 0.03))) for k in range(6)]
for k in range(6):
    f = bm.faces.new((mid[k], mid[(k + 1) % 6], top)); f.material_index = MI['crystal']
    f = bm.faces.new((mid[(k + 1) % 6], mid[k], bot)); f.material_index = MI['crystal']
bm.normal_update()
for f in bm.faces:
    if f.normal.dot(f.calc_center_median() - CRYSTAL_C) < 0: f.normal_flip()
add_part('crystal', bm, w_rigid('staff'), smooth=False)
# llama sobre el cristal (tres lenguas + núcleo) y brasas: cuelgan de staff.flame (parpadeo por escala)
bm = bmesh.new()
FB = CRYSTAL_C + Vector((0, 0, 0.16))
for k, (dx, dy, hgt, rr, m) in enumerate([(0, 0, 0.42, 0.085, 'flame'), (0.07, 0.02, 0.28, 0.055, 'flame'), (-0.06, -0.03, 0.3, 0.055, 'flame'), (0, -0.015, 0.26, 0.05, 'flamecore')]):
    pts = [FB + Vector((dx * t + 0.03 * math.sin(t * 5 + k) * t, dy * t, hgt * t)) for t in [i / 7 for i in range(8)]]
    sweep(bm, pts, lambda t, a, rr=rr: rr * math.sin(math.pi * min(1, 0.25 + t)) ** 0.8 * (1 - t) ** 0.4 + 0.003, nv=8, tip=True, mat=m)
for k in range(3):
    a = TAU * k / 3 + 0.9
    ellipsoid(bm, CRYSTAL_C + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.08 + 0.07 * k)), (0.022, 0.022, 0.04), 'flamecore', seg=4, rings=3)
add_part('flame', bm, w_rigid('staff.flame'), smooth=True)

# ================================================================ ARMADURA + unión
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object; arm.name = 'IgnisRig'; arm.data.name = 'IgnisRig'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones; eb.remove(eb[0])
for name, h, t, p in BONES:
    b = eb.new(name); b.head = h; b.tail = t; b.roll = 0
    if p: b.parent = eb[p]; b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.select_all(action='DESELECT')
for o in PARTS: o.select_set(True)
body = PARTS[0]; bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'Ignis'; body.data.name = 'Ignis'
# quitar ranuras de material vacías
used = {p.material_index for p in body.data.polygons}
body.parent = arm
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = arm

# ================================================================ POSES (cinemática directa propia)
pb = arm.pose.bones
for p in pb: p.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
ORDER = []
def _visit(n):
    if n in ORDER: return
    if PARENT[n]: _visit(PARENT[n])
    ORDER.append(n)
for b in arm.data.bones: _visit(b.name)
BLEN = {n: (t - h).length for n, h, t, p in BONES}

def Qw(p, y, r):
    """Rotación en ejes del mundo: pitch (+ = inclinar hacia adelante un hueso que apunta arriba), yaw (+ = girar hacia la izquierda del personaje), roll (+ = la punta de un hueso vertical va hacia +X)."""
    return Quaternion((0, 0, 1), D(y)) @ Quaternion((1, 0, 0), D(p)) @ Quaternion((0, 1, 0), D(r))
# Nota: el personaje mira a -Y; rotar +a alrededor de +X lleva +Z hacia -Y (adelante). En huesos que cuelgan
# (piernas, brazos) pitch + lleva la punta hacia atrás; en el pie, + baja la punta.
def R(p=0, y=0, r=0, l=None, s=None):
    d = {'r': (p, y, r)}
    if l is not None: d['l'] = l
    if s is not None: d['s'] = s
    return d
def AIM(x, y, z, **kw): d = {'aim': (x, y, z)}; d.update(kw); return d
def ABS(p=0, y=0, r=0): return {'abs': (p, y, r)}

def solve(state):
    posed = {}; out = {}
    for b in ORDER:
        par = PARENT[b]
        M0 = posed[par] @ (REST[par].inverted() @ REST[b]) if par else REST[b].copy()
        q0 = M0.to_3x3().normalized().to_quaternion()
        sp = state.get(b, {})
        qw = Quaternion()
        if 'aim' in sp:
            cur = q0 @ Vector((0, 1, 0)); qw = cur.rotation_difference(Vector(sp['aim']).normalized())
        if 'r' in sp: qw = Qw(*sp['r']) @ qw
        if 'abs' in sp:
            want = Qw(*sp['abs']) @ REST[b].to_quaternion(); ql = q0.inverted() @ want
        else:
            ql = q0.inverted() @ qw @ q0
        ql.normalize()
        loc = Vector((0, 0, 0))
        if 'l' in sp: loc = q0.inverted() @ Vector(sp['l'])
        sc = sp.get('s', 1.0); sc = Vector(sc) if isinstance(sc, (tuple, list)) else Vector((sc, sc, sc))
        posed[b] = M0 @ Matrix.Translation(loc) @ ql.to_matrix().to_4x4() @ Matrix.Diagonal(sc.to_4d())
        out[b] = (loc, ql, sc)
    return out, posed

SIM = {}
for n in REST:
    if n.startswith('hair.'): SIM[n] = dict(k=230, c=14, g=1.0, maxa=26 if n.endswith('.2') else 30)
    if n.startswith('cape.'): SIM[n] = dict(k=75, c=7.5, g=3.0, maxa=55, collide=True)
    if n.startswith('skirt.'): SIM[n] = dict(k=170, c=12, g=0.5, maxa=24)
SIM['hair.ahoge'] = dict(k=150, c=5.5, g=1.0, maxa=45)
SIM['hair.bang'] = dict(k=320, c=18, g=0.5, maxa=14)

def key_bones(frame, out, bones, prevq):
    for b in bones:
        loc, q, sc = out[b]
        p = pb[b]
        if b in prevq and prevq[b].dot(q) < 0: q = -q
        prevq[b] = q.copy()
        p.location = loc; p.rotation_quaternion = q; p.scale = sc
        p.keyframe_insert('location', frame=frame); p.keyframe_insert('rotation_quaternion', frame=frame); p.keyframe_insert('scale', frame=frame)

def robe_radius_at(z):
    h = clamp((0.865 - z) / 0.79); return 0.215 + 0.30 * h ** 1.35

def bake_secondary(act, L, cyclic, wind):
    """Resortes amortiguados sobre las cadenas de pelo/capa/falda (en espacio del mundo), horneados cuadro a cuadro."""
    chain = [b for b in ORDER if b in SIM]
    st = {}
    frames = list(range(1, L + 1))
    seq = frames * 3 if cyclic else [1] * 25 + frames
    rec = {}
    sub = 4; h = 1.0 / 30 / sub
    for idx, f in enumerate(seq):
        scene.frame_set(f)
        posed = {}
        for b in chain:
            par = PARENT[b]
            Pm = posed[par] if par in posed else (arm.matrix_world @ pb[par].matrix)
            M0 = Pm @ (REST[par].inverted() @ REST[b])
            q0 = M0.to_3x3().normalized().to_quaternion()
            H = M0.translation.copy()
            qk = pb[b].rotation_quaternion.normalized()
            Tdir = (q0 @ qk) @ Vector((0, 1, 0))
            Ln = BLEN[b]; T = H + Tdir * Ln
            prm = SIM[b]
            if b not in st: st[b] = [T.copy(), Vector((0, 0, 0))]
            X, V = st[b]
            ph = (f - 1) / L
            w = Vector(wind(ph)) if callable(wind) else Vector(wind)
            for _ in range(sub):
                acc = (T - X) * prm['k'] - V * prm['c'] + Vector((0, 0, -9.8 * prm['g'] * 0.1)) + w
                V = V + acc * h; X = X + V * h
                d = X - H
                if d.length < 1e-6: d = Tdir.copy()
                d.normalize()
                ang = d.angle(Tdir, 0)
                if ang > D(prm['maxa']):
                    d = Tdir.slerp(d, D(prm['maxa']) / ang) if hasattr(Tdir, 'slerp') else d
                    d = (Tdir * math.cos(D(prm['maxa'])) + (d - Tdir * d.dot(Tdir)).normalized() * math.sin(D(prm['maxa'])))
                if prm.get('collide'):
                    # no atravesar la túnica/espalda: en el marco de la cadera, mantener la punta fuera del cono de la túnica
                    hipM = arm.matrix_world @ pb['hips'].matrix @ REST['hips'].inverted()
                    Xl = hipM.inverted() @ (H + d * Ln)
                    rmin = robe_radius_at(Xl.z) + 0.05 if Xl.z < 0.86 else 0.24
                    rxy = math.hypot(Xl.x, Xl.y)
                    if rxy < rmin and Xl.y > -0.05:
                        s = rmin / max(rxy, 1e-4); Xl.x *= s; Xl.y *= s
                        d = ((hipM @ Xl) - H).normalized()
                X = H + d * Ln
            st[b] = [X, V]
            dl = q0.inverted() @ (X - H).normalized()
            ql = Vector((0, 1, 0)).rotation_difference(dl)
            posed[b] = M0 @ ql.to_matrix().to_4x4()
            if (cyclic and idx >= 2 * L) or (not cyclic and idx >= 25):
                rec.setdefault(f, {})[b] = ql.copy()
    # suavizado temporal (2 pasadas 1-2-1) para quitar tirones de un cuadro en golpes muy rápidos
    for _ in range(2):
        new = {}
        for i, f in enumerate(frames):
            fp = frames[i - 1] if (i > 0 or cyclic) else f
            fn = frames[(i + 1) % len(frames)] if (i < len(frames) - 1 or cyclic) else f
            new[f] = {}
            for b in chain:
                q0, q1, q2 = rec[fp][b], rec[f][b], rec[fn][b]
                a = q0.slerp(q2, 0.5); new[f][b] = q1.slerp(a, 0.5)
        rec = new
    # reemplazar las curvas de esas cadenas por el horneado
    for fc in list(act.fcurves):
        for b in chain:
            if fc.data_path == 'pose.bones["%s"].rotation_quaternion' % b: act.fcurves.remove(fc); break
    prev = {}
    for f in frames + ([L + 1] if cyclic else []):
        src = rec[1] if f == L + 1 else rec[f]
        for b in chain:
            q = src[b]
            if b in prev and prev[b].dot(q) < 0: q = -q
            prev[b] = q
            pb[b].rotation_quaternion = q; pb[b].keyframe_insert('rotation_quaternion', frame=f)

def action(name, L, keys, base, cyclic=True, wind=(0, 0, 0)):
    arm.animation_data_create()
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    state = {}
    for b in ORDER: state[b] = {}
    for b, v in base.items(): state[b] = dict(v)
    prevq = {}; interps = []
    first = None
    for i, k in enumerate(keys):
        f, spec = k[0], k[1]; opt = k[2] if len(k) > 2 else None
        for b, v in spec.items(): state[b] = dict(v)
        out, _ = solve(state)
        if i == 0:
            bones = ORDER; first = (out, dict((b, dict(v)) for b, v in state.items()))
        else:
            bones = set(spec.keys()) | {b for b in ORDER if ('aim' in state[b] or 'abs' in state[b])}
            bones = [b for b in ORDER if b in bones]
        key_bones(f, out, bones, prevq)
        if opt: interps.append((f, opt))
    if cyclic:
        key_bones(L + 1, first[0], ORDER, prevq)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'; kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            for f, opt in interps:
                if abs(kp.co.x - f) < 0.01:
                    kp.interpolation = opt[0]
                    if len(opt) > 1: kp.easing = opt[1]
        if cyclic:
            m = fc.modifiers.new('CYCLES')
        fc.update()
    bake_secondary(act, L, cyclic, wind)
    for fc in act.fcurves:
        for m in list(fc.modifiers): fc.modifiers.remove(m)
    act.use_fake_user = True
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 1, act); st.action_frame_start = 1; st.action_frame_end = L + 1 if cyclic else L
    arm.animation_data.action = None
    return act

# ---------------- pose base
STAND = {
    'hips': R(l=(0, 0, 0)), 'spine.01': R(2, 0, 0), 'spine.02': R(1, 0, 0), 'head': R(-2, 4, 2),
    'upperarm.L': R(-4, 0, 2), 'forearm.L': R(-16, 0, 0), 'hand.L': R(-8, 0, 0),
    'upperarm.R': R(-14, 0, 5), 'forearm.R': R(-30, 0, 0), 'hand.R': ABS(3, 0, -6),
    'staff.flame': R(s=(1, 1, 1)),
}
def legs(sd, th, sh, ft): return {'thigh.' + sd: R(th, 0, 0), 'shin.' + sd: R(sh, 0, 0), 'foot.' + sd: R(ft, 0, 0)}
def merge(*ds):
    o = {}
    for d in ds: o.update(d)
    return o
FL = lambda sx, sy, sz: {'staff.flame': R(s=(sx, sy, sz))}

# ---------------- IDLE: respiración, báculo que sube y baja, llama que titila, brisa en pelo/capa
idle_keys = [
    (1, merge(STAND, {'hips': R(l=(0, 0, 0))})),
    (37, {'hips': R(l=(0, 0, 0.012)), 'spine.02': R(-2, 0, 0), 'clavicle.L': R(0, 0, -3), 'clavicle.R': R(0, 0, 3),
          'head': R(0, -3, -1), 'upperarm.R': R(-17, 0, 5), 'forearm.R': R(-33, 0, 0), 'hand.R': ABS(1, 0, -4),
          'upperarm.L': R(-6, 0, 4), 'forearm.L': R(-19, 0, 0)}),
]
# parpadeo de la llama (cuadros irregulares)
for f, s in [(7, (0.92, 1.14, 0.92)), (13, (1.06, 0.9, 1.06)), (19, (0.95, 1.2, 0.95)), (26, (1.05, 0.94, 1.05)), (33, (0.9, 1.12, 0.9)),
             (44, (1.08, 0.98, 1.08)), (50, (0.93, 1.17, 0.93)), (57, (1.04, 0.9, 1.04)), (65, (0.95, 1.12, 0.95))]:
    idle_keys.append((f, FL(*s)))
idle_keys.sort(key=lambda k: k[0])
action('idle', 72, idle_keys, STAND, wind=lambda ph: (0.8 * math.sin(TAU * ph), 1.2 + 0.8 * math.sin(TAU * ph * 2 + 1), 0.3 * math.sin(TAU * ph * 3)))

# ---------------- RUN: inclinación, zancada, braceo, báculo en diagonal, capa al viento
def run_pose(side, phase):
    sx = 1 if side == 'L' else -1
    if phase == 'contact':
        d = merge(legs(side, -26, 12, -4), legs('R' if side == 'L' else 'L', 22, 44, -20),
                  {'hips': R(0, -8 * sx, 2 * sx, l=(0, 0, -0.035)), 'spine.01': R(13, 5 * sx, 0), 'spine.02': R(5, 6 * sx, -2 * sx), 'head': R(-15, -9 * sx, 1 * sx),
                   'skirt.F': R(-16, 0, 0), 'skirt.B': R(-4, 0, 0), 'skirt.L': R(-14 * sx, 0, 0), 'skirt.R': R(14 * sx, 0, 0),
                   'upperarm.L': R(24 * sx, 0, -4), 'forearm.L': R(-30 - 8 * (sx < 0), 0, 0), 'hand.L': R(-10, 0, 0),
                   'upperarm.R': R(-24 - 10 * sx, 0, 8), 'forearm.R': R(-42, 0, 0), 'hand.R': ABS(-34 - 4 * sx, 0, -14),
                   'cape.L.1': R(22, 0, 0), 'cape.R.1': R(22, 0, 0), 'cape.L.2': R(8, 0, 0), 'cape.R.2': R(8, 0, 0)})
    else:
        d = merge(legs(side, 4, 28, -8), legs('R' if side == 'L' else 'L', -8, 58, -18),
                  {'hips': R(0, 0, 0, l=(0, 0, 0.03)), 'spine.01': R(11, 0, 0), 'spine.02': R(4, 0, 0), 'head': R(-13, 0, 0),
                   'skirt.F': R(-8, 0, 0), 'skirt.B': R(2, 0, 0), 'skirt.L': R(0, 0, 0), 'skirt.R': R(0, 0, 0),
                   'upperarm.L': R(4, 0, -6), 'forearm.L': R(-26, 0, 0),
                   'upperarm.R': R(-24, 0, 8), 'forearm.R': R(-42, 0, 0), 'hand.R': ABS(-30, 0, -12),
                   'cape.L.1': R(28, 0, 0), 'cape.R.1': R(28, 0, 0), 'cape.L.2': R(12, 0, 0), 'cape.R.2': R(12, 0, 0)})
    return d
action('run', 20, [(1, merge(STAND, run_pose('L', 'contact'))), (6, run_pose('R', 'pass')), (11, run_pose('R', 'contact')), (16, run_pose('L', 'pass'))],
       STAND, wind=lambda ph: (0.0, 11.0 + 2.0 * math.sin(TAU * ph * 2), 1.5))

# ---------------- ATTACK: anticipación (báculo atrás), golpe rápido, sobrepaso y recuperación
A_UP = {'spine.01': R(-6, -24, 0), 'spine.02': R(-4, -10, 0), 'head': R(5, 20, 0), 'hips': R(0, -6, 0, l=(0, 0.02, -0.02)),
        'upperarm.R': AIM(-0.55, 0.35, 0.75), 'forearm.R': AIM(-0.25, 0.45, 0.86), 'hand.R': ABS(-62, 10, 25),
        'upperarm.L': AIM(0.55, -0.65, -0.35), 'forearm.L': R(-30, 0, 0), 'cape.L.1': R(-6, 0, 0), 'cape.R.1': R(-6, 0, 0),
        'staff.flame': R(s=(1.3, 1.5, 1.3))}
A_HIT = {'spine.01': R(15, 24, 0), 'spine.02': R(8, 10, 0), 'head': R(-12, -16, 0), 'hips': R(0, 6, 0, l=(0, -0.04, -0.045)),
         'upperarm.R': AIM(-0.15, -0.92, 0.12), 'forearm.R': AIM(0.0, -1.0, 0.14), 'hand.R': ABS(82, 0, 0),
         'upperarm.L': AIM(0.45, 0.45, -0.75), 'forearm.L': R(-20, 0, 0), 'staff.flame': R(s=(0.8, 1.8, 0.8)),
         'thigh.L': R(-14, 0, 0), 'shin.L': R(12, 0, 0), 'thigh.R': R(10, 0, 0), 'shin.R': R(14, 0, 0)}
A_OVER = {'spine.01': R(18, 28, 0), 'hand.R': ABS(96, 0, 0), 'upperarm.R': AIM(-0.12, -0.9, 0.0), 'staff.flame': R(s=(1.1, 1.3, 1.1))}
action('attack', 24, [(1, STAND), (5, merge(A_UP, {'staff.flame': R(s=(1.15, 1.3, 1.15))})), (8, merge(A_UP, {'hand.R': ABS(-68, 12, 28), 'spine.01': R(-8, -28, 0)}), ('SINE', 'EASE_IN')),
                      (11, A_HIT), (13, A_OVER),
                      (24, merge(STAND, {'thigh.L': R(0), 'shin.L': R(0), 'thigh.R': R(0), 'shin.R': R(0), 'foot.L': R(0), 'foot.R': R(0)}))], STAND, cyclic=False)

# ---------------- CAST: acumulación (agacharse, juntar las manos sobre el cristal, la llama crece), liberación
C_GATHER = merge(legs('L', -12, 24, -10), legs('R', -12, 24, -10), {
    'hips': R(0, 0, 0, l=(0, 0.03, -0.06)), 'spine.01': R(9, 0, 0), 'spine.02': R(6, 0, 0), 'head': R(-4, 0, 0),
    'upperarm.R': AIM(-0.75, -0.25, -0.05), 'forearm.R': AIM(-0.15, -0.3, 0.95), 'hand.R': ABS(4, 0, -8),
    'upperarm.L': AIM(0.25, -0.55, -0.45), 'forearm.L': AIM(-0.45, -0.6, 0.55), 'hand.L': R(-20, 0, 0),
    'staff.flame': R(s=(1.7, 2.0, 1.7)), 'cape.L.1': R(12, 0, 0), 'cape.R.1': R(12, 0, 0)})
C_REL = merge(legs('L', -26, 18, 0), legs('R', 16, 10, -8), {
    'hips': R(0, 0, 0, l=(0, -0.05, -0.025)), 'spine.01': R(18, 0, 0), 'spine.02': R(10, 0, 0), 'head': R(-15, 0, 0),
    'upperarm.R': AIM(-0.2, -0.95, 0.28), 'forearm.R': AIM(-0.05, -1.0, 0.32), 'hand.R': ABS(68, 0, 0),
    'upperarm.L': AIM(0.25, -0.95, 0.18), 'forearm.L': AIM(0.05, -1.0, 0.12), 'hand.L': R(-70, 0, 0),
    'staff.flame': R(s=(2.4, 2.9, 2.4)), 'cape.L.1': R(-10, 0, 0), 'cape.R.1': R(-10, 0, 0), 'skirt.F': R(-10, 0, 0)})
action('cast', 24, [(1, STAND), (8, C_GATHER),
                    (10, merge(C_GATHER, {'hips': R(0, 0, 1, l=(0.006, 0.03, -0.066)), 'staff.flame': R(s=(1.9, 2.3, 1.9))}), ('EXPO', 'EASE_IN')),
                    (13, C_REL), (16, merge(C_REL, {'staff.flame': R(s=(1.3, 1.6, 1.3)), 'spine.01': R(16, 0, 0)})),
                    (24, merge(STAND, legs('L', 0, 0, 0), legs('R', 0, 0, 0), {'hand.L': R(-8, 0, 0), 'skirt.F': R(0), 'cape.L.1': R(0), 'cape.R.1': R(0)}))],
       STAND, cyclic=False)

# ---------------- DEATH: retroceso, rodillas que ceden, caída de espaldas con rebote, el báculo cae y la llama se apaga
action('death', 40, [
    (1, merge(STAND, {'root': R(0, 0, 0, l=(0, 0, 0))})),
    (4, {'spine.01': R(-16, 0, 0), 'spine.02': R(-10, 0, 6), 'head': R(-26, 0, 12), 'hips': R(0, 0, 0, l=(0, 0.05, 0)),
         'upperarm.L': AIM(0.85, 0.15, -0.3), 'upperarm.R': AIM(-0.85, 0.2, -0.2), 'staff.flame': R(s=(0.8, 0.8, 0.8))}),
    (12, merge(legs('L', -32, 58, -10), legs('R', -28, 54, -10), {
        'hips': R(0, 0, 0, l=(0, 0.06, -0.2)), 'spine.01': R(20, 0, 0), 'spine.02': R(12, 0, 0), 'head': R(22, 0, 0),
        'upperarm.L': R(0, 0, 0), 'upperarm.R': R(-8, 0, 0), 'staff.flame': R(s=(0.6, 0.5, 0.6))})),
    (24, merge(legs('L', -30, 40, 10), legs('R', -18, 30, 10), {
        'root': R(-84, 0, 0, l=(0, 0.0, 0.24)), 'hips': R(0, 0, 0, l=(0, 0, 0)), 'spine.01': R(0, 0, 0), 'spine.02': R(0, 0, 0), 'head': R(-6, 18, 14),
        'upperarm.L': R(0, 0, -65), 'forearm.L': R(-20, 0, 0), 'upperarm.R': R(0, 0, 70), 'forearm.R': R(-15, 0, 0), 'staff': R(25, 0, 50),
        'staff.flame': R(s=(0.3, 0.2, 0.3))}), ('QUAD', 'EASE_IN')),
    (29, {'root': R(-77, 0, 0, l=(0, 0.0, 0.27)), 'head': R(-14, 18, 14)}),
    (34, {'root': R(-86, 0, 0, l=(0, 0.0, 0.235)), 'head': R(-4, 22, 16), 'staff.flame': R(s=(0.05, 0.05, 0.05))}),
    (40, {'root': R(-85, 0, 0, l=(0, 0.0, 0.24)), 'staff.flame': R(s=(0.01, 0.01, 0.01))}),
], STAND, cyclic=False)

# ---------------- RECALL: báculo plantado al frente con ambas manos, cabeza baja, energía que levanta pelo y capa
RC = merge({'hips': R(0, 0, 0, l=(0, 0, -0.02)), 'spine.01': R(3, 0, 0), 'spine.02': R(4, 0, 0), 'head': R(16, 0, 0),
            'upperarm.R': AIM(0.15, -0.6, -0.65), 'forearm.R': AIM(0.35, -0.85, 0.1), 'hand.R': ABS(0, 0, 0),
            'upperarm.L': AIM(-0.12, -0.6, -0.62), 'forearm.L': AIM(-0.42, -0.8, 0.2), 'hand.L': R(-30, 0, 0),
            'staff.flame': R(s=(1.3, 1.5, 1.3))})
action('recall', 60, [(1, merge(STAND, RC)), (31, {'hips': R(0, 0, 0, l=(0, 0, 0.015)), 'head': R(12, 0, 0), 'staff.flame': R(s=(1.6, 2.1, 1.6))})],
       STAND, wind=lambda ph: (0.5 * math.sin(TAU * ph), 0.5 * math.cos(TAU * ph), 9.0 + 4.0 * math.sin(TAU * ph)))

# ---------------- VICTORY (extra): báculo en alto, mano en la cintura, rebote alegre
VI = {'hips': R(0, 6, 0, l=(0, 0, 0)), 'spine.01': R(-4, 4, 3), 'spine.02': R(-4, 0, 0), 'head': R(-12, -6, -8),
      'upperarm.R': AIM(-0.32, -0.08, 0.95), 'forearm.R': AIM(-0.08, -0.06, 1.0), 'hand.R': ABS(-8, 0, 16),
      'upperarm.L': AIM(0.75, 0.18, -0.45), 'forearm.L': AIM(-0.65, -0.25, -0.2), 'hand.L': R(0, 0, 0),
      'staff.flame': R(s=(1.5, 1.8, 1.5))}
action('victory', 48, [(1, merge(STAND, VI)),
                       (9, merge(legs('L', -8, 16, -8), legs('R', -8, 16, -8), {'hips': R(0, 6, 0, l=(0, 0, -0.05)), 'hand.R': ABS(-6, 0, 22), 'staff.flame': R(s=(1.2, 1.4, 1.2))})),
                       (17, merge(legs('L', 0, 0, 0), legs('R', 0, 0, 0), {'hips': R(0, 4, 0, l=(0, 0, 0.06)), 'head': R(-16, -8, -10), 'hand.R': ABS(-12, 0, 10), 'staff.flame': R(s=(1.9, 2.5, 1.9))})),
                       (25, {'hips': R(0, 6, 0, l=(0, 0, 0)), 'head': R(-12, -6, -8), 'hand.R': ABS(-8, 0, 16), 'staff.flame': R(s=(1.5, 1.8, 1.5))}),
                       (37, {'head': R(-10, 4, -4), 'spine.01': R(-4, -2, 2)})],
       STAND, wind=lambda ph: (0.6 * math.sin(TAU * ph), 2.0, 0.5))

scene.frame_start = 1; scene.frame_end = 73
for b in pb: b.location = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.scale = (1, 1, 1)

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('IGNIS_TRIS', tris, 'VERTS', len(body.data.vertices), 'BONES', len(arm.data.bones), 'MATS_USED', sorted(MAT_NAMES[i] for i in used))
if OUT_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=False, export_draco_mesh_compression_enable=False,
                          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True,
                          export_materials='EXPORT', export_image_format='AUTO', export_vertex_color='NONE',
                          export_influence_nb=4)
print('EXPORTED', OUT_GLB)
