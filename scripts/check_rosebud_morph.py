import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rosebud_morph import (
    ROOT_LOCK_END,
    MorphSettings,
    compute_angular_guide_indices,
    compute_guide_point,
    compute_tip_guide_point,
    generate_bud_world_positions,
    smoothstep01,
)

circle_points = [
    ('ne', Vector((1.0, 1.0, 0.5))),
    ('w', Vector((-1.0, 0.0, 0.5))),
    ('se', Vector((1.0, -1.0, 0.5))),
    ('n', Vector((0.0, 1.0, 0.5))),
    ('sw', Vector((-1.0, -1.0, 0.5))),
    ('e', Vector((1.0, 0.0, 0.5))),
    ('nw', Vector((-1.0, 1.0, 0.5))),
    ('s', Vector((0.0, -1.0, 0.5))),
]
angular_indices = compute_angular_guide_indices(circle_points, Vector((0.0, 0.0, 0.5)))
expected_order = ['sw', 's', 'se', 'e', 'ne', 'n', 'nw', 'w']
assert [name for name, _ in sorted(angular_indices.items(), key=lambda item: item[1])] == expected_order
assert angular_indices == compute_angular_guide_indices(
    list(reversed(circle_points)), Vector((0.0, 0.0, 0.5))
)
for rank in range(len(expected_order)):
    assert rank % 2 != ((rank + 1) % len(expected_order)) % 2

invalid_rank_inputs = (
    [],
    [('same', Vector((1.0, 0.0, 0.0))), ('same', Vector((-1.0, 0.0, 0.0)))],
    [('center', Vector((0.0, 0.0, 0.0))), ('e', Vector((1.0, 0.0, 0.0)))],
    [('nan', Vector((float('nan'), 1.0, 0.0))), ('e', Vector((1.0, 0.0, 0.0)))],
    [
        ('a', Vector((1.0, 0.0, 0.0))),
        ('b', Vector((0.0, 1.0, 0.0))),
        ('c', Vector((-1.0, 0.0, 0.0))),
    ],
)
for invalid in invalid_rank_inputs:
    try:
        compute_angular_guide_indices(invalid, Vector((0.0, 0.0, 0.0)))
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid angular guide input must fail')

try:
    compute_angular_guide_indices(circle_points, Vector((float('inf'), 0.0, 0.0)))
except ValueError:
    pass
else:
    raise AssertionError('Non-finite flower center must fail')

tip_local = MorphSettings(
    opening_frame=34,
    bend_radians=math.radians(38.0),
    guide_radius_ratio=0.12,
    guide_height_ratio=1.05,
    guide_pull=0.90,
    angular_offset_radians=math.radians(3.0),
    tip_guide_radius_ratio=0.04,
    tip_guide_height_ratio=1.10,
    alternate_tip_guide_radius_ratio=0.09,
    alternate_tip_guide_height_ratio=1.04,
    tip_blend_start=0.65,
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0
points = [origin + Vector((0.01, 0.0, 0.05)), Vector((1.1, 0.0, 0.5)), centroid]
growth = centroid - origin

body_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 2)
body_odd = compute_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 3)
tip_even = compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 2)
tip_odd = compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, tip_local, 3)
assert tip_even is not None and tip_odd is not None
assert abs(math.hypot(body_even.x, body_even.y) - maximum_radius * 0.12) <= 1e-6
assert abs(math.hypot(body_odd.x, body_odd.y) - maximum_radius * 0.12) <= 1e-6
assert abs(math.hypot(tip_even.x, tip_even.y) - maximum_radius * 0.04) <= 1e-6
assert abs(math.hypot(tip_odd.x, tip_odd.y) - maximum_radius * 0.09) <= 1e-6
assert abs(tip_even.z - (origin.z + growth.length * 1.10)) <= 1e-6
assert abs(tip_odd.z - (origin.z + growth.length * 1.04)) <= 1e-6

single = MorphSettings(34, math.radians(38.0), 0.12, 1.05, 0.90, math.radians(3.0))
single_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 2)
single_odd = compute_guide_point(origin, flower_center, centroid, maximum_radius, single, 3)
assert abs(math.hypot(single_even.x, single_even.y) - maximum_radius * 0.12) <= 1e-6
assert abs(math.hypot(single_odd.x, single_odd.y) - maximum_radius * 0.12) <= 1e-6

sample_points = [
    origin + growth * 0.05,
    origin + growth * 0.50,
    origin + growth * 0.65,
    origin + growth,
]
single_closed, single_parameters = generate_bud_world_positions(
    sample_points, origin, flower_center, centroid, maximum_radius, single, 2
)
tip_closed, tip_parameters = generate_bud_world_positions(
    sample_points, origin, flower_center, centroid, maximum_radius, tip_local, 2
)
assert single_parameters == tip_parameters
assert (single_closed[1] - tip_closed[1]).length <= 1e-6
assert (single_closed[2] - tip_closed[2]).length <= 1e-6
assert (single_closed[3] - tip_closed[3]).length > 1e-4
assert compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, single, 2) is None

tip_values = (0.04, 1.10, 0.09, 1.04, 0.65)
for missing_index in range(len(tip_values)):
    incomplete = list(tip_values)
    incomplete[missing_index] = None
    settings = MorphSettings(34, 0.1, 0.12, 1.05, 0.90, 0.0, *incomplete)
    try:
        compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, settings, 0)
    except ValueError as error:
        assert 'tip guide settings must be provided together' in str(error).lower()
    else:
        raise AssertionError('Partial tip guide settings must fail')

for invalid_start in (ROOT_LOCK_END, 1.0, float('nan')):
    settings = MorphSettings(
        34, 0.1, 0.12, 1.05, 0.90, 0.0, 0.04, 1.10, 0.09, 1.04, invalid_start
    )
    try:
        compute_tip_guide_point(origin, flower_center, centroid, maximum_radius, settings, 0)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid tip blend start must fail')

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, maximum_radius, tip_local, petal_index=2
)
assert smoothstep01(-1.0) == 0.0
assert smoothstep01(2.0) == 1.0
assert parameters[0] <= ROOT_LOCK_END
assert (closed[0] - points[0]).length <= 1e-5
assert (single_closed[-1] - body_even).length < (sample_points[-1] - body_even).length
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
    compute_guide_point(origin, flower_center, centroid, float('nan'), tip_local, 0)
except ValueError:
    pass
else:
    raise AssertionError('Invalid maximum radius must fail')

try:
    generate_bud_world_positions(
        points, origin, flower_center, origin, maximum_radius, tip_local, petal_index=0
    )
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')

print('PASS: rosebud morph deformation math verified')
