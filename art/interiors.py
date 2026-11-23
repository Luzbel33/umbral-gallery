"""Build the four walkable exhibitions with Cycles-baked lighting and a single texture per room."""

from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector

out = Path(__file__).resolve().parents[1] / "public" / "art"
rooms = (
    sys.argv[sys.argv.index("--") + 1 :]
    if "--" in sys.argv
    else ["frecuencia", "intervalos", "estratos", "orbital"]
)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.refresh_devices()
    for device in prefs.devices:
        device.use = device.type == "OPTIX"
    if any(d.use for d in prefs.devices):
        scene.cycles.device = "GPU"
except (AttributeError, TypeError, RuntimeError):
    pass


def material(name, color, metal=0, rough=0.6, grain=0, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emission:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emission
    if grain:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = grain
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*[c * 0.71 for c in color], 1)
        ramp.color_ramp.elements[1].color = (*[min(c * 1.17, 1) for c in color], 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs[0])
        nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    if name == "Smoked oak":
        coord = nt.nodes.new("ShaderNodeTexCoord")
        stretch = nt.nodes.new("ShaderNodeVectorMath")
        stretch.operation = "MULTIPLY"
        stretch.inputs[1].default_value = (0.8, 9, 13)
        nt.links.new(coord.outputs["Generated"], stretch.inputs[0])
        nt.links.new(stretch.outputs[0], noise.inputs["Vector"])
        noise.inputs["Scale"].default_value = 4.8
        noise.inputs["Distortion"].default_value = 2.8
        ramp.color_ramp.elements[0].color = (0.047, 0.018, 0.009, 1)
        ramp.color_ramp.elements[1].color = (0.39, 0.175, 0.072, 1)
    return m


def box(x, y, z, w, d, h, m, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    o = bpy.context.object
    o.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new("Edge", "BEVEL")
        b.width = bevel
        b.segments = 2
        bpy.ops.object.modifier_apply(modifier=b.name)
    return o


def cyl(x, y, z, r, d, m, wall=False):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64, radius=r, depth=d, location=(x, y, z)
    )
    o = bpy.context.object
    o.data.materials.append(m)
    if wall:
        o.rotation_euler.x = math.pi / 2
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return o


def light(pos, at, power, color, size, height=None):
    l = bpy.data.lights.new("Softbox", "AREA")
    l.energy = power
    l.color = color
    l.shape = "RECTANGLE"
    l.size = size
    l.size_y = height or size
    o = bpy.data.objects.new("Softbox", l)
    scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (Vector(at) - o.location).to_track_quat("-Z", "Y").to_euler()


def photo(name, pos, at, lens=24):
    c = bpy.data.cameras.new(name)
    o = bpy.data.objects.new(name, c)
    scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (Vector(at) - o.location).to_track_quat("-Z", "Y").to_euler()
    c.lens = lens
    scene.camera = o
    scene.render.resolution_x = 1344
    scene.render.resolution_y = 810
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 86
    scene.render.filepath = str(out / (name + ".webp"))
    bpy.ops.render.render(write_still=True)


def picture(x, y, z, w, h, file):
    m = material("Print", (0.85, 0.85, 0.85))
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(str(out / file), check_existing=True)
    m.node_tree.links.new(
        n.outputs["Color"],
        m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"],
    )
    bpy.ops.mesh.primitive_plane_add(
        size=1, location=(x, y, z), rotation=(math.pi / 2, 0, 0)
    )
    o = bpy.context.object
    o.scale = (w, h, 1)
    o.data.materials.append(m)
    return o


