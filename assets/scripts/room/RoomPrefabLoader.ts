import { instantiate, Node, Prefab, resources, Sprite } from 'cc';
import type { FoodBowl, FoodItem, FurnitureItem, GapRect, MapData, PowerupItem, RatHole } from '../data/GameTypes';
import { GameConfig } from '../core/GameConfig';
import { placeFoodsForRoom, buildBorderWalls, createCatSpawn, repositionL1FoodsNearCat, markPushableFurniture, generateFoodBowls } from '../game/MapGenerator';
import { MapView } from '../game/MapView';
import { CatPathMarker } from './CatPathMarker';
import { FurnitureMarker } from './FurnitureMarker';
import { FoodSpotMarker } from './FoodSpotMarker';
import { NarrowGapMarker } from './NarrowGapMarker';
import { PowerupMarker } from './PowerupMarker';
import { RatHoleMarker } from './RatHoleMarker';
import { RoomRoot } from './RoomRoot';
import { autoSetupRoom } from './RoomAutoSetup';
import { loadRoomNodeFromEditScene } from './RoomEditSceneLoader';
import { collectFurnitureMarkers } from './RoomCollisionUtil';
import { CatSpawnMarker } from './CatSpawnMarker';
import { GAME_LAYER, setLayerRecursive } from '../core/LayerUtil';
import type { RoomTemplate } from '../data/GameTypes';

export interface RoomPrefabLoadResult {
    roomNode: Node;
    map: MapData;
    mapView: MapView;
}

function loadPrefab(path: string): Promise<Prefab> {
    return new Promise((resolve, reject) => {
        resources.load(path, Prefab, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`无法加载预制体: ${path}`));
                return;
            }
            resolve(asset);
        });
    });
}

