"""Anchr headless Blender worker. Input: a constrained JSON design specification.
No network, no arbitrary user/AI Python execution. Output in an app-owned job folder.
Uses procedural meshes and a simple articulated rig; it is NOT a generative sculpting model.
"""
import bpy, json, math, sys, os, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
if len(argv) != 2:
    raise RuntimeError("Expected -- <spec.json> <output_directory>")
spec_path, output_dir = argv
with open(spec_path, encoding="utf8") as handle:
    spec = json.load(handle)
os.makedirs(output_dir, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
random.seed(int(spec.get("seed", 7)) % 100000)
name = "".join(c for c in str(spec.get("name", "Anchr Model")) if c.isalnum() or c in " _-")[:64] or "Anchr Model"
kind = str(spec.get("archetype", "creature"))
style = str(spec.get("style", "stylized"))
scale = min(3.0, max(.4, float(spec.get("scale", 1))))
palette = spec.get("palette") or ["#596b80", "#b1b5ba", "#273749"]
animation = str(spec.get("animation", "idle"))
detail = min(3, max(1, int(spec.get("detail", 2))))
concept = str(spec.get("concept", "")).lower()[:500]
height_factor = 1.35 if any(t in concept for t in ("tall", "towering", "lanky", "scp-096", "scp 096")) else 1.0
width_factor = .68 if any(t in concept for t in ("thin", "skinny", "emaciated", "gaunt", "slender", "scp-096", "scp 096")) else 1.0
if any(t in concept for t in ("bulky", "muscular", "massive", "heavy armor")): width_factor = 1.3
if not spec.get("palette") and any(t in concept for t in ("pale", "gray skin", "grey skin", "scp-096", "scp 096")):
    palette = ["#b5b7b3", "#aaa9a4", "#20232a"]


def color(hex_value):
    try:
        value = str(hex_value).strip().lstrip("#")
        if len(value) != 6: raise ValueError()
        channels = [int(value[i:i+2],16)/255 for i in (0,2,4)]
        return tuple(((c+0.055)/1.055)**2.4 if c > .04045 else c/12.92 for c in channels) + (1.0,)
    except Exception: return (.5,.55,.62,1)
def material(i, rough=.64, metallic=.05):
    mat = bpy.data.materials.new(name=f"Anchr_Material_{i}")
    mat.diffuse_color = color(palette[i % len(palette)])
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = mat.diffuse_color
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
    return mat
mats = [material(i, .64 if i<2 else .36, .02 if i<2 else .15) for i in range(max(len(palette), 3))]
objects=[]
def smooth(obj):
    for p in obj.data.polygons: p.use_smooth=True
def mesh_uv(label, loc, dims, mat=0, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=loc)
    ob=bpy.context.object; ob.name=label
    ob.scale=tuple(v*scale for v in dims)
    ob.data.materials.append(mats[mat%len(mats)])
    smooth(ob); objects.append(ob)
    return ob
def cube(label, loc, dims, mat=0, bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob=bpy.context.object; ob.name=label
    ob.dimensions=tuple(v*scale for v in dims)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mats[mat%len(mats)])
    if bevel:
        mod=ob.modifiers.new("Soft_Edges", "BEVEL")
        mod.width=bevel*scale;mod.segments=3 if detail>1 else 2
        ob.modifiers.new("Weighted_Normals","WEIGHTED_NORMAL")
    objects.append(ob)
    return ob
def organic_tube(label, a, b, radius, mat=0, vertices=18):
    """Continuous tapered limb mesh: more natural silhouette than a Cylinder."""
    direction=Vector(b)-Vector(a)
    basis=direction.to_track_quat("Z","Y")
    rings=[0,.13,.35,.55,.78,.94,1.0]
    widths=[.72,1.00,1.13,.98,.83,.64,.48]
    verts=[];faces=[]
    for k,t in enumerate(rings):
        center=Vector(a).lerp(Vector(b),t)
        for j in range(vertices):
            theta=2*math.pi*j/vertices
            vector=basis @ Vector((math.cos(theta),math.sin(theta),0))
            verts.append(center+vector*(radius*scale*widths[k]))
    for k in range(len(rings)-1):
        for j in range(vertices):
            z=k*vertices+j
            zz=k*vertices+(j+1)%vertices
            faces.append((z,zz,zz+vertices,z+vertices))
    faces.append(tuple(reversed(range(vertices))))
    faces.append(tuple((len(rings)-1)*vertices+j for j in range(vertices)))
    mesh=bpy.data.meshes.new(label+"_mesh")
    mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(label,mesh);bpy.context.collection.objects.link(ob)
    mesh.materials.append(mats[mat%len(mats)])
    smooth(ob);objects.append(ob)
    return ob

def cylinder(label, a, b, radius, mat=0, vertices=20):
    center=(Vector(a)+Vector(b))/2
    diff=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius*scale, depth=diff.length, location=center)
    ob=bpy.context.object;ob.name=label;ob.rotation_euler=diff.to_track_quat("Z","Y").to_euler()
    ob.data.materials.append(mats[mat%len(mats)]);smooth(ob)
    objects.append(ob);return ob

