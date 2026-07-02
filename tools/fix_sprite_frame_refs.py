#!/usr/bin/env python3
"""Fix Sprite components that reference Texture (@6c48a) instead of SpriteFrame (@f9941)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'assets/scenes'


def fix_scene(path: Path) -> int:
    data = json.loads(path.read_text(encoding='utf-8'))
    fixed = 0
    for obj in data:
        if obj.get('__type__') != 'cc.Sprite':
            continue
        sf = obj.get('_spriteFrame')
        if not isinstance(sf, dict):
            continue
        uuid = sf.get('__uuid__', '')
        if uuid.endswith('@6c48a') and sf.get('__expectedType__') == 'cc.SpriteFrame':
            sf['__uuid__'] = uuid.replace('@6c48a', '@f9941')
            fixed += 1
    if fixed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Fixed {fixed} sprite(s) in {path.name}')
    return fixed


def main() -> int:
    total = sum(fix_scene(p) for p in sorted(ROOT.rglob('*.scene')))
    if total == 0:
        print('No texture-as-spriteframe issues found')
    return 0


if __name__ == '__main__':
    sys.exit(main())
