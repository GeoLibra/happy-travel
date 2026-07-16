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
    guide_radius_ratio: float
    guide_height_ratio: float
    guide_pull: float
    angular_offset_radians: float


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


def compute_guide_point(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    settings: MorphSettings,
    petal_index: int,
) -> Vector:
    if not math.isfinite(maximum_radius) or maximum_radius <= EPSILON:
        raise ValueError('Maximum petal radius is degenerate')
    numeric_settings = (
        settings.bend_radians,
        settings.guide_radius_ratio,
        settings.guide_height_ratio,
        settings.guide_pull,
        settings.angular_offset_radians,
    )
    if not all(math.isfinite(value) for value in numeric_settings):
        raise ValueError('Guide settings must be finite')
    if not 0.0 < settings.guide_radius_ratio <= 1.0:
        raise ValueError('Guide radius ratio must be in (0, 1]')
    if settings.guide_height_ratio <= 0.0:
        raise ValueError('Guide height ratio must be positive')
    if not 0.0 <= settings.guide_pull <= 1.0:
        raise ValueError('Guide pull must be in [0, 1]')
    sector = Vector((centroid.x - flower_center.x, centroid.y - flower_center.y, 0.0))
    if sector.length_squared <= EPSILON:
        raise ValueError('Petal sector direction is degenerate')
    sector.normalize()
    sign = -1.0 if petal_index % 2 else 1.0
    sector = Quaternion(Vector((0.0, 0.0, 1.0)), settings.angular_offset_radians * sign) @ sector
    growth_length = (centroid - origin).length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    return Vector((
        flower_center.x + sector.x * maximum_radius * settings.guide_radius_ratio,
        flower_center.y + sector.y * maximum_radius * settings.guide_radius_ratio,
        origin.z + growth_length * settings.guide_height_ratio,
    ))


def generate_bud_world_positions(
    open_points: list[Vector],
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    settings: MorphSettings,
    petal_index: int,
) -> tuple[list[Vector], list[float]]:
    growth = centroid - origin
    growth_length = growth.length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    growth_direction = growth / growth_length
    guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index)
    desired = (guide - origin).normalized()
    bend_axis = _stable_bend_axis(growth_direction, desired)

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
        guide_line_point = origin + (guide - origin) * parameter
        curved += (guide_line_point - curved) * (settings.guide_pull * weight)
        if not all(math.isfinite(component) for component in curved):
            raise ValueError('Morph deformation produced a non-finite vertex')
        closed_points.append(curved)
    return closed_points, parameters
