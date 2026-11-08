"""Additional checks for versioned architecture-aware layouts; old saved layouts remain loadable."""
from collections import deque
from .architecture import room_problems
from .geometry.geom import Rect, shared_edge


def usable_rooms(layout):
    if layout.architecture_version < 1: return []
    return [problem for room in layout.rooms for problem in room_problems(room)]


def circulation(layout):
    if layout.architecture_version < 1: return []
    # A court, bedroom, bathroom or workroom cannot be the only access to another room.
    transit = {'hall','living','dining','kitchen','entry'}
    links = {r.id:set() for r in layout.rooms}
    links['exterior'] = set()
    for door in layout.doors:
        if len(door.between) == 2 and all(r in links for r in door.between):
            a,b=door.between; links[a].add(b); links[b].add(a)
    types={r.id:r.type for r in layout.rooms}
    seen={'exterior'}; queue=deque(seen)
    while queue:
        a=queue.popleft()
        if a!='exterior' and types[a] not in transit: continue
        for b in links[a]-seen: seen.add(b);queue.append(b)
    return [f'{r.name} requires transit through a private, work or recreation room' for r in layout.rooms if r.id not in seen]


def wall_topology(layout):
    if layout.architecture_version < 1: return []
    errors=[]
    rooms={r.id:r for r in layout.rooms}
    if not layout.walls: return ['Canonical wall topology is missing']
    for wall in layout.walls:
        horizontal=wall.orientation=='horizontal'
        if (horizontal and wall.y1!=wall.y2) or (not horizontal and wall.x1!=wall.x2): errors.append(f'{wall.id} has inconsistent orientation')
        length=abs(wall.x2-wall.x1)+abs(wall.y2-wall.y1)
        if length<=0 or not 0<wall.thickness_ft<=1: errors.append(f'{wall.id} has invalid dimensions')
        for room in layout.rooms:
            crossing=(room.y+.01<wall.y1<room.y+room.h-.01 and min(wall.x2,room.x+room.w)>max(wall.x1,room.x)+.01) if horizontal else (room.x+.01<wall.x1<room.x+room.w-.01 and min(wall.y2,room.y+room.h)>max(wall.y1,room.y)+.01)
            if crossing: errors.append(f'{wall.id} crosses the interior of {room.name}')
        if not wall.rooms or any(r not in rooms for r in wall.rooms): errors.append(f'{wall.id} has invalid room ownership')
        for opening in wall.openings:
            if opening.offset_ft<-.01 or opening.width_ft<=0 or opening.offset_ft+opening.width_ft>length+.01: errors.append(f'{wall.id} opening exceeds its wall')
    for i,a in enumerate(layout.walls):
        for b in layout.walls[i+1:]:
            if a.orientation!=b.orientation: continue
            h=a.orientation=='horizontal'
            if (a.y1 if h else a.x1)!=(b.y1 if h else b.x1): continue
            if min(a.x2 if h else a.y2,b.x2 if h else b.y2)>max(a.x1 if h else a.y1,b.x1 if h else b.y1)+.01: errors.append(f'Duplicate wall spans {a.id}/{b.id}')
    for a,b in layout.open_connections:
        if a not in rooms or b not in rooms or not shared_edge(Rect(rooms[a].x,rooms[a].y,rooms[a].w,rooms[a].h),Rect(rooms[b].x,rooms[b].y,rooms[b].w,rooms[b].h)):
            errors.append('An open connection does not join adjacent rooms')
    # The complete boundary set must match room geometry, including ownership.
    # Comparing normalized spans detects stale walls after an edit and missing walls.
    from .geometry.walls import build_walls
    rects = {r.id: Rect(r.x, r.y, r.w, r.h) for r in layout.rooms}
    expected = build_walls(rects, [], [])
    def signature(w):
        return (w['x1'], w['y1'], w['x2'], w['y2'], w['orientation'], w['exterior'], tuple(sorted(w['rooms'])))
    if {signature(w) for w in expected} != {signature(w.model_dump()) for w in layout.walls}:
        errors.append('Canonical walls do not match the complete current room boundaries and ownership')
    for door in layout.doors:
        owners = set(door.between) - {'exterior'}
        matches = []
        for wall in layout.walls:
            if set(wall.rooms) != owners: continue
            h = wall.orientation == 'horizontal'
            line, center, start = (door.y, door.x, wall.x1) if h else (door.x, door.y, wall.y1)
            if abs(line - (wall.y1 if h else wall.x1)) > .01: continue
            lo, hi = center - door.width_ft / 2 - start, center + door.width_ft / 2 - start
            matches += [o for o in wall.openings if o.sill_ft == 0 and o.offset_ft <= lo + .02 and o.offset_ft + o.width_ft >= hi - .02]
        if not matches: errors.append('A door has no matching canonical opening')
    return errors
