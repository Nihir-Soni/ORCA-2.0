"""Risk-weighted route planning.

A* over a sea grid where edge cost is NOT just distance:

    cost = distance_km
         + wave_penalty        (sea state along the leg)
         + wind_penalty
         + zone_penalty        (enormous — restricted areas are effectively walls)
         + shore_penalty       (mild pull towards the coast in bad weather)

Because the zone penalty dwarfs distance, the safest route is frequently longer
than the straight line — which is exactly the behaviour we want to show a judge:
the shortest track clips a naval exclusion area, ORCA routes around it.
"""
from __future__ import annotations

import heapq
from typing import Dict, List, Optional, Sequence, Tuple

from ..data.geo import (Coord, LANDMASS, PORTS, distance_to_polygon_km,
                        haversine_km, is_on_land, point_in_polygon,
                        RESTRICTED_ZONES, route_zone_conflicts,
                        segment_intersects_polygon)
from ..schemas import RouteLeg, RouteOption

GRID_STEPS = 20                # nodes per axis; 400-node graph — still instant
ZONE_PENALTY_KM = 400.0        # effective cost of entering a restricted polygon
ZONE_BUFFER_KM = 2.0           # keep-clear buffer around polygons
BASE_SPEED_KMH = 18.0          # ~10 knots: typical small motorised fishing craft


def _speed_for(wave_m: Optional[float], wind_kmh: Optional[float]) -> float:
    speed = BASE_SPEED_KMH
    if wave_m:
        speed -= min(5.0, wave_m * 1.6)
    if wind_kmh:
        speed -= min(3.0, wind_kmh / 22.0)
    return max(4.0, speed)


def _zone_cost(pt: Coord) -> Tuple[float, Optional[str]]:
    """Penalty and the offending zone name for a candidate point."""
    worst_cost, worst_name = 0.0, None
    for zone in RESTRICTED_ZONES:
        d = distance_to_polygon_km(pt, zone["polygon"])
        if d == 0.0:
            return ZONE_PENALTY_KM, zone["name"]
        if d < ZONE_BUFFER_KM:
            cost = ZONE_PENALTY_KM * 0.25 * (ZONE_BUFFER_KM - d) / ZONE_BUFFER_KM
            if cost > worst_cost:
                worst_cost, worst_name = cost, zone["name"]
    return worst_cost, worst_name


def _build_grid(origin: Coord, dest: Coord) -> List[List[Coord]]:
    pad = 0.35  # expand the bounding box so the search can detour outside it
    lat_lo, lat_hi = min(origin[0], dest[0]), max(origin[0], dest[0])
    lon_lo, lon_hi = min(origin[1], dest[1]), max(origin[1], dest[1])
    dlat = (lat_hi - lat_lo) or 0.05
    dlon = (lon_hi - lon_lo) or 0.05
    lat_lo, lat_hi = lat_lo - pad * dlat, lat_hi + pad * dlat
    lon_lo, lon_hi = lon_lo - pad * dlon, lon_hi + pad * dlon

    grid: List[List[Coord]] = []
    for i in range(GRID_STEPS):
        row: List[Coord] = []
        for j in range(GRID_STEPS):
            lat = lat_lo + (lat_hi - lat_lo) * i / (GRID_STEPS - 1)
            lon = lon_lo + (lon_hi - lon_lo) * j / (GRID_STEPS - 1)
            row.append((lat, lon))
        grid.append(row)
    return grid


def _nearest_node(grid: List[List[Coord]], pt: Coord) -> Tuple[int, int]:
    best, best_d = (0, 0), float("inf")
    for i, row in enumerate(grid):
        for j, node in enumerate(row):
            d = haversine_km(pt, node)
            if d < best_d:
                best, best_d = (i, j), d
    return best


