import { assetManager, SpriteFrame } from 'cc';

const cache = new Map<string, SpriteFrame>();

export function loadSpriteFrame(uuid: string): Promise<SpriteFrame> {
    const cached = cache.get(uuid);
    if (cached) {
        return Promise.resolve(cached);
    }
    return new Promise((resolve, reject) => {
        assetManager.loadAny({ uuid }, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`无法加载 SpriteFrame: ${uuid}`));
                return;
            }
            const frame = asset as SpriteFrame;
            cache.set(uuid, frame);
            resolve(frame);
        });
    });
}

export async function loadSpriteByKey(getUuid: (key: string) => string | undefined, key: string): Promise<SpriteFrame | null> {
    const uuid = getUuid(key);
    if (!uuid) {
        console.warn(`[AssetLoader] 找不到素材 key: ${key}`);
        return null;
    }
    try {
        return await loadSpriteFrame(uuid);
    } catch (err) {
        console.warn(`[AssetLoader] 加载失败 ${key}`, err);
        return null;
    }
}
