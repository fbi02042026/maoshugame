import {
    _decorator,
    assetManager,
    Button,
    Color,
    Component,
    director,
    ImageAsset,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { DESIGN_HEIGHT } from '../core/DesignConstants';
import { GameManager } from '../core/GameManager';
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';
import { CHAPTERS } from '../data/ChapterTypes';
import { TalentSelectView } from './TalentSelectView';

const { ccclass } = _decorator;

const LOGIN_UUID = 'd77b3fdd-e7a8-42b9-a558-96a59279cf00';

@ccclass('MenuController')
export class MenuController extends Component {
    private startButton: Node | null = null;
    private shopButton: Node | null = null;
    private coinLabel: Label | null = null;
    private talentView: TalentSelectView | null = null;

    async start(): Promise<void> {
        SaveSystem.load();
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

        // 金币显示（左上角）
        if (!this.coinLabel) {
            const coinNode = new Node('CoinLabel');
            canvas.addChild(coinNode);
            coinNode.setPosition(-DESIGN_HEIGHT * 0.5 + 120, DESIGN_HEIGHT * 0.5 - 60, 0);
            coinNode.addComponent(UITransform).setContentSize(200, 40);
            const label = coinNode.addComponent(Label);
            label.fontSize = 24;
            label.lineHeight = 30;
            label.color = new Color(255, 215, 0, 255);
            label.horizontalAlign = Label.HorizontalAlign.LEFT;
            this.coinLabel = label;
        }

        // 开始游戏按钮
        if (!this.startButton) {
            const btnNode = new Node('StartButton');
            canvas.addChild(btnNode);
            btnNode.setPosition(0, -40, 0);
            btnNode.addComponent(UITransform).setContentSize(260, 72);
            const btn = btnNode.addComponent(Button);
            btn.transition = Button.Transition.SCALE;
            btn.zoomScale = 1.05;
            btnNode.on(Button.EventType.CLICK, this.onClickStart, this);

            const bgNode = new Node('Bg');
            btnNode.addChild(bgNode);
            bgNode.setPosition(0, 0, -1);
            const bgGfx = bgNode.addComponent(Graphics);
            bgGfx.fillColor = new Color(30, 30, 30, 220);
            bgGfx.roundRect(-130, -36, 260, 72, 8);
            bgGfx.fill();

            const labelNode = new Node('Label');
            btnNode.addChild(labelNode);
            labelNode.addComponent(UITransform).setContentSize(260, 72);
            const label = labelNode.addComponent(Label);
            label.string = '开始游戏';
            label.fontSize = 32;
            label.lineHeight = 40;
            label.color = new Color(255, 255, 255, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;

            this.startButton = btnNode;
        }

        // 商店/购买下一章按钮
        if (!this.shopButton) {
            const btnNode = new Node('ShopButton');
            canvas.addChild(btnNode);
            btnNode.setPosition(0, -130, 0);
            btnNode.addComponent(UITransform).setContentSize(260, 56);
            const btn = btnNode.addComponent(Button);
            btn.transition = Button.Transition.SCALE;
            btn.zoomScale = 1.05;
            btnNode.on(Button.EventType.CLICK, this.onClickShop, this);

            const bgNode = new Node('Bg');
            btnNode.addChild(bgNode);
            bgNode.setPosition(0, 0, -1);
            const bgGfx = bgNode.addComponent(Graphics);
            bgGfx.fillColor = new Color(60, 40, 20, 200);
            bgGfx.roundRect(-130, -28, 260, 56, 8);
            bgGfx.fill();

            const labelNode = new Node('Label');
            btnNode.addChild(labelNode);
            labelNode.addComponent(UITransform).setContentSize(260, 56);
            const label = labelNode.addComponent(Label);
            label.string = '商店';
            label.fontSize = 24;
            label.lineHeight = 30;
            label.color = new Color(255, 200, 100, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;

            this.shopButton = btnNode;
        }

        // 天赋选择组件
        if (!this.talentView) {
            const tvNode = new Node('TalentSelectView');
            canvas.addChild(tvNode);
            this.talentView = tvNode.addComponent(TalentSelectView);
        }
    }

    private refreshUi(): void {
        if (this.coinLabel) {
            this.coinLabel.string = `💰 ${SaveSystem.data.coins}`;
        }
        if (this.shopButton) {
            const label = this.shopButton.getChildByName('Label')?.getComponent(Label);
            if (label) {
                const nextChapter = SaveSystem.data.unlockedChapter;
                const nextConfig = CHAPTERS.find((c) => c.id === nextChapter);
                if (nextConfig && nextConfig.id > 2) {
                    label.string = `解锁下一章 💰${nextConfig.rewardCoins}`;
                } else {
                    label.string = '商店';
                }
            }
        }
    }

    onClickStart(): void {
        const save = SaveSystem.data;
        const manager = GameManager.instance;
        if (!manager) return;

        // 引导阶段判断
        if (save.tutorialStep === 0) {
            // 引导第1关：章节0，无天赋
            manager.startChapter(0);
            return;
        }

        if (save.tutorialStep === 1) {
            // 引导第2关：章节1，开始选天赋
            this.showTalentSelect((talentId) => {
                manager.startChapter(1);
                if (manager.chapterProgress) {
                    manager.chapterProgress.selectedTalentId = talentId;
                }
            });
            return;
        }

        // 正式游戏：选天赋后进最新解锁的章节
        const latestChapter = Math.max(2, save.unlockedChapter - 1);
        this.showTalentSelect((talentId) => {
            manager.startChapter(latestChapter);
            if (manager.chapterProgress) {
                manager.chapterProgress.selectedTalentId = talentId;
            }
        });
    }

    private showTalentSelect(onSelect: (talentId: string) => void): void {
        if (this.talentView) {
            this.talentView.show(onSelect);
        } else {
            //  fallback：直接开始
            onSelect('');
        }
    }

    onClickShop(): void {
        const save = SaveSystem.data;
        const nextChapterId = save.unlockedChapter;
        const nextConfig = CHAPTERS.find((c) => c.id === nextChapterId);

        if (nextConfig && nextConfig.id > 2) {
            const cost = nextConfig.rewardCoins;
            if (SaveSystem.spendCoins(cost)) {
                SaveSystem.unlockChapter(nextChapterId + 1);
                this.refreshUi();
                console.log(`[Menu] 解锁章节 ${nextConfig.name}，花费 ${cost} 金币`);
            } else {
                console.log('[Menu] 金币不足');
            }
        } else {
            // TODO: 打开皮肤商店
            console.log('[Menu] 打开商店（待实现）');
        }
    }
}
