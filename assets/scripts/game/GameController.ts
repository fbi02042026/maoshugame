import {
    _decorator,
    Camera,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
    Vec2,
} from 'cc';
import { circRectHit, dist, pushOut } from '../collision/CollisionUtil';
import { handleCatCatchHamster, onFoodStolen, updateCat } from '../cat/CatAI';
import { CatController } from '../cat/CatController';
import type { GameRuntimeContext } from '../cat/CatTypes';
import { ArtCatalog } from '../core/ArtCatalog';
import { loadSpriteByKey } from '../core/AssetLoader';
import { GameConfig } from '../core/GameConfig';
import { applyActorSpriteFrame, applyNativeSpriteFrame, GAME_LAYER, setLayerRecursive } from '../core/LayerUtil';
import { htmlToCocos, cocosToHtml } from '../core/MapCoords';
import { DESIGN_HEIGHT, DESIGN_WIDTH, HAMSTER_RADIUS } from '../core/DesignConstants';
import { GameManager } from '../core/GameManager';
import { HamsterController } from '../hamster/HamsterController';
import type { FurnitureItem, MapData } from '../data/GameTypes';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { WorldFollow, calcMapFillZoom, L1_CAMERA_ZOOM } from './WorldFollow';
import { createCatSpawn, createHamsterSpawn, generateMapFromJson, getCollidableRects, randomizeRatHolePosition } from './MapGenerator';
import { MapView } from './MapView';
import { loadRoomForLevel } from '../room/RoomPrefabLoader';
import { SaveSystem } from '../core/SaveSystem';
import { GameResultOverlay } from '../ui/GameResultOverlay';
import { TitleOverlay } from '../ui/TitleOverlay';
import { DialogueBubble } from '../ui/DialogueBubble';
import { ENTRY_DIALOGUES, SAGE_DIALOGUES } from '../data/RunTypes';

const { ccclass } = _decorator;

type GamePhase = 'title' | 'opening' | 'action' | 'result' | 'warping';

const PUSH_DISTANCE = HAMSTER_RADIUS * 2; // 推动距离 = 一个老鼠身位
const DOG_EVENT_MIN_TIME = 20; // 狗叫事件最早触发时间（秒）
const DOG_EVENT_CHANCE = 0.003; // 每帧触发概率

@ccclass('GameController')
export class GameController extends Component {
    private worldRoot: Node | null = null;
    private uiRoot: Node | null = null;
    private hamsterNode: Node | null = null;
    private catNode: Node | null = null;
    private worldFollow: WorldFollow | null = null;
    private viewCamera: Camera | null = null;
    private hudLabel: Label | null = null;
    private statusLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private hintRoot: Node | null = null;
    private sagePortraitNode: Node | null = null;
    private countdownLabel: Label | null = null;
    private alertBarGfx: Graphics | null = null;
    private stealBarGfx: Graphics | null = null;
    private mapView: MapView | null = null;
    private joystick: VirtualJoystick | null = null;
    private titleOverlay: TitleOverlay | null = null;
    private dialogue: DialogueBubble | null = null;

    private _map: MapData | null = null;
    private _runtime: GameRuntimeContext | null = null;
    private _joyDir = new Vec2();
    private _moveDir = new Vec2();
    private _foodCollected = 0;
    private _stealing = false;
    private _stealProgress = 0;
    private _stealTargetIdx = -1;
    private _phase: GamePhase = 'opening';
    private _openingTimer = 0;
    private _countdown = -1;
    private _lives = 3;
    private _maxLives = 3;
    private _levelId = 1;
    private _resultOverlay: GameResultOverlay | null = null;

    // 新功能状态
    private _ratHoleAppeared = false;
    private _speedBoost = false; // 滑板车加速
    private _speedBoostTimer = 0;
    private _firstFoodEver = true;
    private _dogEventTimer = 0;
    private _catHidden = false; // 狗来了猫躲起来
    private _catHideTimer = 0;
    private _titleDone = false;
    private _pushCooldown = 0;
    private _bowlAttractCooldown = 0;
    private _lastMoveDir = new Vec2();

