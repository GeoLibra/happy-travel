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

settings = MorphSettings(
    opening_frame=18,
    bend_radians=math.radians(24.0),
    guide_radius_ratio=0.30,
    guide_height_ratio=0.90,
    guide_pull=0.45,
    angular_offset_radians=math.radians(2.0),
)
origin = Vector((1.0, 0.0, 0.0))
centroid = Vector((1.2, 0.0, 1.0))
flower_center = Vector((0.0, 0.0, 0.5))
maximum_radius = 2.0
points = [origin + Vector((0.01, 0.0, 0.05)), Vector((1.1, 0.0, 0.5)), centroid]

guide_even = compute_guide_point(origin, flower_center, centroid, maximum_radius, settings, 2)
guide_odd = compute_guide_point(origin, flower_center, Vector((0.0, 1.2, 1.0)), maximum_radius, settings, 3)
assert abs(math.hypot(guide_even.x - flower_center.x, guide_even.y - flower_center.y) - 0.60) <= 1e-6
assert (Vector((guide_even.x, guide_even.y)) - Vector((guide_odd.x, guide_odd.y))).length > 0.25

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, maximum_radius, settings, petal_index=2
)
assert smoothstep01(-1.0) == 0.0
assert smoothstep01(2.0) == 1.0
assert parameters[0] <= ROOT_LOCK_END
assert (closed[0] - points[0]).length <= 1e-5
assert (closed[-1] - guide_even).length < (points[-1] - guide_even).length
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
    compute_guide_point(origin, flower_center, centroid, float('nan'), settings, 0)
except ValueError:
    pass
else:
    raise AssertionError('Invalid maximum radius must fail')

try:
    generate_bud_world_positions(
        points, origin, flower_center, origin, maximum_radius, settings, petal_index=0
    )
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')

print('PASS: rosebud morph deformation math verified')
