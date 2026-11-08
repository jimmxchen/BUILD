"""Bounded modular wing search: a clear-span anchor plus independent public/private/work clusters.

Rooms remain rectangles, but the union is an orthogonal footprint. Each wing has
its own circulation and can vary depth, row assignment and orientation. Courts
never carry circulation between wings. No fixed room counts or floor plans.
"""
from __future__ import annotations
import itertools
import math
from .geom import Rect, snap, shared_edge
from .footprint import outline
from .openings import Roles, plan_doors, plan_windows
from .walls import build_walls
from ..architecture import ArchitectureConflict, COURTS, ROOM_RULES, room_problems
from ..schema import Layout, Room, RoomProgram


def _quality(room, rect):
    rule = ROOM_RULES[room.type]
    ratio = rect.aspect()
    return (ratio - rule.preferred_aspect) ** 2 + 12 * abs(rect.area / room.target_sqft - 1)


def _module(rooms, name, hall_width, variant):
    """Search variable-depth shelves; every leaf touches a local gallery and outside."""
    if not rooms: return [({}, 0., 0., 0., 0.)]
    options = []
    orders = [list(rooms), sorted(rooms, key=lambda r: -r.target_sqft), list(reversed(rooms))]
    for order in orders:
        # Public kitchens/dining remain contiguous, never separated by a corridor.
        rows = [order, []] if name == 'common' else [[], []]
        if name != 'common':
            for room in order:
                which = min(range(2), key=lambda i: sum(r.target_sqft for r in rows[i]))
                rows[which].append(room)
        for depth in range(8, 31):
            rects, score, lengths = {}, 0., []
            for index, row in enumerate(rows):
                cursor = 0.
                for room in row:
                    rule = ROOM_RULES[room.type]
                    usable_depth = math.floor(min(depth, math.sqrt(room.target_sqft * (room.max_aspect_ratio or rule.max_aspect)), room.target_sqft / rule.min_side) * 2) / 2
                    width = snap(room.target_sqft / usable_depth)
                    rect = Rect(cursor, depth-usable_depth if index == 0 else depth + hall_width, width, usable_depth)
                    actual = Room.model_validate({**room.model_dump(), **vars(rect)})
                    if room_problems(actual) or abs(rect.area / room.target_sqft - 1) > .1:
                        break
                    rects[room.id] = rect
                    score += _quality(room, rect)
                    cursor += width
                lengths.append(cursor)
            if len(rects) != len(rooms): continue
            length = max(lengths)
            rects[f'circulation_{name}'] = Rect(0., float(depth), length, hall_width)
            height = depth + hall_width + (depth if rows[1] else 0)
            score += length * hall_width * .015 + abs(lengths[0] - lengths[1]) * .01
            options.append((rects, length, float(height), float(depth), score))
    if not options: raise ArchitectureConflict(f'Cannot fit the {name} rooms within their dimension and aspect limits. Change their target areas or constraints.')
    # Keep genuinely distinct depths/assignments; bounded cross-product downstream.
    unique = {}
    for option in sorted(options, key=lambda o: o[4]):
        key = tuple((rid, r.x, r.y, r.w, r.h) for rid, r in option[0].items())
        unique.setdefault(key, option)
    return list(unique.values())[variant:variant + 3] or list(unique.values())[:3]


def _move(dest, source, x, y):
    for key, r in source.items(): dest[key] = Rect(snap(x+r.x), snap(y+r.y), r.w, r.h)