def bake(room):
    meshes = [o for o in list(scene.objects) if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = room
    # Keep print UVs explicit before adding the lighting atlas.
    if o.data.uv_layers:
        old = o.data.uv_layers.active.name
        for m in o.data.materials:
            for n in list(m.node_tree.nodes):
                if n.type == "TEX_IMAGE" and not n.inputs["Vector"].is_linked:
                    uv = m.node_tree.nodes.new("ShaderNodeUVMap")
                    uv.uv_map = old
                    m.node_tree.links.new(uv.outputs[0], n.inputs["Vector"])
    atlas = o.data.uv_layers.new(name="MuseumAtlas")
    o.data.uv_layers.active = atlas
    atlas.active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.1, island_margin=0.003, area_weight=0.8)
    bpy.ops.object.mode_set(mode="OBJECT")
    image = bpy.data.images.new(room + " light", width=1536, height=1536, alpha=False)
    for m in o.data.materials:
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = image
        m.node_tree.nodes.active = n
    scene.render.bake.margin = 4
    scene.cycles.samples = 18
    bpy.ops.object.bake(type="COMBINED")
    image.file_format = "JPEG"
    image.filepath_raw = str(out / (room + "-bake.jpg"))
    image.save()
    baked = bpy.data.materials.new("Baked light")
    baked.use_nodes = True
    nt = baked.node_tree
    nt.nodes.clear()
    surf = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image.filepath_raw)
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], surf.inputs["Surface"])
    for p in o.data.polygons:
        p.material_index = 0
    o.data.materials.clear()
    o.data.materials.append(baked)
    for layer in list(o.data.uv_layers):
        if layer.name != "MuseumAtlas":
            o.data.uv_layers.remove(layer)
    bpy.ops.export_scene.gltf(
        filepath=str(out / ("room-" + room + ".glb")),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
        export_image_format="JPEG",
        export_jpeg_quality=82,
    )
    Path(image.filepath_raw).unlink()


