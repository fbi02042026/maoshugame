import { Color, Graphics, Node, UITransform } from 'cc';
import { buildBorderWalls } from '../game/MapGenerator';
import { htmlToCocos } from '../core/MapCoords';
import { GAME_LAYER, setLayerRecursive } from '../core/LayerUtil';
import type { FoodBowl, RatHole } from '../data/GameTypes';

const FLOOR1 = new Color(240, 228, 212, 255);
const FLOOR2 = new Color(232, 218, 200, 255);
const WALL_COLOR = new Color(184, 230, 208, 255);
const HOLE_COLOR = new Color(58, 42, 26, 255);
const HOLE_INNER = new Color(26, 18, 10, 255);
const GOLD_HOLE_COLOR = new Color(255, 200, 50, 255);
const GOLD_HOLE_GLOW = new Color(255, 215, 0, 80);
const BOWL_COLOR = new Color(100, 149, 237, 255);
const BOWL_FOOD_COLOR = new Color(255, 165, 0, 255);

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

/** 绘制鼠洞（深色洞+深色内圈，可选金色发光效果） */
function drawRatHole(gfx: Graphics, r: number, isGold: boolean, glowPhase?: number): void {
    gfx.clear();
    if (isGold) {
        // 金色呼吸光圈
        const glowR = r + 20 + Math.sin(glowPhase ?? 0) * 6;
        gfx.fillColor = GOLD_HOLE_GLOW;
        gfx.circle(0, 0, glowR);
        gfx.fill();
        // 金色外圈
        gfx.fillColor = GOLD_HOLE_COLOR;
        gfx.circle(0, 0, r);
        gfx.fill();
        // 深色内圈
        gfx.fillColor = HOLE_INNER;
        gfx.circle(0, 0, r * 0.55);
        gfx.fill();
    } else {
        // 普通鼠洞
        gfx.fillColor = HOLE_COLOR;
        gfx.circle(0, 0, r);
        gfx.fill();
        gfx.fillColor = HOLE_INNER;
        gfx.circle(0, 0, r * 0.55);
        gfx.fill();
    }
}

/** 绘制猫粮碗 */
function drawFoodBowl(gfx: Graphics, r: number): void {
    gfx.clear();
    // 碗身（椭圆）
    gfx.fillColor = BOWL_COLOR;
    gfx.ellipse(0, 0, r, r * 0.5);
    gfx.fill();
    // 碗里的猫粮
    gfx.fillColor = BOWL_FOOD_COLOR;
    gfx.circle(-r * 0.3, 2, r * 0.25);
    gfx.fill();
    gfx.circle(r * 0.2, 3, r * 0.2);
    gfx.fill();
    gfx.circle(0, -2, r * 0.22);
    gfx.fill();
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
    /** 鼠洞是否是金色出口 */
    ratHoleGold?: boolean;
    /** 猫粮碗位置 */
    foodBowls?: FoodBowl[];
    /** 勾选后重建 Floor/Walls */
    force?: boolean;
}

/**
 * 在 Room 节点下维护 `_GeneratedMap`（Floor + Walls + 可选鼠洞 + 猫粮碗）。
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

    // 地板
    let floorNode = gen.getChildByName('Floor');
    if (!floorNode || force) {
        floorNode?.destroy();
        floorNode = ensureChild(gen, 'Floor', 0);
        floorNode.addComponent(UITransform).setContentSize(mapW, mapH);
        drawCheckerFloor(floorNode.addComponent(Graphics), mapW, mapH);
    }

    // 墙壁
    let wallNode = gen.getChildByName('Walls');
    if (!wallNode || force) {
        wallNode?.destroy();
        wallNode = ensureChild(gen, 'Walls', 1);
        wallNode.addComponent(UITransform).setContentSize(mapW, mapH);
        drawWalls(wallNode.addComponent(Graphics), mapW, mapH);
    }

    // 鼠洞
    const holeNode = gen.getChildByName('RatHole');
    if (opts?.skipRatHole) {
        holeNode?.destroy();
    } else if (opts?.ratHole) {
        let hole = holeNode;
        if (!hole || force) {
            hole?.destroy();
            hole = ensureChild(gen, 'RatHole', 2);
        }
        const holePos = htmlToCocos(opts.ratHole.x, opts.ratHole.y, mapW, mapH);
        hole.setPosition(holePos.x, holePos.y, 0);
        hole.addComponent(UITransform).setContentSize(opts.ratHole.r * 4, opts.ratHole.r * 4);
        const gfx = hole.getComponent(Graphics) ?? hole.addComponent(Graphics);
        drawRatHole(gfx, opts.ratHole.r, !!opts.ratHoleGold, 0);
    }

    // 猫粮碗
    const bowlsRoot = gen.getChildByName('FoodBowls');
    bowlsRoot?.destroy();
    if (opts?.foodBowls && opts.foodBowls.length > 0) {
        const root = ensureChild(gen, 'FoodBowls', 3);
        for (const bowl of opts.foodBowls) {
            const bNode = new Node(`FoodBowl_${bowl.x}_${bowl.y}`);
            root.addChild(bNode);
            const bPos = htmlToCocos(bowl.x, bowl.y, mapW, mapH);
            bNode.setPosition(bPos.x, bPos.y, 0);
            bNode.addComponent(UITransform).setContentSize(bowl.r * 2, bowl.r * 2);
            const gfx = bNode.addComponent(Graphics);
            drawFoodBowl(gfx, bowl.r);
        }
    }

    setLayerRecursive(gen, GAME_LAYER);
    return gen;
}

/**
 * 动态更新鼠洞状态（收集完食物后调用）
 * @param roomNode 房间根节点
 * @param ratHole 鼠洞位置数据
 * @param isGold 是否是金色出口
 * @param mapW/mapH 地图尺寸
 */
export function showRatHole(
    roomNode: Node,
    ratHole: RatHole,
    isGold: boolean,
    mapW: number,
    mapH: number,
): void {
    let gen = roomNode.getChildByName('_GeneratedMap');
    if (!gen) {
        gen = new Node('_GeneratedMap');
        gen.layer = roomNode.layer;
        roomNode.addChild(gen);
        gen.setSiblingIndex(0);
    }

    let hole = gen.getChildByName('RatHole');
    if (!hole) {
        hole = new Node('RatHole');
        hole.layer = gen.layer;
        gen.addChild(hole);
        hole.setSiblingIndex(2);
    }

    const pos = htmlToCocos(ratHole.x, ratHole.y, mapW, mapH);
    hole.setPosition(pos.x, pos.y, 0);
    hole.addComponent(UITransform).setContentSize(ratHole.r * 4, ratHole.r * 4);
    const gfx = hole.getComponent(Graphics) ?? hole.addComponent(Graphics);
    drawRatHole(gfx, ratHole.r, isGold, 0);
}

/**
 * 更新鼠洞呼吸光圈（每帧调用，金色鼠洞才有效果）
 */
export function updateRatHoleGlow(roomNode: Node, time: number): void {
    const gen = roomNode.getChildByName('_GeneratedMap');
    const hole = gen?.getChildByName('RatHole');
    if (!hole) return;
    const gfx = hole.getComponent(Graphics);
    if (!gfx) return;
    // 简单的金色呼吸效果：重新绘制带phase
    // 这里只在鼠洞节点上存一个r和isGold状态，通过名字解析太麻烦，
    // 改为由 MapView 管理更直接。此函数留作备用。
}
