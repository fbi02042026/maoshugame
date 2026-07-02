#!/usr/bin/env python3
"""Fix Login checkbox hierarchy and Menu empty Sprites."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGIN_SCENE = ROOT / 'assets/scenes/Login.scene'
MENU_SCENE = ROOT / 'assets/scenes/Menu.scene'
LOGIN_DIR = ROOT / 'assets/art/UI/login'

RENAMES = {
    'login_weigouxuan': 'login_agree_box',
    'login_gouxuan': 'login_agree_check',
}

HAMSTER_FRAME_UUID = '86c9b581-bf5a-471e-a711-6c20a7aa36bb@f9941'
SG_KEYS = ['ambient', 'shadows', '_skybox', 'fog', 'octree', 'skin', 'lightProbeInfo', 'postSettings']


def load_scene(path: Path) -> list:
    return json.loads(path.read_text(encoding='utf-8'))


def save_scene(path: Path, data: list) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def find_node(data: list, name: str) -> int | None:
    for i, obj in enumerate(data):
        if obj.get('__type__') == 'cc.Node' and obj.get('_name') == name:
            return i
    return None


def validate_scene(data: list, name: str) -> list[str]:
    errors: list[str] = []
    sg_idx = data[1].get('_globals', {}).get('__id__')
    if sg_idx is None:
        errors.append(f'{name}: missing _globals')
        return errors
    if data[sg_idx].get('__type__') != 'cc.SceneGlobals':
        errors.append(f'{name}: _globals -> {data[sg_idx].get("__type__")}')
    sg = data[sg_idx]
    for offset, key in enumerate(SG_KEYS, start=1):
        if key not in sg:
            continue
        idx = sg[key]['__id__']
        if idx != sg_idx + offset:
            errors.append(f'{name}: SceneGlobals.{key} -> {idx}, expected {sg_idx + offset}')
    for obj in data:
        if obj.get('__type__') != 'cc.Sprite':
            continue
        if not obj.get('_enabled'):
            continue
        if obj.get('_spriteFrame') is not None:
            continue
        node = data[obj['node']['__id__']]
        errors.append(f'{name}: enabled Sprite without spriteFrame on "{node.get("_name", "?")}"')
    return errors


def rename_login_assets() -> None:
    for old, new in RENAMES.items():
        for ext in ('.png', '.png.meta'):
            src = LOGIN_DIR / f'{old}{ext}'
            dst = LOGIN_DIR / f'{new}{ext}'
            if src.exists() and not dst.exists():
                src.rename(dst)
                print(f'Renamed {src.name} -> {dst.name}')
        meta = LOGIN_DIR / f'{new}.png.meta'
        if meta.exists():
            text = meta.read_text(encoding='utf-8')
            text = text.replace(old, new)
            meta.write_text(text, encoding='utf-8')


def fix_login_scene() -> None:
    data = load_scene(LOGIN_SCENE)
    box_idx = find_node(data, 'Checkbox')
    check_idx = find_node(data, 'Checkbox-001')
    row_idx = find_node(data, 'AgreementRow')
    if box_idx is None or check_idx is None or row_idx is None:
        raise RuntimeError('Login.scene: missing Checkbox / Checkbox-001 / AgreementRow')

    data[box_idx]['_name'] = 'AgreeBox'
    data[check_idx]['_name'] = 'AgreeCheck'
    data[check_idx]['_parent'] = {'__id__': box_idx}
    data[check_idx]['_active'] = False
    data[check_idx]['_lpos'] = {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0}

    row_children = data[row_idx]['_children']
    data[row_idx]['_children'] = [c for c in row_children if c['__id__'] != check_idx]
    box_children = data[box_idx].setdefault('_children', [])
    if not any(c['__id__'] == check_idx for c in box_children):
        box_children.append({'__id__': check_idx})

    save_scene(LOGIN_SCENE, data)
    print('Fixed Login.scene checkbox: AgreeBox + AgreeCheck')


def fix_menu_scene() -> None:
    data = load_scene(MENU_SCENE)
    button_names = ['StartButton', 'SkinButton', 'LevelButton', 'SettingsButton']
    for name in button_names:
        node_idx = find_node(data, name)
        if node_idx is None:
            continue
        node = data[node_idx]
        node['_components'] = [
            c for c in node['_components']
            if data[c['__id__']].get('__type__') != 'cc.Sprite'
        ]

    hamster_idx = find_node(data, 'Hamster')
    if hamster_idx is not None:
        for comp in data[hamster_idx]['_components']:
            comp_obj = data[comp['__id__']]
            if comp_obj.get('__type__') == 'cc.Sprite':
                comp_obj['_enabled'] = True
                comp_obj['_spriteFrame'] = {
                    '__uuid__': HAMSTER_FRAME_UUID,
                    '__expectedType__': 'cc.SpriteFrame',
                }
                break

    save_scene(MENU_SCENE, data)
    print('Fixed Menu.scene: removed button Sprites, assigned Hamster frame')


def main() -> int:
    rename_login_assets()
    fix_login_scene()
    fix_menu_scene()

    errors: list[str] = []
    for path in (LOGIN_SCENE, MENU_SCENE):
        errors.extend(validate_scene(load_scene(path), path.name))
    if errors:
        print('Validation FAILED:')
        for err in errors:
            print(' -', err)
        return 1
    print('Login + Menu scenes OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
