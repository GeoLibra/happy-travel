"""Prepare the 2024 RB20 GLB for the interactive showroom.

The source already contains a useful native part hierarchy. This script keeps
that hierarchy intact and adds only the semantic groups required by runtime:
four exact wheel-spin nodes, static wheel-adjacent groups, and a rear-body
assembly for coherent explode/reassemble motion.
"""

from pathlib import Path

import bpy
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_GLB = PROJECT_ROOT / "src/model/2024_redbull_rb20.glb"
OUTPUT_GLB = PROJECT_ROOT / "public/models/2024_redbull_rb20_showroom_v5-uncompressed.glb"

# Native source names and their runtime names. LF/RF are front wheels in this
# asset, while LR/RR are rear wheels.
WHEELS = {
    "FL": ("WHEEL_LF_", "HUB_LF_"),
    "FR": ("WHEEL_RF_", "HUB_RF_"),
    "RL": ("WHEEL_LR_", "HUB_LR_"),
    "RR": ("WHEEL_RR_", "HUB_RR_"),
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def find_prefix(prefix: str) -> bpy.types.Object:
    matches = [obj for obj in bpy.context.scene.objects if obj.name.startswith(prefix)]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one object beginning {prefix!r}, got {[obj.name for obj in matches]}")
    return matches[0]


def matrix_delta(first: Matrix, second: Matrix) -> float:
    return max(abs(first[r][c] - second[r][c]) for r in range(4) for c in range(4))


def parent_preserving_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    before = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.matrix_world = before
    bpy.context.view_layer.update()
    if matrix_delta(obj.matrix_world, before) > 1e-5:
        raise RuntimeError(f"Reparenting changed {obj.name}'s world transform")


def new_empty(name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        parent_preserving_world(obj, parent)
    return obj


def ancestors(obj: bpy.types.Object):
    current = obj.parent
    while current is not None:
        yield current
        current = current.parent


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for child in [obj, *obj.children_recursive]:
        if child.type == "MESH":
            points.extend(child.matrix_world @ Vector(corner) for corner in child.bound_box)
    if not points:
        raise RuntimeError(f"{obj.name} has no mesh bounds")
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def build_root() -> bpy.types.Object:
    source_roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    if not source_roots:
        raise RuntimeError("Imported RB20 has no scene root")
    root = new_empty("F1_Car")
    root["asset"] = "2024_redbull_rb20"
    root["semantic_role"] = "showroom_car_root"
    for source_root in source_roots:
        if source_root != root:
            parent_preserving_world(source_root, root)
    return root


def build_wheels(root: bpy.types.Object) -> None:
    for runtime_key, (wheel_prefix, hub_prefix) in WHEELS.items():
        wheel = find_prefix(wheel_prefix)
        hub = find_prefix(hub_prefix)
        bounds_min, bounds_max = world_bounds(wheel)
        center = (bounds_min + bounds_max) * 0.5
        _, axle_rotation, _ = wheel.matrix_world.decompose()

        pivot = new_empty(f"WheelPivot_{runtime_key}", root)
        # The native wheels carry real camber/toe. Orient the pivot from the
        # native WHEEL transform so WheelSpin's local X is the actual axle,
        # rather than the car/world X axis.
        pivot.matrix_world = Matrix.LocRotScale(center, axle_rotation, Vector((1.0, 1.0, 1.0)))
        pivot["semantic_role"] = "wheel_pivot"
        spin = new_empty(f"WheelSpin_{runtime_key}", pivot)
        spin.location = (0.0, 0.0, 0.0)
        spin.rotation_euler = (0.0, 0.0, 0.0)
        spin.scale = (1.0, 1.0, 1.0)
        spin["semantic_role"] = "rotating_wheel_assembly"
        static = new_empty(f"WheelStatic_{runtime_key}", pivot)
        static.location = (0.0, 0.0, 0.0)
        static.rotation_euler = (0.0, 0.0, 0.0)
        static.scale = (1.0, 1.0, 1.0)
        static["semantic_role"] = "stationary_wheel_hardware"

        # Only the native WHEEL subtree rotates. The HUB/SUSP/INTAKE ancestry
        # stays in the body hierarchy and therefore cannot be spun by runtime.
        parent_preserving_world(wheel, spin)
        parent_preserving_world(hub, static)
        hub["semantic_role"] = "stationary_hub_and_suspension"


def build_rear_body(root: bpy.types.Object) -> None:
    rear_wing_candidates = [
        obj for obj in bpy.context.scene.objects
        if obj.name.startswith("RWING")
    ]
    if not rear_wing_candidates:
        raise RuntimeError("New RB20 has no RWING hierarchy")

    # Reparent only the highest selected ancestors so every native rear-wing
    # child remains attached to its semantic assembly exactly once.
    selected = set(rear_wing_candidates)
    rear_wing_roots = [
        obj for obj in rear_wing_candidates
        if not any(parent in selected for parent in ancestors(obj))
    ]
    rear_body = new_empty("RearBodyAssembly", root)
    rear_body["semantic_role"] = "rear_body_explosion_group"
    panel = new_empty("RearHardRockAeroPanel", rear_body)
    panel["semantic_role"] = "rear_wing_body_panel_assembly"
    for rear_wing in rear_wing_roots:
        parent_preserving_world(rear_wing, panel)

    if not any(obj.type == "MESH" for obj in panel.children_recursive):
        raise RuntimeError("RearHardRockAeroPanel contains no rear-wing geometry")


def is_descendant(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    return any(parent == ancestor for parent in ancestors(obj))


def validate_contract() -> None:
    panel = bpy.data.objects.get("RearHardRockAeroPanel")
    rear_body = bpy.data.objects.get("RearBodyAssembly")
    if panel is None or rear_body is None or panel.parent != rear_body:
        raise RuntimeError("Rear body semantic hierarchy is invalid")

    for key, (wheel_prefix, hub_prefix) in WHEELS.items():
        pivot = bpy.data.objects.get(f"WheelPivot_{key}")
        spin = bpy.data.objects.get(f"WheelSpin_{key}")
        static = bpy.data.objects.get(f"WheelStatic_{key}")
        wheel = find_prefix(wheel_prefix)
        hub = find_prefix(hub_prefix)
        if pivot is None or spin is None or static is None:
            raise RuntimeError(f"Missing semantic wheel nodes for {key}")
        if spin.parent != pivot or static.parent != pivot:
            raise RuntimeError(f"Invalid semantic wheel hierarchy for {key}")
        if wheel.parent != spin or not any(obj.type == "MESH" for obj in spin.children_recursive):
            raise RuntimeError(f"WheelSpin_{key} does not exclusively own its native wheel subtree")
        if is_descendant(hub, spin) or is_descendant(panel, spin):
            raise RuntimeError(f"Static bodywork is incorrectly owned by WheelSpin_{key}")

        protected = [hub, *hub.children_recursive, panel, *panel.children_recursive]
        protected = [obj for obj in protected if not is_descendant(obj, spin)]
        before = {obj.name: obj.matrix_world.copy() for obj in protected}
        spin.rotation_euler.x += 1.2
        bpy.context.view_layer.update()
        for obj in protected:
            if matrix_delta(obj.matrix_world, before[obj.name]) > 1e-5:
                raise RuntimeError(f"{obj.name} moved while testing WheelSpin_{key}")
        spin.rotation_euler.x = 0.0
        bpy.context.view_layer.update()


def export_glb(root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
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
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    bpy.context.view_layer.update()
    root = build_root()
    build_wheels(root)
    build_rear_body(root)
    validate_contract()
    export_glb(root)
    print(f"RB20 showroom v5 export complete: {OUTPUT_GLB}")


if __name__ == "__main__":
    main()
