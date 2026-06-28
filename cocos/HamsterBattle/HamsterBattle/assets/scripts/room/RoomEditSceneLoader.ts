import { assetManager, instantiate, Node, SceneAsset } from 'cc';

/** 与 assets/scenes/room_templates/Room{N}Edit.scene.meta 的 uuid 一致 */
const EDIT_SCENE_UUID: Record<number, string> = {
    1: 'e0010001-0001-4001-8001-000000000001',
    2: 'e0010002-0002-4002-8002-000000000002',
};

/** 从 Room{N}Edit 场景克隆用户编辑好的 Room 节点（优先于旧 prefab） */
export function loadRoomNodeFromEditScene(roomId: number): Promise<Node | null> {
    const uuid = EDIT_SCENE_UUID[roomId];
    if (!uuid) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        assetManager.loadAny({ uuid }, (err, asset) => {
            if (err || !asset) {
                resolve(null);
                return;
            }
            const sceneAsset = asset as SceneAsset;
            const scene = sceneAsset.scene;
            if (!scene) {
                resolve(null);
                return;
            }
            const canvas = scene.getChildByName('Canvas');
            const template = canvas?.getChildByName(`Room${roomId}`);
            if (!template) {
                resolve(null);
                return;
            }
            resolve(instantiate(template));
        });
    });
}

/** 隐藏编辑器里 food 占位图，运行时由 MapView 生成可偷取食物 */
export function hideRoomFoodPlaceholders(roomNode: Node): void {
    const stack: Node[] = [roomNode];
    while (stack.length > 0) {
        const n = stack.pop()!;
        if (/^food(_\d+)?$/i.test(n.name)) {
            n.active = false;
        }
        for (const c of n.children) {
            stack.push(c);
        }
    }
}
