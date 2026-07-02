#!/usr/bin/env python3
"""Validate Cocos scene __id__ references and Sprite spriteFrame assignments."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'assets/scenes'
SG_KEYS = ['ambient', 'shadows', '_skybox', 'fog', 'octree', 'skin', 'lightProbeInfo', 'postSettings']


def check_scene(path: Path) -> list[str]:
    errors: list[str] = []
    data = json.loads(path.read_text(encoding='utf-8'))
    name = path.name

    sg_idx = data[1].get('_globals', {}).get('__id__')
    if sg_idx is None:
        errors.append(f'{name}: scene missing _globals')
        return errors

    if data[sg_idx].get('__type__') != 'cc.SceneGlobals':
        errors.append(f'{name}: _globals -> {data[sg_idx].get("__type__")} (expected cc.SceneGlobals)')

    sg = data[sg_idx]
    for offset, key in enumerate(SG_KEYS, start=1):
        if key not in sg:
            continue
        idx = sg[key]['__id__']
        expected = sg_idx + offset
        if idx != expected:
            errors.append(f'{name}: SceneGlobals.{key} -> {idx}, expected {expected} ({data[idx].get("__type__")})')

    for i, obj in enumerate(data):
        if obj.get('__type__') != 'cc.Sprite':
            continue
        node = data[obj['node']['__id__']]
        node_name = node.get('_name', '?')

        if not obj.get('_enabled'):
            continue

        sf = obj.get('_spriteFrame')
        if sf is None:
            errors.append(f'{name}: enabled Sprite without spriteFrame on node "{node_name}"')
            continue

        if isinstance(sf, dict):
            uuid = sf.get('__uuid__', '')
            if uuid.endswith('@6c48a') and sf.get('__expectedType__') == 'cc.SpriteFrame':
                errors.append(
                    f'{name}: Sprite on "{node_name}" uses Texture @6c48a instead of SpriteFrame @f9941'
                )

    return errors


def main() -> int:
    all_errors: list[str] = []
    for path in sorted(ROOT.rglob('*.scene')):
        all_errors.extend(check_scene(path))

    if all_errors:
        print('Scene validation FAILED:')
        for err in all_errors:
            print(' -', err)
        return 1

    print(f'All {len(list(ROOT.rglob("*.scene")))} scenes OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
