"""Rebuild semantic F1 wheel assemblies and rear aero-panel ownership.

Run with Blender 5.1+ in background mode. The accepted source GLB is read-only;
the script writes a versioned uncompressed intermediate for later optimization.
"""

from __future__ import annotations

import math
from collections import defaultdict
from pathlib import Path
from typing import Literal

import bpy
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_GLB = PROJECT_ROOT / "public/models/red_bull_f1_rigged.glb"
OUTPUT_UNCOMPRESSED_GLB = PROJECT_ROOT / "public/models/red_bull_f1_showroom_v2-uncompressed.glb"

# side sign, longitudinal center, vertical center, visible tire radius
WHEELS = {
    "FL": (-1, -1.378, 0.253, 0.285),
    "FR": (1, -1.378, 0.253, 0.285),
    "RL": (-1, 1.014, 0.254, 0.260),
    "RR": (1, 1.014, 0.254, 0.260),
}

ANGLE_BIN_COUNT = 48
MIN_ROTATING_VERTICES = 2_000
MAX_AXLE_ASYMMETRY = 0.25
MIN_SPIN_ANGLE_COVERAGE = 0.58


def reset_scene() -> None:
    active = bpy.context.view_layer.objects.active
    if active is not None and active.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def import_source() -> None:
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(SOURCE_GLB)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    bpy.context.view_layer.update()


def connected_components(mesh: bpy.types.Mesh) -> list[list[int]]:
    adjacency: list[list[int]] = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        first, second = edge.vertices
        adjacency[first].append(second)
        adjacency[second].append(first)

    seen = bytearray(len(mesh.vertices))
    result: list[list[int]] = []
    for start in range(len(mesh.vertices)):
        if seen[start]:
            continue
        seen[start] = 1
        stack = [start]
        component: list[int] = []
        while stack:
            index = stack.pop()
            component.append(index)
            for neighbor in adjacency[index]:
                if not seen[neighbor]:
                    seen[neighbor] = 1
                    stack.append(neighbor)
        result.append(component)
    return result


def world_points(obj: bpy.types.Object, indices: list[int]) -> list[Vector]:
    return [obj.matrix_world @ obj.data.vertices[index].co for index in indices]


def angular_coverage(points: list[Vector], center_y: float, center_z: float) -> float:
    bins = {
        int(
            ((math.atan2(point.z - center_z, point.y - center_y) + math.pi) / (2 * math.pi))
            * ANGLE_BIN_COUNT
        )
        % ANGLE_BIN_COUNT
        for point in points
    }
    return len(bins) / ANGLE_BIN_COUNT


def classify_wheel_component(
    points: list[Vector],
    wheel_key: str,
) -> Literal["spin", "static", "reject"]:
    side, center_y, center_z, radius = WHEELS[wheel_key]
    side_ratio = sum(1 for point in points if point.x * side >= 0.28) / len(points)
    radii = [math.hypot(point.y - center_y, point.z - center_z) for point in points]
    radial_ratio = sum(1 for value in radii if value <= radius * 1.08) / len(points)
    if side_ratio < 0.90 or radial_ratio < 0.92:
        return "reject"

    coverage = angular_coverage(points, center_y, center_z)
    max_radius = max(radii)
    min_radius = min(radii)
    if coverage >= MIN_SPIN_ANGLE_COVERAGE and max_radius >= radius * 0.025:
        return "spin"
    if len(points) >= 48 and min_radius <= radius * 1.02 and max_radius <= radius * 1.08:
        return "static"
    return "reject"


def is_hard_rock_panel_component(points: list[Vector], wheel_key: str) -> bool:
    if wheel_key not in {"FL", "FR"} or len(points) < 300:
        return False
    _, center_y, center_z, radius = WHEELS[wheel_key]
    radii = [math.hypot(point.y - center_y, point.z - center_z) for point in points]
    coverage = angular_coverage(points, center_y, center_z)
    return (
        min(radii) >= radius * 0.78
        and max(radii) >= radius * 0.98
        and max(point.z for point in points) >= center_z + radius * 0.32
        and coverage < 0.46
    )


def is_rear_body_component(points: list[Vector]) -> bool:
    """Select the rear-wing stack as one semantic exploded-view assembly."""
    if len(points) < 40:
        return False
    minimum_y = min(point.y for point in points)
    maximum_z = max(point.z for point in points)
    return minimum_y >= 1.10 and maximum_z >= 0.50


def activate_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def create_extraction_groups(
    source: bpy.types.Object,
    groups: dict[str, list[int]],
) -> list[str]:
    names: list[str] = []
    for category, indices in groups.items():
        if not indices:
            continue
        name = f"Extract_{category}"
        previous = source.vertex_groups.get(name)
        if previous is not None:
            source.vertex_groups.remove(previous)
        group = source.vertex_groups.new(name=name)
        group.add(sorted(set(indices)), 1.0, "REPLACE")
        names.append(name)
    return names


