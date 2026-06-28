import { circRectHit, dist, rand, randInt } from '../collision/CollisionUtil';
import { HAMSTER_RADIUS, CAT_RADIUS } from '../core/DesignConstants';
import { GameConfig } from '../core/GameConfig';
import type {
    FoodConfig,
    FoodItem,
    FurnitureItem,
    GapRect,
    MapData,
    PowerupItem,
    RatHole,
    WallRect,
} from '../data/GameTypes';
import { generateProceduralRoomLayout } from './RoomLayoutGenerator';

function pickUniqueFoods(count: number): FoodConfig[] {
    const pool = GameConfig.foods.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = randInt(0, i);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(count, pool.length));
}

export function buildBorderWalls(mapW: number, mapH: number): WallRect[] {
    const T = 18;
    return [
        { x: 0, y: 0, w: mapW, h: T },
        { x: 0, y: mapH - T, w: mapW, h: T },
        { x: 0, y: 0, w: T, h: mapH },
        { x: mapW - T, y: 0, w: T, h: mapH },
    ];
}

function cloneFurniture(list: FurnitureItem[]): FurnitureItem[] {
    return list.map((item) => ({ ...item }));
}

function furnitureOverlaps(furniture: FurnitureItem[], x: number, y: number, w: number, h: number, pad = 10): boolean {
    for (const f of furniture) {
        if (x + w + pad <= f.x || x >= f.x + f.w + pad || y + h + pad <= f.y || y >= f.y + f.h + pad) {
            continue;
        }
        return true;
    }
    return false;
}

export function placeFoodsForRoom(
    room: { mapW: number; mapH: number; ratHole: RatHole; foodSpots?: Array<{ x: number; y: number }> },
    furniture: FurnitureItem[],
    foodCount: number,
    levelId: number,
): FoodItem[] {
    const foods: FoodItem[] = [];
    const foodTypes = pickUniqueFoods(foodCount);
    const ratHole = room.ratHole;
    const margin = 36;
    const yMin = levelId === 1 ? 70 : 100;
    const yMax = room.mapH - margin - 60;

    if (room.foodSpots && room.foodSpots.length > 0) {
        for (let i = 0; i < foodCount; i += 1) {
            const spot = room.foodSpots[Math.min(i, room.foodSpots.length - 1)];
            foods.push({
                x: spot.x,
                y: spot.y,
                type: foodTypes[i],
                collected: false,
                stealing: false,
                stealProgress: 0,
            });
        }
        return foods;
    }

    for (let i = 0; i < foodCount; i += 1) {
        let placed = false;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const fx = rand(margin, room.mapW - margin);
            const fy = rand(yMin, yMax);
            if (!furnitureOverlaps(furniture, fx - 18, fy - 18, 36, 36, 10) && dist({ x: fx, y: fy }, ratHole) > 80) {
                foods.push({
                    x: fx,
                    y: fy,
                    type: foodTypes[i],
                    collected: false,
                    stealing: false,
                    stealProgress: 0,
                });
                placed = true;
                break;
            }
        }
        if (!placed && foodTypes[i]) {
            foods.push({
                x: rand(margin, room.mapW - margin),
                y: rand(yMin, yMax),
                type: foodTypes[i],
                collected: false,
                stealing: false,
                stealProgress: 0,
            });
        }
    }
    return foods;
}

export function repositionL1FoodsNearCat(furniture: FurnitureItem[], foods: FoodItem[], catX: number, catY: number): void {
    const nearFoods = [
        { x: catX + 80, y: catY + 50 },
        { x: catX - 70, y: catY + 60 },
        { x: catX + 90, y: catY - 40 },
    ];
    for (let i = 0; i < Math.min(foods.length, nearFoods.length); i += 1) {
        let fx = nearFoods[i].x;
        let fy = nearFoods[i].y;
        for (const f of furniture) {
            if (f.interactive && fx > f.x - 15 && fx < f.x + f.w + 15 && fy > f.y - 15 && fy < f.y + f.h + 15) {
                const dx = fx - (f.x + f.w / 2);
                const dy = fy - (f.y + f.h / 2);
                const len = Math.hypot(dx, dy);
                if (len > 0.1) {
                    const push = Math.max(f.w, f.h) + 20;
                    fx = f.x + f.w / 2 + (dx / len) * push;
                    fy = f.y + f.h / 2 + (dy / len) * push;
                }
                break;
            }
        }
        foods[i].x = fx;
        foods[i].y = fy;
    }
}

export function createHamsterSpawn(map: MapData): { x: number; y: number; r: number; speed: number } {
    if (map.hamsterSpawn) {
        return {
            x: map.hamsterSpawn.x,
            y: map.hamsterSpawn.y,
            r: HAMSTER_RADIUS,
            speed: GameConfig.difficulty.hamsterBaseSpeed,
        };
    }
    return {
        x: map.ratHole.x,
        y: map.ratHole.y - 80,
        r: HAMSTER_RADIUS,
        speed: GameConfig.difficulty.hamsterBaseSpeed,
    };
}