# Articulated humanoid/creature: higher resolution surfaces and explicit proportions.
root = bpy.data.objects.new(name+"_Root", None)
bpy.context.collection.objects.link(root)
root.empty_display_type="CUBE";root.empty_display_size=.25
rigged={}
if kind in ("creature","character","humanoid"):
    torso=mesh_uv("Organic_Torso",(0,0,1.75*scale),(.52,.38,.77),0)
    mesh_uv("Chest_Silhouette",(0,-.025*scale,1.94*scale),(.51,.31,.53),0)
    mesh_uv("Head",(0,0,2.74*scale),(.37,.34,.46),1)
    mesh_uv("Jaw",(0,-.18*scale,2.48*scale),(.29,.23,.15),1)
    cube("Neck",(0,0,2.34*scale),(.24,.24,.35),0,.1)
    for side in (-1,1):
        side_name="L" if side<0 else "R"
        sx=side*.68*scale
        shoulder=mesh_uv(side_name+"_Shoulder",(sx,0,2.15*scale),(.25,.26,.26),0)
        upper=organic_tube(side_name+"_UpperArm",(sx,0,2.12*scale),(sx*1.08,0,1.43*scale),.17,0)
        elbow=mesh_uv(side_name+"_Elbow",(sx*1.08,0,1.43*scale),(.19,.17,.19),2)
        lower=organic_tube(side_name+"_Forearm",(sx*1.08,0,1.43*scale),(sx*1.13,-.04*scale,.87*scale),.13,0)
        hand=mesh_uv(side_name+"_Hand",(sx*1.13,-.05*scale,.84*scale),(.19,.12,.22),1)
        thigh=organic_tube(side_name+"_UpperLeg",(side*.30*scale,0,1.20*scale),(side*.33*scale,0,.63*scale),.24,0)
        shin=organic_tube(side_name+"_LowerLeg",(side*.33*scale,0,.63*scale),(side*.34*scale,0,.14*scale),.16,0)
        foot=cube(side_name+"_Foot",(side*.34*scale,-.16*scale,.12*scale),(.33,.56,.21),2,.08)
        rigged[side_name+"_Arm"]=[shoulder,upper,elbow,lower,hand]
        rigged[side_name+"_Leg"]=[thigh,shin,foot]
    # Separate high-contrast face details; not just a sphere-on-cube dummy.
    for side in (-1,1):
        mesh_uv(("L" if side<0 else "R")+"_Eye",(side*.15*scale,-.31*scale,2.80*scale),(.065,.045,.10),2,16)
    if "armored" in concept or "robot" in concept or "mechanical" in concept:
        for i in range(7):
            pos=(-.30+i*.10)*scale
            cube("Armor_Segment_"+str(i),(pos,-.29*scale,1.86*scale),(.09,.08,.46),2,.028)
elif kind=="vehicle":
    cube("Hull",(0,0,.94*scale),(2.4,1.4,.65),0,.24)
    cube("Cabin",(-.1,0,1.45*scale),(1.10,1.17,.7),1,.25)
    for x in (-.78,.82):
        for y in (-.82,.82):
            bpy.ops.mesh.primitive_torus_add(major_radius=.30*scale,minor_radius=.11*scale,
                location=(x*scale,y*scale,.49*scale),rotation=(math.pi/2,0,0))
            ob=bpy.context.object;ob.name="Wheel";ob.data.materials.append(mats[2]);smooth(ob);objects.append(ob)
elif kind in ("architecture","building"):
    cube("Foundation",(0,0,.13*scale),(3.4,3.2,.28),2,.05)
    cube("Facade",(0,0,1.95*scale),(2.6,2.25,3.40),0,.09)
    cube("Roof",(0,0,3.85*scale),(3.1,2.8,.42),1,.09)
    for i in range(3):
        for side in (-1,1):
            cube("Window",(side*.79*scale,-1.14*scale,(1.0+i*.95)*scale),(.55,.12,.58),2,.02)
    cube("Entrance",(0,-1.18*scale,.68*scale),(.8,.13,1.33),1,.02)
