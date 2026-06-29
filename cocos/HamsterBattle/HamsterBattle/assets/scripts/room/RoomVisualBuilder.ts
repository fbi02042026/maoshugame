import { Color, Graphics, Node, UITransform, resources, JsonAsset } from 'cc';
import type { RoomTemplate } from '../data/GameTypes';
import { htmlCenterToCocosLocal } from '../core/RoomCoord';

interface BakedZone {
    name: string;
    w: number;
    h: number;
    htmlCx: number;
    htmlCy: number;
    color: [number, number, number, number];
    border: [number, number, number, number];
    label?: string;
}

interface BakedRatHole {
    htmlCx: number;
    htmlCy: number;
    r: number;
}

export interface BakedLayout {
    roomId: number;
    mapW: number;
    mapH: number;
    zones: BakedZone[];
    ratHole: BakedRatHole;
}

const FLOOR_FILL = new Color(240, 228, 212, 180);
const FLOOR_BORDER = new Color(160, 200, 180, 255);
const HOLE_FILL = new Color(58, 42, 26, 255);
const HOLE_INNER = new Color(26, 18, 10, 255);

function loadLayout(roomId: number): Promise<BakedLayout | null> {
    return new Promise((resolve) => {
        resources.load(`config/room_layouts/Room${roomId}`, JsonAsset, (err, asset) => {
            if (err || !asset) {
                resolve(null);
                return;
            }
            resolve(asset.json as BakedLayout);
        });
    });
}

function findByName(root: Node, name: string): Node | null {
    if (root.name === name || root.name.includes(name)) {
        return root;
    }
    for (const child of root.children) {
        const found = findByName(child, name);
        if (found) {
            return found;
        }
    }
    return null;
}

function hasFloorSheets(roomNode: Node): boolean {
    return !!findByName(roomNode, '地板片');
}

function createFloorSheet(
    parent: Node,
    zone: BakedZone,
    mapW: number,
    mapH: number,
    zIndex: number,
): Node {
    const pos = htmlCenterToCocosLocal(zone.htmlCx, zone.htmlCy, mapW, mapH);
    const node = new Node(zone.name);
    node.layer = parent.layer;
    parent.addChild(node);
    node.setPosition(pos.x, pos.y, 0);
    node.setSiblingIndex(zIndex);

    const ui = node.addComponent(UITransform);
    ui.setContentSize(zone.w, zone.h);
    ui.setAnchorPoint(0.5, 0.5);

    const gfx = node.addComponent(Graphics);
    const fill = new Color(zone.color[0], zone.color[1], zone.color[2], zone.color[3]);
    const stroke = new Color(zone.border[0], zone.border[1], zone.border[2], zone.border[3]);
    gfx.fillColor = fill;
    gfx.rect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    gfx.fill();
    gfx.lineWidth = 4;
    gfx.strokeColor = stroke;
    gfx.rect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    gfx.stroke();

    return node;
}

function createRatHole(parent: Node, ratHole: BakedRatHole, mapW: number, mapH: number): Node {
    const pos = htmlCenterToCocosLocal(ratHole.htmlCx, ratHole.htmlCy, mapW, mapH);
    const node = new Node('鼠洞');
    node.layer = parent.layer;
    parent.addChild(node);
    node.setPosition(pos.x, pos.y, 0);
    node.setSiblingIndex(9000);

    const gfx = node.addComponent(Graphics);
    gfx.fillColor = HOLE_FILL;
    gfx.circle(0, 0, ratHole.r);
    gfx.fill();
    gfx.fillColor = HOLE_INNER;
    gfx.circle(0, 0, ratHole.r * 0.55);
    gfx.fill();

    return node;
}

function ensureFurnitureFolder(parent: Node): Node {
    let folder = findByName(parent, '家具_拖图片');
    if (folder && folder !== parent) {
        return folder;
    }
    const node = new Node('家具_拖图片到这里');
    node.layer = parent.layer;
    parent.addChild(node);
    node.setSiblingIndex(5000);
    return node;
}

/** 仅生成地板片（房间大小）+ 鼠洞 + 空家具文件夹；不摆家具 */
export async function ensureRoomVisuals(roomNode: Node, room: RoomTemplate): Promise<void> {
    const layout = await loadLayout(room.id);

    if (layout) {
        if (!hasFloorSheets(roomNode)) {
            layout.zones.forEach((zone, i) => {
                createFloorSheet(roomNode, zone, layout.mapW, layout.mapH, i);
            });
        }
        if (!findByName(roomNode, '鼠洞')) {
            createRatHole(roomNode, layout.ratHole, layout.mapW, layout.mapH);
        }
    } else if (!hasFloorSheets(roomNode)) {
        createFloorSheet(
            roomNode,
            {
                name: '01_地板片',
                w: room.mapW,
                h: room.mapH,
                htmlCx: room.mapW / 2,
                htmlCy: room.mapH / 2,
                color: [FLOOR_FILL.r, FLOOR_FILL.g, FLOOR_FILL.b, FLOOR_FILL.a],
                border: [FLOOR_BORDER.r, FLOOR_BORDER.g, FLOOR_BORDER.b, FLOOR_BORDER.a],
            },
            room.mapW,
            room.mapH,
            0,
        );
        createRatHole(
            roomNode,
            { htmlCx: room.ratHole.x, htmlCy: room.ratHole.y, r: room.ratHole.r },
            room.mapW,
            room.mapH,
        );
    }

    ensureFurnitureFolder(roomNode);
}

export { loadLayout };