    async start(): Promise<void> {
        try {
            if (!GameManager.instance?.configReady) {
                await GameConfig.loadAll();
            }

            SaveSystem.load();

            const manager = GameManager.instance;
            const levelId = manager?.currentLevel ?? 1;
            this._levelId = levelId;

            // 跑酷模式：继承剩余生命，应用天赋
            const isRunMode = manager?.runMode === true;
            const isTutorial = manager?.runProgress?.tutorialMode === true;
            const progress = manager?.runProgress;

            if (isRunMode && progress) {
                this._lives = progress.livesRemaining;
                this._maxLives = progress.selectedTalentId === 'extra_life' ? 4 : 3;
            } else {
                this._lives = this._maxLives;
            }

            this._phase = isRunMode && !isTutorial ? 'title' : 'opening';
            this._openingTimer = 0;
            this._countdown = -1;
            this._ratHoleAppeared = false;
            this._foodCollected = 0;
            this._firstFoodEver = SaveSystem.data.tutorialStep === 0;
            this._dogEventTimer = 0;
            this._catHidden = false;
            this._speedBoost = false;
            this._pushCooldown = 0;
            this._bowlAttractCooldown = 0;

            // 判断是否显示标题：正式跑酷且不是刚传送的（传送时不重复播标题）
            const shouldShowTitle = isRunMode && !isTutorial && !manager?.consumeWarpFlag();
            this._titleDone = !shouldShowTitle;

            const level = GameConfig.getLevel(levelId) ?? GameConfig.levels[0];

            await ArtCatalog.load();
            await this.ensureSceneGraph();

            // 正式跑酷模式：鼠洞初始不可见（收集完食物才出现）
            const ratHoleVisible = !(isRunMode && !isTutorial);
            const prefabRoom = await loadRoomForLevel(levelId, this.worldRoot!, { ratHoleVisible });
            console.log('[Game] loadRoomForLevel result:', prefabRoom ? 'OK' : 'NULL');
            if (prefabRoom) {
                this._map = prefabRoom.map;
                this.mapView = prefabRoom.mapView;
                console.log('[Game] 房间加载成功, 家具数:', this._map.furniture.length, '可推:', this._map.furniture.filter(f => f.pushable).length);
            } else {
                console.error('[Game] 未能加载 Room 预制体，回退生成地图');
                this._map = generateMapFromJson(levelId, { ratHoleVisible });
                this.mapView = MapView.createOnWorld(this.worldRoot!);
                await this.mapView.build(this._map);
                console.log('[Game] 回退房间生成, 家具数:', this._map.furniture.length);
            }
            await this.setupActors(this._map);

            const catCtrl = this.catNode!.getComponent(CatController)!;
            const hamsterSpawn = createHamsterSpawn(this._map);
            this._runtime = {
                time: 0,
                levelId,
                mapW: this._map.mapW,
                mapH: this._map.mapH,
                hamster: {
                    x: hamsterSpawn.x,
                    y: hamsterSpawn.y,
                    r: hamsterSpawn.r,
                    speed: hamsterSpawn.speed,
                    invincible: 2, // 开局2秒无敌保护
                    visible: true,
                },
                cat: catCtrl.catState!,
                foodStolen: false,
                catHits: 0,
                sageHint: null,
                placedTraps: [],
                onCatCatch: () => this.onCatCatch(),
            };

            if (this.hudLabel) {
                if (isTutorial) {
                    this.hudLabel.string = `新手引导 · 靠近食物按住偷取 · 带回鼠洞`;
                } else if (isRunMode && progress) {
                    const roomNum = progress.currentRoomIndex + 1;
                    const total = progress.roomSequence.length;
                    this.hudLabel.string = `房间 ${roomNum}/${total} · 偷取食物回鼠洞`;
                } else {
                    this.hudLabel.string = `第${level.id}关 ${level.name} · 靠近食物按住偷取 · 带回鼠洞`;
                }
            }
            this.ensureResultOverlay();
            this.updateStatusLabel();

            // 播放标题"飞奔的奶酪"
            if (this._phase === 'title' && this.titleOverlay) {
                this.joystick?.isInputBlocked(true);
                this.titleOverlay.show('飞奔的奶酪', '', () => {
                    this._titleDone = true;
                    this._phase = 'opening';
                    this._openingTimer = 0;
                    this.joystick?.isInputBlocked(false);
                    this.triggerEntryDialogue();
                });
            } else {
                this.triggerEntryDialogue();
            }

            // 传送后触发仙人时光回溯台词
            if (manager?.shouldShowWarpDialogue()) {
                this.scheduleOnce(() => {
                    this.dialogue?.showImmediate('sage', SAGE_DIALOGUES.warpHappened, 5);
                }, 1.5);
            }
        } catch (err) {
            console.error('[GameController] 启动失败', err);
            if (this.hintLabel) {
                this.hintLabel.string = '游戏加载失败，请看控制台';
            }
            if (this.hudLabel) {
                this.hudLabel.string = String(err);
            }
        }
    }

    /** 进入房间时的随机对话（鼠猫扯皮） */
    private triggerEntryDialogue(): void {
        const manager = GameManager.instance;
        if (!manager?.runMode) return;

        // 引导第1关首次进入显示仙人引导
        if (manager.runProgress?.tutorialMode && manager.runProgress.currentRoomIndex === 0 && SaveSystem.data.tutorialStep === 0) {
            this.scheduleOnce(() => {
                this.dialogue?.showImmediate('sage', SAGE_DIALOGUES.firstEnter, 4);
            }, 0.5);
            return;
        }

        // 正式跑酷或非首关，随机播放鼠猫对话
        if (!manager.runProgress?.tutorialMode || manager.runProgress.currentRoomIndex > 0) {
            const d = ENTRY_DIALOGUES[Math.floor(Math.random() * ENTRY_DIALOGUES.length)];
            this.scheduleOnce(() => {
                this.dialogue?.show(d.speaker, d.text, 3);
            }, 1.0);
        }

        // 传送进入的引导提示
        if (manager.runProgress?.tutorialMode && manager.runProgress.currentRoomIndex === 1) {
            this.scheduleOnce(() => {
                this.dialogue?.show('sage', SAGE_DIALOGUES.tutorialRoom2, 4);
            }, 4.5);
        }
    }

    update(dt: number): void {
        if (!this._map || !this._runtime || !this.hamsterNode) return;

        if (this._phase === 'result' || this._phase === 'warping') return;

        // 标题阶段只更新effects
        if (this._phase === 'title') {
            this.mapView?.updateEffects(dt);
            return;
        }

        if (this._phase === 'opening') {
            this.updateOpening(dt);
            this.mapView?.updateEffects(dt);
            return;
        }

        this._runtime.time += dt;
        this._dogEventTimer += dt;
        if (this._pushCooldown > 0) this._pushCooldown -= dt;
        if (this._bowlAttractCooldown > 0) this._bowlAttractCooldown -= dt;

        // 滑板车计时
        if (this._speedBoost) {
            this._speedBoostTimer -= dt;
            if (this._speedBoostTimer <= 0) {
                this._speedBoost = false;
                this.dialogue?.show('system', '滑板车消失了', 2);
            }
        }

        // 猫躲藏计时（狗来了事件）
        if (this._catHidden) {
            this._catHideTimer -= dt;
            if (this._catHideTimer <= 0) {
                this._catHidden = false;
                // 猫恢复
                const catCtrl = this.catNode?.getComponent(CatController);
                if (catCtrl) {
                    catCtrl.node.active = true;
                }
            }
        }

        // 随机狗叫事件
        if (!this._catHidden && this._dogEventTimer > DOG_EVENT_MIN_TIME && Math.random() < DOG_EVENT_CHANCE) {
            this.triggerDogEvent();
        }

        const hint = this._runtime.sageHint;
        const blocked = !!(hint && hint.timer > 0) || this._catHidden;
        this.joystick?.isInputBlocked(blocked);

        const hamster = this.hamsterNode.getComponent(HamsterController)!;

        // 速度计算：基础速度 * 天赋 * 滑板车
        let speedMult = 1.0;
        if (this._speedBoost) speedMult *= 1.3;
        const talentId = GameManager.instance?.runProgress?.selectedTalentId;
        if (talentId === 'speed_boost') speedMult *= 1.25;

        hamster.speed = GameConfig.difficulty.hamsterBaseSpeed * 60 * speedMult;
        hamster.inputEnabled = !blocked && this._runtime.hamster.invincible <= 0;

        let moveX = 0, moveY = 0;
        if (this.joystick) {
            this.joystick.getDirection(this._joyDir);
            hamster.setJoystickDirection(this._joyDir.x, this._joyDir.y);
        }

        const prevX = this._runtime.hamster.x;
        const prevY = this._runtime.hamster.y;

        if (hamster.getMoveDirection(this._moveDir)) {
            const step = hamster.speed * dt;
            const pos = this.hamsterNode.position;
            this.hamsterNode.setPosition(
                pos.x + this._moveDir.x * step,
                pos.y + this._moveDir.y * step,
                pos.z,
            );
            // 记录移动方向用于推家具
            if (Math.abs(this._moveDir.x) > 0.1 || Math.abs(this._moveDir.y) > 0.1) {
                this._lastMoveDir.set(this._moveDir.x, this._moveDir.y);
            }
        }

        this.syncHamsterHtmlFromNode();
        this.resolveHamsterCollision();
        this.tryPushFurniture(prevX, prevY);
        this.checkFoodBowlCollision();
        this.checkSkateboardPickup();
        this.syncHamsterNodeFromHtml();
        this.updateFoodSteal(dt);
        this.mapView?.updateStealRing(
            this._stealTargetIdx,
            this._stealProgress,
            this._stealing && this._stealTargetIdx >= 0,
        );
        this.checkRatHole();

        if (hint) {
            hint.timer -= dt;
            if (hint.timer <= 0) {
                this._runtime.sageHint = null;
                this.hideSageDialog();
            } else {
                this.showSageDialog(hint.text);
            }
        }

        this.updateStatusLabel();
        this.updateStealBar();
        this.mapView?.updateEffects(dt);
    }

