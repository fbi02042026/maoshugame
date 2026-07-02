#!/usr/bin/env python3
import json
import glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'assets/scenes'

for path in sorted(ROOT.rglob('*.scene')):
    data = json.loads(path.read_text(encoding='utf-8'))
    issues = []
    for i, obj in enumerate(data):
        if obj.get('__type__') != 'cc.Sprite':
            continue
        node = data[obj['node']['__id__']]
        name = node.get('_name', '?')
        sf = obj.get('_spriteFrame')
        enabled = obj.get('_enabled', False)
        active = node.get('_active', True)
        # check if component is still on node
        node_idx = obj['node']['__id__']
        on_node = any(c['__id__'] == i for c in data[node_idx].get('_components', []))
        if not on_node:
            if enabled:
                issues.append(f'ORPHAN enabled Sprite#{i} on {name}')
            continue
        if not enabled:
            if sf is None and active:
                issues.append(f'disabled-null Sprite#{i} on {name} (node active)')
            continue
        if sf is None:
            issues.append(f'ENABLED null Sprite#{i} on {name}')
        elif isinstance(sf, dict):
            uuid = sf.get('__uuid__', '')
            exp = sf.get('__expectedType__', '')
            if uuid.endswith('@6c48a') and 'Texture' not in exp:
                issues.append(f'TEXTURE ref Sprite#{i} on {name}: {uuid}')
    if issues:
        print(f'=== {path.name} ===')
        for x in issues:
            print(' ', x)
