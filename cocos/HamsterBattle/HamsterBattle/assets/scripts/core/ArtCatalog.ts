import { JsonAsset, resources } from 'cc';

export interface ArtEntry {
    id: string;
    file: string;
    category: string;
    uuid: string;
    w: number;
    h: number;
}

export type ArtCategoryKey = 'top' | 'wall' | 'decor' | 'free' | 'food' | 'character' | 'skins';

interface ArtCatalogBundle {
    version: number;
    categories: Partial<Record<string, ArtEntry[]>>;
    entries: ArtEntry[];
}

export class ArtCatalog {
    private static _entries: ArtEntry[] = [];
    private static _byId = new Map<string, ArtEntry>();
    private static _byCategory = new Map<string, ArtEntry[]>();

    static async load(): Promise<void> {
        if (this._byId.size > 0) {
            return;
        }
        const bundle = await new Promise<ArtCatalogBundle>((resolve, reject) => {
            resources.load('config/art_catalog', JsonAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error('无法加载 art_catalog.json，请先运行 tools/export_art_catalog.py'));
                    return;
                }
                resolve(asset.json as ArtCatalogBundle);
            });
        });
        this._entries = bundle.entries ?? [];
        this._byId.clear();
        this._byCategory.clear();
        for (const entry of this._entries) {
            this._byId.set(entry.id, entry);
            const list = this._byCategory.get(entry.category) ?? [];
            list.push(entry);
            this._byCategory.set(entry.category, list);
        }
        if (bundle.categories) {
            for (const [cat, list] of Object.entries(bundle.categories)) {
                if (list?.length) {
                    this._byCategory.set(cat, list);
                }
            }
        }
    }

    static getEntry(id: string): ArtEntry | undefined {
        return this._byId.get(id);
    }

    static getSpriteUuid(key: string): string | undefined {
        return this._byId.get(key)?.uuid;
    }

    static getCategory(category: ArtCategoryKey): ArtEntry[] {
        return this._byCategory.get(category) ?? [];
    }

    static pickRandom(category: ArtCategoryKey, excludeIds: string[] = []): ArtEntry | undefined {
        const pool = this.getCategory(category).filter((e) => !excludeIds.includes(e.id));
        if (!pool.length) {
            return undefined;
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }
}