    lateUpdate(dt: number): void {
        if (!this._map || !this._runtime || !this.hamsterNode || !this.catNode) return;
        if (this._phase === 'result' || this._phase === 'warping' || this._phase === 'title') return;

        if (this._phase === 'opening') {
            this.updateOpeningCameraZoom();
            if (this.uiRoot) {
                this.uiRoot.setScale(1, 1, 1);
                this.uiRoot.setPosition(0, 0, 0);
            }
            return;
        }

        if (this._runtime.hamster.invincible > 0) {
            this._runtime.hamster.invincible -= dt;
        }

        // 狗来了，猫不更新（躲起来了）
        if (!this._catHidden) {
            const catCtrl = this.catNode.getComponent(CatController);
            if (catCtrl?.catState) {
                this._runtime.cat = catCtrl.catState;
                updateCat(this._runtime, this._map, dt);
                catCtrl.syncFromState(this._map.mapW, this._map.mapH);
            }
        }

        this.updateCameraZoom();
        this.updateAlertBar();
        if (this.uiRoot) {
            this.uiRoot.setScale(1, 1, 1);
            this.uiRoot.setPosition(0, 0, 0);
        }
    }

    /** 狗来了随机事件 */
    private triggerDogEvent(): void {
        this._dogEventTimer = 0;
        this._catHidden = true;
        this._catHideTimer = 5;
        const catCtrl = this.catNode?.getComponent(CatController);
        if (catCtrl) {
            catCtrl.node.active = false;
        }
        this.dialogue?.showImmediate('system', '🐕 汪！汪！外面有狗叫！猫吓得躲起来了，快去偷食物！', 3);
    }

    /** 检测滑板车拾取 */
    private checkSkateboardPickup(): void {
        if (this._speedBoost) return;
        const map = this._map!;
        const h = this._runtime!.hamster;
        for (const pw of map.powerups) {
            if (pw.collected) continue;
            if (dist(h, pw) < h.r + 20) {
                pw.collected = true;
                this._speedBoost = true;
                this._speedBoostTimer = 8;
                this.dialogue?.show('system', '🛹 捡到滑板车！加速！', 2.5);
                // 隐藏道具
                const propRoot = this.mapView?.propRoot;
                const pwNode = propRoot?.getChildByName('Powerup_toycar');
                if (pwNode) pwNode.active = false;
                break;
            }
        }
    }

    /** 检测猫粮碗碰撞（撞碗吸引猫） */
    private checkFoodBowlCollision(): void {
        if (this._bowlAttractCooldown > 0) return;
        const map = this._map!;
        const h = this._runtime!.hamster;
        for (const bowl of map.foodBowls) {
            if (dist(h, bowl) < h.r + bowl.r) {
                this._bowlAttractCooldown = 15;
                // 让猫向碗位置移动（通过设置cat目标）
                const catCtrl = this.catNode?.getComponent(CatController);
                if (catCtrl?.catState) {
                    catCtrl.catState.state = 'chase';
                    catCtrl.catState.targetX = bowl.x;
                    catCtrl.catState.targetY = bowl.y;
                    catCtrl.catState.stateTimer = 5;
                }
                this.dialogue?.show('system', '🥣 撞翻了猫粮碗！猫被吸引过去了！', 2.5);
                break;
            }
        }
    }

