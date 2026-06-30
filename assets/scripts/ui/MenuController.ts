import {
    _decorator,
    assetManager,
    Button,
    Color,
    Component,
    director,
    Graphics,
    ImageAsset,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { GameManager } from '../core/GameManager';
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';
import { TalentSelectView } from './TalentSelectView';

const { ccclass } = _decorator;

const LOGIN_UUID = 'd77b3fdd-e7a8-42b9-a558-96a59279cf00';

@ccclass('MenuController')
export class MenuController extends Component {
    private startButton: Node | null = null;
    private skinButton: Node | null = null;
    private coinLabel: Label | null = null;
    private bestLabel: Label | null = null;
    private talentView: TalentSelectView | null = null;

    async start(): Promise<void> {
        SaveSystem.load();

        // 如果还没看过漫画，先跳转到漫画场景
        if (!SaveSystem.data.hasSeenComic) {
            director.loadScene(SceneNames.Comic);
            return;
        }

        try {
            await this.loadLoginBg();
        } catch (err) {
            console.warn('[Menu] 登录背景图加载失败', err);
        }
        this.ensureUi();
        this.refreshUi();
    }

    private async loadLoginBg(): Promise<void> {
        const spriteFrame = await new Promise<SpriteFrame>((resolve, reject) => {
            assetManager.loadAny({ uuid: LOGIN_UUID }, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error('加载登录图片失败'));
                    return;
                }
                const imageAsset = asset as ImageAsset;
                const texture = new Texture2D();
                texture.image = imageAsset;
                const sf = new SpriteFrame();
                sf.texture = texture;
                resolve(sf);
            });
        });

        const canvas = this.node;
        const oldBg = canvas.getChildByName('LoginBg');
        if (oldBg) oldBg.destroy();

        const bgNode = new Node('LoginBg');
        canvas.addChild(bgNode);
        bgNode.setPosition(0, 0, -10);
        bgNode.addComponent(UITransform).setContentSize(720, 1280);
        const sprite = bgNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private ensureUi(): void {
        const canvas = this.node;

        // 标题
        this.ensureTitle(canvas);

        // 金币显示（右上角）
        if (!this.coinLabel) {
            const coinNode = new Node('CoinLabel');
            canvas.addChild(coinNode);
            coinNode.setPosition(DESIGN_WIDTH / 2 - 100, DESIGN_HEIGHT / 2 - 60, 0);
            coinNode.addComponent(UITransform).setContentSize(180, 40);
            const label = coinNode.addComponent(Label);
            label.fontSize = 26;
            label.lineHeight = 32;
            label.color = new Color(255, 215, 0, 255);
            label.horizontalAlign = Label.HorizontalAlign.RIGHT;
            label.useSystemFont = true;
            this.coinLabel = label;
        }

        // 最佳记录（金币下方）
        if (!this.bestLabel) {
            const bestNode = new Node('BestLabel');
            canvas.addChild(bestNode);
            bestNode.setPosition(DESIGN_WIDTH / 2 - 100, DESIGN_HEIGHT / 2 - 100, 0);
            bestNode.addComponent(UITransform).setContentSize(180, 30);
            const label = bestNode.addComponent(Label);
            label.fontSize = 18;
            label.lineHeight = 24;
            label.color = new Color(200, 200, 200, 200);
            label.horizontalAlign = Label.HorizontalAlign.RIGHT;
            label.useSystemFont = true;
            this.bestLabel = label;
        }

        // 开始游戏按钮
        if (!this.startButton) {
            const btnNode = new Node('StartButton');
            canvas.addChild(btnNode);
            btnNode.setPosition(0, -200, 0);
            btnNode.addComponent(UITransform).setContentSize(280, 80);
            const btn = btnNode.addComponent(Button);
            btn.transition = Button.Transition.SCALE;
            btn.zoomScale = 1.08;
            btnNode.on(Button.EventType.CLICK, this.onClickStart, this);

            // 按钮背景
            const bgNode = new Node('Bg');
            btnNode.addChild(bgNode);
            bgNode.setPosition(0, 0, -1);
            bgNode.addComponent(UITransform).setContentSize(280, 80);
            const bgGfx = bgNode.addComponent(Graphics);
            bgGfx.fillColor = new Color(60, 40, 20, 230);
            bgGfx.roundRect(-140, -40, 280, 80, 12);
            bgGfx.fill();
            bgGfx.strokeColor = new Color(255, 200, 100, 255);
            bgGfx.lineWidth = 3;
            bgGfx.roundRect(-140, -40, 280, 80, 12);
            bgGfx.stroke();

            const labelNode = new Node('Label');
            btnNode.addChild(labelNode);
            labelNode.addComponent(UITransform).setContentSize(280, 80);
            const label = labelNode.addComponent(Label);
            label.string = '开始偷奶酪';
            label.fontSize = 34;
            label.lineHeight = 42;
            label.color = new Color(255, 240, 200, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.useSystemFont = true;

            this.startButton = btnNode;
        }

        // 皮肤按钮
        if (!this.skinButton) {
            const btnNode = new Node('SkinButton');
            canvas.addChild(btnNode);
            btnNode.setPosition(0, -300, 0);
            btnNode.addComponent(UITransform).setContentSize(220, 60);
            const btn = btnNode.addComponent(Button);
            btn.transition = Button.Transition.SCALE;
            btn.zoomScale = 1.05;
            btnNode.on(Button.EventType.CLICK, this.onClickSkin, this);

            const bgNode = new Node('Bg');
            btnNode.addChild(bgNode);
            bgNode.setPosition(0, 0, -1);
            bgNode.addComponent(UITransform).setContentSize(220, 60);
            const bgGfx = bgNode.addComponent(Graphics);
            bgGfx.fillColor = new Color(40, 40, 50, 200);
            bgGfx.roundRect(-110, -30, 220, 60, 10);
            bgGfx.fill();
            bgGfx.strokeColor = new Color(150, 150, 180, 200);
            bgGfx.lineWidth = 2;
            bgGfx.roundRect(-110, -30, 220, 60, 10);
            bgGfx.stroke();

            const labelNode = new Node('Label');
            btnNode.addChild(labelNode);
            labelNode.addComponent(UITransform).setContentSize(220, 60);
            const label = labelNode.addComponent(Label);
            label.string = '皮肤 (即将推出)';
            label.fontSize = 24;
            label.lineHeight = 30;
            label.color = new Color(200, 200, 220, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.useSystemFont = true;

            this.skinButton = btnNode;
        }

        // 天赋选择组件（隐藏）
        if (!this.talentView) {
            const tvNode = new Node('TalentSelectView');
            canvas.addChild(tvNode);
            this.talentView = tvNode.addComponent(TalentSelectView);
        }
    }

    private ensureTitle(canvas: Node): void {
        if (canvas.getChildByName('GameTitle')) return;
        const titleNode = new Node('GameTitle');
        canvas.addChild(titleNode);
        titleNode.setPosition(0, DESIGN_HEIGHT / 2 - 160, 0);
        titleNode.addComponent(UITransform).setContentSize(500, 80);
        const label = titleNode.addComponent(Label);
        label.string = '肥猫莫追我';
        label.fontSize = 52;
        label.lineHeight = 60;
        label.color = new Color(255, 255, 255, 240);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.useSystemFont = true;
        // 标题描边效果（用阴影模拟）
        const shadowNode = new Node('Shadow');
        titleNode.addChild(shadowNode);
        shadowNode.setPosition(2, -2, -1);
        shadowNode.addComponent(UITransform).setContentSize(500, 80);
        const shadowLabel = shadowNode.addComponent(Label);
        shadowLabel.string = '肥猫莫追我';
        shadowLabel.fontSize = 52;
        shadowLabel.lineHeight = 60;
        shadowLabel.color = new Color(0, 0, 0, 180);
        shadowLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        shadowLabel.verticalAlign = Label.VerticalAlign.CENTER;
        shadowLabel.useSystemFont = true;
    }

    private refreshUi(): void {
        if (this.coinLabel) {
            this.coinLabel.string = `🧀 ${SaveSystem.data.coins}`;
        }
        if (this.bestLabel) {
            const best = SaveSystem.data.bestFoodSingleRun ?? 0;
            this.bestLabel.string = best > 0 ? `最佳 ${best} 块奶酪` : '';
        }
    }

    onClickStart(): void {
        const save = SaveSystem.data;
        const manager = GameManager.instance;
        if (!manager) return;

        // 引导阶段判断
        if (save.tutorialStep === 0) {
            // 引导第1关：房间1，无天赋
            manager.startTutorial1();
            return;
        }

        if (save.tutorialStep === 1) {
            // 引导第2关：房间1→房间2，选天赋
            this.showTalentSelect((talentId) => {
                manager.startTutorial2(talentId);
            });
            return;
        }

        // 正式跑酷：选天赋后开始
        this.showTalentSelect((talentId) => {
            manager.startRun(talentId);
        });
    }

    private showTalentSelect(onSelect: (talentId: string) => void): void {
        if (this.talentView) {
            this.talentView.show(onSelect);
        } else {
            onSelect('');
        }
    }

    onClickSkin(): void {
        // 皮肤商店待实现
        console.log('[Menu] 皮肤商店待实现');
    }
}
