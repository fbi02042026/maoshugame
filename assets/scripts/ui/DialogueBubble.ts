import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';

const { ccclass } = _decorator;

export type DialogueSpeaker = 'sage' | 'hamster' | 'cat' | 'system';

interface DialogueConfig {
    speaker: DialogueSpeaker;
    text: string;
    duration: number;
}

const SPEAKER_STYLE: Record<DialogueSpeaker, {
    name: string;
    icon: string;
    bgColor: Color;
    borderColor: Color;
    textColor: Color;
}> = {
    sage: {
        name: '仙人',
        icon: '🧙',
        bgColor: new Color(80, 60, 120, 230),
        borderColor: new Color(200, 180, 255, 255),
        textColor: new Color(255, 255, 255, 255),
    },
    hamster: {
        name: '鼠',
        icon: '🐭',
        bgColor: new Color(100, 80, 50, 220),
        borderColor: new Color(220, 200, 160, 255),
        textColor: new Color(255, 255, 255, 255),
    },
    cat: {
        name: '猫',
        icon: '🐱',
        bgColor: new Color(120, 70, 70, 220),
        borderColor: new Color(255, 180, 180, 255),
        textColor: new Color(255, 255, 255, 255),
    },
    system: {
        name: '',
        icon: '💡',
        bgColor: new Color(30, 30, 30, 200),
        borderColor: new Color(255, 215, 0, 255),
        textColor: new Color(255, 255, 200, 255),
    },
};

@ccclass('DialogueBubble')
export class DialogueBubble extends Component {
    private _panel: Node | null = null;
    private _textLabel: Label | null = null;
    private _iconLabel: Label | null = null;
    private _nameLabel: Label | null = null;
    private _timer = 0;
    private _duration = 0;
    private _queue: DialogueConfig[] = [];
    private _showing = false;

    /**
     * 显示对话气泡
     * @param speaker 说话者
     * @param text 内容
     * @param duration 显示时长（秒），默认3秒
     */
    show(speaker: DialogueSpeaker, text: string, duration = 3): void {
        this._queue.push({ speaker, text, duration });
        if (!this._showing) {
            this.showNext();
        }
    }

    /** 立刻显示并清空队列 */
    showImmediate(speaker: DialogueSpeaker, text: string, duration = 3): void {
        this._queue = [];
        this._queue.push({ speaker, text, duration });
        this._showing = false;
        this.showNext();
    }

    hide(): void {
        this._queue = [];
        this._showing = false;
        if (this._panel) {
            this._panel.active = false;
        }
    }

    update(dt: number): void {
        if (!this._showing || !this._panel || !this._panel.active) return;

        this._timer -= dt;
        if (this._timer <= 0) {
            this._panel.active = false;
            this._showing = false;
            // 显示队列中下一条
            if (this._queue.length > 0) {
                this.showNext();
            }
        }
    }

    private showNext(): void {
        if (this._queue.length === 0) return;
        const cfg = this._queue.shift()!;
        this.ensurePanel();
        if (!this._panel) return;

        const style = SPEAKER_STYLE[cfg.speaker];

        this._panel.active = true;
        this._panel.opacity = 255;
        this._timer = cfg.duration;
        this._duration = cfg.duration;
        this._showing = true;

        if (this._textLabel) {
            this._textLabel.string = cfg.text;
            this._textLabel.color = style.textColor;
        }
        if (this._iconLabel) {
            this._iconLabel.string = style.icon;
        }
        if (this._nameLabel) {
            if (cfg.speaker === 'system') {
                this._nameLabel.node.active = false;
            } else {
                this._nameLabel.node.active = true;
                this._nameLabel.string = style.name;
                this._nameLabel.color = style.borderColor;
            }
        }

        // 更新背景颜色
        const bg = this._panel.getChildByName('Bg')?.getComponent(Graphics);
        if (bg) {
            this.drawBubble(bg, style.bgColor, style.borderColor);
        }

        // 根据对话长度自适应宽度
        const maxWidth = DESIGN_WIDTH * 0.75;
        const minWidth = 280;
        const charCount = cfg.text.length;
        const estimatedWidth = Math.max(minWidth, Math.min(maxWidth, charCount * 22 + 80));
        const bubbleH = 90;

        const ut = this._panel.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(estimatedWidth, bubbleH);
        }

        // 系统提示居中，其他靠下
        if (cfg.speaker === 'system') {
            this._panel.setPosition(0, DESIGN_HEIGHT * 0.25, 0);
        } else {
            this._panel.setPosition(0, -DESIGN_HEIGHT * 0.3, 0);
        }
    }

    private drawBubble(gfx: Graphics, bg: Color, border: Color): void {
        const ut = gfx.node.parent?.getComponent(UITransform);
        const w = ut?.width ?? 400;
        const h = ut?.height ?? 90;
        const r = 12;

        gfx.clear();

        // 主体圆角矩形
        gfx.fillColor = bg;
        gfx.roundRect(-w / 2, -h / 2 + 10, w, h - 10, r);
        gfx.fill();

        // 边框
        gfx.strokeColor = border;
        gfx.lineWidth = 2;
        gfx.roundRect(-w / 2, -h / 2 + 10, w, h - 10, r);
        gfx.stroke();

        // 小三角（尾巴指向角色方向，简单画在底部）
        gfx.fillColor = bg;
        gfx.moveTo(-10, -h / 2 + 10);
        gfx.lineTo(0, -h / 2);
        gfx.lineTo(10, -h / 2 + 10);
        gfx.close();
        gfx.fill();
        gfx.strokeColor = border;
        gfx.moveTo(-10, -h / 2 + 10);
        gfx.lineTo(0, -h / 2);
        gfx.lineTo(10, -h / 2 + 10);
        gfx.stroke();
    }

    private ensurePanel(): void {
        if (this._panel) return;

        const canvas = this.node;

        const panel = new Node('DialogueBubble');
        canvas.addChild(panel);
        panel.setPosition(0, -DESIGN_HEIGHT * 0.3, 150);
        panel.addComponent(UITransform).setContentSize(400, 90);
        this._panel = panel;

        // 背景
        const bgNode = new Node('Bg');
        panel.addChild(bgNode);
        bgNode.setPosition(0, 0, -1);
        bgNode.addComponent(UITransform).setContentSize(400, 90);
        bgNode.addComponent(Graphics);

        // 头像/图标
        const iconNode = new Node('Icon');
        panel.addChild(iconNode);
        iconNode.setPosition(-160, 10, 0);
        iconNode.addComponent(UITransform).setContentSize(50, 50);
        const iconLabel = iconNode.addComponent(Label);
        iconLabel.fontSize = 36;
        iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        iconLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this._iconLabel = iconLabel;

        // 名称
        const nameNode = new Node('Name');
        panel.addChild(nameNode);
        nameNode.setPosition(-110, 28, 0);
        nameNode.addComponent(UITransform).setContentSize(100, 24);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.fontSize = 18;
        nameLabel.lineHeight = 22;
        nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this._nameLabel = nameLabel;

        // 文字
        const textNode = new Node('Text');
        panel.addChild(textNode);
        textNode.setPosition(20, 0, 0);
        textNode.addComponent(UITransform).setContentSize(300, 50);
        const textLabel = textNode.addComponent(Label);
        textLabel.fontSize = 20;
        textLabel.lineHeight = 26;
        textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        textLabel.verticalAlign = Label.VerticalAlign.CENTER;
        textLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        this._textLabel = textLabel;

        panel.active = false;
    }
}
