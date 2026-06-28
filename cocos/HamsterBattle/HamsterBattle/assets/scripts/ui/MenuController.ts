import {
    _decorator,
    Button,
    Color,
    Component,
    director,
    Label,
    Node,
    UITransform,
} from 'cc';
import { DESIGN_HEIGHT } from '../core/DesignConstants';
import { GameManager } from '../core/GameManager';
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';

const { ccclass } = _decorator;

@ccclass('MenuController')
export class MenuController extends Component {
    private titleLabel: Label | null = null;
    private progressLabel: Label | null = null;
    private startButton: Node | null = null;

    start(): void {
        this.ensureUi();
        this.refreshUi();
    }

    onClickStart(): void {
        const manager = GameManager.instance;
        const levelId = manager?.currentLevel ?? SaveSystem.data.maxUnlocked;
        if (manager) {
            manager.goGame(Math.max(1, Math.min(levelId, SaveSystem.data.maxUnlocked)));
            return;
        }
        director.loadScene(SceneNames.Game);
    }

    private ensureUi(): void {
        const canvas = this.node;
        if (!this.titleLabel) {
            const titleNode = new Node('TitleLabel');
            canvas.addChild(titleNode);
            titleNode.setPosition(0, DESIGN_HEIGHT * 0.18, 0);
            titleNode.addComponent(UITransform).setContentSize(520, 90);
            const label = titleNode.addComponent(Label);
            label.fontSize = 42;
            label.lineHeight = 48;
            label.color = new Color(255, 230, 180, 255);
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
            label.color = new Color(40, 40, 40, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            this.startButton = buttonNode;
        }
    }

    private refreshUi(): void {
        const save = SaveSystem.data;
        if (this.titleLabel) {
            this.titleLabel.string = '仓鼠大作战';
        }
        if (this.progressLabel) {
            this.progressLabel.string = `已解锁 ${save.maxUnlocked}/8 关 · 皮肤 ${save.unlockedSkins.length}`;
        }
    }
}
