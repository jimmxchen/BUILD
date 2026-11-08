#!/usr/bin/env python3
"""Read-only baseline diagnostics. Run with the backend environment from the repo root.

Synthetic cases exercise deterministic solving; warehouse uses a saved actual live
planner response. Metrics describe design heuristics, not building-code compliance.
"""
import argparse
import copy
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
sys.path.insert(0, str(ROOT / 'backend/tests'))
from prompt_programs import house
from walkthru import checker, solver
from walkthru.geometry.program import refine_type
from walkthru.geometry.taxonomy import canonical_type, MIN_DIM, MAX_ASPECT
from walkthru.schema import RoomProgram


def metrics(layout):
    checks = checker.check(layout)
    violations = []
    unusable = 0
    for room in layout.rooms:
        typ = refine_type(canonical_type(room.type, room.name, room.id), room.name, room.target_sqft)
        ratio = max(room.w, room.h) / min(room.w, room.h)
        narrow = min(room.w, room.h) < MIN_DIM.get(typ, 0)
        stretched = ratio > MAX_ASPECT.get(typ, 99)
        if narrow or stretched:
            violations.append({'id': room.id, 'width': room.w, 'depth': room.h,
                               'aspect': round(ratio, 3), 'minimum_dimension_failed': narrow,
                               'aspect_preference_failed': stretched})
            if room.type != 'hall':
                unusable += room.area
    from walkthru.architecture import ROOM_RULES
    functional = []
    for room in layout.rooms:
        typ = 'basketball_court' if 'basketball' in room.name.lower() else 'workroom' if 'work room' in room.name.lower() else room.type
        rule = ROOM_RULES[typ]
        if min(room.w, room.h) < rule.min_side or max(room.w, room.h) / min(room.w, room.h) > rule.max_aspect + .01:
            functional.append(room)
    total = sum(r.area for r in layout.rooms)
    return {'hard_checks_passed': sum(c.pass_ for c in checks), 'hard_checks_total': len(checks),
            'hard_failures': [{'rule': c.rule, 'message': c.message} for c in checks if not c.pass_],
            'shape_violations': violations,
            'registry_shape_violations': len(functional),
            'area_failing_registry_shape_pct': round(100 * sum(r.area for r in functional if r.type != 'hall') / total, 2),
            'area_in_shape_violating_rooms_pct': round(100 * unusable / total, 2),
            'circulation_pct': round(100 * sum(r.area for r in layout.rooms if r.type == 'hall') / total, 2)}


def run(output, architecture=False):
    live = json.loads((ROOT / 'docs/architecture/baseline/warehouse-live.json').read_text())
    loft = house(3000, 1, 1, big_living=True, notes='Large open-plan loft')
    large_kitchen = house(2500, 3, 2, big_kitchen=True)
    impossible = copy.deepcopy(live['program'])
    impossible['requested_sqft'] = 1000
    cases = {
        'conventional_3bed': house(1800, 3, 2),
        'warehouse_8bed': live['program'],
        'open_loft': loft,
        'small_home_dining': house(900, 1, 1),
        'large_kitchen': large_kitchen,
        'multiple_workspaces': house(3000, 3, 2, offices=4),
        'overspecified': impossible,
    }
    output.mkdir(parents=True, exist_ok=True)
    results = {}
    for name, raw in cases.items():
        program = RoomProgram.model_validate(raw)
        start = time.perf_counter()
        try:
            if architecture:
                from walkthru.architecture import prepare
                program = prepare(program, "warehouse brutalist" if name in ("warehouse_8bed", "overspecified") else "open-plan loft" if name == "open_loft" else "")
            layout = solver.solve(program)
            layout.checks = checker.check(layout)
            elapsed = time.perf_counter() - start
            result = metrics(layout)
            required_ids = {r.id for r in program.rooms}
            result['program_room_id_coverage_pct'] = round(100 * len(required_ids & {r.id for r in layout.rooms}) / len(required_ids), 2)
            result['solver_seconds'] = round(elapsed, 4)
            result['source'] = 'saved live planner program' if name == 'warehouse_8bed' else 'synthetic program; not a live planner evaluation'
            result['requested_sqft'] = program.requested_sqft
            (output / f'{name}-layout.json').write_text(json.dumps(layout.to_json(), indent=2) + '\n')
        except Exception as exc:
            result = {'error': str(exc), 'solver_seconds': round(time.perf_counter() - start, 4)}
        results[name] = result
    (output / 'metrics.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps({name: {k: v for k, v in result.items() if k not in ('shape_violations', 'hard_failures')} for name, result in results.items()}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/architecture/baseline/local')
    parser.add_argument("--architecture", action="store_true")
    args = parser.parse_args()
    run(args.output, args.architecture)
