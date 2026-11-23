"""Render the original Umbral exhibitions with Blender in background mode."""
import bpy
import math
import os
import sys
from mathutils import Vector
from math import sin, cos, pi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "art"))
os.makedirs(ROOT, exist_ok=True)
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
except Exception:
    pass
scene.world.color = (.13, .13, .14)
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 89

def mat(name, color, metal=0, rough=.5, texture=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    n=m.node_tree.nodes
    b=n.get("Principled BSDF")
    b.inputs["Base Color"].default_value=(*color,1)
    b.inputs["Roughness"].default_value=rough
    b.inputs["Metallic"].default_value=metal
    if texture:
        noise=n.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value=115
        noise.inputs["Detail"].default_value=3.5
        bump=n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value=.23
        bump.inputs["Distance"].default_value=.016
        m.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
        m.node_tree.links.new(bump.outputs["Normal"],b.inputs["Normal"])
    return m

def box(name, pos, dims, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object
    o.name=name
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new("Rounded edges","BEVEL")
        mod.width=bevel
        mod.segments=3
        o.modifiers.new("Normals","WEIGHTED_NORMAL")
    return o

def aim(o, target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat("-Z","Y").to_euler()

def area(name, pos, target, energy, color, size, height=None):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=energy
    data.color=color
    data.shape="RECTANGLE"
    data.size=size
    data.size_y=height or size
    o=bpy.data.objects.new(name,data)
    scene.collection.objects.link(o)
    o.location=pos
    aim(o,target)

def ribbon(name, kind, material, position, radius=2):
    verts=[]; faces=[]
    steps=360; sides=32
    for i in range(steps):
        a=2*pi*i/steps
        for j in range(sides):
            b=2*pi*j/sides
            if kind=="orbit":
                # A folded annulus, pinched into three glinting crests.
                ring=radius*(1+.15*cos(3*a+.4))
                twist=1.5*a+.4
                l=.68*cos(b); h=.23*sin(b)
                r=ring+l*cos(twist)-h*sin(twist)
                v=(r*cos(a), .60*sin(2*a+.5)+l*sin(twist)+h*cos(twist), r*sin(a))
            elif kind=="echo":
                r=1.50+.52*cos(3*a)+.33*cos(b)
                v=(r*cos(2*a),r*sin(2*a),.84*sin(3*a)+.33*sin(b))
            else:
                r=radius+.16*sin(11*a+.6)+.48*cos(b)
                v=(r*cos(a),.50*sin(4*a)+.25*sin(b),r*sin(a))
            verts.append(v)
            ix=i*sides+j
            offset=sides//2 if kind=="orbit" and i==steps-1 else 0
            next_ring=((i+1)%steps)*sides
            faces.append((ix,next_ring+(j+offset)%sides,next_ring+(j+offset+1)%sides,i*sides+(j+1)%sides))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=position
    o.data.materials.append(material)
    for f in mesh.polygons:f.use_smooth=True
    return o

def shoot(slug, pos, target, lens, size):
    cam=bpy.data.cameras.new(slug)
    o=bpy.data.objects.new(slug,cam);scene.collection.objects.link(o);o.location=pos
    aim(o,target);scene.camera=o;cam.lens=lens
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.resolution_percentage=100
    scene.render.filepath=os.path.join(ROOT,slug+".webp")
    bpy.ops.render.render(write_still=True)

def build(kind):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    concrete=mat("Piedra cálida",(.19,.16,.135),0,.66,True)
    dark=mat("Basalto",(.058,.048,.044),.19,.27,True)
    slat=mat("Roble ahumado",(.22,.138,.083),.12,.38,True)
    bronze=mat("Bronce satinado",(.62,.32,.125),.87,.245,True)
    ivory=mat("Caliza",(.52,.43,.34),.06,.48,True)
    if kind=="orbital":
        box("Pavimento", (0,0,-.25),(36,29,.5),dark)
        for i in range(-3,4):
            box("Muro encofrado",(i*3.05,5.9,4),(3.03,.46,8),concrete,.018)
        for i in range(45):
            box("Lamas verticales",(5.95+i*.105,5.50,4),(.055,.38,8),slat,.008)
        for i in range(5):
            box("Contrafuerte",(8.3,-7+i*3,4),(.65,.48,8),concrete,.025)
        box("Banco",(-4,2.7,.60),(3.8,1,.16),slat,.045)
        for x in (-5.4,-2.6):box("Pata",(x,2.7,.29),(.14,.76,.58),dark)
        box("Peana",(2,.2,.24),(5.95,3.05,.48),ivory,.035)
        sculpture=ribbon("Materia orbital","orbit",bronze,(2,.2,2.77))
        sculpture.rotation_euler[1]=-.18
        sculpture.rotation_euler[2]=-.23
        area("Tragaluz", (4,-1,8),(2,1,1),1650,(1,.85,.65),5,3)
        area("Ventanal", (8,-4,4),(1,2,2),2200,(1,.85,.65),3,6)
        area("Contraluz", (-3,3,5),(2,0,2),1150,(.78,.85,1),2,5)
        area("Panel",(-1,-7,5),(2,.2,3),740,(1,.89,.8),7,4)
        sun=bpy.data.lights.new("Luz rasante","SUN");sun.energy=3.3;sun.angle=.035;sun.color=(1,.76,.52)
        o=bpy.data.objects.new("Luz rasante",sun);scene.collection.objects.link(o)
        o.location=(12,-4,9);aim(o,(0,3,0))
        shoot("orbital-wide",(-6.9,-15,3.45),(-.25,.8,2.55),40,(1720,780))
        shoot("orbital",(6.8,-10,3.05),(1.8,.2,2.65),49,(900,610))
    elif kind=="echo":
        blue=mat("Ultramar",(.036,.065,.52),.75,.22,True)
        stage=mat("Ciclorama azul",(.045,.074,.28),.18,.44)
        box("Suelo",(0,0,-2.0),(30,28,.35),stage)
        box("Fondo",(0,6,4),(35,.5,15),stage)
        sculpt=ribbon("Frecuencia azul","echo",blue,(0,0,.30))
        sculpt.rotation_euler=(1.0,.29,.45)
        area("Seda azul",(-4,-3,4),(0,0,0),950,(.36,.56,1),4,6)
        area("Reflejo frío",(3,2,4),(0,0,0),1650,(.66,.85,1),4,1)
        area("Luz frontal",(.4,-4,.5),(0,0,0),350,(.50,.60,1),3,1)
        shoot("frecuencia",(2.7,-8,2),(0,0,.23),53,(960,640))
    elif kind=="red":
        red=mat("Óxido",(.47,.062,.021),.38,.43,True)
        floor=mat("Arcilla",(.24,.035,.012),.20,.32,True)
        box("Suelo",(0,0,-.3),(35,55,.5),floor)
        for i in range(19):
            x=-1+.18*i
            angle=.075*i-.30
            for sign in (-1,1):
                o=box("Portal",(x+sign*2.4*cos(angle),-2+i*1.18,3.5-sign*2.4*sin(angle)),(.22,.48,8),red,.07);o.rotation_euler[1]=angle
            o=box("Dintel",(x+3.8*sin(angle),-2+i*1.18,3.5+3.8*cos(angle)),(5,.48,.25),red,.06);o.rotation_euler[1]=angle
        area("Luz naranja",(-4,0,6),(1,5,2),3400,(1,.47,.18),4)
        area("Fondo",(2,19,6),(1,9,3),4500,(1,.48,.18),5)
        area("Rebote",(4,-5,3),(0,2,3),1000,(1,.62,.48),3)
        shoot("intervalos",(2,-6.5,2.1),(-.1,6,3.1),26,(960,640))
    else:
        paper=mat("Travertino",(.59,.43,.25),.08,.55,True)
        for i in range(62):
            shift=.13*i
            o=box("Estrato",(shift-4.5,.34*i, .7*sin(i*.17)),(10,.22,4.5+.8*sin(i*.13)),paper,.13)
            o.rotation_euler[1]=.26+.30*sin(i*.10)
        area("Sol",(-5,1,8),(1,8,1),3200,(1,.80,.54),3)
        area("Rebote",(5,3,6),(0,10,0),1200,(.9,.87,.8),4)
        shoot("estratos",(7,-3.4,4),(0,5,1.9),37,(900,610))
for item in (sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["orbital","echo","red","strata"]):
    build(item)
