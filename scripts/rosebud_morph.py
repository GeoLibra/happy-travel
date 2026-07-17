from __future__ import annotations

import math
from dataclasses import dataclass

from mathutils import Quaternion, Vector

ROOT_LOCK_END = 0.15
EPSILON = 1e-12


def compute_angular_guide_indices(
    named_centroids: list[tuple[str, Vector]],
    flower_center: Vector,
) -> dict[str, int]:
    if not named_centroids:
        raise ValueError('Angular guide ranking requires petals')
    if len(named_centroids) % 2 != 0:
        raise ValueError('Angular guide ranking requires an even petal count')
    if not all(math.isfinite(component) for component in flower_center):
        raise ValueError('Flower center must be finite')
    names = [name for name, _ in named_centroids]
    if len(set(names)) != len(names):
        raise ValueError('Angular guide ranking requires unique names')
    ranked = []
    for name, centroid in named_centroids:
        if not all(math.isfinite(component) for component in centroid):
            raise ValueError('Petal centroid must be finite')
        dx = centroid.x - flower_center.x
        dy = centroid.y - flower_center.y
        if dx * dx + dy * dy <= EPSILON:
            raise ValueError('Petal angular sector is degenerate')
        ranked.append((math.atan2(dy, dx), name))
    ranked.sort(key=lambda item: (item[0], item[1]))
    return {name: rank for rank, (_, name) in enumerate(ranked)}


def apply_angular_guide_phase(
    angular_indices: dict[str, int],
    phase: int,
) -> dict[str, int]:
    if phase not in (0, 1):
        raise ValueError('Angular guide phase must be 0 or 1')
    if not angular_indices:
        raise ValueError('Angular guide phase requires indices')
    ranks = sorted(angular_indices.values())
    if ranks != list(range(len(ranks))):
        raise ValueError('Angular guide ranks must be contiguous from zero')
    if len(ranks) % 2 != 0:
        raise ValueError('Angular guide phase requires an even rank count')
    phased = {name: rank + phase for name, rank in angular_indices.items()}
    parity_counts = [sum(index % 2 == parity for index in phased.values()) for parity in (0, 1)]
    if parity_counts != [len(phased) // 2, len(phased) // 2]:
        raise ValueError('Angular guide phase must split parity evenly')
    ordered = [name for name, _ in sorted(angular_indices.items(), key=lambda item: item[1])]
    for position, name in enumerate(ordered):
        next_name = ordered[(position + 1) % len(ordered)]
        if phased[name] % 2 == phased[next_name] % 2:
            raise ValueError('Adjacent angular guides must alternate parity')
    return phased


@dataclass(frozen=True)
class MorphSettings:
    opening_frame: int
    bend_radians: float
    guide_radius_ratio: float
    guide_height_ratio: float
    guide_pull: float
    angular_offset_radians: float
    tip_guide_radius_ratio: float | None = None
    tip_guide_height_ratio: float | None = None
    alternate_tip_guide_radius_ratio: float | None = None
    alternate_tip_guide_height_ratio: float | None = None
    tip_blend_start: float | None = None


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


def _compute_guide_point_for_ratios(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    radius_ratio: float,
    height_ratio: float,
    angular_offset_radians: float,
    petal_index: int,
) -> Vector:
    sector = Vector((centroid.x - flower_center.x, centroid.y - flower_center.y, 0.0))
    if sector.length_squared <= EPSILON:
        raise ValueError('Petal sector direction is degenerate')
    sector.normalize()
    sign = -1.0 if petal_index % 2 else 1.0
    sector = Quaternion(Vector((0.0, 0.0, 1.0)), angular_offset_radians * sign) @ sector
    growth_length = (centroid - origin).length
    if growth_length <= EPSILON:
        raise ValueError('Petal growth direction is degenerate')
    return Vector((
        flower_center.x + sector.x * maximum_radius * radius_ratio,
        flower_center.y + sector.y * maximum_radius * radius_ratio,
        origin.z + growth_length * height_ratio,
    ))


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
    return _compute_guide_point_for_ratios(
        origin,
        flower_center,
        centroid,
        maximum_radius,
        settings.guide_radius_ratio,
        settings.guide_height_ratio,
        settings.angular_offset_radians,
        petal_index,
    )


def compute_tip_guide_point(
    origin: Vector,
    flower_center: Vector,
    centroid: Vector,
    maximum_radius: float,
    settings: MorphSettings,
    petal_index: int,
) -> Vector | None:
    values = (
        settings.tip_guide_radius_ratio,
        settings.tip_guide_height_ratio,
        settings.alternate_tip_guide_radius_ratio,
        settings.alternate_tip_guide_height_ratio,
        settings.tip_blend_start,
    )
    if all(value is None for value in values):
        return None
    if any(value is None for value in values):
        raise ValueError('Tip guide settings must be provided together')
    if not all(math.isfinite(value) for value in values):
        raise ValueError('Tip guide settings must be finite')
    even_radius, even_height, odd_radius, odd_height, blend_start = values
    if not 0.0 < even_radius <= 1.0 or not 0.0 < odd_radius <= 1.0:
        raise ValueError('Tip guide radius ratios must be in (0, 1]')
    if even_height <= 0.0 or odd_height <= 0.0:
        raise ValueError('Tip guide height ratios must be positive')
    if not ROOT_LOCK_END < blend_start < 1.0:
        raise ValueError('Tip blend start must be between root lock and 1')
    compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, petal_index)
    radius_ratio = odd_radius if petal_index % 2 else even_radius
    height_ratio = odd_height if petal_index % 2 else even_height
    return _compute_guide_point_for_ratios(
        origin,
        flower_center,
        centroid,
        maximum_radius,
        radius_ratio,
        height_ratio,
        settings.angular_offset_radians,
        petal_index,
    )


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
    body_guide = compute_guide_point(
        origin, flower_center, centroid, maximum_radius, settings, petal_index
    )
    tip_guide = compute_tip_guide_point(
        origin, flower_center, centroid, maximum_radius, settings, petal_index
    )
    desired = (body_guide - origin).normalized()
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
        body_line_point = origin + (body_guide - origin) * parameter
        guide_line_point = body_line_point
        if tip_guide is not None:
            tip_blend = smoothstep01(
                (parameter - settings.tip_blend_start) / (1.0 - settings.tip_blend_start)
            )
            tip_line_point = origin + (tip_guide - origin) * parameter
            guide_line_point = body_line_point.lerp(tip_line_point, tip_blend)
        curved += (guide_line_point - curved) * (settings.guide_pull * weight)
        if not all(math.isfinite(component) for component in curved):
            raise ValueError('Morph deformation produced a non-finite vertex')
        closed_points.append(curved)
    return closed_points, parameters
