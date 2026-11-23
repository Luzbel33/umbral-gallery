"""Render the indoor sound-and-sculpture atrium shown on the courtyard page."""
import math
import os
import runpy
import sys

import bpy
from mathutils import Vector

sys.argv = ["blender", "--"]
base = runpy.run_path(os.path.join(os.path.dirname(__file__), "render.py"))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
mat, box, area, shoot = (base[name] for name in ("mat", "box", "area", "shoot"))
scene = bpy.context.scene
scene.world.color = (.09, .11, .15)
scene.cycles.samples = 32
stone = mat("Verde antico", (.055, .09, .087), .18, .37, True)
basalt = mat("Basalto apomazado", (.105, .108, .10), .23, .29, True)
bronze = mat("Latón cepillado", (.68, .33, .105), .77, .23)
nickel = mat("Champán", (.82, .66, .41), .79, .21)
velvet = mat("Tapizado azafrán", (.34, .115, .047), .03, .76, True)
water = mat("Lámina de agua", (.025, .065, .073), .78, .095)
def luminous(name, color, strength):
    material = mat(name, color, .06, .33)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = strength
    return material
light = luminous("Luz ámbar", (1, .50, .20), 3.5)
opal = luminous("Alabastro", (1, .73, .44), 1.85)

def disc(name, x, y, z, radius, depth, material, wall=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=depth, location=(x,y,z))
    obj=bpy.context.object
    obj.name=name
    if wall: obj.rotation_euler.x=math.pi/2
    obj.data.materials.append(material)
    bevel=obj.modifiers.new("Bisel", "BEVEL")
    bevel.width=min(.045,depth/3)
    bevel.segments=3
    return obj

box("Solado",(0,0,-.12),(18,19,.24),basalt)
box("Testero",(0,8.8,4.1),(17.4,.4,8.2),stone)
box("Cubierta",(0,0,8.1),(17.4,19,.25),stone)
for side in [-1,1]:
    box("Lateral",(side*8.1,0,4.1),(.3,19,8.2),stone)
    for i in range(25):
        y=-7.9+i*.65
        box("Costilla",(side*7.8,y,4),(.42,.13,8),bronze,.025)
        if i%4==0: box("Luz de jamba",(side*7.56,y,3.7),(.028,.055,6.8),light)
    for i in range(18):
        x=side*(3.8+i*.22)
        box("Acanalado",(x,8.46,4),(.09,.16,8),basalt,.025)
for i in range(12):
    y=-7+i*1.34
    box("Viga alta",(0,y,7.8),(16,.13,.35),basalt)
    box("Luz de techo",(0,y,7.6),(12,.05,.035),light)
disc("Halo posterior",0,8.46,3.85,3.28,.14,bronze,True)
disc("Disco de alabastro",0,8.34,3.85,3.11,.13,opal,True)
disc("Borde del estanque",0,.45,.14,3.05,.28,bronze)
disc("Agua",0,.45,.291,2.94,.035,water)
for x,y in [(-4.8,-1.0),(4.8,-1.0),(-4.8,3.4),(4.8,3.4)]:
    box("Base de banco",(x,y,.28),(1.05,2.6,.48),basalt,.10)
    box("Asiento",(x,y,.59),(1.05,2.65,.22),velvet,.10)
for i in range(120):
    a=math.tau*i/120
    x=2.05*math.cos(a)
    z=3.23+1.58*math.sin(a)+.28*math.sin(2*a)
    y=.45+.79*math.sin(2*a+.35)
    obj=box("Lámina %03d"%i,(x,y,z),(.057,.53,.62),nickel if i%6<2 else bronze,.017)
    obj.rotation_euler=(.42+1.15*math.sin(a+.2),-a+.24, .47*math.sin(2*a))
area("Luz superior",(-2.6,-1.2,7.4),(0,.5,2.1),2550,(1,.75,.46),4.4)
area("Rebote mineral",(5.5,1,4.3),(0,1,2),1900,(.36,.73,.82),4.1)
area("Contraluz",(-4.8,6.6,4.3),(0,.4,2.8),2300,(1,.57,.28),3.2)
area("Relleno suave",(1,-6,4.4),(0,4,2.5),1100,(.85,.89,1),4.8)
shoot("patio",(4.05,-7.7,2.1),(0,1.45,3.05),26,(1344,760))
