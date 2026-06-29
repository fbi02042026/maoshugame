export interface RectLike {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface PointLike {
    x: number;
    y: number;
}

export function dist(a: PointLike, b: PointLike): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle: number): number {
    while (angle > Math.PI) {
        angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
        angle += Math.PI * 2;
    }
    return angle;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
    return Math.floor(rand(min, max + 1));
}

export function circRectHit(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
}

export function hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    blockers: RectLike[],
    radius = 8,
): boolean {
    const steps = 10;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    for (let i = 1; i < steps; i += 1) {
        const px = x1 + dx * i;
        const py = y1 + dy * i;
        for (const rect of blockers) {
            if (circRectHit(px, py, radius, rect.x, rect.y, rect.w, rect.h)) {
                return false;
            }
        }
    }
    return true;
}

export function pushOut(
    cx: number,
    cy: number,
    cr: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
): PointLike {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    let dx = cx - nx;
    let dy = cy - ny;
    let d = Math.hypot(dx, dy);
    if (d < cr && d > 0.01) {
        const p = cr - d;
        return { x: cx + (dx / d) * p, y: cy + (dy / d) * p };
    }
    if (d < 0.01) {
        const dL = cx - rx;
        const dR = rx + rw - cx;
        const dT = cy - ry;
        const dB = ry + rh - cy;
        const minD = Math.min(dL, dR, dT, dB);
        if (minD === dL) return { x: rx - cr, y: cy };
        if (minD === dR) return { x: rx + rw + cr, y: cy };
        if (minD === dT) return { x: cx, y: ry - cr };
        return { x: cx, y: ry + rh + cr };
    }
    return { x: cx, y: cy };
}

export function isHamsterInsideFurniture(
    hx: number,
    hy: number,
    furniture: Array<{ x: number; y: number; w: number; h: number; interactive?: boolean; hideable?: boolean; decor?: boolean }>,
): boolean {
    for (const f of furniture) {
        if (f.interactive && f.hideable !== false && hx > f.x && hx < f.x + f.w && hy > f.y && hy < f.y + f.h) {
            return true;
        }
    }
    return false;
}
