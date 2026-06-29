import {
    _decorator,
    Button,
    Color,
    Component,
    Label,
    Node,
    UITransform,
} from 'cc';

const { ccclass } = _decorator;

export interface ResultCallbacks {
    onNext?: () => void;
    onRetry?: () => void;
    onMenu?: () => void;
}

/** 通关 / 失败结算层（对照浏览器 endGame） */
@ccclass('GameResultOverlay')
export class GameResultOverlay extends Component {
    private panel: Node | null = null;
    private titleLabel: Label | null = null;
    private detailLabel: Label | null = null;
    private btnNext: Node | null = null;
    private btnRetry: Node | null = null;
    private btnMenu: Node | null = null;
    private _cb: ResultCallbacks | null = null;

    ensure(parent: Node): void {
        if (this.panel) return;

        this.panel = new Node('ResultPanel');
        parent.addChild(this.panel);
        this.panel.setSiblingIndex(500);
        this.panel.active = false;

        const titleNode = new Node('Title');
        this.panel.addChild(titleNode);
        titleNode.setPosition(0, 120, 0);
        titleNode.addComponent(UITransform).setContentSize(600, 80);
        this.titleLabel = titleNode.addComponent(Label);
        this.titleLabel.fontSize = 44;
        this.titleLabel.lineHeight = 50;
        this.titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.titleLabel.useSystemFont = true;

        const detailNode = new Node('Detail');
        this.panel.addChild(detailNode);
        detailNode.setPosition(0, 50, 0);
        detailNode.addComponent(UITransform).setContentSize(600, 50);
        this.detailLabel = detailNode.addComponent(Label);
        this.detailLabel.fontSize = 24;
        this.detailLabel.lineHeight = 30;
        this.detailLabel.color = new Color(220, 220, 220, 255);
        this.detailLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.detailLabel.useSystemFont = true;

        this.btnNext = this.makeButton('下一关', 0, -40, () => this._cb?.onNext?.());
        this.btnRetry = this.makeButton('重试', 0, -120, () => this._cb?.onRetry?.());
        this.btnMenu = this.makeButton('返回菜单', 0, -200, () => this._cb?.onMenu?.());
    }

    private makeButton(text: string, x: number, y: number, fn: () => void): Node {
        const node = new Node(`Btn_${text}`);
        this.panel!.addChild(node);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(240, 56);
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        node.on(Button.EventType.CLICK, fn, this);

        const labelNode = new Node('Label');
        node.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(240, 56);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 28;
        label.lineHeight = 32;
        label.color = new Color(40, 40, 40, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.useSystemFont = true;
        return node;
    }

    showWin(title: string, detail: string, cb: ResultCallbacks): void {
        this._cb = cb;
        if (this.titleLabel) {
            this.titleLabel.string = title;
            this.titleLabel.color = new Color(255, 215, 0, 255);
        }
        if (this.detailLabel) {
            this.detailLabel.string = detail;
        }
        if (this.panel) this.panel.active = true;
        if (this.btnNext) this.btnNext.active = true;
        if (this.btnRetry) this.btnRetry.setPosition(0, -120, 0);
    }

    showLose(title: string, detail: string, cb: ResultCallbacks): void {
        this._cb = cb;
        if (this.titleLabel) {
            this.titleLabel.string = title;
            this.titleLabel.color = new Color(255, 100, 100, 255);
        }
        if (this.detailLabel) {
            this.detailLabel.string = detail;
        }
        if (this.panel) this.panel.active = true;
        if (this.btnNext) this.btnNext.active = false;
        if (this.btnRetry) this.btnRetry.setPosition(0, -40, 0);
    }

    hide(): void {
        if (this.panel) this.panel.active = false;
    }
}
