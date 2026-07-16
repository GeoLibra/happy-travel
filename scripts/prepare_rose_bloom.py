"""Deterministically embed the RoseBloom animation in both rose GLB copies.

Run with Blender from the repository root:
  blender --background --factory-startup --python scripts/prepare_rose_bloom.py
"""

from __future__ import annotations

import json
import math
import shutil
import struct
import sys
from itertools import combinations
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rosebud_morph import (
    MorphSettings,
    ROOT_LOCK_END,
    apply_angular_guide_phase,
    compute_angular_guide_indices,
    generate_bud_world_positions,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_GLB = REPO_ROOT / "src/model/rose.glb"
OUTPUT_GLB = SOURCE_GLB
MIRROR_GLB = REPO_ROOT / "public/models/rose.glb"
FPS = 30
END_FRAME = 135
EXPECTED_PETAL_COUNT = 25
INNER_GUIDE_PHASE = 1
PETAL_COMPONENTS_PER_PETAL = 3
MIN_PETAL_COMPONENT_VERTICES = 100
MAX_PETAL_CLUSTER_COST = 0.08

MATERIAL_OBJECTS = {
    "m_leafs": "leaf",
    "m_stem": "stem",
    "m_thorns": "thorn",
}
MORPH_SETTINGS = {
    "outer": MorphSettings(1, math.radians(12.0), 0.50, 0.75, 0.30, math.radians(1.0)),
    "middle": MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0)),
    "inner": MorphSettings(
        34,
        math.radians(38.0),
        0.12,
        1.05,
        0.90,
        math.radians(3.0),
        tip_guide_radius_ratio=0.04,
        tip_guide_height_ratio=1.10,
        alternate_tip_guide_radius_ratio=0.09,
        alternate_tip_guide_height_ratio=1.04,
        tip_blend_start=0.65,
    ),
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


def component_bounds(obj: bpy.types.Object) -> tuple[float, ...]:
    points = world_vertices(obj)
    return tuple(min(point[axis] for point in points) for axis in range(3)) + tuple(
        max(point[axis] for point in points) for axis in range(3)
    )