else:
    mesh_uv("Base_Form",(0,0,.82*scale),(.9,.74,.9),0)
    cylinder("Neck",(0,0,1.30*scale),(0,0,1.9*scale),.35,1)
    cube("Cap",(0,0,2.10*scale),(1.32,1.0,.42),2,.15)

# Apply planning proportions before creating animation pivots.
if kind in ("creature","character","humanoid"):
    for ob in objects:
        ob.location.x *= width_factor
        ob.location.y *= width_factor
        ob.location.z *= height_factor
        ob.scale.x *= width_factor
        ob.scale.y *= width_factor
        ob.scale.z *= height_factor
    if detail > 1:
        mesh_uv("Mouth_Shadow",(0,-.345*scale*width_factor,2.48*scale*height_factor),(.20,.032,.035),2,24)

# Simple rig controller empties so preview and exported GLB contain real keyframe animation.
for label, parts in rigged.items():
    pivot=(Vector(parts[0].location)).copy()
    controller=bpy.data.objects.new(label+"_RigPivot", None)
    bpy.context.collection.objects.link(controller)
    controller.location=pivot
    controller.parent=root
    for part in parts:
        old=part.matrix_world.copy()
        part.parent=controller
        part.matrix_world=old
    rigged[label]=controller
for obj in objects:
    if obj.parent is None:
        old=obj.matrix_world.copy()
        obj.parent=root
        obj.matrix_world=old

if rigged and animation in ("idle","walk","run","attack"):
    duration=48 if animation=="idle" else 32
    for frame in (1, duration//4, duration//2, duration*3//4, duration):
        phase=2*math.pi*(frame-1)/duration
        for label, pivot in rigged.items():
            pivot.rotation_mode="XYZ"
            arm="Arm" in label
            amplitude = .05 if animation=="idle" else (.45 if animation=="walk" else .72)
            if animation=="attack" and arm: amplitude=1.1
            pivot.rotation_euler.x = math.sin(phase + (math.pi if label.startswith("R") else 0))*amplitude
            pivot.rotation_euler.z = math.sin(phase)*(.04 if arm else .02)
            pivot.keyframe_insert(data_path="rotation_euler",frame=frame)
    bpy.context.scene.frame_end=duration
    bpy.context.scene.render.fps=24
bpy.context.scene.frame_set(1)

# Neutral Studio-style preview, controlled output, no scripts fetched or executed from web.
world=bpy.context.scene.world
if world: world.color=(.08,.10,.13)
bpy.ops.object.camera_add(location=(5*scale,-7*scale,4*scale))
camera=bpy.context.object; camera.name="PreviewCamera"
camera.rotation_euler=(Vector((0,0,1.65*scale))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.type="ORTHO";camera.data.ortho_scale=5.8*scale
bpy.context.scene.camera=camera
for loc,energy in [((2,-4,7),1000),((-3,1,5),750)]:
    bpy.ops.object.light_add(type="AREA",location=loc)
    light=bpy.context.object;light.data.energy=energy;light.data.shape="DISK";light.data.size=5
bpy.context.scene.render.engine="CYCLES"
bpy.context.scene.cycles.samples=12
bpy.context.scene.render.resolution_x=640
bpy.context.scene.render.resolution_y=640
bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.render.image_settings.file_format="PNG"
bpy.context.scene.render.film_transparent=True
bpy.context.scene.render.filepath=os.path.join(output_dir,"preview.png")
bpy.ops.render.render(write_still=True)
for obj in bpy.context.selected_objects: obj.select_set(False)
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output_dir,"model.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(output_dir,"model.glb"),export_format="GLB",
    use_selection=False,export_apply=False,export_animations=True,export_cameras=False,export_lights=False)
report={"model":name,"archetype":kind,"style":style,"animation":animation,"concept":concept,"proportions":{"height":height_factor,"width":width_factor},
        "objects":len(objects),"files":["model.blend","model.glb","preview.png"],
        "limitations":["Procedural template geometry; not a photogrammetry or text-to-mesh model.",
                       "Rig animations are basic pivot keyframes; Roblox rig retargeting may be required."]}
with open(os.path.join(output_dir,"report.json"),"w",encoding="utf8") as f:
    json.dump(report,f,indent=2)
print("ANCHR_RESULT="+json.dumps(report))
