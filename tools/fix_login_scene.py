#!/usr/bin/env python3
"""Fix Login.scene __id__ references after manual edits."""
import json
import sys
from pathlib import Path

SCENE = Path(__file__).resolve().parent.parent / 'assets/scenes/Login.scene'
SCRIPT_TYPE = 'b0050AFAAVABYAFAAAAAAAF'
SG_KEYS = ['ambient', 'shadows', '_skybox', 'fog', 'octree', 'skin', 'lightProbeInfo', 'postSettings']


def validate(data: list) -> None:
    scene = data[1]
    sg_idx = scene['_globals']['__id__']
    assert data[sg_idx]['__type__'] == 'cc.SceneGlobals', f'_globals points to {data[sg_idx]["__type__"]}'
    sg = data[sg_idx]
    for offset, key in enumerate(SG_KEYS, start=1):
        idx = sg[key]['__id__']
        assert idx == sg_idx + offset, f'{key}: expected {sg_idx + offset}, got {idx}'
    # no enabled sprite with null frame
    for i, obj in enumerate(data):
        if obj.get('__type__') == 'cc.Sprite' and obj.get('_enabled') and obj.get('_spriteFrame') is None:
            node_id = obj['node']['__id__']
            node_name = data[node_id].get('_name', '?')
            raise AssertionError(f'Sprite #{i} on node {node_name} is enabled but spriteFrame is null')


def fix() -> None:
    with SCENE.open(encoding='utf-8') as f:
        data = json.load(f)

    canvas = data[2]
    canvas['_components'] = [
        c for c in canvas['_components']
        if data[c['__id__']].get('__type__') != SCRIPT_TYPE
    ]
    data = [obj for obj in data if obj.get('__type__') != SCRIPT_TYPE]

    sg_idx = next(i for i, o in enumerate(data) if o.get('__type__') == 'cc.SceneGlobals')
    data[1]['_globals'] = {'__id__': sg_idx}
    sg = data[sg_idx]
    for offset, key in enumerate(SG_KEYS, start=1):
        sg[key] = {'__id__': sg_idx + offset}

    validate(data)

    with SCENE.open('w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'Fixed {SCENE.name}: {len(data)} objects, SceneGlobals at index {sg_idx}')


if __name__ == '__main__':
    fix()
