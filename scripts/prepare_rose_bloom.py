"""Deterministically embed the RoseBloom animation in both rose GLB copies.

Run with Blender from the repository root:
  blender --background --factory-startup --python scripts/prepare_rose_bloom.py
"""

from __future__ import annotations

import json
import math
import shutil
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_GLB = REPO_ROOT / "src/model/rose.glb"
OUTPUT_GLB = SOURCE_GLB
MIRROR_GLB = REPO_ROOT / "public/models/rose.glb"
FPS = 30
END_FRAME = 135

MATERIAL_OBJECTS = {
    "m_leafs": "leaf",
    "m_stem": "stem",
    "m_thorns": "thorn",
}
LAYER_SETTINGS = {
    "outer": (1, 0.18, (0.72, 0.72, 0.94), math.radians(38.0)),
    "middle": (18, 0.13, (0.80, 0.80, 0.97), math.radians(28.0)),
    "inner": (34, 0.08, (0.88, 0.88, 0.99), math.radians(16.0)),
}


def material_names(obj: bpy.types.Object) -> set[str]:
    if obj.type != "MESH":
        return set()
    return {material.name for material in obj.data.materials if material is not None}


def world_vertices(obj: bpy.types.Object) -> list[Vector]:
    matrix = obj.matrix_world
    return [matrix @ vertex.co for vertex in obj.data.vertices]


def bounds_for(objects: list[bpy.types.Object]) -> tuple[float, ...]:
    points = [point for obj in objects for point in world_vertices(obj)]
    if not points:
        raise RuntimeError("Cannot compute bounds without petal vertices")
    return (
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    )


def centroid(obj: bpy.types.Object) -> Vector:
    points = world_vertices(obj)
    return sum(points, Vector()) / len(points)


def reset_and_import() -> list[bpy.types.Object]:
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.actions, bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)

    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    imported = list(bpy.context.scene.objects)
    if not imported:
        raise RuntimeError(f"No objects imported from {SOURCE_GLB}")

    # A generated GLB imports with its RoseBloom action active. Evaluate and
    # preserve the held-open final pose before discarding imported animation;
    # otherwise a rerun would bake frame 1's closed pose as the new baseline.
    bpy.context.scene.frame_set(END_FRAME)
    bpy.context.view_layer.update()
    final_world_matrices = {obj: obj.matrix_world.copy() for obj in imported}
    for obj in imported:
        obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for obj in imported:
        obj.matrix_world = final_world_matrices[obj]
    bpy.context.view_layer.update()
    return imported


def find_required_meshes(objects: list[bpy.types.Object]) -> None:
    for material, label in MATERIAL_OBJECTS.items():
        matches = [obj for obj in objects if material in material_names(obj)]
        if not matches:
            raise RuntimeError(f"Could not find {label} mesh using material {material}")