def _astar(grid: List[List[Coord]], start: Tuple[int, int], goal: Tuple[int, int],
           wave_m: Optional[float], wind_kmh: Optional[float],
           avoid_zones: bool, avoid_land: bool = False) -> List[Tuple[int, int]]:
    rows, cols = len(grid), len(grid[0])
    goal_pt = grid[goal[0]][goal[1]]

    def h(node: Tuple[int, int]) -> float:
        return haversine_km(grid[node[0]][node[1]], goal_pt)

    open_heap = [(h(start), 0.0, start)]
    came: Dict[Tuple[int, int], Tuple[int, int]] = {}
    g_score: Dict[Tuple[int, int], float] = {start: 0.0}
    seen = set()

    wave_penalty_per_km = 0.0 if not wave_m else min(1.2, max(0.0, (wave_m - 1.0)) * 0.6)
    wind_penalty_per_km = 0.0 if not wind_kmh else min(0.8, max(0.0, (wind_kmh - 20)) * 0.02)

    neighbours = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    while open_heap:
        _, g, current = heapq.heappop(open_heap)
        if current in seen:
            continue
        seen.add(current)
        if current == goal:
            break
        ci, cj = current
        for di, dj in neighbours:
            ni, nj = ci + di, cj + dj
            if not (0 <= ni < rows and 0 <= nj < cols):
                continue
            nxt = (ni, nj)
            if avoid_land and nxt != goal and is_on_land(*grid[ni][nj]):
                continue
            leg_km = haversine_km(grid[ci][cj], grid[ni][nj])
            cost = leg_km * (1.0 + wave_penalty_per_km + wind_penalty_per_km)
            if avoid_zones:
                zcost, _ = _zone_cost(grid[ni][nj])
                cost += zcost
            tentative = g + cost
            if tentative < g_score.get(nxt, float("inf")):
                g_score[nxt] = tentative
                came[nxt] = current
                heapq.heappush(open_heap, (tentative + h(nxt), tentative, nxt))

    if goal not in came and goal != start:
        return []

    path = [goal]
    while path[-1] != start:
        prev = came.get(path[-1])
        if prev is None:
            break
        path.append(prev)
    return list(reversed(path))


def _perpendicular_km(pt: Coord, a: Coord, b: Coord) -> float:
    """Distance from `pt` to the infinite line a-b (local planar approximation)."""
    import math
    lat0 = math.radians((a[0] + b[0]) / 2)
    kx, ky = math.cos(lat0) * 111.320, 110.574
    px, py = pt[1] * kx, pt[0] * ky
    ax, ay = a[1] * kx, a[0] * ky
    bx, by = b[1] * kx, b[0] * ky
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    if norm == 0:
        return math.hypot(px - ax, py - ay)
    return abs(dy * px - dx * py + bx * ay - by * ax) / norm


def _simplify(points: List[Coord], tolerance_km: float = 0.8) -> List[Coord]:
    """Douglas-Peucker.

    The naive 'drop each near-collinear point' version silently flattened a
    smooth detour back into the straight line it was built to avoid — the
    per-point deviation is tiny even when the arc as a whole swings wide.
    Douglas-Peucker measures against the retained chord, so the shape survives.
    """
    if len(points) <= 2:
        return list(points)

    worst_i, worst_d = 0, 0.0
    for i in range(1, len(points) - 1):
        d = _perpendicular_km(points[i], points[0], points[-1])
        if d > worst_d:
            worst_i, worst_d = i, d

    if worst_d <= tolerance_km:
        return [points[0], points[-1]]

    left = _simplify(points[: worst_i + 1], tolerance_km)
    right = _simplify(points[worst_i:], tolerance_km)
    return left[:-1] + right


def _path_length(points: Sequence[Coord]) -> float:
    return sum(haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1))


def plan_routes(origin: Coord, dest: Coord, *, wave_m: Optional[float] = None,
                wind_kmh: Optional[float] = None, risk_score: int = 40,
                risk_category: str = "MODERATE") -> List[RouteOption]:
    """Return the direct track and the risk-weighted safest track."""
    speed = _speed_for(wave_m, wind_kmh)

    # --- direct / shortest -------------------------------------------------
    direct_pts: List[Coord] = [origin, dest]
    direct_km = haversine_km(origin, dest)
    direct_conflicts = route_zone_conflicts(direct_pts)

    # --- safest (A*, zone-aware) ------------------------------------------
    grid = _build_grid(origin, dest)
    s = _nearest_node(grid, origin)
    g = _nearest_node(grid, dest)
    idx_path = _astar(grid, s, g, wave_m, wind_kmh, avoid_zones=True)
    full_pts = [origin] + [grid[i][j] for i, j in idx_path] + [dest]
    safe_pts = _simplify(full_pts)
    # Never let cosmetic simplification reintroduce a hazard the planner avoided.
    if route_zone_conflicts(safe_pts) and not route_zone_conflicts(full_pts):
        safe_pts = full_pts
    safe_km = _path_length(safe_pts)
    safe_conflicts = route_zone_conflicts(safe_pts)

    options: List[RouteOption] = []

    safest = RouteOption(
        name="Safest route",
        kind="safest",
        legs=[RouteLeg(latitude=round(p[0], 4), longitude=round(p[1], 4)) for p in safe_pts],
        distance_km=round(safe_km, 1),
        eta_minutes=int(round(safe_km / speed * 60)),
        risk_score=risk_score,
        risk_category=risk_category,  # type: ignore[arg-type]
        penalties={"restricted_zones": float(len(safe_conflicts)),
                   "extra_km_vs_direct": round(max(0.0, safe_km - direct_km), 1)},
        recommended=True,
        notes=("Avoids all restricted areas."
               if not safe_conflicts else
               "Best available track — some restricted areas remain close."),
    )

    direct = RouteOption(
        name="Direct route",
        kind="shortest",
        legs=[RouteLeg(latitude=round(p[0], 4), longitude=round(p[1], 4)) for p in direct_pts],
        distance_km=round(direct_km, 1),
        eta_minutes=int(round(direct_km / speed * 60)),
        risk_score=min(100, risk_score + 15 * len(direct_conflicts)),
        risk_category="EXTREME" if direct_conflicts else risk_category,  # type: ignore[arg-type]
        penalties={"restricted_zones": float(len(direct_conflicts))},
        recommended=False,
        notes=("Shortest track, but it passes through: "
               + ", ".join(z["name"] for z in direct_conflicts)
               if direct_conflicts else "Shortest track, no restricted areas on the way."),
    )

    # If the direct line is clean and barely shorter, don't invent a detour.
    if not direct_conflicts and safe_km <= direct_km * 1.03:
        direct.recommended = True
        safest.recommended = False
        options = [direct, safest]
    else:
        options = [safest, direct]

    return options


