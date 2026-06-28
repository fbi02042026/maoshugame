export interface LevelConfig {
    id: number;
    name: string;
    roomId: number;
    food: number;
    catSpeed: number;
    alertSpeed: number;
    energy: number;
    traps: string[];
}

export interface TrapConfig {
    name: string;
    energy: number;
    stun: number;
    icon: string;
}

export interface FoodConfig {
    name: string;
    icon: string;
    img: string;
}

export interface DifficultyConfig {
    hamsterBaseSpeed: number;
    hamsterSpeedBoost: number;
    hamsterBoostDuration: number;
    catBaseSpeed: number;
    catChaseMultiplier: number;
    catPatrolMultiplier: number;
    catAccel: number;
    catDecel: number;
    catBaseTurnRate: number;
    catStunDecay: number;
    level1RoomScale: number;
}

export interface ConstantsConfig {
    designWidth: number;
    designHeight: number;
    catVisionRange: number;
    catVisionAngleRad: number;
    catSurpriseTime: number;
    catWakeChargeTime: number;
    catChaseSmokeTime: number;
    catChaseAccelTime: number;
    catChargeTime: number;
    catDashTime: number;
    catFarDist: number;
    catAlertReturn: number;
    catFaceWakeDist: number;
    catMaxStunHits: number;
}

export interface SkinEntry {
    id: string;
    file: string;
    name: string;
    unlock: string;
    sort: number;
}

export interface SkinCatalog {
    version: number;
    character: string;
    monetization: string;
    skins: SkinEntry[];
}

export interface GameConfigBundle {
    levels: LevelConfig[];
    traps: Record<string, TrapConfig>;
    foods: FoodConfig[];
    difficulty: DifficultyConfig;
    constants: ConstantsConfig;
    skinCatalog: SkinCatalog;
}

export interface WallRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FurnitureItem {
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
    name: string;
    interactive: boolean;
    layer: string;
    flipX?: boolean;
    decor?: boolean;
    catbed?: boolean;
    hideable?: boolean;
}

export interface FoodItem {
    x: number;
    y: number;
    type: FoodConfig;
    collected: boolean;
    stealing: boolean;
    stealProgress: number;
}

export interface PowerupItem {
    x: number;
    y: number;
    type: 'toycar';
    collected: boolean;
}

export interface GapRect {
    x: number;
    y: number;
    w: number;
    h: number;
    side?: string;
    type?: string;
}

export interface RatHole {
    x: number;
    y: number;
    r: number;
}

export interface RoomTemplate {
    id: number;
    name: string;
    mapW: number;
    mapH: number;
    layoutGuide?: string;
    furniture: FurnitureItem[];
    ratHole: RatHole;
    narrowGaps?: GapRect[];
    catPaths?: GapRect[];
    foodSpots?: Array<{ x: number; y: number }>;
    hamsterSpawn?: { x: number; y: number };
    catSpawn?: { x: number; y: number };
    powerups?: PowerupItem[];
}

export interface RoomCatalog {
    version: number;
    rooms: RoomTemplate[];
}

export interface MapData {
    levelId: number;
    roomId: number;
    mapW: number;
    mapH: number;
    walls: WallRect[];
    furniture: FurnitureItem[];
    foods: FoodItem[];
    powerups: PowerupItem[];
    ratHole: RatHole;
    spawnCatBed: FurnitureItem | null;
    narrowGaps: GapRect[];
    catPaths: GapRect[];
    foodTarget: number;
    hamsterSpawn?: { x: number; y: number };
    catSpawnOverride?: { x: number; y: number };
    fromPrefab?: boolean;
}

export interface HamsterState {
    x: number;
    y: number;
    r: number;
    speed: number;
}

export interface CatState {
    x: number;
    y: number;
    r: number;
    state: 'sleeping' | 'lazy' | 'patrol' | 'chase';
    stateTimer: number;
}
