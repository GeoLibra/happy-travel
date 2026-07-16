import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rosebud_morph import MorphSettings, generate_bud_world_positions, smoothstep01

settings = MorphSettings(
    opening_frame=18,
    bend_radians=math.radians(30.0),
    radial_pull=0.25,
    tangential_offset=0.025,
)
origin = Vector((0.0, 0.0, 0.0))
centroid = Vector((1.0, 0.0, 1.0))
flower_center = Vector((0.0, 1.0, 0.5))
points = [
    Vector((0.05, 0.0, 0.05)),
    Vector((0.5, 0.0, 0.5)),
    Vector((1.0, 0.0, 1.0)),
]

closed, parameters = generate_bud_world_positions(
    points, origin, flower_center, centroid, settings, petal_index=2
)
assert smoothstep01(-1.0) == 0.0
assert smoothstep01(2.0) == 1.0
assert parameters[0] <= 0.15
assert (closed[0] - points[0]).length <= 1e-5
assert math.hypot(closed[-1].x - flower_center.x, closed[-1].y - flower_center.y) < math.hypot(points[-1].x - flower_center.x, points[-1].y - flower_center.y)
assert all(math.isfinite(component) for point in closed for component in point)

try:
    generate_bud_world_positions(points, origin, flower_center, origin, settings, petal_index=0)
except ValueError as error:
    assert 'growth direction' in str(error)
else:
    raise AssertionError('Degenerate growth direction must fail')

print('PASS: rosebud morph deformation math verified')