    /** 尝试推动可推家具（像推箱子一样，沿移动方向推） */
    private tryPushFurniture(prevX: number, prevY: number): void {
        if (this._pushCooldown > 0) return;
        const map = this._map!;
        const h = this._runtime!.hamster;
        const r = h.r;

        // 根据移动方向确定推动主轴
        const mvx = this._lastMoveDir.x;
        const mvy = this._lastMoveDir.y;
        const absX = Math.abs(mvx);
        const absY = Math.abs(mvy);

        // 没有有效移动方向，不推
        if (absX < 0.1 && absY < 0.1) return;

        let pushDir: 'left' | 'right' | 'up' | 'down';
        if (absX > absY) {
            // X轴方向推
            pushDir = mvx > 0 ? 'right' : 'left';
        } else {
            // Y轴方向推（html坐标Y向下，cocos向上，这里用html坐标思考）
            // mvy在cocos中：+y=向上（html中y减小），-y=向下（html中y增大）
            pushDir = mvy > 0 ? 'up' : 'down';
        }

        for (let i = 0; i < map.furniture.length; i += 1) {
            const f = map.furniture[i];
            if (!f.pushable) continue;

            // 检测玩家与家具是否接触（圆-矩形碰撞）
            const closestX = Math.max(f.x, Math.min(h.x, f.x + f.w));
            const closestY = Math.max(f.y, Math.min(h.y, f.y + f.h));
            const dx = h.x - closestX;
            const dy = h.y - closestY;
            const d = Math.hypot(dx, dy);

            if (d >= r - 2) continue; // 没有接触

            // 检查玩家是否在家具的正确方向一侧
            let pushX = 0, pushY = 0;
            const cx = f.x + f.w / 2;
            const cy = f.y + f.h / 2;

            // 判断推动方向并验证玩家位置
            switch (pushDir) {
                case 'right':
                    // 玩家要向右推，必须在家具左边
                    if (h.x > cx + f.w / 2 - r) continue; // 玩家在家具右边，不能右推
                    pushX = PUSH_DISTANCE;
                    break;
                case 'left':
                    if (h.x < cx - f.w / 2 + r) continue; // 玩家在家具左边，不能左推
                    pushX = -PUSH_DISTANCE;
                    break;
                case 'down':
                    // 向下推（html中y增大），玩家必须在家具上方（h.y < cy）
                    if (h.y > cy + f.h / 2 - r) continue;
                    pushY = PUSH_DISTANCE;
                    break;
                case 'up':
                    // 向上推（html中y减小），玩家必须在家具下方（h.y > cy）
                    if (h.y < cy - f.h / 2 + r) continue;
                    pushY = -PUSH_DISTANCE;
                    break;
            }

            const newX = f.x + pushX;
            const newY = f.y + pushY;

            // 检查推动后是否会与墙壁/其他家具/猫碗重叠
            if (this.canPlaceFurniture(newX, newY, f.w, f.h, f)) {
                f.x = newX;
                f.y = newY;
                this._pushCooldown = 0.25;
                // 更新视觉位置（增量移动）
                this.mapView?.moveFurnitureBy(i, pushX, pushY);
                // 玩家也跟着家具移动一点，避免被家具卡进去
                // 把玩家位置同步到家具边缘外
                if (pushX > 0) {
                    h.x = newX - r - 1;
                } else if (pushX < 0) {
                    h.x = newX + f.w + r + 1;
                } else if (pushY > 0) {
                    h.y = newY - r - 1;
                } else if (pushY < 0) {
                    h.y = newY + f.h + r + 1;
                }
            }
            break; // 一次只推一个
        }
    }

    /** 检查家具放置位置是否合法（不与墙和其他非pushable家具重叠） */
    private canPlaceFurniture(x: number, y: number, w: number, h: number, exclude: FurnitureItem): boolean {
        const map = this._map!;
        const margin = 15;
        // 边界检查
        if (x < margin || y < margin || x + w > map.mapW - margin || y + h > map.mapH - margin - 20) {
            return false;
        }
        // 与墙壁碰撞检查
        const walls = getCollidableRects(map);
        for (const wall of walls) {
            if (x + w <= wall.x || x >= wall.x + wall.w || y + h <= wall.y || y >= wall.y + wall.h) continue;
            return false;
        }
        // 与其他家具碰撞检查
        for (const f of map.furniture) {
            if (f === exclude) continue;
            if (x + w <= f.x + 2 || x >= f.x + f.w - 2 || y + h <= f.y + 2 || y >= f.y + f.h - 2) continue;
            return false;
        }
        return true;
    }

    private updateFoodSteal(dt: number): void {
        const map = this._map!;
        const h = this._runtime!.hamster;

        // 天赋：灵巧爪子偷取速度+40%
        const stealSpeedMult = GameManager.instance?.runProgress?.selectedTalentId === 'steal_fast' ? 1.4 : 1.0;

        if (!this._stealing) {
            for (let i = 0; i < map.foods.length; i += 1) {
                const food = map.foods[i];
                if (food.collected || food.stealing) continue;
                if (dist(h, food) < h.r + 22) {
                    this._stealing = true;
                    this._stealProgress = 0;
                    this._stealTargetIdx = i;
                    food.stealing = true;
                    break;
                }
            }
        }

        if (this._stealing && this._stealTargetIdx >= 0) {
            const food = map.foods[this._stealTargetIdx];
            if (food && dist(h, food) < h.r + 22) {
                this._stealProgress += dt * 1.2 * stealSpeedMult;
                if (this._stealProgress >= 1) {
                    food.collected = true;
                    food.stealing = false;
                    this._foodCollected += 1;
                    this._stealing = false;
                    this._stealProgress = 0;
                    this.mapView?.hideFood(this._stealTargetIdx);
                    onFoodStolen(this._runtime!);

                    // 首次偷到食物，仙人引导
                    if (this._firstFoodEver) {
                        this._firstFoodEver = false;
                        this._runtime!.sageHint = { text: SAGE_DIALOGUES.firstSteal, timer: 3.5 };
                    } else {
                        this._runtime!.sageHint = { text: `偷到${food.type.name}！`, timer: 2.0 };
                    }
                    this._stealTargetIdx = -1;

                    // 检查是否收集完所有食物 → 鼠洞出现
                    if (this._foodCollected >= map.foodTarget && !this._ratHoleAppeared && !map.ratHoleVisible) {
                        this.appearRatHole();
                    }
                }
            } else {
                if (food) food.stealing = false;
                this._stealing = false;
                this._stealProgress = 0;
                this._stealTargetIdx = -1;
            }
        }
    }

    /** 所有食物收集完毕，鼠洞出现 */
    private appearRatHole(): void {
        const map = this._map!;
        this._ratHoleAppeared = true;

        // 随机生成鼠洞位置（不与障碍物重叠）
        const newHole = randomizeRatHolePosition(map);
        map.ratHole = newHole;

        // 判断是否是最后一个房间（金色鼠洞）
        const manager = GameManager.instance;
        const isFinal = manager?.isFinalRoom() ?? true;
        map.ratHoleIsExit = isFinal;
        map.ratHoleVisible = true;

        // 渲染鼠洞
        this.mapView?.showRatHoleAt(newHole, isFinal, map.mapW, map.mapH);

        if (isFinal) {
            this.dialogue?.showImmediate('sage', SAGE_DIALOGUES.goldenHole, 4);
        } else {
            this.dialogue?.showImmediate('system', SAGE_DIALOGUES.foodComplete, 3);
        }
    }

