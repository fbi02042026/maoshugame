/** 房间预制体坐标：Room 根节点原点在地图中心，与 MapCoords 一致 */

import { Node, UITransform, Vec3 } from 'cc';

const _worldPos = new Vec3();
const ROOM_ROOT = 'RoomRoot';

export function findRoomRootFrom(node: Node): Node | null {
    let cur: Node | null = node;
    while (cur) {
        if (cur.getComponent(ROOM_ROOT)) {
            return cur;
        }
        cur = cur.parent;
    }
    return null;
}

/** 节点在 Room 根节点下的本地坐标（支持嵌套在家具文件夹里） */
export function getRoomLocalPoint(node: Node): { x: number; y: number } {
    const room = findRoomRootFrom(node);
    const roomUi = room?.getComponent(UITransform);
    if (!roomUi) {
        return { x: node.position.x, y: node.position.y };
    }
    node.getWorldPosition(_worldPos);
    const local = roomUi.convertToNodeSpaceAR(_worldPos);
    return { x: local.x, y: local.y };
}

export function cocosLocalToHtml(localX: number, localY: number, mapW: number, mapH: number): { x: number; y: number } {
    return {
        x: localX + mapW / 2,
        y: mapH / 2 - localY,
    };
}

export function cocosLocalCenterToHtmlRect(
    localX: number,
    localY: number,
    w: number,
    h: number,
    mapW: number,
    mapH: number,
): { x: number; y: number; w: number; h: number } {
    const cx = localX + mapW / 2;
    const cy = mapH / 2 - localY;
    return {
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
    };
}

export function htmlToCocosLocal(htmlX: number, htmlY: number, mapW: number, mapH: number): { x: number; y: number } {
    return {
        x: htmlX - mapW / 2,
        y: mapH / 2 - htmlY,
    };
}

export function htmlCenterToCocosLocal(htmlCx: number, htmlCy: number, mapW: number, mapH: number): { x: number; y: number } {
    return htmlToCocosLocal(htmlCx, htmlCy, mapW, mapH);
}
