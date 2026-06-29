import {
    clamp,
    circRectHit,
    dist,
    hasLineOfSight,
    lerp,
    normalizeAngle,
    pushOut,
    rand,
    randInt,
    isHamsterInsideFurniture,
} from '../collision/CollisionUtil';
import { GameConfig } from '../core/GameConfig';
import { CAT_HIT_PAD, CAT_RADIUS, FURNITURE_HIT_PAD, HAMSTER_RADIUS } from '../core/DesignConstants';
import type { FurnitureItem, MapData, TrapConfig, WallRect } from '../data/GameTypes';
import { expandWallsForCollision } from '../game/MapGenerator';
import type { CatRuntimeState, GameRuntimeContext, HamsterRuntimeState } from './CatTypes';

const C = () => GameConfig.constants;
const D = () => GameConfig.difficulty;

export function pickInitialCatState(levelId: number, stateTimerOverride?: number): {
    state: CatRuntimeState['state'];
    stateTimer: number;
} {
    if (levelId === 1) {
        return { state: 'sleeping', stateTimer: stateTimerOverride ?? 15 };
    }
    const r = Math.random();
    if (r < 0.4) {
        return { state: 'sleeping', stateTimer: 10 };
    }
    if (r < 0.8) {
        return { state: 'lazy', stateTimer: 8 };
    }
    return { state: 'patrol', stateTimer: 0 };
}

export function createCatState(levelId: number, sx: number, sy: number, stateTimer: number): CatRuntimeState {
    const diff = D();
    const initial = pickInitialCatState(levelId, stateTimer > 0 ? stateTimer : undefined);
    const st = initial.state;
    const tm = initial.stateTimer;
    return {
        x: sx,
        y: sy,
        r: CAT_RADIUS,
        speed: diff.catBaseSpeed,
        dir: 0,
        state: st,
        stateTimer: tm,
        alertValue: 0,
        targetX: 0,
        targetY: 0,
        patrolPts: [],
        patrolIdx: 0,
        chaseSpeed: diff.catBaseSpeed * diff.catChaseMultiplier,
        patrolSpeed: diff.catBaseSpeed * diff.catPatrolMultiplier,
        stunTimer: 0,
        face: st === 'sleeping' ? 'sleeping' : 'normal',
        animT: 0,
        wanderAngle: 0,
        vx: 0,
        vy: 0,
        targetVx: 0,
        targetVy: 0,
        curSpd: 0,
        targetSpd: 0,
        accel: diff.catAccel,
        decel: diff.catDecel,
        baseTurnRate: diff.catBaseTurnRate,
        chaseBuildup: 0,
        chaseBuildupTime: 1.0,
        collCooldown: 0,
        catImg: st === 'sleeping' ? 'catSleep' : 'catAlert1',
        catImgTimer: 0,
        catImgVariant: 0,
        altPhase: 'main',
        altTimer: 0,
        altVariant: 0,
        firstChase: true,
        surprisedTimer: 0,
        lastState: st,
        stuckX: sx,
        stuckY: sy,
        stuckTimer: 0,
        patrolRandomAngle: 0,
        patrolRandomTimer: 0,
        hasSeenHamster: false,
        committedChase: false,
        chargeTimer: 0,
        chargeCooldown: 0,
        dashTimer: 0,
        wakeCharge: false,
        avoidUntil: 0,
        avoidVx: 0,
        avoidVy: 0,
    };
}

function getCatFacingAngle(c: CatRuntimeState): number {
    const len = Math.hypot(c.vx, c.vy);
    if (len > 0.05) return Math.atan2(c.vy, c.vx);
    const dirs = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
    return dirs[c.dir] || 0;
}

function isInCatVisionCone(c: CatRuntimeState, h: HamsterRuntimeState): boolean {
    const dx = h.x - c.x;
    const dy = h.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > C().catVisionRange) return false;
    const catAngle = getCatFacingAngle(c);
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - catAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < C().catVisionAngleRad / 2;
}

function calcAlertGain(c: CatRuntimeState, h: HamsterRuntimeState, d: number, hiding: boolean): number {
    if (d >= C().catVisionRange) return 0;
    const touchDist = c.r + h.r + 2;
    const t = clamp((C().catVisionRange - d) / Math.max(1, C().catVisionRange - touchDist), 0, 1);
    let rate = lerp(3, 25, t);
    if (hiding) rate *= 0.15;
    if (isInCatVisionCone(c, h)) rate *= 1.3;
    return rate;
}

function wakeCatSurprised(c: CatRuntimeState, ctx: GameRuntimeContext): void {
    if (c.state === 'surprised' || c.state === 'charging' || c.state === 'chase') return;
    c.state = 'surprised';
    c.face = 'surprised';
    c.surprisedTimer = C().catSurpriseTime;
    c.catImg = 'catSurprise';
    c.targetSpd = 0;
    c.curSpd = 0;
    c.hasSeenHamster = true;
    c.committedChase = true;
    if (c.firstChase) {
        ctx.sageHint = { text: '猫醒了！快跑！', timer: 3.0 };
        c.firstChase = false;
    }
}

function startCatChase(c: CatRuntimeState, h: HamsterRuntimeState): void {
    c.state = 'chase';
    c.face = 'chase';
    c.chaseBuildup = C().catChaseSmokeTime;
    c.targetSpd = 0;
    c.curSpd = 0;
    c.hasSeenHamster = true;
    const d = dist(c, h);
    const dx = h.x - c.x;
    const dy = h.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
        c.vx = dx / len;
        c.vy = dy / len;
        c.targetVx = c.vx;
        c.targetVy = c.vy;
    }
}

function getCatBedPos(map: MapData): { x: number; y: number } | null {
    const bed = map.spawnCatBed ?? map.furniture.find((f) => f.catbed);
    if (bed) return { x: bed.x + bed.w / 2, y: bed.y + bed.h / 2 };
    return null;
}

