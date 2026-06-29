import {
    Color,
    Graphics,
    Node,
    UITransform,
} from 'cc';
import { loadSpriteFrame } from '../core/AssetLoader';
import { ArtCatalog } from '../core/ArtCatalog';
import { applyNativeSpriteFrame, GAME_LAYER, setLayerRecursive } from '../core/LayerUtil';
import { htmlCenterToCocos, htmlToCocos } from '../core/MapCoords';
import type { FoodItem, FurnitureItem, MapData, PowerupItem } from '../data/GameTypes';
import { roomHasRatHoleVisual, syncGeneratedMapBase } from '../room/RoomBaseBuilder';

async function addSpriteAtHtmlRect(
    parent: Node,
    key: string,
    htmlX: number,
    htmlY: number,
    htmlW: number,
    htmlH: number,
    mapW: number,
    mapH: number,
    flipX = false,
    zIndex = 0,
): Promise<Node | null> {
    const uuid = ArtCatalog.getSpriteUuid(key);
    const node = new Node(key);
    node.layer = parent.layer;
    parent.addChild(node);
    const pos = htmlCenterToCocos(htmlX, htmlY, htmlW, htmlH, mapW, mapH);
    node.setPosition(pos.x, pos.y, 0);
    if (flipX) {
        node.setScale(-1, 1, 1);
    }
    node.setSiblingIndex(zIndex);
    if (uuid) {
        try {
            const frame = await loadSpriteFrame(uuid);
            applyNativeSpriteFrame(node, frame);
        } catch (err) {
            console.warn(`[MapView] 加载 ${key} 失败`, err);
            node.addComponent(UITransform).setContentSize(htmlW, htmlH);
        }
    } else {
        console.warn(`[MapView] 缺少素材 UUID: ${key}`);
        node.addComponent(UITransform).setContentSize(htmlW, htmlH);
    }
    return node;
}

export class MapView {
    readonly root: Node;
    readonly furnitureRoot: Node;
    readonly foodRoot: Node;
    readonly propRoot: Node;
    readonly foodNodes: Node[] = [];
    private readonly _stealRings: (Graphics | null)[] = [];

    /** 独立地图（无房间预制体时的后备） */
    static createOnWorld(worldRoot: Node): MapView {
        return new MapView(worldRoot);
    }

    /** 地板/墙挂到 Room 下 _GeneratedMap；编辑场景已保存则沿用，不再覆盖 */
    static mountInRoom(roomNode: Node, map: MapData): MapView {
        const view = new MapView(undefined, roomNode);
        const skipRatHole = roomHasRatHoleVisual(roomNode);
        // 强制重建地板和墙壁，因为 Graphics 绘制数据不会序列化到场景文件
        syncGeneratedMapBase(roomNode, map.mapW, map.mapH, {
            skipRatHole,
            ratHole: map.ratHole,
            force: true,
        });
        return view;
    }

    private constructor(parent?: Node, roomNode?: Node) {
        if (roomNode) {
            this.root = MapView.ensureChild(roomNode, '_GeneratedMap', 0);
            this.furnitureRoot = MapView.ensureChild(roomNode, '_FurnitureRuntime', 500);
            this.foodRoot = MapView.ensureChild(roomNode, '_FoodLayer', 9000);
            this.propRoot = MapView.ensureChild(roomNode, '_PropsLayer', 9001);
        } else {
            this.root = new Node('MapView');
            this.root.layer = GAME_LAYER;
            parent!.addChild(this.root);
            this.furnitureRoot = new Node('Furniture');
            this.foodRoot = new Node('Food');
            this.propRoot = new Node('Props');
            this.root.addChild(this.furnitureRoot);
            this.root.addChild(this.foodRoot);
            this.root.addChild(this.propRoot);
        }

        this.furnitureRoot.layer = GAME_LAYER;
        this.foodRoot.layer = GAME_LAYER;
        this.propRoot.layer = GAME_LAYER;
        this.root.layer = GAME_LAYER;
    }

    private static ensureChild(parent: Node, name: string, siblingIndex: number): Node {
        let node = parent.getChildByName(name);
        if (!node) {
            node = new Node(name);
            node.layer = GAME_LAYER;
            parent.addChild(node);
        }
        node.setSiblingIndex(siblingIndex);
        return node;
    }

