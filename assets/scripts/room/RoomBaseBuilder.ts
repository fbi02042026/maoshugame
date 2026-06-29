import { Color, Graphics, Node, UITransform } from 'cc';
import { buildBorderWalls } from '../game/MapGenerator';
import { htmlToCocos } from '../core/MapCoords';
import { GAME_LAYER, setLayerRecursive } from '../core/LayerUtil';
import type { RatHole } from '../data/GameTypes';

const FLOOR1 = new Color(240, 228, 212, 255);
const FLOOR2 = new Color(232, 218, 200, 255);
const WALL_COLOR = new Color(184, 230, 208, 255);
const HOLE_COLOR = new Color(58, 42, 26, 255);

export function drawCheckerFloor(gfx: Graphics, mapW: number, mapH: number): void {
    const tile = 40;
    const cols = Math.ceil(mapW / tile);
    const rows = Math.ceil(mapH / tile);
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const hx = col * tile;
            const hy = row * tile;
            const tw = Math.min(tile, mapW - hx);
            const th = Math.min(tile, mapH - hy);
            const cx = hx + tw / 2 - mapW / 2;
            const cy = mapH / 2 - (hy + th / 2);
            gfx.fillColor = (row + col) % 2 === 0 ? FLOOR1 : FLOOR2;
            gfx.rect(cx - tw / 2, cy - th / 2, tw, th);
            gfx.fill();
        }
    }
}

function drawWalls(gfx: Graphics, mapW: number, mapH: number): void {
    gfx.fillColor = WALL_COLOR;
    for (const wall of buildBorderWalls(mapW, mapH)) {
        const cx = wall.x + wall.w / 2 - mapW / 2;
        const cy = mapH / 2 - (wall.y + wall.h / 2);
        gfx.rect(cx - wall.w / 2, cy - wall.h / 2, wall.w, wall.h);
        gfx.fill();
    }
}

function ensureChild(parent: Node, name: string, index: number): Node {
    let node = parent.getChildByName(name);
    if (!node) {
        node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
    }
    node.setSiblingIndex(index);
    return node;
}

export function roomHasRatHoleVisual(roomNode: Node): boolean {
    const stack: Node[] = [roomNode];
    while (stack.length > 0) {
        const n = stack.pop()!;
        if (/鼠洞/i.test(n.name)) {
            return true;
        }
        for (const c of n.children) {
            stack.push(c);
        }
    }
    return false;
}

export interface SyncGeneratedMapOptions {
    skipRatHole?: boolean;
    ratHole?: RatHole;
    /** 勾选后重建 Floor/Walls（会清掉对 Floor、Walls 节点的直接修改） */
    force?: boolean;
}

/**
 * 在 Room 节点下维护 `_GeneratedMap`（Floor + Walls + 可选鼠洞）。
 * 默认仅缺失时创建，方便在 Room1Edit 里看着替换后保存场景。
 */
export function syncGeneratedMapBase(
    roomNode: Node,
    mapW: number,
    mapH: number,
    opts?: SyncGeneratedMapOptions,
): Node {
    let gen = roomNode.getChildByName('_GeneratedMap');
    if (!gen) {
        gen = new Node('_GeneratedMap');
        gen.layer = roomNode.layer;
        roomNode.addChild(gen);
        gen.setSiblingIndex(0);
    } else {
        gen.setSiblingIndex(0);
    }

    const force = !!opts?.force;
    let floorNode = gen.getChildByName('Floor');
    if (!floorNode || force) {
        floorNode?.destroy();
        floorNode = ensureChild(gen, 'Floor', 0);
        floorNode.addComponent(UITransform).setContentSize(mapW, mapH);
        drawCheckerFloor(floorNode.addComponent(Graphics), mapW, mapH);
    }

    let wallNode = gen.getChildByName('Walls');
    if (!wallNode || force) {
        wallNode?.destroy();
        wallNode = ensureChild(gen, 'Walls', 1);
        wallNode.addComponent(UITransform).setContentSize(mapW, mapH);
        drawWalls(wallNode.addComponent(Graphics), mapW, mapH);
    }

    const holeNode = gen.getChildByName('RatHole');
    if (opts?.skipRatHole) {
        holeNode?.destroy();
    } else if (opts?.ratHole && (!holeNode || force)) {
        holeNode?.destroy();
        const hole = ensureChild(gen, 'RatHole', 2);
        const holePos = htmlToCocos(opts.ratHole.x, opts.ratHole.y, mapW, mapH);
        hole.setPosition(holePos.x, holePos.y, 0);
        const holeGfx = hole.addComponent(Graphics);
        holeGfx.fillColor = HOLE_COLOR;
        holeGfx.circle(0, 0, opts.ratHole.r);
        holeGfx.fill();
        holeGfx.fillColor = new Color(26, 18, 10, 255);
        holeGfx.circle(0, 0, opts.ratHole.r * 0.55);
        holeGfx.fill();
    }

    setLayerRecursive(gen, GAME_LAYER);
    return gen;
}