def bounds_distance(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def cluster_petal_components(components: list[bpy.types.Object]) -> list[tuple[bpy.types.Object, ...]]:
    expected_components = EXPECTED_PETAL_COUNT * PETAL_COMPONENTS_PER_PETAL
    if len(components) != expected_components:
        raise RuntimeError(
            f"Expected {expected_components} substantial petal components "
            f"({EXPECTED_PETAL_COUNT} petals x {PETAL_COMPONENTS_PER_PETAL}), found {len(components)}"
        )

    component_bounds_by_object = {obj: component_bounds(obj) for obj in components}
    candidates = []
    for group in combinations(components, PETAL_COMPONENTS_PER_PETAL):
        cost = sum(
            bounds_distance(component_bounds_by_object[left], component_bounds_by_object[right])
            for left, right in combinations(group, 2)
        )
        candidates.append((cost, tuple(sorted(group, key=lambda obj: obj.name))))
    candidates.sort(key=lambda item: (item[0], tuple(obj.name for obj in item[1])))

    assigned: set[bpy.types.Object] = set()
    clusters = []
    for cost, group in candidates:
        if any(obj in assigned for obj in group):
            continue
        if cost > MAX_PETAL_CLUSTER_COST:
            raise RuntimeError(
                f"Could not identify a coherent physical petal; nearest remaining cluster cost is {cost:.6f}"
            )
        clusters.append(group)
        assigned.update(group)
        if len(assigned) == len(components):
            break

    if len(clusters) != EXPECTED_PETAL_COUNT or len(assigned) != len(components):
        raise RuntimeError(
            f"Expected {EXPECTED_PETAL_COUNT} complete petal clusters, "
            f"formed {len(clusters)} from {len(assigned)} of {len(components)} components"
        )
    return clusters


def join_petal_components(clusters: list[tuple[bpy.types.Object, ...]]) -> list[bpy.types.Object]:
    petals = []
    for index, cluster in enumerate(clusters):
        bpy.ops.object.select_all(action="DESELECT")
        active = cluster[0]
        for component in cluster:
            component.select_set(True)
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = f"__CompletePetal_{index:03d}"
        active.data.name = f"__CompletePetalMesh_{index:03d}"
        petals.append(active)
    return petals


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
        shape_keys = obj.data.shape_keys if obj.type == "MESH" else None
        if shape_keys is not None:
            shape_keys.animation_data_clear()
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
    petals = None

    if len(material_petals) == 1 and not generated_petals:
        source = material_petals[0]
        bpy.ops.object.select_all(action="DESELECT")
        source.select_set(True)
        bpy.context.view_layer.objects.active = source
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
        components = sorted(
            [obj for obj in bpy.context.selected_objects if obj.type == "MESH"],
            key=lambda obj: tuple(round(value, 6) for value in obj.bound_box[0]),
        )
        if len(components) < 3:
            raise RuntimeError(f"Expected at least 3 petal islands, found {len(components)}")
    elif len(generated_petals) == EXPECTED_PETAL_COUNT and len(generated_petals) == len(material_petals):
        petals = generated_petals
        components = []
    elif len(generated_petals) >= 3 and len(generated_petals) == len(material_petals):
        components = generated_petals
    else:
        raise RuntimeError(
            "Expected exactly one m_petal mesh or at least three generated Petal_* meshes; "
            f"found {len(material_petals)} m_petal meshes and {len(generated_petals)} Petal_* meshes"
        )

    if petals is None:
        substantial_components = [
            component
            for component in components
            if len(component.data.vertices) >= MIN_PETAL_COMPONENT_VERTICES
        ]
        debris = [component for component in components if component not in substantial_components]
        for component in debris:
            bpy.data.objects.remove(component, do_unlink=True)

        clusters = cluster_petal_components(substantial_components)
        petals = join_petal_components(clusters)

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

    layers = {}
    for petal in petals:
        normalized_radius = radial[petal] / max_radius
        layers[petal] = "outer" if normalized_radius >= 0.66 else "middle" if normalized_radius >= 0.33 else "inner"

    inner_petals = [petal for petal in petals if layers[petal] == "inner"]
    if len(inner_petals) != 8:
        raise RuntimeError(f"Expected 8 inner petals for circular alternation, found {len(inner_petals)}")
    inner_guide_indices = compute_angular_guide_indices(
        [(petal.name, centers[petal]) for petal in inner_petals],
        flower_center,
    )
    inner_guide_indices = apply_angular_guide_phase(inner_guide_indices, INNER_GUIDE_PHASE)
    even_count = sum(index % 2 == 0 for index in inner_guide_indices.values())
    odd_count = sum(index % 2 == 1 for index in inner_guide_indices.values())
    if (even_count, odd_count) != (4, 4):
        raise RuntimeError(f'Inner phased guides must split 4/4, found {even_count}/{odd_count}')
    for petal in sorted(inner_petals, key=lambda item: inner_guide_indices[item.name]):
        print(
            f'INNER_GUIDE petal={petal.name} '
            f'angular_rank={inner_guide_indices[petal.name] - INNER_GUIDE_PHASE} '
            f'guide_index={inner_guide_indices[petal.name]}'
        )

    outer_radius = MORPH_SETTINGS["outer"].guide_radius_ratio
    middle_radius = MORPH_SETTINGS["middle"].guide_radius_ratio
    inner_body_radius = MORPH_SETTINGS["inner"].guide_radius_ratio
    inner_odd_tip = MORPH_SETTINGS["inner"].alternate_tip_guide_radius_ratio
    inner_even_tip = MORPH_SETTINGS["inner"].tip_guide_radius_ratio
    if inner_odd_tip is None or inner_even_tip is None:
        raise RuntimeError('Inner tip guide radii are required')
    if not outer_radius > middle_radius > inner_body_radius > inner_odd_tip > inner_even_tip > 0.0:
        raise RuntimeError(
            'Guide radii must descend outer > middle > inner body > odd tip > even tip; '
            f'found {[outer_radius, middle_radius, inner_body_radius, inner_odd_tip, inner_even_tip]}'
        )

    for animation_index, petal in enumerate(petals):
        if petal.data.shape_keys is not None:
            petal.shape_key_clear()
        origin = attachment_origin(petal)
        set_world_origin(petal, origin)
        petal.matrix_world = petal.matrix_world.copy()

        layer = layers[petal]
        settings = MORPH_SETTINGS[layer]
        guide_index = inner_guide_indices[petal.name] if layer == "inner" else animation_index
        petal["RoseLayer"] = layer
        stagger = (animation_index % 5) * 2
        opening_frame = settings.opening_frame + stagger
        open_frame = opening_frame + 82
        if open_frame >= END_FRAME:
            raise RuntimeError(f"Open frame {open_frame} leaves no final hold for {petal.name}")

        basis = petal.shape_key_add(name="Basis", from_mix=False)
        bud = petal.shape_key_add(name="Bud", from_mix=False)
        open_world = petal.matrix_world.copy()
        open_points = [open_world @ point.co for point in basis.data]
        closed_points, parameters = generate_bud_world_positions(
            open_points, origin, flower_center, centers[petal], max_radius, settings, guide_index
        )
        inverse_world = open_world.inverted_safe()
        for vertex_index, closed_world in enumerate(closed_points):
            bud.data[vertex_index].co = inverse_world @ closed_world
            if parameters[vertex_index] <= ROOT_LOCK_END:
                displacement = (bud.data[vertex_index].co - basis.data[vertex_index].co).length
                if displacement > 1e-5:
                    raise RuntimeError(f"{petal.name} root vertex moved by {displacement:.9g}")

        bud.value = 1.0
        bud.keyframe_insert(data_path="value", frame=1)
        bud.keyframe_insert(data_path="value", frame=opening_frame)
        bud.value = 0.0
        bud.keyframe_insert(data_path="value", frame=open_frame)
        bud.keyframe_insert(data_path="value", frame=END_FRAME)

        shape_keys = petal.data.shape_keys
        action = shape_keys.animation_data.action
        if action is None:
            raise RuntimeError(f"Blender did not create a shape-key action for {petal.name}")
        action.name = f"{petal.name}_RoseBloom"
        for curve in action_fcurves(action):
            for keyframe in curve.keyframe_points:
                keyframe.interpolation = "BEZIER"
                keyframe.handle_left_type = "AUTO_CLAMPED"
                keyframe.handle_right_type = "AUTO_CLAMPED"

        shape_keys.animation_data.action = None
        track = shape_keys.animation_data.nla_tracks.new()
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
    for obj in bpy.context.scene.objects:
        if obj.animation_data and (obj.animation_data.action or len(obj.animation_data.nla_tracks)):
            raise RuntimeError(f"Object transforms may not be animated; found {obj.name}")
    animated = set()
    for petal in petals:
        keys = petal.data.shape_keys
        if keys is None or [key.name for key in keys.key_blocks] != ["Basis", "Bud"]:
            raise RuntimeError(f"{petal.name} must contain exactly Basis and Bud shape keys")
        data = keys.animation_data
        if not data or len(data.nla_tracks) != 1:
            raise RuntimeError(f"{petal.name} must contain one shape-key NLA track")
        animated.add(petal.name)
    if animated != petal_names:
        raise RuntimeError(f"Every petal must have morph animation; found {len(animated)}")


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
        export_morph=True,
        export_morph_animation=True,
        export_morph_normal=True,
        export_morph_tangent=False,
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