def separate_group(source: bpy.types.Object, group_name: str, object_name: str) -> bpy.types.Object:
    group = source.vertex_groups.get(group_name)
    if group is None:
        raise RuntimeError(f"Missing extraction group {group_name} on {source.name}")
    activate_only(source)
    source.vertex_groups.active_index = group.index
    before = set(bpy.data.objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.vertex_group_select()
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    separated = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(separated) != 1:
        raise RuntimeError(
            f"Expected one separated object for {group_name} on {source.name}, got {len(separated)}"
        )
    result = separated[0]
    result.name = object_name
    for vertex_group in list(result.vertex_groups):
        result.vertex_groups.remove(vertex_group)
    bpy.context.view_layer.update()
    return result


def parent_preserving_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    world_matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.matrix_world = world_matrix
    bpy.context.view_layer.update()
    if matrix_delta(obj.matrix_world, world_matrix) > 1e-5:
        raise RuntimeError(
            f"Reparenting {obj.name} under {parent.name} changed its world transform: "
            f"matrix delta={matrix_delta(obj.matrix_world, world_matrix):.8f}"
        )


def create_identity_group(name: str, parent: bpy.types.Object) -> bpy.types.Object:
    existing = bpy.data.objects.get(name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    group = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(group)
    group.parent = parent
    group.matrix_parent_inverse.identity()
    group.location = (0.0, 0.0, 0.0)
    group.rotation_euler = (0.0, 0.0, 0.0)
    group.scale = (1.0, 1.0, 1.0)
    return group


def create_wheel_hierarchy(
    key: str,
    rotating: list[bpy.types.Object],
    stationary: list[bpy.types.Object],
) -> None:
    pivot = bpy.data.objects.get(f"WheelPivot_{key}")
    if pivot is None:
        raise RuntimeError(f"Missing source pivot WheelPivot_{key}")
    spin = create_identity_group(f"WheelSpin_{key}", pivot)
    static = create_identity_group(f"WheelStatic_{key}", pivot)
    for obj in rotating:
        parent_preserving_world(obj, spin)
    for obj in stationary:
        parent_preserving_world(obj, static)
    spin["semantic_role"] = "rotating_wheel_assembly"
    static["semantic_role"] = "stationary_wheel_hardware"


def rebuild_semantic_wheels(
    meshes: list[bpy.types.Object],
) -> dict[str, list[bpy.types.Object]]:
    existing_wheels = {
        key: bpy.data.objects.get(f"Wheel_{key}")
        for key in WHEELS
    }
    if any(wheel is None for wheel in existing_wheels.values()):
        missing = [key for key, wheel in existing_wheels.items() if wheel is None]
        raise RuntimeError(f"Source is missing wheel meshes: {missing}")

    rotating: dict[str, list[bpy.types.Object]] = {key: [] for key in WHEELS}
    stationary: dict[str, list[bpy.types.Object]] = {key: [] for key in WHEELS}
    hard_rock_panels: list[bpy.types.Object] = []
    rear_body_parts: list[bpy.types.Object] = []

    for key, wheel in existing_wheels.items():
        assert wheel is not None
        panel_indices: list[int] = []
        for component in connected_components(wheel.data):
            points = world_points(wheel, component)
            if is_hard_rock_panel_component(points, key):
                panel_indices.extend(component)
        if panel_indices:
            create_extraction_groups(wheel, {"rear_hard_rock": panel_indices})
            hard_rock_panels.append(
                separate_group(wheel, "Extract_rear_hard_rock", f"RearHardRockAeroPanel_{key}")
            )
        wheel.name = f"WheelSpinGeometry_{key}"
        rotating[key].append(wheel)

    body_meshes = [obj for obj in meshes if obj not in existing_wheels.values()]
    for source in body_meshes:
        indices_by_category: dict[str, list[int]] = defaultdict(list)
        for component in connected_components(source.data):
            if len(component) < 16:
                continue
            points = world_points(source, component)
            if is_rear_body_component(points):
                indices_by_category["rear_body"].extend(component)
                continue
            for key in WHEELS:
                classification = classify_wheel_component(points, key)
                if classification != "reject":
                    indices_by_category[f"{classification}_{key}"].extend(component)
                    break
        group_names = create_extraction_groups(source, indices_by_category)
        for group_name in group_names:
            if group_name == "Extract_rear_body":
                rear_body_parts.append(
                    separate_group(source, group_name, f"RearBodyGeometry_{source.name}")
                )
                continue
            _, classification, key = group_name.split("_", 2)
            part = separate_group(
                source,
                group_name,
                f"Wheel{classification.title()}Geometry_{key}_{source.name}",
            )
            if classification == "spin":
                rotating[key].append(part)
            else:
                stationary[key].append(part)

    totals = {
        key: sum(len(obj.data.vertices) for obj in parts)
        for key, parts in rotating.items()
    }
    for key, count in totals.items():
        if count < MIN_ROTATING_VERTICES:
            raise RuntimeError(f"{key} has only {count} rotating vertices")
    for left, right in (("FL", "FR"), ("RL", "RR")):
        asymmetry = abs(totals[left] - totals[right]) / max(totals[left], totals[right])
        if asymmetry > MAX_AXLE_ASYMMETRY:
            raise RuntimeError(f"{left}/{right} rotating geometry differs by {asymmetry:.1%}")

    for key in WHEELS:
        create_wheel_hierarchy(key, rotating[key], stationary[key])
    print("Semantic rotating vertex totals:", totals)
    print("Rear body semantic mesh count:", len(rear_body_parts))
    return {"panels": hard_rock_panels, "rear_body": rear_body_parts}


def extract_rear_hard_rock_panel(
    root: bpy.types.Object,
    panel_meshes: list[bpy.types.Object],
    rear_body_meshes: list[bpy.types.Object],
) -> bpy.types.Object:
    if len(panel_meshes) != 2:
        raise RuntimeError(f"Expected two symmetric Hard Rock aero panels, got {len(panel_meshes)}")
    rear_body = create_identity_group("RearBodyAssembly", root)
    rear_body["semantic_role"] = "rear_body_explosion_group"
    for rear_body_mesh in rear_body_meshes:
        parent_preserving_world(rear_body_mesh, rear_body)
    panel_group = create_identity_group("RearHardRockAeroPanel", rear_body)
    panel_group["semantic_role"] = "rear_body_aero_panel"
    for panel in panel_meshes:
        parent_preserving_world(panel, panel_group)
    return panel_group


def matrix_delta(first: Matrix, second: Matrix) -> float:
    return max(
        abs(first[row][column] - second[row][column])
        for row in range(4)
        for column in range(4)
    )


def matrix_close(first: Matrix, second: Matrix, tolerance: float = 1e-5) -> bool:
    return all(
        abs(first[row][column] - second[row][column]) <= tolerance
        for row in range(4)
        for column in range(4)
    )


def is_descendant(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    current = obj.parent
    while current is not None:
        if current == ancestor:
            return True
        current = current.parent
    return False


def validate_scene_contract() -> None:
    # Flush all reparent operations before capturing the protected transforms.
    bpy.context.view_layer.update()
    panel = bpy.data.objects.get("RearHardRockAeroPanel")
    rear_body = bpy.data.objects.get("RearBodyAssembly")
    if panel is None or rear_body is None or panel.parent != rear_body:
        raise RuntimeError("Rear Hard Rock panel hierarchy is invalid")
    if not any(obj.type == "MESH" and not is_descendant(obj, panel) for obj in rear_body.children_recursive):
        raise RuntimeError("RearBodyAssembly must contain rear-wing geometry outside the panel group")
    for key in WHEELS:
        pivot = bpy.data.objects.get(f"WheelPivot_{key}")
        spin = bpy.data.objects.get(f"WheelSpin_{key}")
        static = bpy.data.objects.get(f"WheelStatic_{key}")
        if pivot is None or spin is None or static is None:
            raise RuntimeError(f"Missing semantic wheel hierarchy for {key}")
        if spin.parent != pivot or static.parent != pivot:
            raise RuntimeError(f"Semantic wheel children are not under WheelPivot_{key}")
        if is_descendant(panel, spin):
            raise RuntimeError(f"Rear Hard Rock panel is inside WheelSpin_{key}")

        protected = [obj for obj in static.children_recursive] + [panel]
        before = {obj.name: obj.matrix_world.copy() for obj in protected}
        old_rotation = spin.rotation_euler.copy()
        spin.rotation_euler.x += math.pi / 2
        bpy.context.view_layer.update()
        for obj in protected:
            if not matrix_close(obj.matrix_world, before[obj.name]):
                raise RuntimeError(
                    f"{obj.name} moved while validating WheelSpin_{key}: "
                    f"matrix delta={matrix_delta(obj.matrix_world, before[obj.name]):.8f}"
                )
        spin.rotation_euler = old_rotation
        bpy.context.view_layer.update()


def select_hierarchy(root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(path: Path) -> None:
    root = bpy.data.objects.get("F1_Car")
    if root is None:
        raise RuntimeError("Missing F1_Car root")
    select_hierarchy(root)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_materials="EXPORT",
        export_normals=True,
        export_texcoords=True,
        export_attributes=True,
    )


def main() -> None:
    reset_scene()
    import_source()
    root = bpy.data.objects.get("F1_Car")
    if root is None:
        raise RuntimeError("Source GLB has no F1_Car root")
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("Source GLB imported without mesh objects")
    rebuild_result = rebuild_semantic_wheels(mesh_objects)
    rear_panel = extract_rear_hard_rock_panel(
        root,
        rebuild_result["panels"],
        rebuild_result["rear_body"],
    )
    if rear_panel.name != "RearHardRockAeroPanel":
        raise RuntimeError("Rear Hard Rock panel naming contract failed")
    validate_scene_contract()
    export_glb(OUTPUT_UNCOMPRESSED_GLB)
    print(f"F1 showroom v2 export complete: {OUTPUT_UNCOMPRESSED_GLB}")


if __name__ == "__main__":
    main()
