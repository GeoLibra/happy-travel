import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rosebud_morph import (
    ROOT_LOCK_END,
    MorphSettings,
    compute_guide_point,
    generate_bud_world_positions,
    smoothstep01,
)

nested = MorphSettings(
    opening_frame=34,
    bend_radians=math.radians(38.0),
    guide_radius_ratio=0.04,
    guide_height_ratio=1.10,
    guide_pull=0.90,
    angular_offset_radians=math.radians(3.0),
    alternate_guide_radius_ratio=0.09,
    alternate_guide_height_ratio=1.04,
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0
points = [origin + Vector((0.01, 0.0, 0.05)), Vector((1.1, 0.0, 0.5)), centroid]

even_guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, nested, 2)
odd_guide = compute_guide_point(origin, flower_center, centroid, maximum_radius, nested, 3)
even_radius = math.hypot(even_guide.x - flower_center.x, even_guide.y - flower_center.y)
odd_radius = math.hypot(odd_guide.x - flower_center.x, odd_guide.y - flower_center.y)
growth_length = (centroid - origin).length
assert abs(even_radius - maximum_radius * 0.04) <= 1e-6
assert abs(odd_radius - maximum_radius * 0.09) <= 1e-6
assert abs(even_guide.z - (origin.z + growth_length * 1.10)) <= 1e-6
assert abs(odd_guide.z - (origin.z + growth_length * 1.04)) <= 1e-6
assert (Vector((even_guide.x, even_guide.y)) - Vector((odd_guide.x, odd_guide.y))).length > 0.05

single = MorphSettings(18, math.radians(24.0), 0.30, 0.90, 0.45, math.radians(2.0))
single_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 2)
single_odd = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 3)
assert abs(math.hypot(single_even.x, single_even.y) - 0.60) <= 1e-6
assert abs(math.hypot(single_odd.x, single_odd.y) - 0.60) <= 1e-6

for incomplete in (
    MorphSettings(34, 0.1, 0.04, 1.10, 0.90, 0.0, 0.09, None),
    MorphSettings(34, 0.1, 0.04, 1.10, 0.90, 0.0, None, 1.04),
):
    try:
        compute_guide_point(origin, flower_center, centroid, maximum_radius, incomplete, 0)
    except ValueError as error:
        assert 'alternate guide radius and height' in str(error).lower()
    else:
        raise AssertionError('Partial alternate guide settings must fail')

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, maximum_radius, nested, petal_index=2
)
assert smoothstep01(-1.0) == 0.0
assert smoothstep01(2.0) == 1.0
assert parameters[0] <= ROOT_LOCK_END
assert (closed[0] - points[0]).length <= 1e-5
assert (closed[-1] - even_guide).length < (points[-1] - even_guide).length
assert all(math.isfinite(component) for point in closed for component in point)

for bad_settings in (
    MorphSettings(18, 0.1, 0.0, 0.9, 0.45, 0.0),
    MorphSettings(18, 0.1, 0.3, 0.9, 1.1, 0.0),
    MorphSettings(18, float('nan'), 0.3, 0.9, 0.45, 0.0),
):
    try:
        compute_guide_point(origin, flower_center, centroid, maximum_radius, bad_settings, 0)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid guide settings must fail')

try:
    compute_guide_point(origin, flower_center, centroid, float('nan'), nested, 0)
except ValueError:
    pass
else:
    raise AssertionError('Invalid maximum radius must fail')

try:
    generate_bud_world_positions(
        points, origin, flower_center, origin, maximum_radius, nested, petal_index=0
    )
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')

print('PASS: rosebud morph deformation math verified')
