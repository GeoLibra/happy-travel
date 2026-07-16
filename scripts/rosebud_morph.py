from __future__ import annotations

import math
from dataclasses import dataclass

from mathutils import Quaternion, Vector

ROOT_LOCK_END = 0.15
EPSILON = 1e-12


@dataclass(frozen=True)
class MorphSettings:
    opening_frame: int
    bend_radians: float
    radial_pull: float
    tangential_offset: float


def smoothstep01(value: float) -> float:
    value = min(max(value, 0.0), 1.0)
    return value * value * (3.0 - 2.0 * value)


def _stable_bend_axis(growth: Vector, desired: Vector) -> Vector:
    axis = growth.cross(desired)
    if axis.length_squared <= EPSILON:
        axis = growth.cross(Vector((0.0, 0.0, 1.0)))
    if axis.length_squared <= EPSILON:
        axis = growth.cross(Vector((1.0, 0.0, 0.0)))
    if axis.length_squared <= EPSILON:
        raise ValueError('Could not compute a stable bend axis')
    return axis.normalized()


def generate_bud_world_positions(
    open_points: list[Vector],
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    settings: MorphSettings,
    petal_index: int,
) -> tuple[list[Vector], list[float]]:
    growth = centroid - origin
    growth_length = growth.length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    growth_direction = growth / growth_length
    inward = Vector((flower_center.x - origin.x, flower_center.y - origin.y, 0.0))
    if inward.length_squared <= EPSILON:
        raise ValueError('Petal inward direction is degenerate')
    inward.normalize()
    desired = (inward + Vector((0.0, 0.0, 0.65))).normalized()
    bend_axis = _stable_bend_axis(growth_direction, desired)
    tangent = Vector((-inward.y, inward.x, 0.0))
    tangent_sign = -1.0 if petal_index % 2 else 1.0

    closed_points = []
    parameters = []
    for point in open_points:
        parameter = min(max((point - origin).dot(growth_direction) / growth_length, 0.0), 1.0)
        parameters.append(parameter)
        if parameter <= ROOT_LOCK_END:
            closed_points.append(point.copy())
            continue
        weight = smoothstep01((parameter - ROOT_LOCK_END) / (1.0 - ROOT_LOCK_END))
        curved = origin + Quaternion(bend_axis, settings.bend_radians * weight) @ (point - origin)
        axis_point = Vector((flower_center.x, flower_center.y, curved.z))
        curved += (axis_point - curved) * (settings.radial_pull * weight)
        curved += tangent * (growth_length * settings.tangential_offset * tangent_sign * weight)
        if not all(math.isfinite(component) for component in curved):
            raise ValueError('Morph deformation produced a non-finite vertex')
        closed_points.append(curved)
    return closed_points, parameters
