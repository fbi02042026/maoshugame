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
import { roomHasRatHoleVisual, syncGeneratedMapBase, showRatHole as drawRatHole } from '../room/RoomBaseBuilder';

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
    private _furnitureNodes: Node[] = [];
    private _ratHoleGlowPhase = 0;
    private _mapData: MapData | null = null;
    private _roomNode: Node | null = null;

    /** 独立地图（无房间预制体时的后备） */
    static createOnWorld(worldRoot: Node): MapView {
        return new MapView(worldRoot);
    }

    /** 地板/墙挂到 Room 下 _GeneratedMap；编辑场景已保存则沿用，不再覆盖 */
    static mountInRoom(roomNode: Node, map: MapData): MapView {
        const view = new MapView(undefined, roomNode);
        const skipRatHole = roomHasRatHoleVisual(roomNode) || !map.ratHoleVisible;
        syncGeneratedMapBase(roomNode, map.mapW, map.mapH, {
            skipRatHole,
            ratHole: map.ratHoleVisible ? map.ratHole : undefined,
            ratHoleGold: map.ratHoleIsExit,
            foodBowls: map.foodBowls,
            force: true,
        });
        view._mapData = map;
        view._roomNode = roomNode;
        return view;
    }

    private constructor(parent?: Node, roomNode?: Node) {
        if (roomNode) {
            this.root = MapView.ensureChild(roomNode, '_GeneratedMap', 0);
            this.furnitureRoot = MapView.ensureChild(roomNode, '_FurnitureRuntime', 500);
            this.foodRoot = MapView.ensureChild(roomNode, '_FoodLayer', 9000);
            this.propRoot = MapView.ensureChild(roomNode, '_PropsLayer', 9001);
            this._roomNode = roomNode;
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
            node.layer = parent.layer;
            parent.addChild(node);
        }
        node.setSiblingIndex(siblingIndex);
        return node;
    }

    /** 独立地图后备：整图生成（无 Room 编辑场景时） */
    buildRoomBase(map: MapData): void {
        syncGeneratedMapBase(this.root, map.mapW, map.mapH, {
            skipRatHole: !map.ratHoleVisible,
            ratHole: map.ratHoleVisible ? map.ratHole : undefined,
            ratHoleGold: map.ratHoleIsExit,
            foodBowls: map.foodBowls,
            force: true,
        });
        this._mapData = map;
    }

    async build(map: MapData): Promise<void> {
        this._mapData = map;
        this.foodNodes.length = 0;
        this._stealRings.length = 0;
        this._furnitureNodes = [];
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
        for (let i = 0; i < map.furniture.length; i += 1) {
            const item = map.furniture[i];
            if (item._nodeRef) {
                this._furnitureNodes.push(item._nodeRef);
            } else {
                const node = await this.addFurniture(item, map, z);
                this._furnitureNodes.push(node ?? null);
            }
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
        this._mapData = map;
        this.foodNodes.length = 0;
        this._stealRings.length = 0;
        this._furnitureNodes = [];
        this.foodRoot.removeAllChildren();
        this.propRoot.removeAllChildren();

        // 重建家具运行时节点（用于推箱子视觉移动）
        this.furnitureRoot.removeAllChildren();
        for (let i = 0; i < map.furniture.length; i += 1) {
            const item = map.furniture[i];
            if (item._nodeRef) {
                // 预制体模式：记录原始视觉节点，不新建sprite
                this._furnitureNodes.push(item._nodeRef);
            } else if (item.pushable) {
                // 独立地图模式：为可推家具创建sprite节点
                const node = await this.addFurniture(item, map, i);
                if (node) this._furnitureNodes.push(node);
            } else {
                this._furnitureNodes.push(null);
            }
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

        setLayerRecursive(this.foodRoot, GAME_LAYER);
        setLayerRecursive(this.propRoot, GAME_LAYER);
        setLayerRecursive(this.furnitureRoot, GAME_LAYER);
    }

    private async addFurniture(item: FurnitureItem, map: MapData, z: number): Promise<Node | null> {
        const node = await addSpriteAtHtmlRect(
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
        if (node && item.pushable) {
            // 给可推动家具加个小标记（右下角一个小箭头，用Graphics）
            const mark = new Node('PushMark');
            node.addChild(mark);
            const mut = mark.addComponent(UITransform);
            mut.setContentSize(item.w, item.h);
            // 不画实际标记了，保持画面干净，只在逻辑层面处理
        }
        return node;
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

    /** 偷取进度弧 */
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

    /** 动态显示鼠洞（收集完食物后调用） */
    showRatHoleAt(ratHole: { x: number; y: number; r: number }, isGold: boolean, mapW: number, mapH: number): void {
        if (this._roomNode) {
            drawRatHole(this._roomNode, ratHole, isGold, mapW, mapH);
        } else {
            // 独立地图模式
            const gen = this.root;
            let hole = gen.getChildByName('RatHole');
            if (!hole) {
                hole = new Node('RatHole');
                hole.layer = gen.layer;
                gen.addChild(hole);
                hole.setSiblingIndex(2);
            }
            const pos = htmlToCocos(ratHole.x, ratHole.y, mapW, mapH);
            hole.setPosition(pos.x, pos.y, 0);
            hole.addComponent(UITransform).setContentSize(ratHole.r * 4, ratHole.r * 4);
            const gfx = hole.getComponent(Graphics) ?? hole.addComponent(Graphics);
            this.drawRatHoleGfx(gfx, ratHole.r, isGold, 0);
        }
        if (this._mapData) {
            this._mapData.ratHole = { x: ratHole.x, y: ratHole.y, r: ratHole.r };
            this._mapData.ratHoleVisible = true;
            this._mapData.ratHoleIsExit = isGold;
        }
    }

    private drawRatHoleGfx(gfx: Graphics, r: number, isGold: boolean, phase: number): void {
        gfx.clear();
        if (isGold) {
            const glowR = r + 16 + Math.sin(phase) * 5;
            gfx.fillColor = new Color(255, 215, 0, 80);
            gfx.circle(0, 0, glowR);
            gfx.fill();
            gfx.fillColor = new Color(255, 200, 50, 255);
            gfx.circle(0, 0, r);
            gfx.fill();
            gfx.fillColor = new Color(26, 18, 10, 255);
            gfx.circle(0, 0, r * 0.55);
            gfx.fill();
        } else {
            gfx.fillColor = new Color(58, 42, 26, 255);
            gfx.circle(0, 0, r);
            gfx.fill();
            gfx.fillColor = new Color(26, 18, 10, 255);
            gfx.circle(0, 0, r * 0.55);
            gfx.fill();
        }
    }

    /** 每帧更新：金色鼠洞呼吸光圈 */
    updateEffects(dt: number): void {
        this._ratHoleGlowPhase += dt * 3;
        if (!this._mapData?.ratHoleVisible || !this._mapData?.ratHoleIsExit) return;

        const gen = this._roomNode?.getChildByName('_GeneratedMap') ?? this.root;
        const hole = gen?.getChildByName('RatHole');
        if (!hole) return;
        const gfx = hole.getComponent(Graphics);
        if (!gfx) return;
        this.drawRatHoleGfx(gfx, this._mapData.ratHole.r, true, this._ratHoleGlowPhase);
    }

    /** 移动家具（html坐标增量）
     *  @param dx html坐标X增量（正数=向右）
     *  @param dy html坐标Y增量（正数=向下）
     */
    moveFurnitureBy(furnitureIndex: number, dx: number, dy: number): void {
        const node = this._furnitureNodes[furnitureIndex];
        if (!node) return;
        // html坐标Y向下，cocos坐标Y向上，所以dy取反
        const cocosDx = dx;
        const cocosDy = -dy;
        const cur = node.position;
        node.setPosition(cur.x + cocosDx, cur.y + cocosDy, cur.z);
    }

    /** 更新家具到指定html坐标（兼容旧接口，用增量方式实现） */
    updateFurniturePosition(furnitureIndex: number, htmlX: number, htmlY: number, mapW: number, mapH: number): void {
        const item = this._mapData?.furniture[furnitureIndex];
        const node = this._furnitureNodes[furnitureIndex];
        if (!item || !node) return;
        // 计算html坐标增量
        const newCx = htmlX; // 传入的htmlX是中心x（f.x + f.w/2）
        const newCy = htmlY; // 传入的htmlY是中心y（f.y + f.h/2）
        const oldCx = item.x + item.w / 2;
        const oldCy = item.y + item.h / 2;
        const dx = newCx - oldCx;
        const dy = newCy - oldCy;
        this.moveFurnitureBy(furnitureIndex, dx, dy);
    }
}
