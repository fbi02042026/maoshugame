import { JsonAsset, resources } from 'cc';
import type {
    ConstantsConfig,
    DifficultyConfig,
    FoodConfig,
    GameConfigBundle,
    LevelConfig,
    RoomCatalog,
    RoomTemplate,
    SkinCatalog,
    TrapConfig,
} from '../data/GameTypes';

type JsonLoader = <T>(path: string) => Promise<T>;

function loadJson<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
        resources.load(path, JsonAsset, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`无法加载 ${path}`));
                return;
            }
            resolve(asset.json as T);
        });
    });
}

export class GameConfig {
    private static _bundle: GameConfigBundle | null = null;
    private static _rooms: RoomTemplate[] = [];

    static get bundle(): GameConfigBundle {
        if (!this._bundle) {
            throw new Error('GameConfig 尚未加载，请先调用 GameConfig.loadAll()');
        }
        return this._bundle;
    }

    static get levels(): LevelConfig[] {
        return this.bundle.levels;
    }

    static get traps(): Record<string, TrapConfig> {
        return this.bundle.traps;
    }

    static get foods(): FoodConfig[] {
        return this.bundle.foods;
    }

    static get difficulty(): DifficultyConfig {
        return this.bundle.difficulty;
    }

    static get constants(): ConstantsConfig {
        return this.bundle.constants;
    }

    static get skinCatalog(): SkinCatalog {
        return this.bundle.skinCatalog;
    }

    static getLevel(id: number): LevelConfig | undefined {
        return this.levels.find((level) => level.id === id);
    }

    static getRoom(id: number): RoomTemplate | undefined {
        return this._rooms.find((room) => room.id === id);
    }

    static get rooms(): RoomTemplate[] {
        return this._rooms;
    }

    static async loadAll(loader: JsonLoader = loadJson): Promise<GameConfigBundle> {
        const [levels, traps, foods, difficulty, constants, skinCatalog, roomCatalog] = await Promise.all([
            loader<LevelConfig[]>('config/levels'),
            loader<Record<string, TrapConfig>>('config/traps'),
            loader<FoodConfig[]>('config/foods'),
            loader<DifficultyConfig>('config/difficulty'),
            loader<ConstantsConfig>('config/constants'),
            loader<SkinCatalog>('config/skin_catalog'),
            loader<RoomCatalog>('config/rooms'),
        ]);

        this._rooms = roomCatalog.rooms ?? [];

        this._bundle = {
            levels,
            traps,
            foods,
            difficulty,
            constants,
            skinCatalog,
        };
        return this._bundle;
    }
}

import '../room/RoomEditInit';
