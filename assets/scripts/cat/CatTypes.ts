/** 猫 AI 运行时状态（与 hamster_battle.html createCat 对齐） */
export type CatStateName =
    | 'sleeping'
    | 'lazy'
    | 'patrol'
    | 'alert'
    | 'surprised'
    | 'charging'
    | 'chase'
    | 'launching'
    | 'returning'
    | 'stunned'
    | 'confused';

export interface CatRuntimeState {
    x: number;
    y: number;
    r: number;
    speed: number;
    dir: number;
    state: CatStateName;
    stateTimer: number;
    alertValue: number;
    targetX: number;
    targetY: number;
    patrolPts: Array<{ x: number; y: number }>;
    patrolIdx: number;
    chaseSpeed: number;
    patrolSpeed: number;
    stunTimer: number;
    face: string;
    animT: number;
    wanderAngle: number;
    vx: number;
    vy: number;
    targetVx: number;
    targetVy: number;
    curSpd: number;
    targetSpd: number;
    accel: number;
    decel: number;
    baseTurnRate: number;
    chaseBuildup: number;
    chaseBuildupTime: number;
    collCooldown: number;
    catImg: string;
    catImgTimer: number;
    catImgVariant: number;
    altPhase: 'main' | 'switched';
    altTimer: number;
    altVariant: number;
    firstChase: boolean;
    surprisedTimer: number;
    lastState: CatStateName;
    stuckX: number;
    stuckY: number;
    stuckTimer: number;
    patrolRandomAngle: number;
    patrolRandomTimer: number;
    hasSeenHamster: boolean;
    committedChase: boolean;
    chargeTimer: number;
    chargeCooldown: number;
    dashTimer: number;
    wakeCharge: boolean;
    avoidUntil: number;
    avoidVx: number;
    avoidVy: number;
    // 弹射系统
    energy: number;
    launchVx: number;
    launchVy: number;
    launchSpeed: number;
    launchFlightTime: number;
    launchFlightTimer: number;
    angerLevel: number;
}

export interface HamsterRuntimeState {
    x: number;
    y: number;
    r: number;
    speed: number;
    invincible: number;
    visible: boolean;
}

export interface GameRuntimeContext {
    time: number;
    levelId: number;
    mapW: number;
    mapH: number;
    hamster: HamsterRuntimeState;
    cat: CatRuntimeState;
    foodStolen: boolean;
    catHits: number;
    sageHint: { text: string; timer: number } | null;
    placedTraps: Array<{ x: number; y: number; type: string }>;
    onCatCatch: () => void;
}
