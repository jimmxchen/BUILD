"""Versioned architectural constraints; fixtures include a real failed planner result."""
import json
from pathlib import Path
import pytest
from prompt_programs import house
from walkthru import checker, solver, requirements
from walkthru.architecture import prepare, ArchitectureConflict
from walkthru.architecture_checks import wall_topology, usable_rooms, circulation
from walkthru.schema import RoomProgram, Layout
ROOT = Path(__file__).resolve().parents[2]
PROMPT = '8 bed 3 bath industrial complex style warehouse. i want a basketball court and also 4 work room areas. 10k square feet. make it look modern and brutal'


def warehouse():
    return RoomProgram.model_validate(json.loads((ROOT/'docs/architecture/baseline/warehouse-live.json').read_text())['program'])


@pytest.mark.parametrize('raw,prompt', [
    (house(1800,3,2), ''), (house(3000,1,1,big_living=True), 'open-plan loft'),
    (house(900,1,1), ''), (house(2500,3,2,big_kitchen=True), ''),
    (house(3000,3,2,offices=4), ''),
])
def test_supported_programs(raw,prompt):
    p=prepare(RoomProgram.model_validate(raw),prompt)
    layout=solver.solve(p)
    assert all(c.pass_ for c in checker.check(layout))
    assert {r.id for r in p.rooms} <= {r.id for r in layout.rooms}
    assert not wall_topology(layout)
    assert not usable_rooms(layout)
    assert not circulation(layout)
    if 'loft' in prompt: assert layout.open_connections
    assert solver.solve(p,keep=layout).model_dump()==layout.model_dump()


def test_exact_warehouse_prompt():
    p=prepare(warehouse(),PROMPT); layout=solver.solve(p)
    req=requirements.parse(PROMPT)
    assert req.workrooms_min==4 and req.courts_min==1
    assert not requirements.mismatches(req,layout.rooms,layout.requested_sqft)
    assert sum(r.type in ('bedroom','primary_bedroom') for r in layout.rooms)==8
    assert sum(r.type=='bathroom' for r in layout.rooms)==3
    assert sum(r.type=='workroom' for r in layout.rooms)==4
    court=next(r for r in layout.rooms if r.type=='basketball_court')
    assert court.court_format=='half'
    assert sorted((court.w,court.h))==[57,60]
    assert layout.style=='brutalist' and layout.archetype=='warehouse_conversion'
    assert any('recreational' in note for note in layout.design_notes)
    assert all(c.pass_ for c in checker.check(layout))
    assert prepare(p).model_dump()==p.model_dump()


def test_explicit_full_and_overspecified_report_conflict():
    with pytest.raises(ArchitectureConflict): prepare(warehouse(),PROMPT+' full-size regulation court')
    p=warehouse();p.requested_sqft=1000
    with pytest.raises(ArchitectureConflict): prepare(p,PROMPT)
    p=warehouse();p.requested_sqft=16000
    full=prepare(p,PROMPT+' full-size court')
    layout=solver.solve(full)
    assert next(r for r in layout.rooms if r.type=='basketball_court').court_format=='full'


def test_invalid_shapes_and_stale_topology_are_rejected():
    layout=solver.solve(prepare(warehouse(),PROMPT))
    bad=layout.model_copy(deep=True)
    dining=next(r for r in bad.rooms if r.type=='dining');dining.h=2
    assert usable_rooms(bad) and wall_topology(bad)
    bad=layout.model_copy(deep=True);bad.walls.pop()
    assert wall_topology(bad)
    bad=layout.model_copy(deep=True);bad.walls.append(bad.walls[0].model_copy())
    assert any('Duplicate' in s for s in wall_topology(bad))
    bad=layout.model_copy(deep=True)
    for w in bad.walls: w.openings=[]
    assert any('door' in s for s in wall_topology(bad))
    bad=layout.model_copy(deep=True);bad.doors=[]
    assert circulation(bad)


def test_registry_and_legacy_compatibility():
    assert json.loads((ROOT/'backend/walkthru/room_specs.json').read_text())==json.loads((ROOT/'frontend/src/lib/room-specs.json').read_text())
    legacy=Layout.model_validate(json.loads((ROOT/'shared/sample_layout.json').read_text()))
    assert legacy.architecture_version==0
    assert not wall_topology(legacy)


def test_pipeline_and_http_conflict(monkeypatch):
    from walkthru import planner, pipeline, api
    from fastapi.testclient import TestClient
    monkeypatch.setattr(planner, 'offline', lambda: False)
    monkeypatch.setattr(planner, '_parse', lambda *args, **kwargs: warehouse())
    result=pipeline.generate(PROMPT)
    assert len(result.layout.checks)==13
    assert all(c.pass_ for c in result.layout.checks)
    assert result.program.architecture_version==1
    assert not result.cached
    def conflict(*args): raise ArchitectureConflict('Full court does not fit; increase area or request a half court.')
    monkeypatch.setattr(pipeline,'generate',conflict)
    response=TestClient(api.app).post('/api/generate',json={'prompt':PROMPT})
    assert response.status_code==422
    assert 'half court' in response.json()['detail']
