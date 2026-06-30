import { sys } from 'cc';

const SAVE_KEY = 'hamster_battle_save_v2';

export interface SaveData {
    // 兼容旧字段
    maxUnlocked: number;
    bestStars: Record<string, number>;
    equippedSkinId: string;
    unlockedSkins: string[];
    loginStreak: number;
    lastLoginDate: string;
    totalFoodEver: number;
    adWatchesToday: number;
    adWatchDate: string;
    hasSeenComic: boolean;
    // 新字段
    coins: number;
    tutorialStep: number; // 0=未开始, 1=完成第1关引导, 2=完成全部引导
    unlockedChapter: number; // 最大解锁章节（默认1）
    highestChapterCleared: number; // 最高通关章节
}

const DEFAULT_SAVE: SaveData = {
    maxUnlocked: 1,
    bestStars: {},
    equippedSkinId: 'skin_01',
    unlockedSkins: ['skin_01', 'skin_02', 'skin_03'],
    loginStreak: 0,
    lastLoginDate: '',
    totalFoodEver: 0,
    adWatchesToday: 0,
    adWatchDate: '',
    hasSeenComic: false,
    coins: 0,
    tutorialStep: 0,
    unlockedChapter: 1,
    highestChapterCleared: 0,
};

export class SaveSystem {
    private static _data: SaveData = { ...DEFAULT_SAVE, bestStars: {}, unlockedSkins: [...DEFAULT_SAVE.unlockedSkins] };

    static get data(): SaveData {
        return this._data;
    }

    static load(): SaveData {
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (!raw) {
                // 尝试迁移旧存档
                const oldRaw = sys.localStorage.getItem('hamster_battle_save_v1');
                if (oldRaw) {
                    const old = JSON.parse(oldRaw);
                    this._data = {
                        ...this.cloneDefault(),
                        ...old,
                        bestStars: old.bestStars ?? {},
                        unlockedSkins: old.unlockedSkins?.length ? old.unlockedSkins : [...DEFAULT_SAVE.unlockedSkins],
                        coins: 0,
                        tutorialStep: old.maxUnlocked > 1 ? 2 : 0,
                        unlockedChapter: 1,
                        highestChapterCleared: 0,
                    };
                    this.save();
                    return this._data;
                }
                this._data = this.cloneDefault();
                return this._data;
            }
            const parsed = JSON.parse(raw) as Partial<SaveData>;
            this._data = {
                ...this.cloneDefault(),
                ...parsed,
                bestStars: parsed.bestStars ?? {},
                unlockedSkins: parsed.unlockedSkins?.length ? parsed.unlockedSkins : [...DEFAULT_SAVE.unlockedSkins],
            };
            this._data.maxUnlocked = Math.max(1, Math.min(8, this._data.maxUnlocked));
            this._data.coins = Math.max(0, this._data.coins);
            this._data.unlockedChapter = Math.max(1, this._data.unlockedChapter);
        } catch {
            this._data = this.cloneDefault();
        }
        return this._data;
    }

    static save(): void {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this._data));
    }

    static addCoins(amount: number): void {
        this._data.coins = Math.max(0, this._data.coins + amount);
        this.save();
    }

    static spendCoins(amount: number): boolean {
        if (this._data.coins < amount) return false;
        this._data.coins -= amount;
        this.save();
        return true;
    }

    static completeTutorialStep(step: number): void {
        if (step > this._data.tutorialStep) {
            this._data.tutorialStep = step;
            this.save();
        }
    }

    static unlockChapter(chapterId: number): void {
        if (chapterId > this._data.unlockedChapter) {
            this._data.unlockedChapter = chapterId;
            this.save();
        }
    }

    static recordChapterClear(chapterId: number): void {
        if (chapterId > this._data.highestChapterCleared) {
            this._data.highestChapterCleared = chapterId;
            this.save();
        }
    }

    static updateStars(levelId: number, stars: number): void {
        const key = String(levelId);
        const current = this._data.bestStars[key] ?? 0;
        if (stars > current) {
            this._data.bestStars[key] = stars;
            this.save();
        }
    }

    static unlockLevel(levelId: number): void {
        if (levelId > this._data.maxUnlocked) {
            this._data.maxUnlocked = Math.min(8, levelId);
            this.save();
        }
    }

    static unlockSkin(skinId: string): void {
        if (!this._data.unlockedSkins.includes(skinId)) {
            this._data.unlockedSkins.push(skinId);
            this.save();
        }
    }

    private static cloneDefault(): SaveData {
        return {
            ...DEFAULT_SAVE,
            bestStars: {},
            unlockedSkins: [...DEFAULT_SAVE.unlockedSkins],
        };
    }
}
