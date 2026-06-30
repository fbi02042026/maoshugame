export interface ChapterConfig {
    id: number;
    name: string;
    roomCount: number;
    roomPool: number[];
    difficultyMult: number;
    rewardCoins: number;
    isTutorial?: boolean;
}

export interface ChapterProgress {
    chapterId: number;
    completedRoomIndices: number[];
    totalFoodCollected: number;
    livesRemaining: number;
    selectedTalentId: string | null;
    currentRoomIndex: number;
}

export interface RoomResult {
    won: boolean;
    foodCollected: number;
    livesRemaining: number;
    isLastRoom: boolean;
}

export interface TalentConfig {
    id: string;
    name: string;
    description: string;
    icon: string;
}

export const TALENTS: TalentConfig[] = [
    { id: 'speed_boost', name: '风火轮', description: '移动速度 +20%', icon: '🛹' },
    { id: 'steal_fast', name: '灵巧爪子', description: '偷取速度 +30%', icon: '🐾' },
    { id: 'extra_life', name: '九条命', description: '初始生命 +1', icon: '❤️' },
    { id: 'banana_master', name: '香蕉大师', description: '每10秒自动丢香蕉皮', icon: '🍌' },
    { id: 'food_radar', name: '食物雷达', description: '食物位置闪烁提示', icon: '👁️' },
    { id: 'tough_skin', name: '厚脸皮', description: '被抓后无敌时间 +1秒', icon: '🛡️' },
    { id: 'small_body', name: '小身板', description: '碰撞体积 -20%', icon: '🐭' },
    { id: 'gold_food', name: '点金手', description: '金色食物出现率 +30%', icon: '✨' },
];

export const CHAPTERS: ChapterConfig[] = [
    {
        id: 0,
        name: '新手教学·第一关',
        roomCount: 1,
        roomPool: [1],
        difficultyMult: 0.5,
        rewardCoins: 50,
        isTutorial: true,
    },
    {
        id: 1,
        name: '新手教学·第二关',
        roomCount: 2,
        roomPool: [1, 2],
        difficultyMult: 0.6,
        rewardCoins: 80,
        isTutorial: true,
    },
    {
        id: 2,
        name: '第一章·小偷入门',
        roomCount: 5,
        roomPool: [1, 2, 3, 4, 5],
        difficultyMult: 1.0,
        rewardCoins: 200,
    },
    {
        id: 3,
        name: '第二章·大盗之路',
        roomCount: 5,
        roomPool: [1, 2, 3, 4, 5],
        difficultyMult: 1.3,
        rewardCoins: 300,
    },
    {
        id: 4,
        name: '第三章·传说鼠王',
        roomCount: 5,
        roomPool: [1, 2, 3, 4, 5],
        difficultyMult: 1.6,
        rewardCoins: 500,
    },
];

export function generateRoomSequence(chapter: ChapterConfig, seed?: number): number[] {
    const pool = [...chapter.roomPool];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, chapter.roomCount);
}

export function getTalentById(id: string): TalentConfig | undefined {
    return TALENTS.find((t) => t.id === id);
}