function tickCatAbandon(c: CatRuntimeState, h: HamsterRuntimeState, d: number, dt: number, levelId: number): boolean {
    if (!c.committedChase) return false;
    const lv = GameConfig.getLevel(levelId)!;
    const outOfAlert = d > C().catVisionRange;
    if (outOfAlert) {
        c.alertValue -= lv.alertSpeed * 5 * dt;
    } else {
        c.alertValue = 100;
    }
    c.alertValue = clamp(c.alertValue, 0, 100);
    if (c.alertValue <= C().catAlertReturn) {
        c.state = 'returning';
    c.committedChase = false;
    c.dashTimer = 0;
    c.chargeTimer = 0;
    c.wakeCharge = false;
    c.chargeCooldown = 0;
        return true;
    }
    return false;
}

function catDeflectFromWall(c: CatRuntimeState, nx: number, ny: number, time: number): void {
    const tx1 = -ny;
    const ty1 = nx;
    const tx2 = ny;
    const ty2 = -nx;
    const dot1 = c.vx * tx1 + c.vy * ty1;
    const dot2 = c.vx * tx2 + c.vy * ty2;
    const dx = Math.abs(dot1) >= Math.abs(dot2) ? tx1 : tx2;
    const dy = Math.abs(dot1) >= Math.abs(dot2) ? ty1 : ty2;
    c.avoidUntil = time + 1.0;
    c.avoidVx = dx;
    c.avoidVy = dy;
    c.vx = dx;
    c.vy = dy;
    c.targetVx = dx;
    c.targetVy = dy;
    c.collCooldown = 0.65;
    c.curSpd = Math.min(c.curSpd * 0.35, c.patrolSpeed * 0.6);
}

function getCatChaseTarget(c: CatRuntimeState, h: HamsterRuntimeState, map: MapData): { x: number; y: number } {
    if (!h) return { x: c.x, y: c.y };
    const blockers = map.furniture.filter((f) => f.interactive);
    if (hasLineOfSight(c.x, c.y, h.x, h.y, blockers, 2)) return { x: h.x, y: h.y };
    if (map.catPaths.length) {
        const g = map.catPaths[0];
        const gx = g.x + g.w / 2;
        const gy = g.y + g.h / 2;
        if (dist(c, { x: gx, y: gy }) > 20) return { x: gx, y: gy };
    }
    return { x: h.x, y: h.y };
}

function catDeflectFromFurniture(c: CatRuntimeState, f: FurnitureItem, time: number): void {
    const fcx = f.x + f.w / 2;
    const fcy = f.y + f.h / 2;
    let ax = c.x - fcx;
    let ay = c.y - fcy;
    let aLen = Math.hypot(ax, ay);
    if (aLen < 0.01) {
        ax = 1;
        ay = 0;
        aLen = 1;
    }
    ax /= aLen;
    ay /= aLen;
    const tx1 = -ay;
    const ty1 = ax;
    const tx2 = ay;
    const ty2 = -ax;
    const dot1 = c.vx * tx1 + c.vy * ty1;
    const dot2 = c.vx * tx2 + c.vy * ty2;
    const dx = Math.abs(dot1) >= Math.abs(dot2) ? tx1 : tx2;
    const dy = Math.abs(dot1) >= Math.abs(dot2) ? ty1 : ty2;
    c.avoidUntil = time + 0.9;
    c.avoidVx = dx;
    c.avoidVy = dy;
    c.vx = dx;
    c.vy = dy;
    c.targetVx = dx;
    c.targetVy = dy;
    c.collCooldown = 0.55;
    c.curSpd = Math.min(c.curSpd * 0.35, c.patrolSpeed * 0.5);
}

function genPatrolPts(map: MapData, placedTraps: GameRuntimeContext['placedTraps']): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [];
    const uncollectedFoods = map.foods.filter((f) => !f.collected);
    const foodTargets = uncollectedFoods.length > 0 ? uncollectedFoods : map.foods;
    for (const food of foodTargets) {
        if (pts.length >= 6) break;
        const angle = Math.random() * Math.PI * 2;
        const offset = 60 + Math.random() * 100;
        const px = food.x + Math.cos(angle) * offset;
        const py = food.y + Math.sin(angle) * offset;
        if (px > 50 && px < map.mapW - 50 && py > 50 && py < map.mapH - 100) {
            pts.push({ x: px, y: py });
        }
    }
    let attempts = 0;
    while (pts.length < 6 && attempts < 200) {
        attempts += 1;
        const px = rand(80, map.mapW - 80);
        const py = rand(80, map.mapH - 180);
        let inside = false;
        for (const f of map.furniture) {
            if (px > f.x - 10 && px < f.x + f.w + 10 && py > f.y - 10 && py < f.y + f.h + 10) {
                inside = true;
                break;
            }
        }
        if (!inside) {
            for (const t of placedTraps) {
                if (Math.hypot(px - t.x, py - t.y) < 25) {
                    inside = true;
                    break;
                }
            }
        }
        if (!inside) pts.push({ x: px, y: py });
    }
    while (pts.length < 6) pts.push({ x: rand(100, map.mapW - 100), y: rand(100, map.mapH - 200) });
    return pts;
}

function catMove(cat: CatRuntimeState, tx: number, ty: number, time: number): void {
    if (cat.avoidUntil && time < cat.avoidUntil) {
        cat.targetVx = cat.avoidVx;
        cat.targetVy = cat.avoidVy;
        cat.dir = Math.abs(cat.targetVx) > Math.abs(cat.targetVy)
            ? (cat.targetVx > 0 ? 3 : 2)
            : (cat.targetVy > 0 ? 0 : 1);
        return;
    }
    const dx = tx - cat.x;
    const dy = ty - cat.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
        cat.targetVx = dx / d;
        cat.targetVy = dy / d;
        cat.dir = Math.abs(cat.targetVx) > Math.abs(cat.targetVy)
            ? (cat.targetVx > 0 ? 3 : 2)
            : (cat.targetVy > 0 ? 0 : 1);
    } else if (d > 0.01) {
        cat.targetVx = dx / d;
        cat.targetVy = dy / d;
    }
}

function isCatPursuing(c: CatRuntimeState): boolean {
    return c.state === 'chase' || (c.state === 'charging' && !c.wakeCharge);
}

