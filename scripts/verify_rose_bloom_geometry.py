from __future__ import annotations

import math
from itertools import combinations
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

MODEL = Path(__file__).resolve().parent.parent / "public/models/rose.glb"
FRAMES = (1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 105, 120, 135)
MAX_INTERSECTING_PAIRS = 80
MAX_TRIANGLE_PAIRS = 40_000
MAX_ROTATION_DEGREES = 8.05


def material_names(obj):
    return {material.name for material in obj.data.materials if material} if obj.type == "MESH" else set()


def evaluated_bvh(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=1e-5)
    finally:
        evaluated.to_mesh_clear()


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(MODEL))
petals = sorted(
    [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and "m_petal" in material_names(obj)],
    key=lambda obj: obj.name,
)
if len(petals) != 25:
    raise RuntimeError(f"Expected 25 petals, found {len(petals)}")

bpy.context.scene.frame_set(135)
bpy.context.view_layer.update()
final_rotations = {petal: petal.matrix_world.to_quaternion() for petal in petals}

for frame in FRAMES:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    bvhs = {petal: evaluated_bvh(petal) for petal in petals}
    overlaps = [
        len(bvhs[left].overlap(bvhs[right]))
        for left, right in combinations(petals, 2)
    ]
    intersecting_pairs = sum(count > 0 for count in overlaps)
    triangle_pairs = sum(overlaps)
    maximum_rotation = max(
        math.degrees(petal.matrix_world.to_quaternion().rotation_difference(final_rotations[petal]).angle)
        for petal in petals
    )
    print(
        f"FRAME {frame:03d}: intersecting_pairs={intersecting_pairs:03d} "
        f"triangle_pairs={triangle_pairs:05d} rotation_max={maximum_rotation:05.2f}"
    )
    if intersecting_pairs > MAX_INTERSECTING_PAIRS:
        raise RuntimeError(f"Frame {frame} has {intersecting_pairs} intersecting petal pairs")
    if triangle_pairs > MAX_TRIANGLE_PAIRS:
        raise RuntimeError(f"Frame {frame} has {triangle_pairs} overlapping triangle pairs")
    if maximum_rotation > MAX_ROTATION_DEGREES:
        raise RuntimeError(f"Frame {frame} rotates a petal by {maximum_rotation:.3f} degrees")

print("PASS: sampled rose bloom geometry stays within intersection and rotation limits")
