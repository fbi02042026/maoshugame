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
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';

const { ccclass } = _decorator;

const LOGIN_UUID = 'd77b3fdd-e7a8-42b9-a558-96a59279cf00';

@ccclass('MenuController')
export class MenuController extends Component {
    private titleLabel: Label | null = null;
    private progressLabel: Label | null = null;
    private startButton: Node | null = null;

    async start(): Promise<void> {
        SaveSystem.load();
        this.ensureUi();
        this.refreshUi();
        try {
            await this.loadLoginBg();
        } catch (err) {
            console.warn('[Menu] 登录背景图加载失败', err);
        }
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
        // 删除旧的背景（如果有）
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

    onClickStart(): void {
        // DEBUG: 测试阶段强制每次进入片头漫画
        director.loadScene(SceneNames.Comic);
    }

    private ensureUi(): void {
        const canvas = this.node;
        if (!this.titleLabel) {
            const titleNode = new Node('TitleLabel');
            canvas.addChild(titleNode);
            titleNode.setPosition(0, DESIGN_HEIGHT * 0.18, 0);
            titleNode.addComponent(UITransform).setContentSize(520, 90);
            const label = titleNode.addComponent(Label);
            label.fontSize = 46;
            label.lineHeight = 54;
            label.color = new Color(255, 200, 80, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.titleLabel = label;
        }
        if (!this.progressLabel) {
            const progressNode = new Node('ProgressLabel');
            canvas.addChild(progressNode);
            progressNode.setPosition(0, DESIGN_HEIGHT * 0.1, 0);
            progressNode.addComponent(UITransform).setContentSize(520, 48);
            const label = progressNode.addComponent(Label);
            label.fontSize = 22;
            label.lineHeight = 28;
            label.color = new Color(220, 220, 220, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.progressLabel = label;
        }
        if (!this.startButton) {
            const buttonNode = new Node('StartButton');
            canvas.addChild(buttonNode);
            buttonNode.setPosition(0, -40, 0);
            buttonNode.addComponent(UITransform).setContentSize(220, 64);
            const button = buttonNode.addComponent(Button);
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 1.05;
            buttonNode.on(Button.EventType.CLICK, this.onClickStart, this);

            const labelNode = new Node('Label');
            buttonNode.addChild(labelNode);
            labelNode.addComponent(UITransform).setContentSize(220, 64);
            const label = labelNode.addComponent(Label);
            label.string = '开始游戏';
            label.fontSize = 30;
            label.lineHeight = 36;
            label.color = new Color(255, 255, 255, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            this.startButton = buttonNode;
        }
    }

    private refreshUi(): void {
        const save = SaveSystem.data;
        if (this.titleLabel) {
            this.titleLabel.string = '肥猫莫追我';
        }
        if (this.progressLabel) {
            this.progressLabel.string = `已解锁 ${save.maxUnlocked}/8 关 · 皮肤 ${save.unlockedSkins.length}`;
        }
    }
}