function isCatFastEnough(c: CatRuntimeState): boolean {
    return c.dashTimer > 0 || c.curSpd >= c.chaseSpeed * 0.5;
}

function getStunTime(ctx: GameRuntimeContext, trap?: TrapConfig): number {
    if (ctx.catHits >= C().catMaxStunHits) return 0;
    const base = trap ? trap.stun : 1.5;
    return [base, base * 0.5, base * 0.15][Math.min(ctx.catHits, 2)];
}

function clampCatInBounds(c: CatRuntimeState, mapW: number, mapH: number): void {
    const pad = 18;
    c.x = clamp(c.x, pad + c.r, mapW - pad - c.r);
    c.y = clamp(c.y, pad + c.r, mapH - pad - c.r);
}

function updateAlternating(
    c: CatRuntimeState,
    dt: number,
    mainKey: [string, string],
    altKey: [string, string],
    minMain: number,
    maxMain: number,
    minAlt: number,
    maxAlt: number,
): string {
    c.altTimer -= dt;
    if (c.altTimer <= 0) {
        if (c.altPhase === 'main') {
            c.altPhase = 'switched';
            c.altVariant = c.altVariant === 0 ? 1 : 0;
            c.altTimer = minAlt + Math.random() * (maxAlt - minAlt);
        } else {
            c.altPhase = 'main';
            c.altTimer = minMain + Math.random() * (maxMain - minMain);
        }
    }
    return c.altPhase === 'main'
        ? (c.altVariant === 0 ? mainKey[0] : mainKey[1])
        : altKey[c.altVariant];
}

function updateCatImg(c: CatRuntimeState, dt: number, ctx: GameRuntimeContext): void {
    switch (c.state) {
    case 'sleeping':
        c.catImg = 'catSleep';
        break;
    case 'stunned':
        c.catImg = 'catStun';
        break;
    case 'surprised':
        c.catImg = 'catSurprise';
        break;
    case 'charging':
        c.catImg = 'catAngry';
        break;
    case 'chase':
        if (ctx.catHits >= 1) {
            c.catImg = updateAlternating(c, dt, ['catRage1', 'catRage2'], ['catRage1', 'catRage2'], 2, 4, 0.8, 1.5);
        } else {
            c.catImg = 'catAngry';
        }
        break;
    case 'alert':
        c.catImg = updateAlternating(c, dt, ['catAlert1', 'catAlert2'], ['catAlert1', 'catAlert2'], 2.5, 4.5, 0.8, 1.2);
        break;
    case 'returning':
        c.catImg = 'catAlert1';
        break;
    case 'lazy':
    case 'patrol':
        c.catImg = ctx.catHits >= 1 && c.catImg !== 'catHappy' ? 'catAngry' : 'catAlert1';
        break;
    case 'confused':
        if (c.catImg !== 'catHappy') c.catImg = 'catAlert1';
        break;
    default:
        if (c.catImg !== 'catHappy') c.catImg = 'catAlert1';
        break;
    }
}