function hideRoomFoodPlaceholders(roomNode: Node): void {
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

/** RoomRoot 缺失或 Missing Script 时自动补挂，避免整房加载失败 */
function ensureRoomRoot(roomNode: Node, roomId: number, roomTpl: RoomTemplate): RoomRoot {
    let root = roomNode.getComponent(RoomRoot);
    if (!root) {
        root = roomNode.addComponent(RoomRoot);
    }
    root.roomId = roomId;
    root.mapW = roomTpl.mapW;
    root.mapH = roomTpl.mapH;
    return root;
}

export function buildMapDataFromRoomNode(roomNode: Node, levelId: number, opts?: { ratHoleVisible?: boolean }): MapData {
    const lv = GameConfig.getLevel(levelId) ?? GameConfig.levels[0];
    const roomTpl = GameConfig.getRoom(lv.roomId);
    if (!roomTpl) {
        throw new Error(`[Room] 找不到 roomId=${lv.roomId} 的配置`);
    }
    const root = ensureRoomRoot(roomNode, lv.roomId, roomTpl);
    const { mapW, mapH } = root.getMapSize();
    const walls = buildBorderWalls(mapW, mapH);

    const furniture: FurnitureItem[] = collectFurnitureMarkers(roomNode)
        .map((m) => {
            const item = m.toFurnitureItem(mapW, mapH);
            item._nodeRef = m.node;
            return item;
        });

    const ratHoleMarker = roomNode.getComponentInChildren(RatHoleMarker);
    const ratHole: RatHole = ratHoleMarker?.toRatHole(mapW, mapH) ?? {
        x: mapW / 2,
        y: mapH - 35,
        r: 24,
    };

    const narrowGaps: GapRect[] = roomNode
        .getComponentsInChildren(NarrowGapMarker)
        .map((m) => m.toGapRect(mapW, mapH));
    const narrowGapsFinal: GapRect[] = narrowGaps.length > 0
        ? narrowGaps
        : (roomTpl?.narrowGaps ?? []).map((g) => ({ ...g }));

    const catPaths: GapRect[] = roomNode
        .getComponentsInChildren(CatPathMarker)
        .map((m) => m.toGapRect(mapW, mapH));
    const catPathsFinal: GapRect[] = catPaths.length > 0
        ? catPaths
        : (roomTpl?.catPaths ?? []).map((g) => ({ ...g }));

    const powerups: PowerupItem[] = roomNode
        .getComponentsInChildren(PowerupMarker)
        .map((m) => m.toPowerup(mapW, mapH));

    const foodSpots = roomNode
        .getComponentsInChildren(FoodSpotMarker)
        .map((m) => m.toSpot(mapW, mapH));

    // 鼠洞 = 老鼠出生点 + 回洞终点（与浏览器版一致，出生在洞外一点）
    const hamsterSpawn = {
        x: ratHole.x,
        y: ratHole.y - 80,
    };

    const catSpawnMarker = roomNode.getComponentInChildren(CatSpawnMarker)?.toSpawn(mapW, mapH);
    const catBeds = furniture.filter((f) => f.catbed);
    const spawnCatBed = catBeds.length > 0 ? catBeds[0] : null;

    const foods: FoodItem[] = placeFoodsForRoom(
        { mapW, mapH, ratHole, foodSpots },
        furniture,
        lv.food,
        levelId,
    );

    const catSpawn = createCatSpawn(spawnCatBed, mapW, levelId);
    let catX = catSpawn.x;
    let catY = catSpawn.y;
    if (spawnCatBed) {
        catX = spawnCatBed.x + spawnCatBed.w / 2;
        catY = spawnCatBed.y + spawnCatBed.h / 2;
    } else if (catSpawnMarker) {
        catX = catSpawnMarker.x;
        catY = catSpawnMarker.y;
    } else if (roomTpl?.catSpawn) {
        catX = roomTpl.catSpawn.x;
        catY = roomTpl.catSpawn.y;
    }
    if (spawnCatBed) {
        spawnCatBed.x = catX - spawnCatBed.w / 2;
        spawnCatBed.y = catY - spawnCatBed.h / 2;
    }

    // 用户摆了 food 节点时不再随机改位置
    if (levelId === 1 && foods.length > 0 && foodSpots.length === 0 && !spawnCatBed) {
        repositionL1FoodsNearCat(furniture, foods, catX, catY);
    }

    // 标记可推动家具
    markPushableFurniture(furniture);

    // 生成猫粮碗
    const foodBowls: FoodBowl[] = generateFoodBowls(mapW, mapH, furniture, levelId);

    // 鼠洞可见性
    const ratHoleVisible = opts?.ratHoleVisible ?? true;

    return {
        levelId,
        roomId: root.roomId,
        mapW,
        mapH,
        walls,
        furniture,
        foods,
        powerups,
        ratHole,
        ratHoleVisible,
        ratHoleIsExit: false,
        foodBowls,
        spawnCatBed,
        narrowGaps: narrowGapsFinal,
        catPaths: catPathsFinal,
        foodTarget: lv.food,
        hamsterSpawn,
        catSpawnOverride: spawnCatBed ? undefined : (catSpawnMarker ?? roomTpl?.catSpawn),
        fromPrefab: true,
    };
}

/** 按关卡加载 resources/prefabs/rooms/Room{roomId}，找不到则返回 null */
export async function loadRoomForLevel(levelId: number, parent: Node, opts?: { ratHoleVisible?: boolean }): Promise<RoomPrefabLoadResult | null> {
    const lv = GameConfig.getLevel(levelId);
    if (!lv) {
        return null;
    }
    try {
        let roomNode = await loadRoomNodeFromEditScene(lv.roomId);
        if (roomNode) {
            console.log(`[Room] 使用编辑场景 Room${lv.roomId}Edit`);
        } else {
            console.warn(`[Room] 未加载到 Room${lv.roomId}Edit，回退 prefab Room${lv.roomId}`);
            const prefab = await loadPrefab(`prefabs/rooms/Room${lv.roomId}`);
            roomNode = instantiate(prefab);
        }
        roomNode.name = `Room${lv.roomId}`;
        const roomTpl = GameConfig.getRoom(lv.roomId);
        if (roomTpl) {
            autoSetupRoom(roomNode, roomTpl);
        }
        roomNode.layer = GAME_LAYER;
        setLayerRecursive(roomNode, GAME_LAYER);
        parent.addChild(roomNode);
        roomNode.setSiblingIndex(0);
        const map = buildMapDataFromRoomNode(roomNode, levelId, { ratHoleVisible: opts?.ratHoleVisible ?? true });
        console.log(`[Room] 家具碰撞 ${map.furniture.length} 件，场景子节点 ${roomNode.children.length} 个`);
        for (const child of roomNode.children) {
            const spriteCount = child.getComponentsInChildren(Sprite).length;
            console.log(`[Room]   子节点 "${child.name}" active=${child.active} 含 ${spriteCount} 个Sprite`);
        }
        const mapView = MapView.mountInRoom(roomNode, map);
        await mapView.buildFoodLayer(map);
        hideRoomFoodPlaceholders(roomNode);
        console.log('[Room] 房间加载完成');
        return { roomNode, map, mapView };
    } catch (err) {
        console.error('[Room] loadRoomForLevel 失败，将回退空地图（家具不会显示）', err);
        return null;
    }
}
