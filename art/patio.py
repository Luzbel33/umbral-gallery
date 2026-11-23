"""Render the stone courtyard used for the browser lounge."""
import sys, os, math, random, runpy
sys.argv=['blender','--']
b=runpy.run_path(os.path.join(os.path.dirname(__file__),'render.py'))
import bpy
from mathutils import Vector
rng=random.Random(26)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete()
mat,box,area,shoot=b['mat'],b['box'],b['area'],b['shoot']
stone=mat('Travertino',(.52,.41,.29),0,.68,True)
plaster=mat('Revoque',(.53,.37,.24),0,.77,True)
wood=mat('Cedro',(.24,.105,.052),.04,.36,True)
moss=mat('Salvia',(.095,.15,.074),0,.85)
water=mat('Estanque',(.038,.16,.13),.5,.16)
fabric=mat('Tapicería de lino',(.56,.32,.15),0,.88,True)
box('Piso',(0,0,-.18),(28,27,.36),stone)
box('Muro largo',(0,7,2.4),(26,.5,4.8),plaster)
for x in [-8,-3,2,7]:box('Pilar',(x,5,2.25),(.34,.38,4.5),stone)
for i in range(29):box('Sombra de pérgola',(-9+i*.57,5.1,4.65),(.18,4.8,.18),wood)
box('Viga transversal',(0,3.2,4.42),(20,.24,.29),wood)
box('Estanque',(-1,1,.11),(6.4,3.4,.26),stone,.14)
box('Agua',(-1,1,.25),(6.03,3.04,.045),water,.13)
for x,y in [(4.2,-.4),(4.2,3.2),(-5,3.4)]:
 box('Banco',(x,y,.34),(3.0,1.0,.52),stone,.09)
 box('Asiento',(x,y,.67),(2.94,.93,.21),fabric,.09)
def tree(x,y,h,span):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.22,radius2=.09,depth=h,location=(x,y,h/2));bpy.context.object.data.materials.append(wood)
 for k in range(95):
  angle=rng.random()*math.tau;rad=span*rng.random()**.5
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x+math.cos(angle)*rad,y+math.sin(angle)*rad,h+.65*(1-rad/span)+rng.uniform(-.5,.42)))
  o=bpy.context.object;o.scale=(.76,.68,.43);o.rotation_euler.z=angle;o.data.materials.append(moss)
tree(3.5,2.3,3.8,2.3);tree(-6.5,4,3,1.65);tree(7,5,3.9,1.9)
area('Sol cálido',(-3,-1,11),(0,3,0),2300,(1,.85,.65),5)
sun=bpy.data.lights.new('Sol','SUN');sun.energy=4;sun.angle=.075;sun.color=(1,.80,.59)
o=bpy.data.objects.new('Sol',sun);bpy.context.scene.collection.objects.link(o);o.location=(-8,-3,10);b['aim'](o,(1,4,0))
shoot('patio',(8.7,-10.7,3.7),(.6,2.25,1.75),35,(1250,660))
