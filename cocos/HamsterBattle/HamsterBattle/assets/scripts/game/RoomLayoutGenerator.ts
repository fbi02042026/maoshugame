import { circRectHit, dist, rand, randInt } from '../collision/CollisionUtil';
import { ArtCatalog, type ArtCategoryKey } from '../core/ArtCatalog';
import type { FurnitureItem, GapRect, PowerupItem, RatHole, WallRect } from '../data/GameTypes';

export interface ProceduralRoomLayout {
    furniture: FurnitureItem[];
    narrowGaps: GapRect[];
    catPaths: GapRect[];
    powerups: PowerupItem[];
    spawnCatBed: FurnitureItem | null;
}

function pickArtId(category: ArtCategoryKey, exclude: string[] = []): string {
    const entry = ArtCatalog.pickRandom(category, exclude);
    if (entry) {
        return entry.id;
    }
    const fallback = ArtCatalog.getCategory(category)[0];
    return fallback?.id ?? category;
}

function pushFurniture(
    furniture: FurnitureItem[],
    item: Omit<FurnitureItem, 'hideable'> & { hideable?: boolean },
): void {
    furniture.push({
        hideable: item.decor ? false : item.hideable !== false,
        flipX: !!item.flipX,
        decor: !!item.decor,
        catbed: !!item.catbed,
        ...item,
    });
}

function overlaps(
    furniture: FurnitureItem[],
    x: number,
    y: number,
    w: number,
    h: number,
    pad = 10,
): boolean {
    for (const f of furniture) {
        if (x + w + pad <= f.x || x >= f.x + f.w + pad || y + h + pad <= f.y || y >= f.y + f.h + pad) {
            continue;
        }
        return true;
    }
    return false;
}

function isClearSpot(
    furniture: FurnitureItem[],
    walls: WallRect[],
    x: number,
    y: number,
    r: number,
): boolean {
    for (const f of furniture) {
        if (f.interactive && circRectHit(x, y, r, f.x, f.y, f.w, f.h)) {
            return false;
        }
    }
    for (const w of walls) {
        if (circRectHit(x, y, r, w.x, w.y, w.w, w.h)) {
            return false;
        }
    }
    return true;
}

function placeTopWallFurniture(furniture: FurnitureItem[], mapW: number): void {
    const T = 18;
    const y = T + 4;
    const topArts = ArtCatalog.getCategory('top');
    const stoveType = topArts[0]?.id ?? pickArtId('top');
    const fridgeA = topArts[0]?.id ?? pickArtId('top');
    const fridgeB = topArts[1]?.id ?? topArts[0]?.id ?? pickArtId('top');

    pushFurniture(furniture, {
        x: Math.floor(mapW / 2 - 110),
        y,
        w: 220,
        h: 72,
        type: stoveType,
        name: '灶台',
        interactive: false,
        layer: 'top',
    });
    pushFurniture(furniture, {
        x: T + 6,
        y: T + 6,
        w: 78,
        h: 100,
        type: fridgeA,
        name: '冰箱',
        interactive: false,
        layer: 'top',
    });
    pushFurniture(furniture, {
        x: mapW - T - 6 - 72,
        y: T + 8,
        w: 72,
        h: 96,
        type: fridgeB,
        name: '冰箱',
        interactive: false,
        layer: 'top',
    });
}

function placeSideWallFurniture(furniture: FurnitureItem[], mapW: number): void {
    const T = 18;
    const wallArts = ArtCatalog.getCategory('wall');
    const pickWall = (index: number): string => wallArts[index % wallArts.length]?.id ?? pickArtId('wall');

    const left = [
        { w: 72, h: 78, y: 150 },
        { w: 62, h: 108, y: 300 },
        { w: 54, h: 54, y: 480 },
    ];
    const right = [
        { w: 72, h: 78, y: 180 },
        { w: 52, h: 72, y: 340 },
        { w: 54, h: 54, y: 520 },
    ];

    left.forEach((d, i) => {
        pushFurniture(furniture, {
            x: T + 4,
            y: d.y,
            w: d.w,
            h: d.h,
            type: pickWall(i),
            name: '墙边',
            interactive: false,
            layer: 'side',
        });
    });
    right.forEach((d, i) => {
        pushFurniture(furniture, {
            x: mapW - T - 4 - d.w,
            y: d.y,
            w: d.w,
            h: d.h,
            type: pickWall(i + 3),
            name: '墙边',
            interactive: false,
            layer: 'side',
            flipX: true,
        });
    });
}

function placeCatBeds(furniture: FurnitureItem[], mapW: number): FurnitureItem | null {
    const bedType = pickArtId('decor');
    const defs = [
        { w: 76, h: 58, x: mapW * 0.2, y: 92 },
        { w: 76, h: 58, x: mapW * 0.52, y: 86 },
        { w: 74, h: 56, x: mapW * 0.76, y: 98 },
    ];
    const beds: FurnitureItem[] = [];
    defs.forEach((d) => {
        const bed: FurnitureItem = {
            x: d.x - d.w / 2,
            y: d.y,
            w: d.w,
            h: d.h,
            type: bedType,
            name: '猫窝',
            interactive: false,
            catbed: true,
            layer: 'catbed',
            hideable: false,
        };
        pushFurniture(furniture, bed);
        beds.push(bed);
    });
    return beds[randInt(0, beds.length - 1)];
}