    /** 检测到达鼠洞 */
    private checkRatHole(): void {
        const map = this._map!;
        const h = this._runtime!.hamster;
        if (h.invincible > 0) return;
        if (!map.ratHoleVisible) return; // 鼠洞还没出现

        const holeDist = dist(h, map.ratHole);
        if (holeDist >= h.r + map.ratHole.r) return;

        if (this._foodCollected <= 0) {
            this._runtime!.sageHint = { text: SAGE_DIALOGUES.notEnoughFood, timer: 2.0 };
            return;
        }
        if (this._foodCollected < map.foodTarget) {
            this._runtime!.sageHint = {
                text: `还要 ${map.foodTarget - this._foodCollected} 份食物~`,
                timer: 2.0,
            };
            return;
        }

        // 食物已收集完，到达鼠洞 → 通知GameManager
        const manager = GameManager.instance;
        if (!manager?.runMode) {
            this.endGame(true);
            return;
        }

        this._phase = 'warping';
        this.joystick?.isInputBlocked(true);

        // 播传送效果
        if (this.titleOverlay) {
            this.titleOverlay.showWarpEffect(() => {
                const result = manager.onReachRatHole(this._foodCollected, this._lives);
                if (result === 'complete') {
                    this.endGame(true);
                }
                // warp/tutorial_next: GameManager 已经加载了新场景，不需要处理
            });
        } else {
            const result = manager.onReachRatHole(this._foodCollected, this._lives);
            if (result === 'complete') {
                this.endGame(true);
            }
        }
    }

    private endGame(won: boolean): void {
        if (this._phase === 'result') return;
        this._phase = 'result';
        this.joystick?.isInputBlocked(true);

        const hamster = this.hamsterNode?.getComponent(HamsterController);
        if (hamster) hamster.inputEnabled = false;

        this.worldFollow?.clearFixedFocus();

        const manager = GameManager.instance;

        // 读取结算结果
        const runResult = manager?.runResult;
        const isRunMode = manager?.runMode === true;

        if (isRunMode && runResult) {
            const { won: runWon, coins, totalFood } = runResult;
            if (runWon) {
                this._resultOverlay?.showWin(
                    '跑酷成功！回家了！',
                    `偷取食物 ${totalFood} 份 · 获得 ${coins} 金币`,
                    {
                        onNext: () => manager.goMenu(),
                        onRetry: () => {
                            manager.clearRunState?.();
                            manager.startRun(manager.runProgress?.selectedTalentId ?? undefined);
                        },
                        onMenu: () => manager.goMenu(),
                    },
                );
            } else {
                this._resultOverlay?.showLose(
                    '被抓住了...',
                    `偷了 ${totalFood} 份食物 · 安慰奖 ${coins} 金币`,
                    {
                        onRetry: () => {
                            manager.clearRunState?.();
                            const save = SaveSystem.data;
                            if (save.tutorialStep < 2) {
                                manager.startTutorial1();
                            } else {
                                manager.startRun(undefined);
                            }
                        },
                        onMenu: () => manager.goMenu(),
                    },
                );
            }
            return;
        }

        // 非跑酷模式（普通关卡/旧逻辑）
        const levelId = this._levelId;
        const foodTarget = this._map?.foodTarget ?? 0;
        if (won) {
            const stars = this._lives;
            SaveSystem.updateStars(levelId, stars);
            if (this._foodCollected >= foodTarget) {
                SaveSystem.unlockLevel(levelId + 1);
            }
            this._resultOverlay?.showWin(
                '胜利！',
                `剩余生命 ${this._lives} · 获得 ${stars} 星`,
                {
                    onNext: () => {
                        const next = levelId + 1;
                        if (next <= SaveSystem.data.maxUnlocked && next <= 8) {
                            GameManager.instance?.goGame(next);
                        } else {
                            GameManager.instance?.goMenu();
                        }
                    },
                    onRetry: () => GameManager.instance?.goGame(levelId),
                    onMenu: () => GameManager.instance?.goMenu(),
                },
            );
        } else {
            this._resultOverlay?.showLose(
                '失败',
                '被猫抓住太多次了，再试一次吧',
                {
                    onRetry: () => GameManager.instance?.goGame(levelId),
                    onMenu: () => GameManager.instance?.goMenu(),
                },
            );
        }
    }

