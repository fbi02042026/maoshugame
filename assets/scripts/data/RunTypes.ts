export interface TalentConfig {
    id: string;
    name: string;
    description: string;
    icon: string;
}

export interface RunProgress {
    /** 本次跑酷的房间序列（随机打乱后的房间id） */
    roomSequence: number[];
    /** 当前在序列中的索引（0-based） */
    currentRoomIndex: number;
    /** 累计偷到的食物数（跨房间累计） */
    totalFoodCollected: number;
    /** 剩余生命 */
    livesRemaining: number;
    /** 已选天赋id */
    selectedTalentId: string | null;
    /** 新手引导模式下的子步骤 */
    tutorialMode: boolean;
    /** 仙人对话是否已经播过时光回溯 */
    hasSeenWarpDialogue: boolean;
    /** 是否在传送中（防止重复触发） */
    isWarping: boolean;
}

export interface RoomResult {
    won: boolean;
    foodCollected: number;
    livesRemaining: number;
}

/** 3种初始天赋 */
export const TALENTS: TalentConfig[] = [
    { id: 'speed_boost', name: '风火轮', description: '移动速度 +25%', icon: '🛹' },
    { id: 'extra_life', name: '九条命', description: '初始生命 +1（共4条）', icon: '❤️' },
    { id: 'steal_fast', name: '灵巧爪子', description: '偷取速度 +40%', icon: '🐾' },
];

/** 跑酷参数 */
export const RUN_CONFIG = {
    /** 正式跑酷串联的房间数（穿越5个房间后回家） */
    roomsPerRun: 5,
    /** 可用房间池id */
    roomPool: [1, 2, 3, 4, 5],
    /** 基础通关金币奖励 */
    baseRewardCoins: 50,
    /** 每个食物转化的金币 */
    coinsPerFood: 10,
    /** 失败时保留的金币比例 */
    failCoinRatio: 0.5,
};

/** 鼠猫搞笑对话（进入房间时随机选一句） */
export const ENTRY_DIALOGUES: Array<{ speaker: 'hamster' | 'cat'; text: string }> = [
    { speaker: 'hamster', text: '肥猫！今天你的食物我全包了！' },
    { speaker: 'cat', text: 'ZZZ...嗯？有老鼠味...' },
    { speaker: 'hamster', text: '这猫睡得跟猪一样，嘿嘿嘿' },
    { speaker: 'cat', text: '又来？这次看你往哪跑！' },
    { speaker: 'hamster', text: '今天天气不错，适合偷奶酪~' },
    { speaker: 'cat', text: '我的食物...我的美梦...' },
    { speaker: 'hamster', text: '小猫咪，你睡着了吗？' },
    { speaker: 'cat', text: '呼...噜...（说梦话）小鱼干...' },
];

/** 仙人对话文案 */
export const SAGE_DIALOGUES = {
    firstEnter: '小家伙，看到那些食物了吗？靠近并按住偷取！',
    firstSteal: '很好！现在带着食物回鼠洞吧！',
    warpHappened: '这...这可能是因为时光回溯出现的波动，导致老鼠洞和另一个房间链接在了一起。赶快寻找出路吧，为师先走了！',
    goldenHole: '这鼠洞散发着金光！这一定是回家的路！',
    caught: '哎呀！小心那只肥猫！你还有命，快继续！',
    oneLifeLeft: '只剩一条命了！小心行事！',
    foodComplete: '食物收集完毕！鼠洞出现了，快溜！',
    notEnoughFood: '还没拿到足够食物呢，再去找找~',
    tutorialRoom2: '干得不错！还有一个房间，去把那边的食物也偷了！',
};

export function getTalentById(id: string): TalentConfig | undefined {
    return TALENTS.find((t) => t.id === id);
}

/** 随机打乱数组（Fisher-Yates） */
export function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** 生成本次跑酷的房间序列 */
export function generateRunRoomSequence(): number[] {
    return shuffleArray(RUN_CONFIG.roomPool).slice(0, RUN_CONFIG.roomsPerRun);
}