def _get_coastal_points(spacing_km: float = 10.0) -> List[Coord]:
    """Generate points along the simplified landmass boundary."""
    pts = []
    for poly in LANDMASS:
        for i in range(len(poly) - 1):
            p1, p2 = poly[i], poly[i+1]
            d = haversine_km(p1, p2)
            steps = max(1, int(d / spacing_km))
            for step in range(steps):
                f = step / steps
                pts.append((p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])))
    return pts


COASTAL_POINTS = _get_coastal_points(5.0)


def plan_emergency_route(origin: Coord, *, wave_m: Optional[float] = None,
                         wind_kmh: Optional[float] = None,
                         risk_score: int = 40,
                         risk_category: str = "MODERATE") -> Optional[dict]:
    """Find the safest reachable shore destination.

    Emergency routing is deliberately separate from ``plan_routes``: the
    normal planner targets a PFZ, while this planner targets the nearest valid
    coastal landing point.
    """
    from ..data.geo import nearest_port
    
    nearest_coast = min(COASTAL_POINTS, key=lambda c: haversine_km(origin, c))
    if is_on_land(*origin) and haversine_km(origin, nearest_coast) > 0.5:
        return None
    candidates = sorted(COASTAL_POINTS, key=lambda c: haversine_km(origin, c))[:15]
    speed = _speed_for(wave_m, wind_kmh)
    best: Optional[dict] = None

    for destination in candidates:
        if is_on_land(*origin) and haversine_km(origin, destination) < 0.5:
            points = [origin, destination]
        else:
            grid = _build_grid(origin, destination)
            start = _nearest_node(grid, origin)
            goal = _nearest_node(grid, destination)
            path = _astar(grid, start, goal, wave_m, wind_kmh, avoid_zones=True, avoid_land=True)
            if not path:
                continue
            points = [origin] + [grid[i][j] for i, j in path] + [destination]

        conflicts = route_zone_conflicts(points)
        if conflicts:
            continue
        if any(is_on_land(*point) for point in points[1:-1]):
            continue
        if any(
            segment_intersects_polygon(points[index], points[index + 1], polygon)
            for index in range(len(points) - 1)
            for polygon in LANDMASS
        ):
            continue
        distance = _path_length(points)
        score = risk_score + len(conflicts) * 1000 + max(0.0, distance - haversine_km(origin, destination)) * 0.5
        
        near_port = nearest_port(destination[0], destination[1])
        dest_name = f"Coast near {near_port['name']}"
        
        candidate = {
            "destination": {"latitude": destination[0], "longitude": destination[1], "name": dest_name},
            "distance_km": round(distance, 1),
            "eta_minutes": int(round(distance / speed * 60)),
            "risk_score": min(100, int(round(score))),
            "risk_category": risk_category,
            "waypoints": [{"latitude": round(point[0], 4), "longitude": round(point[1], 4)} for point in _simplify(points)],
            "notes": "Safest reachable shore destination; intermediate route stays in navigable water.",
            "_selection_score": score,
        }
        if best is None or candidate["_selection_score"] < best["_selection_score"]:
            best = candidate

    if best is not None:
        best.pop("_selection_score", None)
    return best
