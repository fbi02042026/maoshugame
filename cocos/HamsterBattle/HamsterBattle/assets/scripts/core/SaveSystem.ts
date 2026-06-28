import { sys } from 'cc';

const SAVE_KEY = 'hamster_battle_save_v1';

export interface SaveData {
    maxUnlocked: number;
    bestStars: Record<string, number>;
    equippedSkinId: string;
    unlockedSkins: string[];
    loginStreak: number;
    lastLoginDate: string;
    totalFoodEver: number;
    adWatchesToday: number;
    adWatchDate: string;
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
        } catch {
            this._data = this.cloneDefault();
        }
        return this._data;
    }

    static save(): void {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this._data));
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

    private static cloneDefault(): SaveData {
        return {
            ...DEFAULT_SAVE,
            bestStars: {},
            unlockedSkins: [...DEFAULT_SAVE.unlockedSkins],
        };
    }
}