function placeDecorations(furniture: FurnitureItem[], mapW: number, mapH: number, count: number): void {
    const decorArts = ArtCatalog.getCategory('decor');
    if (!decorArts.length) {
        return;
    }
    let placed = 0;
    for (let attempt = 0; attempt < 100 && placed < count; attempt += 1) {
        const art = decorArts[randInt(0, decorArts.length - 1)];
        const w = Math.min(40, Math.max(28, Math.round(art.w * 0.08)));
        const h = Math.min(42, Math.max(32, Math.round(art.h * 0.08)));
        const x = rand(50, mapW - w - 50);
        const y = rand(130, mapH - 200);
        if (!overlaps(furniture, x, y, w, h, 12)) {
            pushFurniture(furniture, {
                x,
                y,
                w,
                h,
                type: art.id,
                name: '装饰',
                interactive: true,
                decor: true,
                layer: 'decor',
            });
            placed += 1;
        }
    }
}

function placeFreeFurniture(furniture: FurnitureItem[], mapW: number, mapH: number, levelId: number): void {
    const freeArts = ArtCatalog.getCategory('free');
    if (!freeArts.length) {
        return;
    }

    const pool = levelId === 1
        ? freeArts.slice(0, Math.min(1, freeArts.length))
        : freeArts.slice();
    const pickCnt = levelId === 1 ? 1 : randInt(2, Math.min(4, pool.length));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (let i = 0; i < pickCnt; i += 1) {
        const art = shuffled[i % shuffled.length];
        const w = Math.min(150, Math.max(88, Math.round(art.w * 0.22)));
        const h = Math.min(110, Math.max(48, Math.round(art.h * 0.18)));
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const x = rand(80, mapW - w - 80);
            const y = rand(200, mapH - h - 160);
            if (!overlaps(furniture, x, y, w, h, 16)) {
                pushFurniture(furniture, {
                    x,
                    y,
                    w,
                    h,
                    type: art.id,
                    name: '家具',
                    interactive: true,
                    layer: 'free',
                });
                break;
            }
        }
    }
}

function placePowerups(
    furniture: FurnitureItem[],
    walls: WallRect[],
    ratHole: RatHole,
    levelId: number,
    isL1: boolean,
    mapW: number,
    mapH: number,
    catPaths: GapRect[],
): PowerupItem[] {
    const powerups: PowerupItem[] = [];
    const maxCnt = levelId === 3 ? 2 : levelId <= 2 ? 1 : 0;
    if (maxCnt <= 0) {
        return powerups;
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
        let x: number;
        let y: number;
        if (isL1 && catPaths.length > 0) {
            const g = catPaths[0];
            x = g.x + rand(15, Math.max(20, g.w - 15));
            y = g.y + g.h / 2 + rand(-50, 50);
        } else {
            x = rand(60, mapW - 60);
            y = rand(80, mapH - 120);
        }
        if (dist({ x, y }, ratHole) < 130) {
            continue;
        }
        if (isClearSpot(furniture, walls, x, y, 22)) {
            powerups.push({ x, y, type: 'toycar', collected: false });
            if (powerups.length >= maxCnt) {
                break;
            }
        }
    }
    return powerups;
}

/** 对齐 HTML generateMap：无预制体且 rooms.json furniture 为空时使用 */
export function generateProceduralRoomLayout(
    levelId: number,
    mapW: number,
    mapH: number,
    ratHole: RatHole,
    walls: WallRect[],
): ProceduralRoomLayout {
    const furniture: FurnitureItem[] = [];
    const isL1 = levelId === 1;
    let narrowGaps: GapRect[] = [];
    let catPaths: GapRect[] = [];

    placeTopWallFurniture(furniture, mapW);
    const spawnCatBed = placeCatBeds(furniture, mapW);
    if (!isL1) {
        placeSideWallFurniture(furniture, mapW);
    }

    if (isL1) {
        const wallY = Math.floor(mapH * 0.42);
        const barrierX = 50;
        const barrierW = Math.floor(mapW * 0.53);
        const sofaType = pickArtId('free');
        pushFurniture(furniture, {
            x: barrierX,
            y: wallY,
            w: barrierW,
            h: 70,
            type: sofaType,
            name: '沙发',
            interactive: true,
            layer: 'free',
        });
        narrowGaps = [{ x: 18, y: wallY, w: 28, h: 70, side: 'left', type: 'mouse' }];
        catPaths = [{
            x: barrierX + barrierW + 8,
            y: wallY,
            w: Math.max(80, mapW - barrierX - barrierW - 26),
            h: 70,
            type: 'cat',
        }];
        placeDecorations(furniture, mapW, mapH, 2);
    } else {
        placeFreeFurniture(furniture, mapW, mapH, levelId);
        placeDecorations(furniture, mapW, mapH, Math.min(9, 3 + levelId));
    }

    const powerups = placePowerups(furniture, walls, ratHole, levelId, isL1, mapW, mapH, catPaths);

    return { furniture, narrowGaps, catPaths, powerups, spawnCatBed };
}