function applyCatPhysics(c: CatRuntimeState, h: HamsterRuntimeState, map: MapData, dt: number): void {
    const distToHamster = h ? dist(c, h) : 9999;
    const catchDist = c.r + (h ? h.r : HAMSTER_RADIUS) + 4;

    if (c.curSpd < c.targetSpd) {
        c.curSpd += c.accel * dt;
        if (c.curSpd > c.targetSpd) c.curSpd = c.targetSpd;
    } else if (c.curSpd > c.targetSpd) {
        c.curSpd -= c.decel * dt;
        if (c.curSpd < c.targetSpd) c.curSpd = c.targetSpd;
    }
    if (c.targetSpd <= 0.01 && c.curSpd > 0) {
        c.curSpd -= c.decel * 0.8 * dt;
        if (c.curSpd < 0) c.curSpd = 0;
    }

    if (c.state === 'charging') {
        const cLen = Math.hypot(c.vx, c.vy);
        if (cLen > 0.01) {
            c.vx /= cLen;
            c.vy /= cLen;
        }
        const turnSpeed = c.baseTurnRate * 2.5 * dt;
        const curAngle = Math.atan2(c.vy, c.vx);
        const tgtAngle = Math.atan2(c.targetVy, c.targetVx);
        let diff = tgtAngle - curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = curAngle + clamp(diff, -turnSpeed, turnSpeed);
        c.vx = Math.cos(na);
        c.vy = Math.sin(na);
        return;
    }

    if (c.state === 'confused' || c.state === 'stunned') {
        const cLen = Math.hypot(c.vx, c.vy);
        if (cLen > 0.01) {
            c.vx /= cLen;
            c.vy /= cLen;
        }
        c.vx *= c.curSpd * 60;
        c.vy *= c.curSpd * 60;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        return;
    }

    let desiredVx = c.targetVx;
    let desiredVy = c.targetVy;
    let avoidVx = 0;
    let avoidVy = 0;
    let needsAvoid = false;
    const isCloseToTarget = distToHamster < catchDist + 20;

    if (c.curSpd > 0.1 && c.dashTimer <= 0) {
        const reactTime = isCloseToTarget ? 0.05 : 0.10;
        const lookAhead = c.curSpd * 60 * reactTime + c.r + 3;
        const maxLook = isCloseToTarget ? 25 : 45;
        const la = Math.min(lookAhead, maxLook);
        let hitObstacle: { x: number; y: number; type: string; fx?: number; fy?: number } | null = null;
        let hitDist = la;
        const samples = 6;
        for (let i = 1; i <= samples; i += 1) {
            const t = i / samples;
            const sx = c.x + c.vx * la * t;
            const sy = c.y + c.vy * la * t;
            for (const w of map.walls) {
                if (sx > w.x && sx < w.x + w.w && sy > w.y && sy < w.y + w.h) {
                    hitObstacle = { x: sx, y: sy, type: 'wall' };
                    hitDist = la * t;
                    break;
                }
            }
            if (hitObstacle) break;
            if (c.state === 'chase') {
                for (const f of map.furniture) {
                    if (f.interactive && sx > f.x - 3 && sx < f.x + f.w + 3 && sy > f.y - 3 && sy < f.y + f.h + 3) {
                        if (h) {
                            const hNearF = h.x > f.x - 15 && h.x < f.x + f.w + 15 && h.y > f.y - 15 && h.y < f.y + f.h + 15;
                            if (hNearF && distToHamster < hitDist + 20) continue;
                        }
                        hitObstacle = { x: sx, y: sy, type: 'furn', fx: f.x + f.w / 2, fy: f.y + f.h / 2 };
                        hitDist = la * t;
                        break;
                    }
                }
                if (hitObstacle) break;
            }
        }

        if (hitObstacle) {
            needsAvoid = true;
            let ax: number;
            let ay: number;
            if (hitObstacle.type === 'wall') {
                const tx1 = -c.vy;
                const ty1 = c.vx;
                const tx2 = c.vy;
                const ty2 = -c.vx;
                const dot1 = c.targetVx * tx1 + c.targetVy * ty1;
                const dot2 = c.targetVx * tx2 + c.targetVy * ty2;
                if (dot1 > dot2) {
                    ax = tx1;
                    ay = ty1;
                } else {
                    ax = tx2;
                    ay = ty2;
                }
                ax = ax * 0.6 + c.targetVx * 0.4;
                ay = ay * 0.6 + c.targetVy * 0.4;
            } else {
                ax = c.x - (hitObstacle.fx ?? c.x);
                ay = c.y - (hitObstacle.fy ?? c.y);
                const aLen = Math.hypot(ax, ay);
                if (aLen > 0.01) {
                    ax /= aLen;
                    ay /= aLen;
                }
                ax = ax * 0.5 + c.targetVx * 0.5;
                ay = ay * 0.5 + c.targetVy * 0.5;
            }
            const aLen = Math.hypot(ax, ay);
            if (aLen > 0.01) {
                avoidVx = ax / aLen;
                avoidVy = ay / aLen;
            }
            if (!isCloseToTarget) {
                const slowFactor = Math.max(0.5, hitDist / la);
                c.curSpd = Math.min(c.curSpd, c.chaseSpeed * slowFactor);
            }
        }
    }

    if (needsAvoid) {
        const avoidWeight = isCloseToTarget ? 0.35 : 0.6;
        const tgtWeight = isCloseToTarget ? 0.65 : 0.4;
        desiredVx = desiredVx * tgtWeight + avoidVx * avoidWeight;
        desiredVy = desiredVy * tgtWeight + avoidVy * avoidWeight;
        const dLen = Math.hypot(desiredVx, desiredVy);
        if (dLen > 0.01) {
            desiredVx /= dLen;
            desiredVy /= dLen;
        }
    }

    if (Math.abs(c.vx) < 0.01 && Math.abs(c.vy) < 0.01) {
        c.vx = desiredVx;
        c.vy = desiredVy;
    }

    const curAngle = Math.atan2(c.vy, c.vx);
    const tgtAngle = Math.atan2(desiredVy, desiredVx);
    let diff = tgtAngle - curAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const absDiff = Math.abs(diff);
    const spdRatio = c.chaseSpeed > 0 ? c.curSpd / c.chaseSpeed : 0;
    let turnMult = 1.0;
    if (c.dashTimer > 0) {
        turnMult = lerp(0.04, 0.2, 1 - spdRatio);
    } else if (spdRatio > 0.75) {
        turnMult = lerp(0.25, 1.0, (1 - spdRatio) / 0.25);
    }
    const turnSlowdown = 1.0 - absDiff * (c.dashTimer > 0 ? 0.95 : 0.8);
    const turnSlowdownClamped = Math.max(c.dashTimer > 0 ? 0.15 : 0.25, turnSlowdown);
    c.curSpd *= 1.0 + (turnSlowdownClamped - 1.0) * 3.0 * dt;
    const turnSpeed = c.baseTurnRate * turnMult * (isCloseToTarget ? 2.0 : 1.0) * (1.0 + absDiff * 0.5);
    const maxTurn = turnSpeed * dt;
    const actualTurn = absDiff < maxTurn ? diff : Math.sign(diff) * maxTurn;
    const newAngle = curAngle + actualTurn;
    c.vx = Math.cos(newAngle);
    c.vy = Math.sin(newAngle);
    const spdCap = c.dashTimer > 0 ? c.chaseSpeed * 1.5 : c.chaseSpeed;
    c.curSpd = Math.min(c.curSpd, spdCap);
    const move = c.curSpd * 60 * dt;
    c.x += c.vx * move;
    c.y += c.vy * move;
}

