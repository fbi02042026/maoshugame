import { _decorator, Button, Color, Component, director, Label, Node, UITransform } from 'cc';
import '../core/AppInit';
import { GameManager } from '../core/GameManager';
import { SceneNames } from '../core/SceneNames';

const { ccclass } = _decorator;

@ccclass('BootController')
export class BootController extends Component {
    private statusLabel: Label | null = null;

    async start(): Promise<void> {
        this.ensureStatusLabel();
        this.setStatus('加载配置…');
        const manager = this.ensureManager();
        try {
            await manager.bootstrap();
            this.setStatus('进入主菜单…');
            director.loadScene(SceneNames.Menu);
        } catch (err) {
            console.error('[BootController] 启动失败', err);
            this.setStatus('加载失败，请检查 resources/config');
        }
    }

    private ensureStatusLabel(): void {
        if (this.statusLabel) {
            return;
        }
        const canvas = this.node;
        const labelNode = new Node('StatusLabel');
        canvas.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(400, 60);
        const label = labelNode.addComponent(Label);
        label.string = '启动中…';
        label.fontSize = 28;
        label.lineHeight = 32;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        this.statusLabel = label;
    }

    private ensureManager(): GameManager {
        let manager = GameManager.instance;
        if (manager) {
            return manager;
        }
        let node = this.node.scene.getChildByName('GameManager');
        if (!node) {
            node = new Node('GameManager');
            this.node.scene.addChild(node);
        }
        manager = node.getComponent(GameManager) ?? node.addComponent(GameManager);
        return manager;
    }

    private setStatus(text: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
    }
}
