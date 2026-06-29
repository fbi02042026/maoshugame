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
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { GameManager } from '../core/GameManager';
import { HamsterController } from '../hamster/HamsterController';
import type { MapData } from '../data/GameTypes';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { WorldFollow, calcMapFillZoom, L1_CAMERA_ZOOM } from './WorldFollow';
import { createCatSpawn, createHamsterSpawn, generateMapFromJson, getCollidableRects } from './MapGenerator';
import { MapView } from './MapView';
import { loadRoomForLevel } from '../room/RoomPrefabLoader';
import { SaveSystem } from '../core/SaveSystem';
import { GameResultOverlay } from '../ui/GameResultOverlay';

const { ccclass } = _decorator;

type GamePhase = 'opening' | 'action' | 'result';

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

    async start(): Promise<void> {
        try {
            if (!GameManager.instance?.configReady) {
                await GameConfig.loadAll();
            }

            SaveSystem.load();

        const manager = GameManager.instance;
        const levelId = manager?.currentLevel ?? 1;
        this._levelId = levelId;
        this._lives = this._maxLives;
        this._phase = 'opening';
        this._openingTimer = 0;
        this._countdown = -1;
        const level = GameConfig.getLevel(levelId) ?? GameConfig.levels[0];

        await ArtCatalog.load();
        await this.ensureSceneGraph();

        const prefabRoom = await loadRoomForLevel(levelId, this.worldRoot!);
        console.log('[Game] loadRoomForLevel result:', prefabRoom ? 'OK' : 'NULL');
        if (prefabRoom) {
            this._map = prefabRoom.map;
            this.mapView = prefabRoom.mapView;
            console.log('[Game] 房间加载成功, 家具数:', this._map.furniture.length);
        } else {
            console.error('[Game] 未能加载 Room1Edit 房间，请检查控制台 [Room] 报错');
            if (this.hudLabel) {
                this.hudLabel.string = '房间加载失败 · 请看控制台';
            }
            this._map = generateMapFromJson(levelId);
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
                invincible: 0,
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
            this.hudLabel.string = `第${level.id}关 ${level.name} · 靠近食物按住偷取 · 带回鼠洞`;
        }
        this.ensureResultOverlay();
        this.updateStatusLabel();
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

    update(dt: number): void {
        if (!this._map || !this._runtime || !this.hamsterNode) return;

        if (this._phase === 'result') return;

        if (this._phase === 'opening') {
            this.updateOpening(dt);
            return;
        }

        this._runtime.time += dt;

        const blocked = !!(this._runtime.sageHint && this._runtime.sageHint.timer > 0);
        this.joystick?.isInputBlocked(blocked);

        const hamster = this.hamsterNode.getComponent(HamsterController)!;
        hamster.speed = GameConfig.difficulty.hamsterBaseSpeed * 60;
        hamster.inputEnabled = !blocked && this._runtime.hamster.invincible <= 0;

        if (this.joystick) {
            this.joystick.getDirection(this._joyDir);
            hamster.setJoystickDirection(this._joyDir.x, this._joyDir.y);
        }

        if (hamster.getMoveDirection(this._moveDir)) {
            const step = hamster.speed * dt;
            const pos = this.hamsterNode.position;
            this.hamsterNode.setPosition(
                pos.x + this._moveDir.x * step,
                pos.y + this._moveDir.y * step,
                pos.z,
            );
        }

        this.syncHamsterHtmlFromNode();
        this.resolveHamsterCollision();
        this.syncHamsterNodeFromHtml();
        this.updateFoodSteal(dt);
        this.mapView?.updateStealRing(
            this._stealTargetIdx,
            this._stealProgress,
            this._stealing && this._stealTargetIdx >= 0,
        );
        this.checkWinAtRatHole();

        const hint = this._runtime.sageHint;
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
    }

    lateUpdate(dt: number): void {
        if (!this._map || !this._runtime || !this.hamsterNode || !this.catNode) return;
        if (this._phase === 'result') return;

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

        const catCtrl = this.catNode.getComponent(CatController);
        if (catCtrl?.catState) {
            this._runtime.cat = catCtrl.catState;
            updateCat(this._runtime, this._map, dt);
            catCtrl.syncFromState(this._map.mapW, this._map.mapH);
        }

        this.updateCameraZoom();
        this.updateAlertBar();
        if (this.uiRoot) {
            this.uiRoot.setScale(1, 1, 1);
            this.uiRoot.setPosition(0, 0, 0);
        }
    }

    private updateFoodSteal(dt: number): void {
        const map = this._map!;
        const h = this._runtime!.hamster;

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
                this._stealProgress += dt * 1.2;
                if (this._stealProgress >= 1) {
                    food.collected = true;
                    food.stealing = false;
                    this._foodCollected += 1;
                    this._stealing = false;
                    this._stealProgress = 0;
                    this.mapView?.hideFood(this._stealTargetIdx);
                    onFoodStolen(this._runtime!);
                    this._runtime!.sageHint = { text: `偷到${food.type.name}！快回鼠洞！`, timer: 3.0 };
                    this._stealTargetIdx = -1;
                }
            } else {
                if (food) food.stealing = false;
                this._stealing = false;
                this._stealProgress = 0;
                this._stealTargetIdx = -1;
            }
        }
    }

    private checkWinAtRatHole(): void {
        const map = this._map!;
        const h = this._runtime!.hamster;
        if (h.invincible > 0) return;

        const holeDist = dist(h, map.ratHole);
        if (holeDist >= h.r + map.ratHole.r) return;

        if (this._foodCollected <= 0) {
            this._runtime!.sageHint = { text: '还没拿到食物呢，再去找找~', timer: 2.5 };
            return;
        }
        if (this._foodCollected < map.foodTarget) {
            this._runtime!.sageHint = {
                text: `还要 ${map.foodTarget - this._foodCollected} 份食物才能过关~`,
                timer: 2.5,
            };
            return;
        }

        this.endGame(true);
    }

    private endGame(won: boolean): void {
        if (this._phase === 'result') return;
        this._phase = 'result';
        this.joystick?.isInputBlocked(true);

        const hamster = this.hamsterNode?.getComponent(HamsterController);
        if (hamster) hamster.inputEnabled = false;

        this.worldFollow?.clearFixedFocus();

        const levelId = this._levelId;
        const foodTarget = this._map?.foodTarget ?? 0;

        if (won) {
            const stars = this._lives;
            SaveSystem.updateStars(levelId, stars);
            if (this._foodCollected >= foodTarget) {
                SaveSystem.unlockLevel(levelId + 1);
            }
            if (this.hudLabel) {
                this.hudLabel.string = `通关！${stars} 星 · 带回 ${this._foodCollected}/${foodTarget}`;
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
            if (this.hudLabel) {
                this.hudLabel.string = '失败 · 生命耗尽';
            }
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
        const t = this._openingTimer;

        this.joystick?.isInputBlocked(true);
        const hamster = this.hamsterNode!.getComponent(HamsterController)!;
        hamster.inputEnabled = false;

        let text = '';
        let focusX = map.mapW / 2;
        let focusY = map.mapH / 2;
        let zoom = isL1 ? 0.75 : calcMapFillZoom(map.mapH) * 0.85;

        if (isL1) {
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
                const gap = map.narrowGaps.find((g) => g.type === 'mouse');
                if (gap) {
                    focusX = gap.x + gap.w / 2;
                    focusY = gap.y + gap.h / 2;
                    zoom = 1.3;
                    text = '左边那条窄道只有你钻得过去，胖猫进不来！';
                } else {
                    focusX = map.ratHole.x;
                    focusY = map.ratHole.y;
                    zoom = 0.8;
                }
            } else if (t < 13.5) {
                focusX = map.ratHole.x;
                focusY = map.ratHole.y;
                zoom = 0.8;
                text = '接下来就看你这个瓜娃子的了！';
            } else if (t < 14.5) {
                this._countdown = 3;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
                zoom = 1.2;
                text = '';
            } else if (t < 15.5) {
                this._countdown = 2;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
                zoom = 1.2;
            } else if (t < 16.5) {
                this._countdown = 1;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
                zoom = 1.2;
            } else if (t < 17) {
                this._countdown = 0;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
                zoom = 1.2;
            } else {
                this.startActionPhase();
                return;
            }
        } else {
            if (t < 2) {
                text = `第 ${map.levelId} 关 · 偷食物回鼠洞`;
            } else if (t < 4 && map.foods.length) {
                const food = map.foods[0];
                focusX = food.x;
                focusY = food.y;
                zoom = calcMapFillZoom(map.mapH);
            } else if (t < 6) {
                focusX = this._runtime!.cat.x;
                focusY = this._runtime!.cat.y;
                zoom = calcMapFillZoom(map.mapH);
            } else if (t < 7) {
                this._countdown = 3;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
                zoom = map.levelId === 1 ? L1_CAMERA_ZOOM : calcMapFillZoom(map.mapH);
            } else if (t < 8) {
                this._countdown = 2;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
            } else if (t < 9) {
                this._countdown = 1;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
            } else if (t < 9.5) {
                this._countdown = 0;
                focusX = this._runtime!.hamster.x;
                focusY = this._runtime!.hamster.y;
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
        this.statusLabel.string =
            `${hearts} · 食物 ${this._foodCollected}/${this._map?.foodTarget ?? 0}${stealText} · 猫:${c.state} · 警戒 ${Math.floor(c.alertValue)}%`;
    }

    private onCatCatch(): void {
        if (!this._map || !this._runtime || this._phase !== 'action') return;
        if (this._runtime.hamster.invincible > 0) return;

        if (this._foodCollected > 0) {
            this._foodCollected -= 1;
        }
        this._lives -= 1;
        handleCatCatchHamster(this._runtime, this._map);
        this.syncHamsterNodeFromHtml();
        const catCtrl = this.catNode?.getComponent(CatController);
        catCtrl?.syncFromState(this._map.mapW, this._map.mapH);

        const msg = this._lives > 0
            ? `被猫抓住了！还剩 ${this._lives} 条命`
            : '生命耗尽...';
        this._runtime.sageHint = { text: msg, timer: 3.0 };

        if (this._lives <= 0) {
            this.scheduleOnce(() => this.endGame(false), 0.8);
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

    /** 底部引导对话框 + 仙人立绘（对照浏览器 drawOpeningUI） */
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

    /** 右上角警觉条（对照浏览器 HUD） */
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
        if (!gfx || !c || this._phase !== 'action') {
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

    /** 屏幕中央偷取进度条 */
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
            hc.speed = GameConfig.difficulty.hamsterBaseSpeed * 60 * 1.3;
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

        const holeNear = dist(runtime.hamster, map.ratHole) < runtime.hamster.r + map.ratHole.r + 24;

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