function handleStuckDetection(
    c: CatRuntimeState,
    h: HamsterRuntimeState,
    map: MapData,
    placedTraps: GameRuntimeContext['placedTraps'],
    dt: number,
): void {
    const activeStates: CatRuntimeState['state'][] = [
        'patrol', 'chase', 'charging', 'returning', 'alert', 'stunned', 'confused', 'surprised', 'lazy',
    ];
    if (!activeStates.includes(c.state)) {
        c.stuckTimer = 0;
        c.stuckX = c.x;
        c.stuckY = c.y;
        return;
    }
    const dx = c.x - c.stuckX;
    const dy = c.y - c.stuckY;
    c.stuckTimer += dt;
    if (c.stuckTimer <= 1.5) return;
    const moved = Math.hypot(dx, dy);
    if (moved >= 15) {
        c.stuckX = c.x;
        c.stuckY = c.y;
        c.stuckTimer = 0;
        return;
    }
    const testDirs = [
        { vx: 1, vy: 0 }, { vx: -1, vy: 0 }, { vx: 0, vy: 1 }, { vx: 0, vy: -1 },
        { vx: 0.707, vy: 0.707 }, { vx: -0.707, vy: 0.707 }, { vx: 0.707, vy: -0.707 }, { vx: -0.707, vy: -0.707 },
    ];
    let bestDir: { vx: number; vy: number } | null = null;
    let bestGap = 0;
    for (const dir of testDirs) {
        let clear = true;
        let stepDist = 0;
        for (let step = 10; step <= 80; step += 10) {
            const tx = c.x + dir.vx * step;
            const ty = c.y + dir.vy * step;
            for (const f of map.furniture) {
                if (f.interactive && circRectHit(tx, ty, c.r, f.x, f.y, f.w, f.h)) {
                    clear = false;
                    break;
                }
            }
            if (!clear) break;
            for (const w of map.walls) {
                if (circRectHit(tx, ty, c.r, w.x, w.y, w.w, w.h)) {
                    clear = false;
                    break;
                }
            }
            if (!clear) break;
            stepDist = step;
        }
        if (stepDist > bestGap) {
            bestGap = stepDist;
            bestDir = dir;
        }
    }
    if (c.state === 'patrol') {
        let targetX = map.mapW / 2;
        let targetY = map.mapH / 2;
        const food = map.foods.find((f) => !f.collected);
        if (food) {
            targetX = food.x;
            targetY = food.y;
        }
        const foodAngle = Math.atan2(targetY - c.y, targetX - c.x);
        const clearDirs: Array<{ dir: { vx: number; vy: number }; dist: number; angle: number }> = [];
        for (const dir of testDirs) {
            let clear = true;
            let stepDist = 0;
            for (let step = 10; step <= 80; step += 10) {
                const tx = c.x + dir.vx * step;
                const ty = c.y + dir.vy * step;
                for (const f of map.furniture) {
                    if (f.interactive && circRectHit(tx, ty, c.r, f.x, f.y, f.w, f.h)) {
                        clear = false;
                        break;
                    }
                }
                if (!clear) break;
                for (const w of map.walls) {
                    if (circRectHit(tx, ty, c.r, w.x, w.y, w.w, w.h)) {
                        clear = false;
                        break;
                    }
                }
                if (!clear) break;
                stepDist = step;
            }
            if (stepDist > 30) clearDirs.push({ dir, dist: stepDist, angle: Math.atan2(dir.vy, dir.vx) });
        }
        let finalAngle: number;
        if (clearDirs.length > 0) {
            clearDirs.sort((a, b) => {
                const da = Math.abs(normalizeAngle(a.angle - foodAngle));
                const db = Math.abs(normalizeAngle(b.angle - foodAngle));
                return da - db;
            });
            finalAngle = clearDirs[0].angle + (Math.random() - 0.5) * 0.6;
        } else {
            finalAngle = Math.random() * Math.PI * 2;
        }
        c.vx = Math.cos(finalAngle);
        c.vy = Math.sin(finalAngle);
        c.targetVx = c.vx;
        c.targetVy = c.vy;
        c.patrolRandomAngle = finalAngle;
        c.patrolRandomTimer = rand(0.8, 2.0);
        c.curSpd = Math.max(c.curSpd, c.patrolSpeed);
    } else if (bestDir && bestGap > 30) {
        c.vx = bestDir.vx;
        c.vy = bestDir.vy;
        c.targetVx = bestDir.vx;
        c.targetVy = bestDir.vy;
        c.curSpd = Math.max(c.curSpd, c.patrolSpeed);
    } else if (c.state === 'chase' || c.state === 'alert') {
        const tox = h.x - c.x;
        const toy = h.y - c.y;
        const toLen = Math.hypot(tox, toy);
        if (toLen > 0.01) {
            const r = Math.random() > 0.5 ? 1 : -1;
            c.vx = (tox * r - toy) / Math.SQRT2 / toLen;
            c.vy = (toy * r + tox) / Math.SQRT2 / toLen;
            c.targetVx = c.vx;
            c.targetVy = c.vy;
        }
    } else {
        c.state = 'patrol';
        c.patrolPts = genPatrolPts(map, placedTraps);
        c.patrolIdx = 0;
        if (c.patrolPts.length > 0) {
            const pt = c.patrolPts[0];
            const pdx = pt.x - c.x;
            const pdy = pt.y - c.y;
            const pLen = Math.hypot(pdx, pdy);
            if (pLen > 0.01) {
                c.vx = pdx / pLen;
                c.vy = pdy / pLen;
                c.targetVx = c.vx;
                c.targetVy = c.vy;
            }
        }
    }
    c.stuckX = c.x;
    c.stuckY = c.y;
    c.stuckTimer = 0;
}

function furnitureHitRect(f: FurnitureItem): WallRect {
    return {
        x: f.x - FURNITURE_HIT_PAD,
        y: f.y - FURNITURE_HIT_PAD,
        w: f.w + FURNITURE_HIT_PAD * 2,
        h: f.h + FURNITURE_HIT_PAD * 2,
    };
}