    /** 独立地图后备：整图生成（无 Room 编辑场景时） */
    buildRoomBase(map: MapData): void {
        syncGeneratedMapBase(this.root, map.mapW, map.mapH, {
            skipRatHole: false,
            ratHole: map.ratHole,
            force: true,
        });
    }

    async build(map: MapData): Promise<void> {
        this.foodNodes.length = 0;
        this._stealRings.length = 0;
        this.furnitureRoot.removeAllChildren();
        this.foodRoot.removeAllChildren();
        this.propRoot.removeAllChildren();
        for (const child of [...this.root.children]) {
            if (child !== this.furnitureRoot && child !== this.foodRoot && child !== this.propRoot) {
                child.destroy();
            }
        }

        this.buildRoomBase(map);

        let z = 0;
        for (const item of map.furniture) {
            await this.addFurniture(item, map, z);
            z += 1;
        }

        for (const food of map.foods) {
            if (!food.collected) {
                await this.addFood(food, map);
            }
        }

        for (const pw of map.powerups) {
            if (!pw.collected) {
                this.addPowerup(pw, map);
            }
        }

        setLayerRecursive(this.root, GAME_LAYER);
    }

    /** 预制体房间已包含视觉，只叠加动态食物/道具 */
    async buildFoodLayer(map: MapData): Promise<void> {
        this.foodNodes.length = 0;
        this._stealRings.length = 0;
        this.foodRoot.removeAllChildren();
        this.propRoot.removeAllChildren();

        for (const food of map.foods) {
            if (!food.collected) {
                await this.addFood(food, map);
            }
        }

        for (const pw of map.powerups) {
            if (!pw.collected) {
                this.addPowerup(pw, map);
            }
        }

        setLayerRecursive(this.foodRoot, GAME_LAYER);
        setLayerRecursive(this.propRoot, GAME_LAYER);
    }

    private async addFurniture(item: FurnitureItem, map: MapData, z: number): Promise<void> {
        await addSpriteAtHtmlRect(
            this.furnitureRoot,
            item.type,
            item.x,
            item.y,
            item.w,
            item.h,
            map.mapW,
            map.mapH,
            !!item.flipX,
            z,
        );
    }

    private async addFood(food: FoodItem, map: MapData): Promise<void> {
        const uuid = ArtCatalog.getSpriteUuid(food.type.img);
        const node = new Node(`Food_${food.type.img}`);
        node.layer = this.foodRoot.layer;
        this.foodRoot.addChild(node);
        const pos = htmlToCocos(food.x, food.y, map.mapW, map.mapH);
        node.setPosition(pos.x, pos.y, 0);
        if (uuid) {
            try {
                const frame = await loadSpriteFrame(uuid);
                applyNativeSpriteFrame(node, frame);
            } catch (err) {
                console.warn(`[MapView] 加载食物 ${food.type.img} 失败`, err);
            }
        }
        this.foodNodes.push(node);

        const ringNode = new Node('StealRing');
        ringNode.layer = node.layer;
        node.addChild(ringNode);
        ringNode.setSiblingIndex(10);
        const ringGfx = ringNode.addComponent(Graphics);
        this._stealRings.push(ringGfx);
    }

    /** 偷取进度弧（对照浏览器版食物外圈） */
    updateStealRing(index: number, progress: number, active: boolean): void {
        const gfx = this._stealRings[index];
        if (!gfx) return;
        gfx.clear();
        if (!active || progress <= 0) return;
        const r = 28;
        gfx.lineWidth = 4;
        gfx.strokeColor = new Color(255, 215, 0, 230);
        gfx.arc(0, 0, r, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * progress, true);
        gfx.stroke();
    }

    hideFood(index: number): void {
        const node = this.foodNodes[index];
        if (node) node.active = false;
    }

    private addPowerup(pw: PowerupItem, map: MapData): void {
        const node = new Node('Powerup_toycar');
        node.layer = GAME_LAYER;
        this.propRoot.addChild(node);
        const pos = htmlToCocos(pw.x, pw.y, map.mapW, map.mapH);
        node.setPosition(pos.x, pos.y, 0);
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = new Color(255, 99, 71, 255);
        gfx.circle(0, 0, 16);
        gfx.fill();
        gfx.strokeColor = new Color(255, 0, 0, 255);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, 16);
        gfx.stroke();
    }
}