export function createCatSpawn(
    spawnCatBed: FurnitureItem | null,
    mapW: number,
    levelId: number,
): { x: number; y: number; r: number; state: 'sleeping'; stateTimer: number } {
    let sx: number;
    let sy: number;
    if (spawnCatBed) {
        sx = spawnCatBed.x + spawnCatBed.w / 2;
        sy = spawnCatBed.y + spawnCatBed.h / 2;
    } else {
        const starts = levelId === 1
            ? [
                { x: mapW * 0.35, y: 110 },
                { x: mapW * 0.62, y: 130 },
                { x: mapW * 0.45, y: 90 },
                { x: mapW * 0.28, y: 150 },
            ]
            : [
                { x: 600, y: 280 },
                { x: 200, y: 380 },
                { x: 700, y: 460 },
                { x: 400, y: 320 },
            ];
        const sp = starts[randInt(0, starts.length - 1)];
        sx = sp.x;
        sy = sp.y;
    }
    const stateTimer = levelId === 1 ? 15 : 10;
    return { x: sx, y: sy, r: CAT_RADIUS, state: 'sleeping', stateTimer };
}

/** JSON 房间配置（无预制体时的后备方案） */
export function generateMapFromJson(levelId: number): MapData {
    const lv = GameConfig.getLevel(levelId) ?? GameConfig.levels[0];
    const room = GameConfig.getRoom(lv.roomId);
    if (!room) {
        throw new Error(`找不到 roomId=${lv.roomId}，请检查 config/rooms.json 或放置 Room 预制体`);
    }

    const mapW = room.mapW;
    const mapH = room.mapH;
    const walls = buildBorderWalls(mapW, mapH);
    const ratHole = { ...room.ratHole };

    let furniture = cloneFurniture(room.furniture);
    let narrowGaps: GapRect[] = (room.narrowGaps ?? []).map((g) => ({ ...g }));
    let catPaths: GapRect[] = (room.catPaths ?? []).map((g) => ({ ...g }));
    let powerups: PowerupItem[] = (room.powerups ?? [])
        .filter((p) => !p.collected)
        .map((p) => ({ ...p }));

    let spawnCatBed: FurnitureItem | null = null;

    if (furniture.length === 0) {
        const proc = generateProceduralRoomLayout(levelId, mapW, mapH, ratHole, walls);
        furniture = proc.furniture;
        if (narrowGaps.length === 0) {
            narrowGaps = proc.narrowGaps;
        }
        if (catPaths.length === 0) {
            catPaths = proc.catPaths;
        }
        if (powerups.length === 0) {
            powerups = proc.powerups;
        }
        spawnCatBed = proc.spawnCatBed;
    } else {
        const catBeds = furniture.filter((f) => f.catbed);
        spawnCatBed = catBeds.length > 0 ? catBeds[randInt(0, catBeds.length - 1)] : null;
    }

    const foods = placeFoodsForRoom(
        { mapW, mapH, ratHole, foodSpots: room.foodSpots },
        furniture,
        lv.food,
        levelId,
    );

    const catSpawn = createCatSpawn(spawnCatBed, mapW, levelId);
    const catX = room.catSpawn?.x ?? catSpawn.x;
    const catY = room.catSpawn?.y ?? catSpawn.y;
    if (spawnCatBed) {
        spawnCatBed.x = catX - spawnCatBed.w / 2;
        spawnCatBed.y = catY - spawnCatBed.h / 2;
    }

    if (levelId === 1 && foods.length > 0) {
        repositionL1FoodsNearCat(furniture, foods, catX, catY);
    }

    return {
        levelId,
        roomId: room.id,
        mapW,
        mapH,
        walls,
        furniture,
        foods,
        powerups,
        ratHole,
        spawnCatBed,
        narrowGaps,
        catPaths,
        foodTarget: lv.food,
        hamsterSpawn: room.hamsterSpawn,
        catSpawnOverride: room.catSpawn,
        fromPrefab: false,
    };
}

export function generateMap(levelId: number): MapData {
    return generateMapFromJson(levelId);
}

/** 底墙在鼠洞处留缺口，避免回洞时被墙卡住 */
export function expandWallsForCollision(map: MapData): WallRect[] {
    const out: WallRect[] = [];
    const hole = map.ratHole;
    const gapPad = hole.r + 16;
    const gapLeft = Math.max(0, hole.x - gapPad);
    const gapRight = Math.min(map.mapW, hole.x + gapPad);

    for (const w of map.walls) {
        const isBottom = w.h <= 20 && w.y >= map.mapH - 25;
        if (!isBottom) {
            out.push(w);
            continue;
        }
        if (gapLeft > 0) {
            out.push({ x: 0, y: w.y, w: gapLeft, h: w.h });
        }
        if (gapRight < map.mapW) {
            out.push({ x: gapRight, y: w.y, w: map.mapW - gapRight, h: w.h });
        }
    }
    return out;
}

export function getCollidableRects(map: MapData): WallRect[] {
    const rects: WallRect[] = expandWallsForCollision(map);
    for (const f of map.furniture) {
        if (f.interactive) {
            rects.push({ x: f.x, y: f.y, w: f.w, h: f.h });
        }
    }
    return rects;
}
