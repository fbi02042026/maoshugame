import {
    _decorator,
    assetManager,
    Button,
    Component,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    ImageAsset,
} from 'cc';
import { GameManager } from '../core/GameManager';
import { SaveSystem } from '../core/SaveSystem';
import { TalentSelectView } from './TalentSelectView';

const { ccclass } = _decorator;

// 仓鼠序列帧 UUID（吃饭 x8 + 睡觉 x8）
const EATING_FRAMES = [
    '86c9b581-bf5a-471e-a711-6c20a7aa36bb@6c48a',
    'f81e376a-ca4c-4d2b-bf31-ae6891b370b6@6c48a',
    '3d1a4d43-67d6-4a21-bb7d-51e1382deea3@6c48a',
    'dd1d6c18-6105-4ffb-a60e-7bf910f9a73b@6c48a',
    'd7918948-0d1e-4afa-91c5-b9eb039a34e0@6c48a',
    'f6f43364-e00a-40ba-b3e9-02d69e4f2ec0@6c48a',
    'bffe126c-74b4-4862-a06e-cf79b091d0d7@6c48a',
    '19e5585e-b252-49de-b389-2bb253970522@6c48a',
];

const SLEEPING_FRAMES = [
    '1865f198-5d37-40bf-bd1b-ecdd6434d557@6c48a',
    '9e0cb1a2-8314-4a92-99f2-c95de82f4586@6c48a',
    '2648dec0-8d47-4ef4-a2ba-095286ed024c@6c48a',
    'a93e4d22-cd33-4abc-accc-fd12f628c2b6@6c48a',
    '8d65e61b-d8ec-43a7-ab51-2bea2e2fd6bf@6c48a',
    '37048e91-ff1f-479f-b112-b9d37927d918@6c48a',
    'e9544612-50ca-4f1a-816c-b43f30dd3dc1@6c48a',
    '2a0f0980-9d19-4b4f-bf64-39d10b0041d3@6c48a',
];

const FRAME_INTERVAL = 0.15; // 每帧间隔（秒）

@ccclass('MenuController')
export class MenuController extends Component {
    // 场景节点引用
    private hamsterNode: Node | null = null;
    private hamsterSprite: Sprite | null = null;
    private coinLabel: Label | null = null;
    private bestLabel: Label | null = null;
    private startButton: Node | null = null;
    private skinButton: Node | null = null;
    private levelButton: Node | null = null;
    private settingsButton: Node | null = null;

    // 仓鼠动画
    private hamsterFrames: SpriteFrame[] = [];
    private hamsterFrameIdx = 0;
    private hamsterTimer = 0;
    private hamsterAnimating = false;

    // 天赋选择
    private talentView: TalentSelectView | null = null;

    start(): void {
        SaveSystem.load();
        this.bindSceneNodes();
        this.bindButtons();
        this.initTalentView();
        this.startHamsterAnimation();
        this.refreshUi();
    }

    onEnable(): void {
        // 从别的界面切回时刷新UI
        this.refreshUi();
        // 随机切换仓鼠状态
        this.startHamsterAnimation();
    }

    update(dt: number): void {
        if (!this.hamsterAnimating || this.hamsterFrames.length === 0) return;
        this.hamsterTimer += dt;
        if (this.hamsterTimer >= FRAME_INTERVAL) {
            this.hamsterTimer -= FRAME_INTERVAL;
            this.hamsterFrameIdx = (this.hamsterFrameIdx + 1) % this.hamsterFrames.length;
            if (this.hamsterSprite) {
                this.hamsterSprite.spriteFrame = this.hamsterFrames[this.hamsterFrameIdx];
            }
        }
    }

