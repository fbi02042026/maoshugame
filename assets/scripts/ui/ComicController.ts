import {
    _decorator,
    assetManager,
    Button,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    tween,
    UITransform,
    UIOpacity,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';

const { ccclass } = _decorator;

const COMIC_UUIDS = [
    'f236f7e4-dd14-4ba6-b92b-d1c194be5813',
    '73c47810-201b-4e58-acb9-bfb4084371c0',
    '67fa05a1-a1d2-47c8-b417-721db6ef34f2',
    '1fb8f8dc-6879-491c-b179-d425044aa127',
    'daffc5c1-f858-43e3-bc01-d98055a69ed2',
    '638edc53-b9cb-4015-921c-7e4b9e33e13b',
];

/** 每格统一间隔：1.5s × 1.3 = 1.95s */
const PANEL_INTERVAL = 1.95;
const FADE_TIME = 0.5;

function loadSpriteFrameFromUuid(uuid: string): Promise<SpriteFrame> {
    // 优先加载对应的 SpriteFrame 子资源（带 @6c48a），避免手动构造导致 UV 数据缺失
    const sfUuid = uuid.includes('@') ? uuid : `${uuid}@6c48a`;
    return new Promise((resolve, reject) => {
        assetManager.loadAny({ uuid: sfUuid }, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`无法加载 SpriteFrame: ${sfUuid}`));
                return;
            }
            resolve(asset as SpriteFrame);
        });
    });
}

@ccclass('ComicController')
export class ComicController extends Component {
    private comicNodes: Node[] = [];
    private nextButton: Node | null = null;
    private startButton: Node | null = null;
    private isPlaying = false;

    async start(): Promise<void> {
        try {
            await this.loadComicImages();
            this.playFirstPage();
        } catch (err) {
            console.error('[ComicController] 加载片头漫画失败', err);
            this.skipToGame();
        }
    }

    private async loadComicImages(): Promise<void> {
        const canvas = this.node;
        for (let i = 0; i < COMIC_UUIDS.length; i += 1) {
            const spriteFrame = await loadSpriteFrameFromUuid(COMIC_UUIDS[i]);
            const node = new Node(`Comic_${i + 1}`);
            canvas.addChild(node);
            node.setPosition(0, 0, 0);
            const ui = node.addComponent(UITransform);
            ui.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
            const sprite = node.addComponent(Sprite);
            if (spriteFrame && spriteFrame.texture) {
                sprite.spriteFrame = spriteFrame;
            }
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 0;
            this.comicNodes.push(node);
        }
    }

    private playFirstPage(): void {
        if (this.isPlaying) return;
        this.isPlaying = true;

        const [n1, n2, n3, n4] = this.comicNodes;
        const op1 = n1.getComponent(UIOpacity)!;
        const op2 = n2.getComponent(UIOpacity)!;
        const op3 = n3.getComponent(UIOpacity)!;
        const op4 = n4.getComponent(UIOpacity)!;

        // 每格独立延迟启动，统一 1.95 秒间隔
        tween(op1).delay(0).to(FADE_TIME, { opacity: 255 }).start();
        tween(op2).delay(PANEL_INTERVAL).to(FADE_TIME, { opacity: 255 }).start();
        tween(op3).delay(PANEL_INTERVAL * 2).to(FADE_TIME, { opacity: 255 }).start();
        tween(op4)
            .delay(PANEL_INTERVAL * 3)
            .to(FADE_TIME, { opacity: 255 })
            .call(() => this.showNextButton())
            .start();
    }

    private showNextButton(): void {
        console.log('[Comic] 第一页播完，显示"下一步"按钮');
        const canvas = this.node;
        const btnNode = new Node('NextButton');
        canvas.addChild(btnNode);
        btnNode.setPosition(DESIGN_WIDTH / 2 - 130, -DESIGN_HEIGHT / 2 + 100, 0);
        btnNode.addComponent(UITransform).setContentSize(220, 64);
        const btn = btnNode.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 1.05;
        btnNode.on(Button.EventType.CLICK, this.onClickNext, this);

        // 黑底
        const bgNode = new Node('Bg');
        btnNode.addChild(bgNode);
        bgNode.setPosition(0, 0, -1);
        const bgGfx = bgNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(30, 30, 30, 220);
        bgGfx.roundRect(-110, -32, 220, 64, 8);
        bgGfx.fill();

        const labelNode = new Node('Label');
        btnNode.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(220, 64);
        const label = labelNode.addComponent(Label);
        label.string = '下一步';
        label.fontSize = 30;
        label.lineHeight = 36;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const opacity = btnNode.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(FADE_TIME, { opacity: 255 }).start();

        this.nextButton = btnNode;
    }

    private onClickNext(): void {
        if (this.nextButton) {
            this.nextButton.destroy();
            this.nextButton = null;
        }

        const [n1, n2, n3, n4, n5, n6] = this.comicNodes;
        const op1 = n1.getComponent(UIOpacity)!;
        const op2 = n2.getComponent(UIOpacity)!;
        const op3 = n3.getComponent(UIOpacity)!;
        const op4 = n4.getComponent(UIOpacity)!;
        const op5 = n5.getComponent(UIOpacity)!;
        const op6 = n6.getComponent(UIOpacity)!;

        // 图1-4 同时淡出，然后图5-6 逐个淡入
        tween(op1).to(FADE_TIME, { opacity: 0 }).start();
        tween(op2).to(FADE_TIME, { opacity: 0 }).start();
        tween(op3).to(FADE_TIME, { opacity: 0 }).start();
        tween(op4)
            .to(FADE_TIME, { opacity: 0 })
            .call(() => {
                tween(op5).delay(0).to(FADE_TIME, { opacity: 255 }).start();
                tween(op6)
                    .delay(PANEL_INTERVAL)
                    .to(FADE_TIME, { opacity: 255 })
                    .call(() => this.showStartButton())
                    .start();
            })
            .start();
    }

    private showStartButton(): void {
        console.log('[Comic] 第二页播完，显示"开始游戏"按钮');
        const canvas = this.node;
        const btnNode = new Node('StartButton');
        canvas.addChild(btnNode);
        btnNode.setPosition(DESIGN_WIDTH / 2 - 130, -DESIGN_HEIGHT / 2 + 100, 0);
        btnNode.addComponent(UITransform).setContentSize(260, 76);
        const btn = btnNode.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 1.05;
        btnNode.on(Button.EventType.CLICK, this.onClickStart, this);

        // 底框
        const bgNode = new Node('Bg');
        btnNode.addChild(bgNode);
        bgNode.setPosition(0, 0, -1);
        const bgGfx = bgNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(30, 30, 30, 220);
        bgGfx.roundRect(-130, -38, 260, 76, 8);
        bgGfx.fill();

        const labelNode = new Node('Label');
        btnNode.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(260, 76);
        const label = labelNode.addComponent(Label);
        label.string = '开始游戏';
        label.fontSize = 32;
        label.lineHeight = 40;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const opacity = btnNode.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(FADE_TIME, { opacity: 255 }).start();

        this.startButton = btnNode;
    }

    private onClickStart(): void {
        SaveSystem.data.hasSeenComic = true;
        SaveSystem.save();
        // 漫画结束后回到主菜单（老鼠洞界面）
        director.loadScene(SceneNames.Menu);
    }

    private skipToGame(): void {
        SaveSystem.data.hasSeenComic = true;
        SaveSystem.save();
        director.loadScene(SceneNames.Menu);
    }
}