function resolveCatCollisions(c: CatRuntimeState, ctx: GameRuntimeContext, map: MapData): void {
    const catHitR = c.r + CAT_HIT_PAD;
    if (c.collCooldown <= 0) {
        for (const f of map.furniture) {
            const fr = furnitureHitRect(f);
            if (f.interactive && c.state !== 'sleeping' && circRectHit(c.x, c.y, catHitR, fr.x, fr.y, fr.w, fr.h)) {
                const isDecor = !!f.decor;
                const stun = getStunTime(ctx);
                if (stun > 0 && isCatPursuing(c) && isCatFastEnough(c)) {
                    c.state = 'stunned';
                    c.stunTimer = stun;
                    c.alertValue = Math.max(0, c.alertValue - 20);
                    ctx.catHits += 1;
                    if (isDecor) (f as FurnitureItem & { shakeTimer?: number }).shakeTimer = 0.45;
                    const pushPad = isDecor ? 6 : 20;
                    if (ctx.catHits < C().catMaxStunHits) {
                        const p = pushOut(c.x, c.y, catHitR + pushPad, fr.x, fr.y, fr.w, fr.h);
                        const pdx = p.x - c.x;
                        const pdy = p.y - c.y;
                        c.x = p.x;
                        c.y = p.y;
                        if (Math.hypot(pdx, pdy) > 0.01) {
                            const vLen = Math.hypot(pdx, pdy);
                            c.vx = pdx / vLen;
                            c.vy = pdy / vLen;
                            c.targetVx = c.vx;
                            c.targetVy = c.vy;
                        }
                    }
                    c.curSpd *= 0.5;
                    c.collCooldown = 0.05;
                } else {
                    const pushPad = f.decor ? 8 : 12;
                    const p = pushOut(c.x, c.y, catHitR + pushPad, fr.x, fr.y, fr.w, fr.h);
                    c.x = p.x;
                    c.y = p.y;
                    if (f.decor) (f as FurnitureItem & { shakeTimer?: number }).shakeTimer = 0.35;
                    catDeflectFromFurniture(c, f, ctx.time);
                }
                break;
            }
        }
    }

    for (let i = ctx.placedTraps.length - 1; i >= 0; i -= 1) {
        const tr = ctx.placedTraps[i];
        if (dist(c, tr) < c.r + 16) {
            const td = GameConfig.traps[tr.type];
            const stun = getStunTime(ctx, td);
            if (stun > 0 && td) {
                c.state = 'stunned';
                c.stunTimer = stun;
                c.alertValue = Math.max(0, c.alertValue - 20);
                ctx.catHits += 1;
                ctx.placedTraps.splice(i, 1);
                c.curSpd = 0;
            }
        }
    }

    if (c.collCooldown <= 0 && c.state !== 'sleeping') {
        for (const w of expandWallsForCollision(map)) {
            if (circRectHit(c.x, c.y, catHitR + 2, w.x, w.y, w.w, w.h)) {
                const p = pushOut(c.x, c.y, catHitR + 8, w.x, w.y, w.w, w.h);
                const pdx = p.x - c.x;
                const pdy = p.y - c.y;
                const pLen = Math.hypot(pdx, pdy);
                c.x = p.x;
                c.y = p.y;
                const wallStun = getStunTime(ctx);
                if (wallStun > 0 && isCatPursuing(c) && isCatFastEnough(c)) {
                    c.state = 'stunned';
                    c.stunTimer = wallStun;
                    c.alertValue = Math.max(0, c.alertValue - 15);
                    ctx.catHits += 1;
                    c.curSpd *= 0.4;
                    c.collCooldown = 0.05;
                } else if (pLen > 0.01) {
                    catDeflectFromWall(c, pdx / pLen, pdy / pLen, ctx.time);
                } else {
                    c.collCooldown = 0.5;
                    c.curSpd *= 0.3;
                }
                break;
            }
        }
    }

    if (c.state !== 'sleeping' && map.narrowGaps.length) {
        for (const gap of map.narrowGaps) {
            if (gap.type !== 'mouse') continue;
            if (circRectHit(c.x, c.y, c.r, gap.x, gap.y, gap.w, gap.h)) {
                const p = pushOut(c.x, c.y, c.r + 6, gap.x, gap.y, gap.w, gap.h);
                c.x = p.x;
                c.y = p.y;
                let pdx = c.x - (gap.x + gap.w);
                const pdy = c.y - (gap.y + gap.h / 2);
                if (Math.hypot(pdx, pdy) < 0.01) {
                    c.vx = 1;
                    c.vy = 0;
                } else {
                    const pl = Math.hypot(pdx, pdy);
                    c.vx = pdx / pl;
                    c.vy = pdy / pl;
                }
                c.targetVx = c.vx;
                c.targetVy = c.vy;
                c.curSpd = Math.min(c.curSpd, c.patrolSpeed * 0.5);
                c.collCooldown = 0.4;
            }
        }
    }
}