    private updateOpening(dt: number): void {
        this._openingTimer += dt;
        const map = this._map!;
        const isL1 = map.levelId === 1;
        const isTutorial = GameManager.instance?.runProgress?.tutorialMode === true;
        const t = this._openingTimer;

        this.joystick?.isInputBlocked(true);
        const hamster = this.hamsterNode!.getComponent(HamsterController)!;
        hamster.inputEnabled = false;

        let text = '';
        let focusX = map.mapW / 2;
        let focusY = map.mapH / 2;
        let zoom = isL1 ? 0.75 : calcMapFillZoom(map.mapH) * 0.85;

        // 只有引导关才播长开场，正式跑酷房间只做短倒计时
        if (isTutorial && isL1 && SaveSystem.data.tutorialStep === 0) {
            // 完整新手引导开场
            if (t < 3) {
                text = '徒儿，这是厨房，你的冒险开始咯~';
            } else if (t < 5 && map.foods.length > 0) {
                const food = map.foods.reduce((a, b) =>
                    (dist(a, map.ratHole) > dist(b, map.ratHole) ? a : b));
                focusX = food.x;
                focusY = food.y;
                zoom = 0.9;
                text = '看到那些好吃的没得？全给为师拿回来！';
            } else if (t < 7) {
                focusX = this._runtime!.cat.x;
                focusY = this._runtime!.cat.y;
                zoom = 1.0;
                text = '那只胖猫在睡觉💤...莫去惹它哈！';
            } else if (t < 9.5) {
                focusX = map.ratHole.x;
                focusY = map.ratHole.y;
                zoom = 0.8;
                text = '偷到食物后回鼠洞！';
            } else if (t < 12) {
                focusX = map.ratHole.x;
                focusY = map.ratHole.y;
                zoom = 0.8;
                text = '接下来就看你了！';
            } else if (t < 13) {
                this._countdown = 3;
                text = '';
            } else if (t < 14) {
                this._countdown = 2;
            } else if (t < 15) {
                this._countdown = 1;
            } else if (t < 15.5) {
                this._countdown = 0;
            } else {
                this.startActionPhase();
                return;
            }
        } else {
            // 短开场（非首关/正式跑酷）
            if (t < 1.5) {
                text = isTutorial ? '继续加油！' : '准备...';
            } else if (t < 2.5) {
                this._countdown = 3;
            } else if (t < 3.5) {
                this._countdown = 2;
            } else if (t < 4.5) {
                this._countdown = 1;
            } else if (t < 5) {
                this._countdown = 0;
            } else {
                this.startActionPhase();
                return;
            }
        }

        this.worldFollow?.setFixedFocusHtml(focusX, focusY, map.mapW, map.mapH);
        if (this.worldFollow) {
            this.worldFollow.targetZoom = zoom;
        }

        if (this.hintRoot) {
            if (this._countdown >= 0) {
                this.hintRoot.active = false;
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = true;
                    this.countdownLabel.string = this._countdown === 0 ? 'GO!' : String(this._countdown);
                }
            } else if (text) {
                this.showSageDialog(text);
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = false;
                }
            } else {
                this.hideSageDialog();
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = false;
                }
            }
        }
    }

    private showSageDialog(text: string): void {
        if (!this.hintRoot || !this.hintLabel) return;
        this.hintRoot.active = true;
        if (this.sagePortraitNode) {
            this.sagePortraitNode.active = true;
        }
        this.hintLabel.string = text;
    }

    private hideSageDialog(): void {
        if (this.hintRoot) {
            this.hintRoot.active = false;
        }
    }

    private async loadSagePortrait(): Promise<void> {
        if (!this.sagePortraitNode) return;
        const frame = await loadSpriteByKey((k) => ArtCatalog.getSpriteUuid(k), 'sage');
        if (frame && this.sagePortraitNode.isValid) {
            applyNativeSpriteFrame(this.sagePortraitNode, frame);
            this.sagePortraitNode.setScale(0.55, 0.55, 1);
        }
    }

    private startActionPhase(): void {
        this._phase = 'action';
        this._countdown = -1;
        this.worldFollow?.clearFixedFocus();
        this.joystick?.isInputBlocked(false);
        const hamster = this.hamsterNode?.getComponent(HamsterController);
        if (hamster) hamster.inputEnabled = true;
        this.hideSageDialog();
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
    }

    private updateOpeningCameraZoom(): void {
        if (!this.worldFollow || !this._map) return;
        const catCtrl = this.catNode?.getComponent(CatController);
        if (catCtrl?.catState) {
            this._runtime!.cat = catCtrl.catState;
            updateCat(this._runtime!, this._map, 0);
            catCtrl.syncFromState(this._map.mapW, this._map.mapH);
        }
    }

    private ensureResultOverlay(): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName('GameResultOverlay');
        if (!node) {
            node = new Node('GameResultOverlay');
            root.addChild(node);
            node.setSiblingIndex(1000);
        }
        this._resultOverlay = node.getComponent(GameResultOverlay) ?? node.addComponent(GameResultOverlay);
        this._resultOverlay.ensure(root);
        this._resultOverlay.hide();
    }

    private updateStatusLabel(): void {
        if (!this.statusLabel || !this._runtime) return;
        const c = this._runtime.cat;
        let hearts = '';
        for (let i = 0; i < this._maxLives; i += 1) {
            hearts += i < this._lives ? '❤' : '♡';
        }
        const stealText = this._stealing
            ? ` · 偷取 ${Math.floor(this._stealProgress * 100)}%`
            : '';
        const speedText = this._speedBoost ? ' · 🛹' : '';
        const manager = GameManager.instance;
        let roomInfo = '';
        if (manager?.runMode && manager.runProgress) {
            const p = manager.runProgress;
            roomInfo = ` · 房间${p.currentRoomIndex + 1}/${p.roomSequence.length}`;
        }
        this.statusLabel.string =
            `${hearts} · ${this._foodCollected}/${this._map?.foodTarget ?? 0}${stealText}${speedText}${roomInfo}`;
    }

    private onCatCatch(): void {
        if (!this._map || !this._runtime || this._phase !== 'action') return;
        if (this._runtime.hamster.invincible > 0) return;

        // 撞到猫时滑板车消失
        if (this._speedBoost) {
            this._speedBoost = false;
            this._speedBoostTimer = 0;
        }

        if (this._foodCollected > 0) {
            this._foodCollected -= 1;
        }
        this._lives -= 1;
        handleCatCatchHamster(this._runtime, this._map);
        this.syncHamsterNodeFromHtml();
        const catCtrl = this.catNode?.getComponent(CatController);
        catCtrl?.syncFromState(this._map.mapW, this._map.mapH);

        const manager = GameManager.instance;
        const msg = this._lives > 0
            ? (manager?.runProgress?.tutorialMode && this._lives === 1
                ? SAGE_DIALOGUES.oneLifeLeft
                : `被猫抓住了！还剩 ${this._lives} 条命`)
            : '生命耗尽...';
        this._runtime.sageHint = { text: msg, timer: 3.0 };

        if (this._lives <= 0) {
            this._phase = 'warping';
            this.joystick?.isInputBlocked(true);
            manager?.onRunFailed(this._foodCollected);
            this.scheduleOnce(() => this.endGame(false), 1.0);
        }
    }

    private syncHamsterHtmlFromNode(): void {
        if (!this._map || !this.hamsterNode || !this._runtime) return;
        const html = cocosToHtml(this.hamsterNode.position.x, this.hamsterNode.position.y, this._map.mapW, this._map.mapH);
        this._runtime.hamster.x = html.x;
        this._runtime.hamster.y = html.y;
    }

    private syncHamsterNodeFromHtml(): void {
        if (!this._map || !this.hamsterNode || !this._runtime) return;
        const pos = htmlToCocos(this._runtime.hamster.x, this._runtime.hamster.y, this._map.mapW, this._map.mapH);
        this.hamsterNode.setPosition(pos.x, pos.y, 0);
    }

    private updateCameraZoom(): void {
        if (!this.worldFollow || !this._map || !this.catNode || !this.hamsterNode) return;
        const base = this._map.levelId === 1
            ? L1_CAMERA_ZOOM
            : calcMapFillZoom(this._map.mapH);
        const cd = dist(this.catNode.position, this.hamsterNode.position);
        if (cd < 100) this.worldFollow.targetZoom = base + 0.25;
        else if (cd < 200) this.worldFollow.targetZoom = base + 0.12;
        else this.worldFollow.targetZoom = base;
    }

    private async ensureSceneGraph(): Promise<void> {
        const canvas = this.node;
        canvas.layer = GAME_LAYER;

        const uiCameraNode = canvas.getChildByName('Camera');
        this.viewCamera = uiCameraNode?.getComponent(Camera) ?? null;

        this.worldRoot = canvas.getChildByName('World');
        if (!this.worldRoot) {
            this.worldRoot = new Node('World');
            canvas.addChild(this.worldRoot);
        }
        this.worldRoot.setSiblingIndex(0);
        this.worldRoot.layer = GAME_LAYER;

        this.uiRoot = canvas.getChildByName('UIRoot');
        if (!this.uiRoot) {
            this.uiRoot = new Node('UIRoot');
            canvas.addChild(this.uiRoot);
        }
        this.uiRoot.layer = GAME_LAYER;
        this.uiRoot.setSiblingIndex(100);

        // 标题覆盖层
        let titleNode = this.uiRoot.getChildByName('TitleOverlay');
        if (!titleNode) {
            titleNode = new Node('TitleOverlay');
            this.uiRoot.addChild(titleNode);
        }
        this.titleOverlay = titleNode.getComponent(TitleOverlay) ?? titleNode.addComponent(TitleOverlay);

        // 对话气泡
        let dlgNode = this.uiRoot.getChildByName('DialogueBubble');
        if (!dlgNode) {
            dlgNode = new Node('DialogueBubble');
            this.uiRoot.addChild(dlgNode);
        }
        this.dialogue = dlgNode.getComponent(DialogueBubble) ?? dlgNode.addComponent(DialogueBubble);

        const oldCam = canvas.scene.getChildByName('GameCamera');
        if (oldCam) oldCam.destroy();

        if (!this.hamsterNode) {
            this.hamsterNode = this.worldRoot.getChildByName('Hamster') ?? new Node('Hamster');
            if (!this.hamsterNode.parent) this.worldRoot.addChild(this.hamsterNode);
            this.hamsterNode.layer = GAME_LAYER;
        }
        if (!this.catNode) {
            this.catNode = this.worldRoot.getChildByName('Cat') ?? new Node('Cat');
            if (!this.catNode.parent) this.worldRoot.addChild(this.catNode);
            this.catNode.layer = GAME_LAYER;
        }

        let followNode = canvas.getChildByName('WorldFollow');
        if (!followNode) {
            followNode = new Node('WorldFollow');
            canvas.addChild(followNode);
        }
        this.worldFollow = followNode.getComponent(WorldFollow) ?? followNode.addComponent(WorldFollow);
        this.worldFollow.worldRoot = this.worldRoot;
        this.worldFollow.viewCamera = this.viewCamera;

        if (!this.uiRoot.getChildByName('VirtualJoystick')) {
            const joyNode = new Node('VirtualJoystick');
            this.uiRoot.addChild(joyNode);
            joyNode.addComponent(UITransform).setContentSize(DESIGN_HEIGHT, DESIGN_HEIGHT);
            this.joystick = joyNode.addComponent(VirtualJoystick);
        } else {
            this.joystick = this.uiRoot.getChildByName('VirtualJoystick')?.getComponent(VirtualJoystick) ?? null;
        }

        this.createLabel('HUDLabel', 580, DESIGN_WIDTH - 40, 22, (l) => {
            this.hudLabel = l;
            l.color = new Color(255, 255, 255, 255);
        });
        this.createLabel('StatusLabel', 540, DESIGN_WIDTH - 40, 18, (l) => {
            this.statusLabel = l;
            l.color = new Color(200, 255, 200, 255);
        });
        this.createGuideLabel();
        void this.loadSagePortrait();
        this.createCountdownLabel();
        this.createAlertBar();
        this.createStealBar();
    }

    private createGuideLabel(): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName('HintLabel');
        if (!node) {
            node = new Node('HintLabel');
            root.addChild(node);

            const sageNode = new Node('SagePortrait');
            node.addChild(sageNode);
            sageNode.setPosition(-DESIGN_WIDTH / 2 + 95, 55, 0);
            sageNode.addComponent(UITransform).setContentSize(80, 100);
            this.sagePortraitNode = sageNode;

            const panel = new Node('GuidePanel');
            node.addChild(panel);
            panel.setSiblingIndex(0);
            panel.addComponent(UITransform).setContentSize(DESIGN_WIDTH - 80, 100);
            const gfx = panel.addComponent(Graphics);
            gfx.fillColor = new Color(255, 255, 255, 235);
            const pw = DESIGN_WIDTH - 80;
            const ph = 100;
            gfx.rect(-pw / 2, -ph / 2, pw, ph);
            gfx.fill();
            gfx.lineWidth = 2;
            gfx.strokeColor = new Color(255, 215, 0, 255);
            gfx.rect(-pw / 2, -ph / 2, pw, ph);
            gfx.stroke();

            const labelNode = new Node('Text');
            node.addChild(labelNode);
            labelNode.setPosition(12, 0, 0);
            labelNode.addComponent(UITransform).setContentSize(DESIGN_WIDTH - 140, 90);
            const label = labelNode.addComponent(Label);
            label.useSystemFont = true;
            label.fontSize = 22;
            label.lineHeight = 28;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.RESIZE_HEIGHT;
            label.color = new Color(40, 40, 40, 255);
            this.hintLabel = label;
            node.active = false;
        } else {
            this.hintRoot = node;
            this.sagePortraitNode = node.getChildByName('SagePortrait');
            this.hintLabel = node.getChildByName('Text')?.getComponent(Label)
                ?? node.getComponent(Label);
        }
        this.hintRoot = node!;
        node!.setPosition(0, -DESIGN_HEIGHT / 2 + 150, 0);
    }

    private createAlertBar(): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName('AlertBar');
        if (!node) {
            node = new Node('AlertBar');
            root.addChild(node);
            const bw = 80;
            const bh = 12;
            node.setPosition(DESIGN_WIDTH / 2 - 28 - bw / 2, DESIGN_HEIGHT / 2 - 30, 0);
            node.addComponent(UITransform).setContentSize(bw, bh);
            this.alertBarGfx = node.addComponent(Graphics);
        } else {
            this.alertBarGfx = node.getComponent(Graphics);
        }
    }

    private updateAlertBar(): void {
        const gfx = this.alertBarGfx;
        const c = this._runtime?.cat;
        if (!gfx || !c || this._phase !== 'action' || this._catHidden) {
            gfx?.clear();
            return;
        }
        const bw = 80;
        const bh = 12;
        const aw = (c.alertValue / 100) * bw;
        gfx.clear();
        gfx.fillColor = new Color(255, 255, 255, 64);
        gfx.rect(-bw / 2, -bh / 2, bw, bh);
        gfx.fill();
        if (aw > 0) {
            gfx.fillColor = c.alertValue > 60
                ? new Color(255, 68, 68, 255)
                : c.alertValue > 30
                    ? new Color(255, 165, 0, 255)
                    : new Color(255, 255, 0, 255);
            gfx.rect(-bw / 2, -bh / 2, Math.max(6, aw), bh);
            gfx.fill();
        }
    }

    private createStealBar(): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName('StealBar');
        if (!node) {
            node = new Node('StealBar');
            root.addChild(node);
            node.setPosition(0, -40, 0);
            node.addComponent(UITransform).setContentSize(90, 18);
            this.stealBarGfx = node.addComponent(Graphics);
            node.active = false;
        } else {
            this.stealBarGfx = node.getComponent(Graphics);
        }
    }

    private updateStealBar(): void {
        const gfx = this.stealBarGfx;
        if (!gfx) return;
        const node = gfx.node;
        if (!this._stealing || this._phase !== 'action') {
            node.active = false;
            gfx.clear();
            return;
        }
        node.active = true;
        const bw = 90;
        const bh = 18;
        const pw = bw * this._stealProgress;
        gfx.clear();
        gfx.fillColor = new Color(0, 0, 0, 166);
        gfx.rect(-bw / 2, -bh / 2, bw, bh);
        gfx.fill();
        if (pw > 0) {
            gfx.fillColor = new Color(255, 215, 0, 255);
            gfx.rect(-bw / 2, -bh / 2, pw, bh);
            gfx.fill();
        }
    }

    private createCountdownLabel(): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName('CountdownLabel');
        if (!node) {
            node = new Node('CountdownLabel');
            root.addChild(node);
            node.setPosition(0, 0, 0);
            node.addComponent(UITransform).setContentSize(200, 120);
            const label = node.addComponent(Label);
            label.useSystemFont = true;
            label.fontSize = 88;
            label.lineHeight = 96;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color(255, 215, 0, 255);
            label.string = '';
            this.countdownLabel = label;
            node.active = false;
        } else {
            this.countdownLabel = node.getComponent(Label);
        }
    }

    private createLabel(name: string, y: number, width: number, fontSize: number, setup: (l: Label) => void): void {
        const root = this.uiRoot ?? this.node;
        let node = root.getChildByName(name);
        if (!node) {
            node = new Node(name);
            root.addChild(node);
            node.setPosition(0, y, 0);
            node.addComponent(UITransform).setContentSize(width, 40);
            const label = node.addComponent(Label);
            label.useSystemFont = true;
            label.fontSize = fontSize;
            label.lineHeight = fontSize + 4;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            setup(label);
        } else {
            const label = node.getComponent(Label);
            if (label) {
                label.useSystemFont = true;
                setup(label);
            }
        }
    }

    private async setupActors(map: MapData): Promise<void> {
        const hamster = createHamsterSpawn(map);
        const baseCat = createCatSpawn(map.spawnCatBed, map.mapW, map.levelId);
        const catSpawn = (map.catSpawnOverride && !map.spawnCatBed)
            ? { ...baseCat, x: map.catSpawnOverride.x, y: map.catSpawnOverride.y }
            : baseCat;

        if (this.hamsterNode) {
            const pos = htmlToCocos(hamster.x, hamster.y, map.mapW, map.mapH);
            this.hamsterNode.setPosition(pos.x, pos.y, 0);
            this.hamsterNode.setSiblingIndex(9998);
            const frame = await loadSpriteByKey((k) => ArtCatalog.getSpriteUuid(k), 'mouse');
            if (frame) {
                applyActorSpriteFrame(this.hamsterNode, frame);
            }
            const hc = this.hamsterNode.getComponent(HamsterController) ?? this.hamsterNode.addComponent(HamsterController);
            hc.radius = hamster.r;
            let speedMult = 1.3; // 基础30%加速
            const talentId = GameManager.instance?.runProgress?.selectedTalentId;
            if (talentId === 'speed_boost') {
                speedMult *= 1.25;
            }
            hc.speed = GameConfig.difficulty.hamsterBaseSpeed * 60 * speedMult;
            if (this.worldFollow) {
                this.worldFollow.target = this.hamsterNode;
                const fillZoom = map.levelId === 1
                    ? L1_CAMERA_ZOOM
                    : calcMapFillZoom(map.mapH);
                this.worldFollow.targetZoom = fillZoom;
                this.worldFollow.zoom = fillZoom;
            }
        }

        if (this.catNode) {
            this.catNode.setSiblingIndex(9997);
            const cat = this.catNode.getComponent(CatController) ?? this.catNode.addComponent(CatController);
            cat.init(map.levelId, catSpawn.x, catSpawn.y, catSpawn.stateTimer, map.mapW, map.mapH);
        }

        setLayerRecursive(this.worldRoot!, GAME_LAYER);
    }

    private resolveHamsterCollision(): void {
        const map = this._map;
        const runtime = this._runtime;
        if (!map || !runtime) return;

        // 鼠洞附近不撞底墙
        let holeNear = false;
        if (map.ratHoleVisible) {
            holeNear = dist(runtime.hamster, map.ratHole) < runtime.hamster.r + map.ratHole.r + 24;
        }

        let x = runtime.hamster.x;
        let y = runtime.hamster.y;
        const r = runtime.hamster.r;
        for (const wall of getCollidableRects(map)) {
            if (holeNear && wall.y >= map.mapH - 25) continue;
            if (circRectHit(x, y, r, wall.x, wall.y, wall.w, wall.h)) {
                const p = pushOut(x, y, r + 1, wall.x, wall.y, wall.w, wall.h);
                x = p.x;
                y = p.y;
            }
        }
        runtime.hamster.x = x;
        runtime.hamster.y = y;
    }
}