def discover_petals(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    material_petals = [obj for obj in objects if "m_petal" in material_names(obj)]
    generated_petals = [obj for obj in material_petals if obj.name.startswith("Petal_")]

    if len(material_petals) == 1 and not generated_petals:
        source = material_petals[0]
        bpy.ops.object.select_all(action="DESELECT")
        source.select_set(True)
        bpy.context.view_layer.objects.active = source
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
        petals = sorted(
            [obj for obj in bpy.context.selected_objects if obj.type == "MESH"],
            key=lambda obj: tuple(round(value, 6) for value in obj.bound_box[0]),
        )
        if len(petals) < 3:
            raise RuntimeError(f"Expected at least 3 petal islands, found {len(petals)}")
    elif len(generated_petals) >= 3 and len(generated_petals) == len(material_petals):
        petals = generated_petals
    else:
        raise RuntimeError(
            "Expected exactly one m_petal mesh or at least three generated Petal_* meshes; "
            f"found {len(material_petals)} m_petal meshes and {len(generated_petals)} Petal_* meshes"
        )

    centers = {obj: centroid(obj) for obj in petals}
    flower_center = sum(centers.values(), Vector()) / len(centers)

    def polar_key(obj: bpy.types.Object) -> tuple[float, float, float]:
        delta = centers[obj] - flower_center
        return (
            round(math.atan2(delta.y, delta.x), 6),
            round(math.hypot(delta.x, delta.y), 6),
            round(centers[obj].z, 6),
        )

    petals.sort(key=polar_key)
    for index, petal in enumerate(petals):
        petal.name = f"__RosePetal_{index:03d}"
        petal.data.name = f"__RosePetalMesh_{index:03d}"
    for index, petal in enumerate(petals):
        petal.name = f"Petal_{index:03d}"
        petal.data.name = f"Petal_{index:03d}_Mesh"
        if "m_petal" not in material_names(petal):
            raise RuntimeError(f"{petal.name} lost material m_petal")
    return petals


def set_world_origin(obj: bpy.types.Object, origin_world: Vector) -> None:
    old_world = obj.matrix_world.copy()
    new_world = old_world.copy()
    new_world.translation = origin_world
    vertex_transform = new_world.inverted_safe() @ old_world
    for vertex in obj.data.vertices:
        vertex.co = vertex_transform @ vertex.co
    obj.matrix_world = new_world


def attachment_origin(obj: bpy.types.Object) -> Vector:
    points = world_vertices(obj)
    minimum = min(point.z for point in points)
    maximum = max(point.z for point in points)
    cutoff = minimum + (maximum - minimum) * 0.12
    band = [point for point in points if point.z <= cutoff]
    if not band:
        raise RuntimeError(f"Could not determine attachment band for {obj.name}")
    return sum(band, Vector()) / len(band)


def capped_rotation(source: Vector, target: Vector, maximum_angle: float) -> Quaternion:
    if source.length_squared < 1e-16 or target.length_squared < 1e-16:
        return Quaternion()
    delta = source.normalized().rotation_difference(target.normalized())
    angle = delta.angle
    if angle > maximum_angle and angle > 1e-12:
        delta = Quaternion().slerp(delta, maximum_angle / angle)
    return delta


def action_fcurves(action: bpy.types.Action):
    # Blender 5 creates layered actions. Legacy actions expose fcurves directly;
    # layered actions expose them through channel bags.
    direct = getattr(action, "fcurves", None)
    if direct is not None:
        return list(direct)
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                curves.extend(channelbag.fcurves)
    return curves


def animate_petals(petals: list[bpy.types.Object]) -> None:
    centers = {petal: centroid(petal) for petal in petals}
    flower_center = sum(centers.values(), Vector()) / len(centers)
    radial = {
        petal: math.hypot(centers[petal].x - flower_center.x, centers[petal].y - flower_center.y)
        for petal in petals
    }
    max_radius = max(radial.values())
    if max_radius <= 1e-12:
        raise RuntimeError("Petal centroids have no usable radial distribution")

    for index, petal in enumerate(petals):
        origin = attachment_origin(petal)
        set_world_origin(petal, origin)
        petal.rotation_mode = "QUATERNION"
        petal.matrix_world = petal.matrix_world.copy()

        open_location = petal.location.copy()
        open_rotation = petal.rotation_quaternion.copy()
        open_scale = petal.scale.copy()
        open_world = petal.matrix_world.copy()
        open_world_location, open_world_rotation, open_world_scale = open_world.decompose()

        normalized_radius = radial[petal] / max_radius
        layer = "outer" if normalized_radius >= 0.66 else "middle" if normalized_radius >= 0.33 else "inner"
        layer_frame, inward, scale_factors, max_angle = LAYER_SETTINGS[layer]
        stagger = (index % 5) * 2
        opening_frame = layer_frame + stagger
        open_frame = opening_frame + 82
        if open_frame >= END_FRAME:
            raise RuntimeError(f"Open frame {open_frame} leaves no final hold for {petal.name}")

        closed_world_location = open_world_location.copy()
        closed_world_location.x += (flower_center.x - open_world_location.x) * inward
        closed_world_location.y += (flower_center.y - open_world_location.y) * inward
        growth = centers[petal] - open_world_location
        toward_axis = Vector((flower_center.x, flower_center.y, centers[petal].z)) - open_world_location
        rotation_delta = capped_rotation(growth, toward_axis, max_angle)
        closed_world_rotation = rotation_delta @ open_world_rotation
        closed_world_scale = Vector(
            (
                open_world_scale.x * scale_factors[0],
                open_world_scale.y * scale_factors[1],
                open_world_scale.z * scale_factors[2],
            )
        )
        closed_world = Matrix.LocRotScale(closed_world_location, closed_world_rotation, closed_world_scale)
        closed_local = petal.parent.matrix_world.inverted_safe() @ closed_world if petal.parent else closed_world
        closed_location, closed_rotation, closed_scale = closed_local.decompose()

        petal.location = closed_location
        petal.rotation_quaternion = closed_rotation
        petal.scale = closed_scale
        for path in ("location", "rotation_quaternion", "scale"):
            petal.keyframe_insert(data_path=path, frame=1)
            petal.keyframe_insert(data_path=path, frame=opening_frame)

        petal.location = open_location
        petal.rotation_quaternion = open_rotation
        petal.scale = open_scale
        for path in ("location", "rotation_quaternion", "scale"):
            petal.keyframe_insert(data_path=path, frame=open_frame)
            petal.keyframe_insert(data_path=path, frame=END_FRAME)

        action = petal.animation_data.action
        if action is None:
            raise RuntimeError(f"Blender did not create an action for {petal.name}")
        action.name = f"{petal.name}_RoseBloom"
        for curve in action_fcurves(action):
            for keyframe in curve.keyframe_points:
                keyframe.interpolation = "BEZIER"
                keyframe.handle_left_type = "AUTO_CLAMPED"
                keyframe.handle_right_type = "AUTO_CLAMPED"

        # One identically named NLA track per object is merged into one glTF clip.
        petal.animation_data.action = None
        track = petal.animation_data.nla_tracks.new()
        track.name = "RoseBloom"
        strip = track.strips.new("RoseBloom", 1, action)
        strip.action_frame_start = 1
        strip.action_frame_end = END_FRAME


def ensure_root(objects: list[bpy.types.Object], open_bounds: tuple[float, ...]) -> bpy.types.Object:
    root = bpy.data.objects.get("RoseRoot")
    if root is None:
        root = bpy.data.objects.new("RoseRoot", None)
        bpy.context.scene.collection.objects.link(root)
        for obj in objects:
            if obj != root and obj.parent is None:
                world = obj.matrix_world.copy()
                obj.parent = root
                obj.matrix_world = world
    root["OpenPoseBounds"] = list(open_bounds)
    return root


def verify_scene_animation(petals: list[bpy.types.Object]) -> None:
    petal_names = {petal.name for petal in petals}
    animated = []
    for obj in bpy.context.scene.objects:
        data = obj.animation_data
        has_animation = bool(data and (data.action or len(data.nla_tracks)))
        if has_animation:
            animated.append(obj.name)
            if obj.name not in petal_names or not obj.name.startswith("Petal_"):
                raise RuntimeError(f"Only Petal_* objects may have animation data; found {obj.name}")
    if set(animated) != petal_names:
        raise RuntimeError(f"Every petal must be animated; animated {len(animated)} of {len(petals)}")


def read_glb_json(path: Path) -> dict:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise RuntimeError(f"Invalid GLB header in {path}")
    offset = 12
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        chunk = raw[offset + 8 : offset + 8 + length]
        if kind == 0x4E4F534A:
            return json.loads(chunk.rstrip(b" \0"))
        offset += 8 + length
    raise RuntimeError(f"Missing JSON chunk in {path}")


def export_and_validate(petals: list[bpy.types.Object], original_bounds: tuple[float, ...]) -> None:
    bpy.context.scene.frame_set(END_FRAME)
    final_bounds = bounds_for(petals)
    differences = [abs(before - after) for before, after in zip(original_bounds, final_bounds)]
    if max(differences) > 1e-4:
        raise RuntimeError(
            f"Final petal bounds changed by {max(differences):.9g}; "
            f"original={original_bounds}, final={final_bounds}"
        )

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_nla_strips_merged_animation_name="RoseBloom",
        export_frame_range=True,
        export_force_sampling=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        check_existing=False,
    )
    document = read_glb_json(OUTPUT_GLB)
    animation_names = [animation.get("name") for animation in document.get("animations", [])]
    if animation_names != ["RoseBloom"]:
        raise RuntimeError(f"Expected exactly one RoseBloom clip, exported {animation_names}")
    shutil.copyfile(OUTPUT_GLB, MIRROR_GLB)
    if OUTPUT_GLB.read_bytes() != MIRROR_GLB.read_bytes():
        raise RuntimeError("GLB mirror differs from source output")


def main() -> None:
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.fps_base = 1.0
    scene.frame_start = 1
    scene.frame_end = END_FRAME

    imported = reset_and_import()
    find_required_meshes(imported)
    petals = discover_petals(imported)
    original_bounds = bounds_for(petals)
    animate_petals(petals)
    ensure_root(imported, original_bounds)
    verify_scene_animation(petals)
    export_and_validate(petals, original_bounds)
    print(
        f"PASS: exported {len(petals)} petals as RoseBloom to {OUTPUT_GLB} "
        f"and mirrored identical bytes to {MIRROR_GLB}"
    )


if __name__ == "__main__":
    main()