export function updateCat(ctx: GameRuntimeContext, map: MapData, dt: number): void {
    const c = ctx.cat;
    const h = ctx.hamster;
    if (!c || !h) return;

    c.animT += dt;
    if (c.stateTimer > 0) c.stateTimer -= dt;
    const d = dist(c, h);
    const lv = GameConfig.getLevel(ctx.levelId)!;
    const hiding = isHamsterInsideFurniture(h.x, h.y, map.furniture);

    if (ctx.sageHint && ctx.sageHint.timer > 0) {
        c.targetSpd = 0;
        c.curSpd = 0;
        updateCatImg(c, dt, ctx);
        return;
    }

    c.lastState = c.state;

    const faceDist = c.r + h.r + C().catFaceWakeDist;
    if (c.state !== 'chase' && c.state !== 'surprised' && c.state !== 'stunned' && c.state !== 'confused') {
        if (d <= faceDist && (c.state === 'sleeping' || c.state === 'lazy' || c.state === 'patrol')) {
            c.alertValue = 100;
        } else if (d < C().catVisionRange) {
            let gain = calcAlertGain(c, h, d, hiding);
            // 醒着且在视野锥内：更快发现（含 returning / alert）
            if (c.state !== 'sleeping' && isInCatVisionCone(c, h)) {
                gain *= 2.2;
            }
            c.alertValue += gain * dt;
        } else {
            c.alertValue -= lv.alertSpeed * 0.5 * dt;
        }
    }

    // 警戒满：回窝/巡逻/警觉等状态都应被惊醒（returning 原先漏了）
    if (c.alertValue >= 100
        && c.state !== 'chase' && c.state !== 'surprised'
        && c.state !== 'stunned' && c.state !== 'confused' && c.state !== 'sleeping') {
        wakeCatSurprised(c, ctx);
    }

    handleStuckDetection(c, h, map, ctx.placedTraps, dt);

    switch (c.state) {
    case 'sleeping':
        c.face = 'sleeping';
        c.targetSpd = 0;
        c.catImg = 'catSleep';
        if (c.alertValue >= 100) wakeCatSurprised(c, ctx);
        else if (c.stateTimer <= 0 && ctx.levelId !== 1) {
            c.state = 'lazy';
            c.stateTimer = rand(6, 10);
        }
        break;
    case 'lazy':
        c.face = 'normal';
        c.targetSpd = c.patrolSpeed * 0.3;
        if (Math.abs(c.curSpd) < 0.1 || Math.random() < 0.02) {
            c.wanderAngle = Math.random() * Math.PI * 2;
            c.targetVx = Math.cos(c.wanderAngle);
            c.targetVy = Math.sin(c.wanderAngle);
        }
        if (c.alertValue >= 100) wakeCatSurprised(c, ctx);
        else if (c.alertValue > 15) {
            c.state = 'alert';
            c.face = 'alert';
        } else if (c.stateTimer <= 0) {
            c.state = 'patrol';
            c.patrolPts = genPatrolPts(map, ctx.placedTraps);
            c.patrolIdx = 0;
        }
        break;
    case 'patrol':
        c.face = 'normal';
        if (!c.patrolPts.length) c.patrolPts = genPatrolPts(map, ctx.placedTraps);
        if (c.alertValue >= 100) {
            wakeCatSurprised(c, ctx);
            break;
        }
        if (c.alertValue > 15) {
            c.state = 'alert';
            c.face = 'alert';
            break;
        }
        if (c.patrolRandomTimer > 0) {
            c.patrolRandomTimer -= dt;
            c.targetSpd = c.patrolSpeed;
            const tx = c.x + Math.cos(c.patrolRandomAngle) * 100;
            const ty = c.y + Math.sin(c.patrolRandomAngle) * 100;
            catMove(c, tx, ty, ctx.time);
        } else if (c.patrolIdx < c.patrolPts.length) {
            const t = c.patrolPts[c.patrolIdx];
            const td = dist(c, t);
            if (td < 30) {
                c.targetSpd = 0;
                if (c.curSpd < 0.1) {
                    c.patrolIdx += 1;
                    if (c.patrolIdx >= c.patrolPts.length) {
                        c.patrolPts = genPatrolPts(map, ctx.placedTraps);
                        c.patrolIdx = 0;
                    }
                }
            } else {
                c.targetSpd = c.patrolSpeed;
                catMove(c, t.x, t.y, ctx.time);
            }
        }
        break;
    case 'alert':
        c.face = 'alert';
        if (c.alertValue >= 100) {
            wakeCatSurprised(c, ctx);
            break;
        }
        if (c.alertValue <= 8) {
            c.state = 'patrol';
            c.patrolPts = genPatrolPts(map, ctx.placedTraps);
            c.patrolIdx = 0;
            c.face = 'normal';
            break;
        }
        c.targetSpd = c.patrolSpeed;
        if (c.hasSeenHamster) catMove(c, h.x, h.y, ctx.time);
        else {
            c.wanderAngle += (Math.random() - 0.5) * 0.5 * dt;
            c.targetVx = Math.cos(c.wanderAngle);
            c.targetVy = Math.sin(c.wanderAngle);
        }
        break;
    case 'surprised':
        c.face = 'surprised';
        c.targetSpd = 0;
        c.catImg = 'catSurprise';
        c.surprisedTimer -= dt;
        if (c.surprisedTimer <= 0) {
            c.state = 'charging';
            c.chargeTimer = 0;
            c.wakeCharge = true;
            c.face = 'chase';
        }
        break;
    case 'charging': {
        c.face = 'chase';
        c.targetSpd = 0;
        c.curSpd = Math.max(0, c.curSpd - dt * 3);
        c.chargeTimer = (c.chargeTimer || 0) + dt;
        const ct = getCatChaseTarget(c, h, map);
        catMove(c, ct.x, ct.y, ctx.time);
        const chargeLimit = c.wakeCharge ? C().catWakeChargeTime : C().catChargeTime;
        if (c.chargeTimer >= chargeLimit) {
            if (c.wakeCharge) {
                c.wakeCharge = false;
                c.chargeTimer = 0;
                startCatChase(c, h);
                break;
            }
            c.state = 'chase';
            c.dashTimer = C().catDashTime;
            c.chargeCooldown = 4.5;
            c.chargeTimer = 0;
            const ct2 = getCatChaseTarget(c, h, map);
            const dx = ct2.x - c.x;
            const dy = ct2.y - c.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.01) {
                c.vx = dx / len;
                c.vy = dy / len;
                c.targetVx = c.vx;
                c.targetVy = c.vy;
            }
            c.targetSpd = c.chaseSpeed * 1.45;
            c.curSpd = c.chaseSpeed * 1.25;
        }
        break;
    }
    case 'returning': {
        c.face = 'normal';
        if (c.alertValue >= 100) {
            wakeCatSurprised(c, ctx);
            break;
        }
        const bed = getCatBedPos(map);
        if (bed) {
            catMove(c, bed.x, bed.y, ctx.time);
            c.targetSpd = c.patrolSpeed;
            if (dist(c, bed) < 45) {
                c.state = ctx.levelId === 1 ? 'sleeping' : 'lazy';
                c.stateTimer = ctx.levelId === 1 ? 15 : 8;
                c.alertValue = 0;
                c.hasSeenHamster = false;
                c.targetSpd = 0;
                c.curSpd = 0;
            }
        } else {
            c.state = 'patrol';
            c.patrolPts = genPatrolPts(map, ctx.placedTraps);
            c.patrolIdx = 0;
        }
        break;
    }
    case 'chase':
        if (!c.hasSeenHamster && !ctx.foodStolen) {
            c.state = 'patrol';
            c.patrolPts = genPatrolPts(map, ctx.placedTraps);
            c.patrolIdx = 0;
            break;
        }
        if (ctx.foodStolen) c.committedChase = true;
        if (tickCatAbandon(c, h, d, dt, ctx.levelId)) break;
        c.face = 'chase';
        if (c.chargeCooldown > 0) c.chargeCooldown -= dt;
        {
            const pastWarmup = c.chaseBuildup >= C().catChaseSmokeTime + C().catChaseAccelTime;
            if (c.dashTimer <= 0 && pastWarmup && d > C().catFarDist && c.chargeCooldown <= 0) {
                c.state = 'charging';
                c.chargeTimer = 0;
                break;
            }
            c.chaseBuildup += dt;
            if (c.dashTimer > 0) {
                c.dashTimer -= dt;
                c.targetSpd = c.chaseSpeed * (1.1 + (c.dashTimer / C().catDashTime) * 0.35);
            } else if (c.chaseBuildup < C().catChaseSmokeTime) {
                c.targetSpd = 0;
            } else if (c.chaseBuildup < C().catChaseSmokeTime + C().catChaseAccelTime) {
                const t = (c.chaseBuildup - C().catChaseSmokeTime) / C().catChaseAccelTime;
                c.targetSpd = c.chaseSpeed * t;
            } else {
                c.targetSpd = c.chaseSpeed;
            }
            const ct = getCatChaseTarget(c, h, map);
            catMove(c, ct.x, ct.y, ctx.time);
        }
        break;
    case 'stunned':
        c.face = 'stunned';
        c.targetSpd = c.patrolSpeed * 0.4;
        if (Math.abs(c.vx) > 0.01 || Math.abs(c.vy) > 0.01) {
            c.targetVx = c.vx;
            c.targetVy = c.vy;
        }
        if (c.stunTimer > 0) c.stunTimer -= dt;
        if (c.stunTimer <= 0) {
            if (ctx.foodStolen && c.committedChase) startCatChase(c, h);
            else {
                c.state = 'patrol';
                c.patrolPts = genPatrolPts(map, ctx.placedTraps);
                c.patrolIdx = 0;
                c.face = 'normal';
                c.alertValue = 0;
                if (c.patrolPts.length > 0) {
                    const pt = c.patrolPts[0];
                    const pdx = pt.x - c.x;
                    const pdy = pt.y - c.y;
                    const pLen = Math.hypot(pdx, pdy);
                    if (pLen > 0.01) {
                        c.vx = pdx / pLen;
                        c.vy = pdy / pLen;
                        c.targetVx = c.vx;
                        c.targetVy = c.vy;
                    }
                }
            }
        }
        break;
    case 'confused':
        c.face = 'confused';
        c.targetSpd = c.patrolSpeed * 0.3;
        c.targetVx = c.vx;
        c.targetVy = c.vy;
        c.alertValue -= lv.alertSpeed * 4.0 * dt;
        if (c.stateTimer <= 0 && c.alertValue <= 0) {
            c.state = 'patrol';
            c.patrolPts = genPatrolPts(map, ctx.placedTraps);
            c.patrolIdx = 0;
            c.face = 'normal';
            if (c.patrolPts.length > 0) {
                const pt = c.patrolPts[0];
                const pdx = pt.x - c.x;
                const pdy = pt.y - c.y;
                const pLen = Math.hypot(pdx, pdy);
                if (pLen > 0.01) {
                    c.vx = pdx / pLen;
                    c.vy = pdy / pLen;
                    c.targetVx = c.vx;
                    c.targetVy = c.vy;
                }
            }
        }
        break;
    default:
        break;
    }

    updateCatImg(c, dt, ctx);
    if (c.collCooldown > 0) c.collCooldown -= dt;
    applyCatPhysics(c, h, map, dt);

    if (c.state === 'chase' && d < c.r + h.r + 6 && h.invincible <= 0) {
        ctx.onCatCatch();
    } else if (c.state === 'charging' && !c.wakeCharge && d < c.r + h.r + 8 && h.invincible <= 0) {
        ctx.onCatCatch();
    }

    resolveCatCollisions(c, ctx, map);
    clampCatInBounds(c, map.mapW, map.mapH);
    c.alertValue = clamp(c.alertValue, 0, 100);
}

