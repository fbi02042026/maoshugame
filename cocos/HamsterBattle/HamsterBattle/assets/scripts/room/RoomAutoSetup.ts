import { Component, Node, Sprite, UITransform } from 'cc';
import type { RoomTemplate } from '../data/GameTypes';
import { getRoomLocalPoint } from '../core/RoomCoord';
import { CatPathMarker } from './CatPathMarker';
import { CatSpawnMarker } from './CatSpawnMarker';
import { FoodSpotMarker } from './FoodSpotMarker';
import { FurnitureMarker } from './FurnitureMarker';
import { HamsterSpawnMarker } from './HamsterSpawnMarker';
import { NarrowGapMarker } from './NarrowGapMarker';
import { RatHoleMarker } from './RatHoleMarker';
import { RoomRoot } from './RoomRoot';
import { RoomGuideGizmo } from './RoomGuideGizmo';

import { isNoCollisionBranch, setupNoCollisionBranches, stripNoCollisionFurnitureMarkers } from './RoomCollisionUtil';

const SKIP_FURNITURE_NAME = /鼠洞|老鼠出生|猫出生|猫窝|连通口|地板片|地板|参考|说明|Hint|Grid|_guide_|^food(_\d+)?$|^catbed_|^mouseGap$|^catPath$|^窄道$|noCollision|无碰撞|nocollision|no_collision/i;

function isFoodBranch(node: Node): boolean {
    let cur: Node | null = node;
    while (cur) {
        if (/^food(_\d+)?$/i.test(cur.name)) {
            return true;
        }
        cur = cur.parent;
    }
    return false;
}

function isMarkerNode(name: string): boolean {
    return /鼠洞|老鼠出生|猫出生|猫窝|连通口|mouseGap|窄道|catPath/i.test(name);
}

function findNodeByName(root: Node, name: string): Node | null {
    if (root.name === name) {
        return root;
    }
    for (const child of root.children) {
        const found = findNodeByName(child, name);
        if (found) {
            return found;
        }
    }
    return null;
}

function walkNodes(node: Node, fn: (n: Node) => void): void {
    fn(node);
    for (const child of node.children) {
        walkNodes(child, fn);
    }
}

function ensureMarker<T extends Component>(
    node: Node,
    match: RegExp,
    type: new () => T,
): void {
    if (!match.test(node.name) || node.getComponent(type)) {
        return;
    }
    node.addComponent(type);
}

function inferLayer(node: Node): string {
    let cur: Node | null = node;
    while (cur) {
        const n = cur.name;
        if (/side|墙|小房间/i.test(n)) {
            return 'wall';
        }
        if (/top|大房间|上/i.test(n)) {
            return 'top';
        }
        if (/zhongjian|free|随意/i.test(n)) {
            return 'free';
        }
        if (/decor|装饰/i.test(n)) {
            return 'decor';
        }
        cur = cur.parent;
    }
    return 'free';
}

function hasUserFurniture(roomNode: Node): boolean {
    const folder = findNodeByName(roomNode, '家具_拖图片到这里');
    return !!(folder && folder.children.length > 0);
}

function setupFoodSpots(roomNode: Node): void {
    walkNodes(roomNode, (node) => {
        if (!/^food(_\d+)?$/i.test(node.name)) {
            return;
        }
        let target: Node = node;
        for (const child of node.children) {
            if (child.getComponent(Sprite)) {
                target = child;
                break;
            }
        }
        if (!target.getComponent(FoodSpotMarker)) {
            target.addComponent(FoodSpotMarker);
        }
    });
}

function setupCatbed(node: Node): void {
    if (!/^catbed_/i.test(node.name)) {
        return;
    }
    const fm = node.getComponent(FurnitureMarker) ?? node.addComponent(FurnitureMarker);
    fm.catbed = true;
    fm.interactive = false;
    fm.layer = 'catbed';
    fm.hideable = false;
}

function setupGapMarker(node: Node, type: new () => NarrowGapMarker | CatPathMarker, defaultW: number, defaultH: number): void {
    if (!node.getComponent(UITransform)) {
        node.addComponent(UITransform).setContentSize(defaultW, defaultH);
    }
    if (!node.getComponent(type)) {
        node.addComponent(type);
    }
}

