"""Render de comparación con sombreado toon (Cycles + Toon BSDF + líneas Freestyle).
Uso: blender -b <ignis.blend> -P tools/blender/render_toon.py -- <carpeta_salida> [accion:cuadro ...]"""
import bpy, math, sys, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]; extra = argv[1:]
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.render.resolution_x = 900; sc.render.resolution_y = 1100; sc.render.film_transparent = False
sc.view_settings.view_transform = 'Standard'
# materiales toon: 2 escalones de luz + emisión para el cristal
for m in bpy.data.materials:
    nt = m.node_tree; ns = nt.nodes
    bsdf = ns.get('Principled BSDF')
    col = bsdf.inputs['Base Color'].default_value[:]
    em = bsdf.inputs['Emission Strength'].default_value
    for n in list(ns):
        if n.type != 'OUTPUT_MATERIAL': ns.remove(n)
    out = [n for n in ns if n.type == 'OUTPUT_MATERIAL'][0]
    toon = ns.new('ShaderNodeBsdfToon'); toon.inputs['Color'].default_value = col; toon.inputs['Size'].default_value = 0.75; toon.inputs['Smooth'].default_value = 0.02
    emis = ns.new('ShaderNodeEmission'); emis.inputs['Color'].default_value = col; emis.inputs['Strength'].default_value = 0.12 + em * 0.5
    add = ns.new('ShaderNodeAddShader')
    nt.links.new(toon.outputs[0], add.inputs[0]); nt.links.new(emis.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs[0])
# mundo y luz
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.72, 0.95, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(10), math.radians(-35)))
bpy.context.object.data.energy = 3.2; bpy.context.object.data.angle = 0.02
# suelo con degradé suave
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1.4, fill_type='NGON', location=(0, 0, 0.001))
g = bpy.context.object; gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.55, 0.85, 1); g.data.materials.append(gm)
# contorno anime
sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 2.2
fs = sc.view_layers[0].freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ls')
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new('anime')
ls.linestyle.color = (0.12, 0.04, 0.04)
ls.select_by_visibility = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False
# cámara
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.75
def shoot(name, az, el=8, target=(0, 0, 1.2)):
    a = math.radians(az); e = math.radians(el); d = 8
    pos = Vector((math.sin(a) * math.cos(e) * d, -math.cos(a) * math.cos(e) * d, target[2] + math.sin(e) * d))
    cam.location = pos
    cam.rotation_euler = (Vector(target) - pos).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name); bpy.ops.render.render(write_still=True)
arm = bpy.data.objects['IgnisRig']
def set_action(nm, frame):
    for t in arm.animation_data.nla_tracks: t.mute = t.name != nm
    sc.frame_set(frame)
set_action('idle', 1)
shoot('ignis-blender-front.png', 0)
shoot('ignis-blender-34.png', 35, 10)
for e in extra:
    nm, fr = e.split(':'); set_action(nm, int(fr)); shoot('pose-%s-%s.png' % (nm, fr), 35, 10)