for room in rooms:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene.cycles.samples = 24
    scene.world.color = (0.10, 0.11, 0.13)
    dark = material("Graphite", (0.040, 0.045, 0.052), 0.12, 0.48, 62)
    chalk = material("Limestone", (0.66, 0.58, 0.48), 0.02, 0.76, 48)
    oak = material("Smoked oak", (0.24, 0.105, 0.046), 0.08, 0.48, 81)
    brass = material("Brass", (0.61, 0.32, 0.12), 0.48, 0.32)
    warm = material("Warm light", (1, 0.55, 0.23), emission=3.8)
    cool = material("Opal", (0.68, 0.81, 1), emission=1.8)
    floor = material(
        "Terrazzo",
        (0.20, 0.18, 0.155) if room != "frecuencia" else (0.055, 0.062, 0.086),
        0.09,
        0.35,
        154,
    )
    wall = material(
        "Plaster",
        {
            "frecuencia": (0.085, 0.11, 0.155),
            "intervalos": (0.095, 0.052, 0.048),
            "estratos": (0.62, 0.58, 0.53),
            "orbital": (0.48, 0.39, 0.31),
        }[room],
        0,
        0.78,
        69,
    )
    box(0, 0, -0.15, 16.6, 18.7, 0.3, floor)
    box(0, 9.08, 3, 16.5, 0.3, 6, wall)
    box(0, -9.08, 3, 16.5, 0.3, 6, wall)
    for x in [-8.13, 8.13]:
        box(x, 0, 3, 0.26, 18.4, 6, wall)
        box(x * 0.981, 0, 0.08, 0.075, 18, 0.16, dark)
    box(
        0,
        0,
        6.14,
        16.6,
        18.7,
        0.28,
        dark if room in ["frecuencia", "intervalos"] else chalk,
    )
    light((0, -5, 4.6), (0, 4, 1.8), 850, (0.83, 0.86, 1), 6)
    light((-5.7, 4.7, 5.3), (0, 1, 0.3), 1450, (1, 0.71, 0.44), 3.5)
    if room == "frecuencia":
        # An actual listening desk and stereo pair occupy the stage; the back wall is an acoustic shell.
        felt = material("Indigo felt", (0.055, 0.081, 0.15), 0, 0.85, 94)
        for i in range(27):
            x = (i - 13) * 0.49
            depth = 0.32 + 0.52 * (0.5 + 0.5 * math.cos(i * 0.58))
            box(x, 8.72 - depth / 2, 3, 0.43, depth, 5.58, felt, 0.048)
        box(0, 4.9, 0.62, 3.7, 1.32, 1.18, oak, 0.06)
        box(0, 4.9, 1.25, 3.85, 1.46, 0.13, chalk, 0.03)
        box(-0.20, 4.87, 1.39, 1.63, 1.04, 0.15, dark, 0.04)
        cyl(-0.34, 4.88, 1.493, 0.45, 0.07, brass)
        cyl(-0.34, 4.88, 1.535, 0.431, 0.022, dark)
        cyl(-0.34, 4.88, 1.55, 0.14, 0.015, brass)
        arm = box(0.40, 4.86, 1.57, 0.034, 0.61, 0.04, brass, 0.01)
        arm.rotation_euler.z = -0.35
        # Open record shelves, paper spines and a front-loading integrated amplifier.
        sleeve = [
            material("Slate paper", (0.055, 0.08, 0.11)),
            material("Bone paper", (0.64, 0.54, 0.4)),
            material("Oxide paper", (0.28, 0.073, 0.042)),
            material("Ochre paper", (0.44, 0.29, 0.11)),
        ]
        box(0, 4.20, 0.68, 3.50, 0.09, 0.90, dark, 0.025)
        for x in [-1.71, -0.47, 0.72, 1.71]:
            box(x, 4.10, 0.69, 0.085, 0.21, 0.90, oak, 0.015)
        box(0, 4.10, 0.23, 3.47, 0.23, 0.085, oak, 0.015)
        box(0, 4.12, 1.12, 3.47, 0.19, 0.065, oak, 0.015)
        for i in range(34):
            x = -1.62 + i * 0.029
            o = box(
                x,
                4.09,
                0.54 + 0.015 * math.sin(i * 2),
                0.021,
                0.17,
                0.54 + (0.04 * math.cos(i * 4)),
                sleeve[(i * 7 + i // 4) % 4],
                0.003,
            )
            o.rotation_euler.y = 0.04 * math.cos(i * 0.26)
        box(0.10, 4.06, 0.53, 0.98, 0.18, 0.28, dark, 0.016)
        for x in [-0.26, 0.46]:
            cyl(x, 3.945, 0.54, 0.056, 0.04, brass, True)
        box(0.1, 3.958, 0.59, 0.35, 0.012, 0.04, cool)
        for i in range(17):
            box(
                0.90 + i * 0.043,
                4.09,
                0.54,
                0.027,
                0.16,
                0.53,
                sleeve[(i + i // 5) % 4],
                0.005,
            )
        for i in range(3):
            cyl(0.54, 4.54 + i * 0.11, 1.496, 0.041, 0.02, brass)
        for x in [-1.4, 1.4]:
            box(x, 4.9, 0.076, 0.28, 1.10, 0.152, dark, 0.016)
        for x in [-3.38, 3.38]:
            box(x, 5.05, 1.28, 0.98, 0.83, 2.53, oak, 0.05)
            box(x, 4.615, 1.28, 0.89, 0.07, 2.41, dark, 0.022)
            for z, r in [(0.69, 0.345), (1.51, 0.265), (2.08, 0.114)]:
                cyl(x, 4.56, z, r, 0.058, brass, True)
                cyl(x, 4.517, z, r * 0.91, 0.07, dark, True)
                cyl(x, 4.469, z, r * 0.30, 0.081, felt, True)
        # A recessed mixing rail and stepped diffusers frame the listening desk.
        for x in [-5.95, 5.95]:
            box(x, 4.8, 0.35, 1.10, 2.8, 0.58, oak, 0.085)
            box(x, 4.8, 0.66, 1.09, 2.68, 0.12, felt, 0.055)
        for i in range(8):
            x = (i - 3.5) * 1.74
            box(x, 1, 5.78, 1.21, 12, 0.22, felt, 0.07)
        for x in [-6.6, 6.6]:
            box(x, 7.9, 3, 0.065, 0.07, 4.65, warm)
            light((x, 6.8, 3), (x * 0.65, 8, 3), 590, (0.38, 0.57, 1), 1.4, 4)
        light((1.8, 2, 4.6), (0, 4.7, 1), 650, (1, 0.79, 0.54), 2.1)
        photo("cover-frecuencia", (3.9, -2.4, 2.02), (0, 4.9, 1.57), 29)
    elif room == "intervalos":
        velvet = material("Oxblood velvet", (0.31, 0.045, 0.036), 0, 0.89, 78)
        for x in [-7.65, 7.65]:
            for i in range(34):
                y = (i - 16.5) * 0.51
                o = box(x, y, 3, 0.24, 0.45, 5.7, velvet, 0.09)
                o.rotation_euler.z = 0.22 * math.sin(i * 1.5)
            box(x * 0.99, 0, 0.16, 0.06, 16, 0.05, warm)
        box(0, 8.55, 3, 10.05, 0.22, 4.40, dark, 0.07)
        picture(0, 8.415, 3, 6.06, 4.04, "intervalos.webp")
        for x in [-4.4, 4.4]:
            for y in [-0.7, -3.5]:
                for shift in [-0.78, 0.78]:
                    seat = x + shift
                    box(seat, y, 0.19, 1.22, 0.75, 0.38, dark, 0.09)
                    box(seat, y, 0.49, 1.26, 1.06, 0.27, velvet, 0.12)
                    back = box(seat, y - 0.51, 0.91, 1.28, 0.27, 1.14, velvet, 0.13)
                    back.rotation_euler.x = -0.10
                    for side in [-0.68, 0.68]:
                        box(seat + side, y - 0.02, 0.67, 0.12, 0.91, 0.19, oak, 0.05)
        for y in [-5.8, -3, -0.2, 2.6, 5.4]:
            for x in [-7.3, 7.3]:
                box(x, y, 1.02, 0.17, 0.38, 0.22, brass, 0.025)
                box(x * 0.987, y, 0.99, 0.022, 0.29, 0.09, warm, 0.012)
        light((0, 7, 3.3), (0, -1, 1.1), 1800, (1, 0.34, 0.12), 6, 3)
        photo("cover-intervalos", (2.25, -6.3, 1.7), (-0.15, 7.4, 2.7), 22)
    elif room == "estratos":
        # Flush framed prints face a single uninterrupted, level aisle.
        ash = material("Oiled ash", (0.31, 0.21, 0.13), 0.04, 0.44, 47)
        for x in [-6.52, 6.52]:
            box(x, 0.05, 5.83, 0.29, 17.90, 0.34, chalk, 0.024)
        for y in [-4.85, -1.65, 1.55, 4.75]:
            box(7.91, y, 3.37, 0.09, 2.88, 3.95, brass, 0.04)
            box(7.85, y, 3.37, 0.045, 2.75, 3.84, cool, 0.026)
            for j in range(6):
                box(7.79, y - 1.27 + j * 0.51, 3.37, 0.095, 0.035, 3.82, ash, 0.008)
        for x in [-5.9, -2.9]:
            box(x, -3.75, 0.255, 0.22, 1.00, 0.51, dark, 0.025)
        box(-4.4, -3.75, 0.57, 3.65, 1.02, 0.16, ash, 0.075)
        light((6.7, 1.8, 4.8), (-1.4, 3.6, 1.4), 680, (1, 0.85, 0.67), 2.5, 2.1)
        images = [
            "earth-parana_delta_0.webp",
            "earth-sabotage.webp",
            "earth-andes_0.webp",
        ]
        for i, x in enumerate([-4.86, 0, 4.86]):
            y = 8.74
            box(x, y, 2.63, 3.58, 0.12, 3.38, dark, 0.027)
            box(x, y - 0.075, 2.63, 3.47, 0.04, 3.27, chalk)
            img = bpy.data.images.load(str(out / images[i]), check_existing=True)
            ratio = img.size[0] / img.size[1]
            pw = min(3.22, 3.02 * ratio)
            picture(x, y - 0.103, 2.63, pw, pw / ratio, images[i])
            light((x, 6.2, 4.65), (x, 8.65, 2.63), 155, (1, 0.91, 0.78), 1.3)
        photo("cover-estratos", (-2.35, -2.6, 1.83), (0.50, 7.25, 2.62), 24)
    else:
        for i in range(6):
            x = -6.7 + i * 2.68
            box(x, 3.1, 5.78, 0.34, 11, 0.42, chalk, 0.026)
        for x in [-6.1, 6.1]:
            box(x, 8.7, 3, 0.075, 0.12, 5.44, warm)
        box(0, 1, 0.23, 3.9, 2.75, 0.46, chalk, 0.045)
        light((5, 2.6, 5.5), (0, 1, 0.4), 2700, (1, 0.87, 0.66), 2.6)
    box(0, -8.86, 1.42, 1.92, 0.09, 2.84, oak, 0.025)
    box(0, -8.79, 1.40, 1.72, 0.055, 2.69, dark, 0.018)
    box(0.62, -8.72, 1.12, 0.24, 0.085, 0.038, brass, 0.01)
    for x in [-2.9, 2.9]:
        box(x, -1, 5.96, 0.075, 12, 0.055, warm if room != "estratos" else cool)
    bake(room)
