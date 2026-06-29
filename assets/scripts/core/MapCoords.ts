import { Vec3 } from 'cc';

/** HTML 画布坐标（左上原点、Y 向下）↔ Cocos 世界坐标（中心原点、Y 向上） */
export function htmlToCocos(x: number, y: number, mapW: number, mapH: number): Vec3 {
    return new Vec3(x - mapW / 2, mapH / 2 - y, 0);
}

export function htmlCenterToCocos(x: number, y: number, w: number, h: number, mapW: number, mapH: number): Vec3 {
    return htmlToCocos(x + w / 2, y + h / 2, mapW, mapH);
}

export function cocosToHtml(x: number, y: number, mapW: number, mapH: number): { x: number; y: number } {
    return {
        x: x + mapW / 2,
        y: mapH / 2 - y,
    };
}