def solve(program: RoomProgram, keep: Layout | None = None) -> Layout:
    from .. import checker
    rooms = program.rooms
    if not rooms: raise ArchitectureConflict('The program has no rooms.')
    if len({r.id for r in rooms}) != len(rooms) or any(r.id.startswith('circulation_') for r in rooms):
        raise ArchitectureConflict('Room IDs must be unique and cannot use the reserved circulation_ prefix.')
    courts = [r for r in rooms if r.type == 'basketball_court']
    if len(courts) > 1: raise ArchitectureConflict('This bounded strategy supports one court per building. Split the project or request one shared court.')
    anchor = courts[0] if courts else max([r for r in rooms if r.type == 'living'] or rooms, key=lambda r: r.target_sqft)
    private = [r for r in rooms if r.id != anchor.id and r.type in ('bedroom', 'primary_bedroom', 'bathroom')]
    work = [r for r in rooms if r.id != anchor.id and r.type in ('office', 'workroom')]
    common = [r for r in rooms if r.id != anchor.id and r not in private and r not in work]
    industrial = program.archetype in ('warehouse_conversion', 'mixed_use', 'office')
    hw = 5. if industrial else 3.
    options = [_module(group, name, hw, 0) for name, group in [('private', private), ('work', work), ('common', common)]]
    if courts:
        spec = COURTS[anchor.court_format]
        shapes = [(spec['room_width'], spec['room_length']), (spec['room_length'], spec['room_width'])]
    else:
        shapes = [(snap(math.sqrt(anchor.target_sqft * ratio)), 0) for ratio in (1., 1.3, 1.6, 2.)]
        shapes = [(w, snap(anchor.target_sqft / w)) for w, _ in shapes]
    candidates = []
    for (aw, ah), groups in itertools.product(shapes, itertools.product(*options)):
        if room_problems(Room.model_validate({**anchor.model_dump(), 'x': 0, 'y': 0, 'w': aw, 'h': ah})): continue
        rects = {anchor.id: Rect(0, 0, aw, ah)}
        score = sum(o[4] for o in groups) + _quality(anchor, rects[anchor.id])
        p, w, c = groups
        if courts or industrial or len(work) > 1:
            # A three-sided gallery connects zones without using the recreation room as a hall.
            height = max(ah, p[2] + (5 if p[0] and w[0] else 0) + w[2], c[2])
            rects['circulation_north'] = Rect(-hw, -hw, aw + 2*hw, hw)
            rects['circulation_east'] = Rect(aw, 0, hw, height)
            rects['circulation_west'] = Rect(-hw, 0, hw, max(ah, c[2]))
            _move(rects, p[0], aw + hw, 0)
            _move(rects, w[0], aw + hw, p[2] + (5 if p[0] else 0))
            _move(rects, c[0], -hw - c[1], 0)
            entrance_id = 'circulation_north'
        else:
            # The public anchor connects independent wings, rather than one residential strip.
            _move(rects, p[0], aw, snap(ah/2 - p[3] - hw/2))
            _move(rects, c[0], -c[1], snap(ah/2 - c[3] - hw/2))
            if w[0]:
                # Rotate the work wing so its gallery meets the anchor's south edge.
                for rid, r in w[0].items():
                    rects[rid] = Rect(snap(aw/2 - w[3] - hw/2 + r.y), ah + r.x, r.h, r.w)
            entrance_id = anchor.id
        # Quantization precedes all topology generation.
        minx, miny = min(r.x for r in rects.values()), min(r.y for r in rects.values())
        rects = {rid: Rect(snap(r.x-minx), snap(r.y-miny), r.w, r.h) for rid, r in rects.items()}
        if any(a.x < b.x2-.01 and b.x < a.x2-.01 and a.y < b.y2-.01 and b.y < a.y2-.01 for i, a in enumerate(rects.values()) for b in list(rects.values())[i+1:]): continue
        total = sum(r.area for r in rects.values())
        if abs(total / program.requested_sqft - 1) > .1: continue
        score += 100 * abs(total/program.requested_sqft - 1)
        score += sum(r.area for rid, r in rects.items() if rid.startswith('circulation_')) / total * 20
        for room in rooms:
            for adjacent in room.adjacent_to:
                if adjacent in rects and not shared_edge(rects[room.id], rects[adjacent]): score += 2
        if keep:
            previous = {r.id:r for r in keep.rooms}
            score += sum(2 for rid,r in rects.items() if rid in previous and (r.x,r.y,r.w,r.h)!=(previous[rid].x,previous[rid].y,previous[rid].w,previous[rid].h))
        candidates.append((score, rects, entrance_id))
    errors = []
    for score, rects, entrance_id in sorted(candidates, key=lambda c: c[0])[:12]:
        W,D = max(r.x2 for r in rects.values()),max(r.y2 for r in rects.values())
        try: boundary, holes = outline(rects)
        except ValueError: continue
        specs = {r.id:r for r in rooms}
        types = {rid: ('hallway' if rid.startswith('circulation_') else 'bedroom' if specs[rid].type == 'primary_bedroom' else 'office' if specs[rid].type == 'workroom' else 'other' if specs[rid].type == 'basketball_court' else specs[rid].type) for rid in rects}
        roles = Roles(types=types, hall=entrance_id if types[entrance_id]=='hallway' else None, entrance=entrance_id, host={}, garage=None)
        doors, entrance = plan_doors(rects,roles,W,D,'north',None)
        # Every room opens directly to circulation or a public room. Never route via bedrooms,
        # bathrooms, workrooms or a court. Add all hall connections before final reachability.
        from .openings import DoorPlanner
        planner = DoorPlanner(rects,roles,(entrance['x'],entrance['y']))
        for a in rects:
            for b in rects:
                if a >= b: continue
                if types[a]=='hallway' or types[b]=='hallway': planner.add(a,b,'opening' if types[a]==types[b]=='hallway' else 'door')
        doors = [d for d in doors if 'exterior' in d['between'] or all(types[r] in ('living','dining','kitchen','entry') for r in d['between'])]
        doors.extend(planner.doors)
        windows = plan_windows(rects,types,W,D,doors)
        if industrial:
            for window in windows:
                if types[window['room']] in ('living', 'kitchen', 'dining', 'office', 'other'):
                    window['sill_ft'], window['head_ft'] = 3, 12
        open_connections = []
        if program.open_plan:
            for i,a in enumerate(rooms):
                for b in rooms[i+1:]:
                    if a.type in ('living','dining','kitchen') and b.type in ('living','dining','kitchen') and shared_edge(rects[a.id],rects[b.id]): open_connections.append([a.id,b.id])
        walls = build_walls(rects,doors,windows)
        for wall in walls:
            if any(set(wall['rooms'])==set(pair) for pair in open_connections):
                length = abs(wall['x2']-wall['x1'])+abs(wall['y2']-wall['y1'])
                wall['openings'] = [{'type':'open','offset_ft':0,'width_ft':length,'sill_ft':0,'head_ft':30}]
        outrooms=[]
        for rid,rect in rects.items():
            base = specs[rid].model_dump() if rid in specs else dict(id=rid,type='hall',name=rid.replace('circulation_','').title()+' Gallery',target_sqft=rect.area,adjacent_to=[],zone='circulation')
            outrooms.append({**base,**vars(rect)})
        result=Layout.model_validate(dict(architecture_version=1,archetype=program.archetype,style=program.style,ceiling_ft=26 if courts else 14 if industrial else 10,
            design_notes=program.design_notes,footprint=dict(width_ft=W,depth_ft=D,outline=boundary,holes=holes),entrance=entrance,
            rooms=outrooms,doors=doors,windows=windows,walls=walls,open_connections=open_connections,requested_sqft=program.requested_sqft))
        failures=[c for c in checker.check(result) if not c.pass_]
        if not failures: return result
        errors=[c.message for c in failures]
    raise ArchitectureConflict('No valid zoned arrangement fits these dimensions and area. Increase the area or adjust room targets. '+ '; '.join(errors[:3]))