    // ============================================================
    // 绑定场景节点
    // ============================================================
    private bindSceneNodes(): void {
        this.hamsterNode = this.node.getChildByName('Hamster');
        this.hamsterSprite = this.hamsterNode?.getComponent(Sprite) ?? null;

        const coinNode = this.node.getChildByName('CoinDisplay');
        this.coinLabel = coinNode?.getComponent(Label) ?? null;

        const bestNode = this.node.getChildByName('BestDisplay');
        this.bestLabel = bestNode?.getComponent(Label) ?? null;

        this.startButton = this.node.getChildByName('StartButton');
        this.skinButton = this.node.getChildByName('SkinButton');
        this.levelButton = this.node.getChildByName('LevelButton');
        this.settingsButton = this.node.getChildByName('SettingsButton');
    }

    // ============================================================
    // 绑定按钮事件
    // ============================================================
    private bindButtons(): void {
        this.startButton?.on(Button.EventType.CLICK, this.onClickStart, this);
        this.skinButton?.on(Button.EventType.CLICK, this.onClickSkin, this);
        this.levelButton?.on(Button.EventType.CLICK, this.onClickLevelSelect, this);
        this.settingsButton?.on(Button.EventType.CLICK, this.onClickSettings, this);
    }

    // ============================================================
    // 天赋选择
    // ============================================================
    private initTalentView(): void {
        if (this.talentView) return;
        const tv = new Node('TalentSelectView');
        this.node.addChild(tv);
        this.talentView = tv.addComponent(TalentSelectView);
    }

    // ============================================================
    // 仓鼠序列帧动画
    // ============================================================
    private startHamsterAnimation(): void {
        // 随机选择吃饭或睡觉状态
        const isEating = Math.random() < 0.5;
        const frameUuids = isEating ? EATING_FRAMES : SLEEPING_FRAMES;

        this.hamsterAnimating = false;
        this.hamsterFrames = [];
        this.hamsterFrameIdx = 0;
        this.hamsterTimer = 0;

        // 加载所有帧
        let loaded = 0;
        const frames: (SpriteFrame | null)[] = new Array(frameUuids.length).fill(null);

        for (let i = 0; i < frameUuids.length; i++) {
            assetManager.loadAny(
                { uuid: frameUuids[i] },
                (err, asset) => {
                    if (err) {
                        loaded++;
                        return;
                    }
                    const sf = new SpriteFrame();
                    sf.texture = asset as Texture2D;
                    frames[i] = sf;
                    loaded++;
                    if (loaded === frameUuids.length) {
                        this.hamsterFrames = frames.filter((f): f is SpriteFrame => f !== null);
                        if (this.hamsterFrames.length > 0 && this.hamsterSprite) {
                            this.hamsterSprite.spriteFrame = this.hamsterFrames[0];
                            this.hamsterAnimating = true;
                        }
                    }
                },
            );
        }
    }

    // ============================================================
    // UI 刷新
    // ============================================================
    private refreshUi(): void {
        if (this.coinLabel) {
            this.coinLabel.string = `🧀 ${SaveSystem.data.coins}`;
        }
        if (this.bestLabel) {
            const b = SaveSystem.data.bestFoodSingleRun ?? 0;
            this.bestLabel.string = b > 0 ? `最佳 ${b} 块奶酪` : '';
        }
    }

    // ============================================================
    // 按钮回调
    // ============================================================
    onClickStart(): void {
        const save = SaveSystem.data;
        const mgr = GameManager.instance;
        if (!mgr) return;
        if (save.tutorialStep === 0) { mgr.startTutorial1(); return; }
        if (save.tutorialStep === 1) {
            this.showTalentSelect((tid) => mgr.startTutorial2(tid));
            return;
        }
        this.showTalentSelect((tid) => mgr.startRun(tid));
    }

    private showTalentSelect(onSelect: (talentId: string) => void): void {
        if (this.talentView) this.talentView.show(onSelect);
        else onSelect('');
    }

    onClickSkin(): void { /* P1 */ }
    onClickLevelSelect(): void { /* P1 */ }
    onClickSettings(): void { /* P1 */ }
}