/** 未手动放置 mouseGap 时，根据 zhongjian 最左侧家具推断窄道 */
function ensureDefaultMouseGap(roomNode: Node): void {
    if (findNodeByName(roomNode, 'mouseGap') || findNodeByName(roomNode, '窄道')) {
        return;
    }
    const zhongjian = findNodeByName(roomNode, 'zhongjian');
    if (!zhongjian) {
        return;
    }

    let minLeft = Infinity;
    let gapY = 0;
    let found = false;

    walkNodes(zhongjian, (node) => {
        const ui = node.getComponent(UITransform);
        if (!ui || !node.getComponent(Sprite)) {
            return;
        }
        const lp = getRoomLocalPoint(node);
        const left = lp.x - ui.contentSize.width * ui.anchorPoint.x;
        if (left < minLeft) {
            minLeft = left;
            gapY = lp.y;
            found = true;
        }
    });

    if (!found) {
        return;
    }

    const gap = new Node('mouseGap');
    gap.setParent(roomNode);
    gap.setPosition(minLeft - 18, gapY, 0);
    setupGapMarker(gap, NarrowGapMarker, 28, 70);
}

/** 未手动放置 catPath 时，在家具上方生成猫通道 */
function ensureDefaultCatPath(roomNode: Node): void {
    if (findNodeByName(roomNode, 'catPath')) {
        return;
    }
    const zhongjian = findNodeByName(roomNode, 'zhongjian');
    if (!zhongjian) {
        return;
    }

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let maxTop = -Infinity;
    let found = false;

    walkNodes(zhongjian, (node) => {
        const ui = node.getComponent(UITransform);
        if (!ui || !node.getComponent(Sprite)) {
            return;
        }
        const lp = getRoomLocalPoint(node);
        const left = lp.x - ui.contentSize.width * ui.anchorPoint.x;
        const right = lp.x + ui.contentSize.width * (1 - ui.anchorPoint.x);
        const top = lp.y + ui.contentSize.height * (1 - ui.anchorPoint.y);
        minLeft = Math.min(minLeft, left);
        maxRight = Math.max(maxRight, right);
        maxTop = Math.max(maxTop, top);
        found = true;
    });

    if (!found) {
        return;
    }

    const path = new Node('catPath');
    path.setParent(roomNode);
    const w = Math.max(80, maxRight - minLeft + 40);
    path.setPosition((minLeft + maxRight) / 2, maxTop + 35, 0);
    setupGapMarker(path, CatPathMarker, w, 70);
}

/** 按节点名自动挂 Marker / 家具碰撞；识别 catbed_grey、food、mouseGap 等 */
export function autoSetupRoom(roomNode: Node, room: RoomTemplate): void {
    let root = roomNode.getComponent(RoomRoot);
    if (!root) {
        root = roomNode.addComponent(RoomRoot);
    }
    root.roomId = room.id;
    root.mapW = room.mapW;
    root.mapH = room.mapH;

    const ui = roomNode.getComponent(UITransform) ?? roomNode.addComponent(UITransform);
    ui.setContentSize(room.mapW, room.mapH);
    ui.setAnchorPoint(0.5, 0.5);
    roomNode.setPosition(0, 0, 0);

    const guide = roomNode.getComponent(RoomGuideGizmo);
    if (guide) {
        guide.roomId = room.id;
        guide.mapW = room.mapW;
        guide.mapH = room.mapH;
        if (!roomNode.getChildByName('_GeneratedMap')?.getChildByName('Floor')) {
            guide.rebuild();
        }
        guide.enabled = false;
    }

    walkNodes(roomNode, (node) => {
        if (node === roomNode) {
            return;
        }
        ensureMarker(node, /鼠洞/, RatHoleMarker);
        ensureMarker(node, /老鼠出生/, HamsterSpawnMarker);
        ensureMarker(node, /猫出生/, CatSpawnMarker);
        setupCatbed(node);

        if (/^mouseGap$|^窄道$/i.test(node.name)) {
            setupGapMarker(node, NarrowGapMarker, 28, 70);
        }
        if (/^catPath$/i.test(node.name)) {
            setupGapMarker(node, CatPathMarker, 80, 70);
        }
    });

    setupFoodSpots(roomNode);
    ensureDefaultMouseGap(roomNode);
    ensureDefaultCatPath(roomNode);

    setupNoCollisionBranches(roomNode);

    walkNodes(roomNode, (node) => {
        if (node === roomNode || isMarkerNode(node.name) || SKIP_FURNITURE_NAME.test(node.name)) {
            return;
        }
        if (isNoCollisionBranch(node) || isFoodBranch(node)) {
            return;
        }
        if (!node.getComponent(Sprite) || node.getComponent(FurnitureMarker)) {
            return;
        }
        const fm = node.addComponent(FurnitureMarker);
        fm.interactive = true;
        fm.layer = inferLayer(node);
    });

    walkNodes(roomNode, (node) => {
        if (node.name.startsWith('_guide_') || node.name.startsWith('_说明')) {
            node.active = false;
        }
    });

    stripNoCollisionFurnitureMarkers(roomNode);
    setupNoCollisionBranches(roomNode);
}
