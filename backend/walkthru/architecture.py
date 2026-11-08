"""Architectural semantics and concept-design limits (not building-code certification)."""
from __future__ import annotations
import re
import math
from dataclasses import dataclass
from .schema import RoomProgram


class ArchitectureConflict(ValueError):
    """Explicit program constraints cannot be met without a user's tradeoff."""


@dataclass(frozen=True)
class RoomRule:
    min_side: float
    max_aspect: float
    preferred_aspect: float = 1.4


# room_specs.json is the configurable source; the frontend copy is checked for parity.
import json
from pathlib import Path
_REGISTRY = json.loads(Path(__file__).with_name('room_specs.json').read_text())
ROOM_RULES = {key: RoomRule(**value) for key, value in _REGISTRY['rooms'].items()}
COURTS = _REGISTRY['courts']


def infer_archetype(prompt: str) -> str:
    text = prompt.lower()
    if re.search(r'warehouse|industrial complex|factory conversion', text): return 'warehouse_conversion'
    if 'loft' in text: return 'loft'
    if re.search(r'basketball|mixed.use', text): return 'mixed_use'
    if re.search(r'office building|office complex', text): return 'office'
    return 'residential'


def prepare(program: RoomProgram, prompt: str = '') -> RoomProgram:
    """Retain all room IDs. Never rescale a named court or explicit dimension constraint."""
    p = program.model_copy(deep=True)
    p.architecture_version = 1
    text = (prompt + ' ' + p.notes).lower()
    if p.archetype == 'residential': p.archetype = infer_archetype(text)
    if re.search(r'brutal', text): p.style = 'brutalist'
    elif p.style == 'neutral' and re.search(r'industrial|warehouse', text): p.style = 'industrial'
    p.open_plan = p.open_plan or bool(re.search(r'open.plan|open kitchen|loft', text))
    for r in p.rooms:
        if re.search(r'basketball|\bcourt\b', r.name + ' ' + r.id, re.I):
            r.type, r.zone = 'basketball_court', 'recreation'
        elif re.search(r'work\s*room|workshop|work_room', r.name + ' ' + r.id, re.I):
            r.type, r.zone = 'workroom', 'work'
        elif r.type in ('bedroom', 'primary_bedroom'): r.zone = 'private'
        elif r.type in ('office', 'workroom'): r.zone = 'work'
        elif r.type in ('bathroom', 'laundry', 'closet'): r.zone = 'service'
        else: r.zone = 'public'
    courts = [r for r in p.rooms if r.type == 'basketball_court']
    other = sum(r.target_sqft for r in p.rooms if r.type != 'basketball_court')
    remaining = p.requested_sqft * .86 - other
    for court in courts:
        # Only the user's wording or a previously selected format may lock regulation size.
        explicit = court.court_format not in (None, 'auto')
        fmt = court.court_format if explicit else ('full' if re.search(r'full[ -]?(?:size|court)|regulation|\bnba\b', prompt, re.I) else 'auto')
        if re.search(r'half[ -]?court', prompt, re.I): fmt = 'half'
        options = list(COURTS) if fmt == 'auto' else [fmt]
        selected = next((key for key in options if COURTS[key]['room_length'] * COURTS[key]['room_width'] <= remaining), None)
        if selected is None:
            minimum = other + sum(COURTS[key]['room_length'] * COURTS[key]['room_width'] for key in options[:1])
            raise ArchitectureConflict(f'The requested court and other rooms need about {minimum / .86:.0f} sq ft including circulation. Increase the building area, request a half/compact recreational court, or reduce the other rooms; no spaces were discarded.')
        spec = COURTS[selected]
        court.court_format = selected
        court.target_sqft = spec['room_length'] * spec['room_width']
        court.min_width_ft, court.min_depth_ft = spec['room_width'], spec['room_length']
        court.ceiling_height_ft = spec['height']
        remaining -= court.target_sqft
        message = f'{selected.title()} court selected: {spec["length"]:g} × {spec["width"]:g} ft playing surface in a {spec["room_length"]:g} × {spec["room_width"]:g} ft clear room.'
        if selected != 'full': message += ' This is recreational, not a regulation full-size court.'
        if message not in p.design_notes: p.design_notes.append(message)
    targets = sum(r.target_sqft for r in p.rooms)
    if targets > p.requested_sqft * .94:
        raise ArchitectureConflict(f'Room targets total {targets:.0f} sq ft before circulation within a {p.requested_sqft:.0f} sq ft building. Increase area or reduce the program; no rooms were dropped.')
    # Distribute a court downgrade's spare area to useful common/work spaces; keep bedrooms,
    # bathrooms and any explicitly constrained room fixed. Explain the redistribution.
    if courts and targets < p.requested_sqft * .86:
        expandable = [r for r in p.rooms if r.type in ('living', 'dining', 'kitchen', 'workroom') and not r.min_width_ft and not r.min_depth_ft]
        extra = p.requested_sqft * .86 - targets
        base = sum(r.target_sqft for r in expandable)
        if base:
            for r in expandable: r.target_sqft = math.floor((r.target_sqft + extra * r.target_sqft / base) / 5) * 5
            note = 'Space released by the court choice is allocated to common rooms and workspaces; all requested room counts are retained.'
            if note not in p.design_notes: p.design_notes.append(note)
    return p


def room_problems(room) -> list[str]:
    rule = ROOM_RULES.get(room.type, RoomRule(6, 3))
    w, h = sorted((room.w, room.h))
    errors = []
    if w < rule.min_side - .01: errors.append(f'{room.name} has a {w:g} ft side; minimum usable dimension is {rule.min_side:g} ft')
    limit = room.max_aspect_ratio or rule.max_aspect
    if h / max(w, .001) > limit + .01: errors.append(f'{room.name} aspect ratio {h/w:.2f} exceeds {limit:g}')
    mw, md = room.min_width_ft or 0, room.min_depth_ft or 0
    if not ((room.w >= mw-.01 and room.h >= md-.01) or (room.h >= mw-.01 and room.w >= md-.01)):
        errors.append(f'{room.name} does not fit its required {mw:g} × {md:g} ft dimensions')
    if room.type == 'basketball_court':
        spec = COURTS.get(room.court_format or '')
        if not spec: errors.append(f'{room.name} needs an explicit court format')
        elif w < min(spec['room_width'], spec['room_length'])-.01 or h < max(spec['room_width'], spec['room_length'])-.01:
            errors.append(f'{room.name} lacks the clear room envelope for {room.court_format}')
        if spec and (room.ceiling_height_ft or 0) < spec['height']: errors.append(f'{room.name} needs {spec["height"]:g} ft clear height')
    return errors