export function onFoodStolen(ctx: GameRuntimeContext): void {
    const c = ctx.cat;
    const h = ctx.hamster;
    ctx.foodStolen = true;
    c.alertValue = 100;
    c.committedChase = true;
    c.hasSeenHamster = true;
    if (c.state === 'sleeping' || c.state === 'lazy' || c.state === 'patrol') {
        wakeCatSurprised(c, ctx);
    } else if (c.state !== 'chase' && c.state !== 'charging' && c.state !== 'surprised') {
        startCatChase(c, h);
    }
}

export function handleCatCatchHamster(ctx: GameRuntimeContext, map: MapData): void {
    const h = ctx.hamster;
    const c = ctx.cat;
    let dx = h.x - c.x;
    let dy = h.y - c.y;
    const dLen = Math.hypot(dx, dy);
    if (dLen > 0.01) {
        dx /= dLen;
        dy /= dLen;
    }
    const knockback = 20;
    let remaining = knockback;
    const step = 5;
    while (remaining > 0) {
        const s = Math.min(step, remaining);
        const nx = h.x + dx * s;
        const ny = h.y + dy * s;
        let blocked = false;
        for (const w of expandWallsForCollision(map)) {
            if (circRectHit(nx, ny, h.r, w.x, w.y, w.w, w.h)) {
                blocked = true;
                break;
            }
        }
        if (!blocked) {
            for (const f of map.furniture) {
                const fr = furnitureHitRect(f);
                if (f.interactive && circRectHit(nx, ny, h.r, fr.x, fr.y, fr.w, fr.h)) {
                    blocked = true;
                    break;
                }
            }
        }
        if (blocked) break;
        if (dist({ x: nx, y: ny }, map.ratHole) < h.r + map.ratHole.r) break;
        h.x = nx;
        h.y = ny;
        remaining -= s;
    }
    h.invincible = 2.5;
    c.state = 'confused';
    c.stateTimer = 1.5;
    c.alertValue = 0;
    c.targetSpd = 0;
    c.curSpd *= 0.3;
    c.catImg = 'catHappy';
    const cdx = c.x - h.x;
    const cdy = c.y - h.y;
    const cdLen = Math.hypot(cdx, cdy);
    if (cdLen > 0.01) {
        c.vx = cdx / cdLen;
        c.vy = cdy / cdLen;
        c.targetVx = c.vx;
        c.targetVy = c.vy;
    }
}

export const CAT_IMG_TO_ART: Record<string, string> = {
    catSleep: 'cat_sleep',
    catSurprise: 'cat_surprise',
    catAngry: 'cat_angry',
    catStun: 'cat_stun',
    catAlert1: 'cat_alert1',
    catAlert2: 'cat_alert2',
    catRage1: 'cat_rage1',
    catRage2: 'cat_rage2',
    catHappy: 'cat_happy',
};
