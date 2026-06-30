import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
    tween,
    Vec3,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';

const { ccclass } = _decorator;

type Phase = 'fade_in' | 'hold' | 'fade_out' | 'done';

@ccclass('TitleOverlay')
export class TitleOverlay extends Component {
    private _panel: Node | null = null;
    private _titleLabel: Label | null = null;
    private _subLabel: Label | null = null;
    private _phase: Phase = 'done';
    private _timer = 0;
    private _onDone: (() => void) | null = null;

    /**
     * 播放标题动画："飞奔的奶酪" 淡入→停留→淡出
     * @param title 主标题文字
     * @param subtitle 副标题文字（可选）
     * @param onDone 动画结束回调
     */
    show(title: string, subtitle?: string, onDone?: () => void): void {
        this._onDone = onDone ?? null;
        this.ensurePanel();
        if (!this._panel) return;

        this._panel.active = true;
        this._panel.setScale(0.8, 0.8, 1);
        this._panel.opacity = 0;

        if (this._titleLabel) {
            this._titleLabel.string = title;
        }
        if (this._subLabel) {
            if (subtitle) {
                this._subLabel.node.active = true;
                this._subLabel.string = subtitle;
            } else {
                this._subLabel.node.active = false;
            }
        }

        this._phase = 'fade_in';
        this._timer = 0;
    }

    /** 播放传送闪白+波纹效果 */
    showWarpEffect(onDone?: () => void): void {
        this.ensurePanel();
        if (!this._panel) return;

        this._panel.active = true;
        this._panel.setScale(1, 1, 1);
        this._panel.opacity = 255;
        if (this._titleLabel) this._titleLabel.node.active = false;
        if (this._subLabel) this._subLabel.node.active = false;

        // 闪白
        const bg = this._panel.getChildByName('Bg')?.getComponent(Graphics);
        if (bg) {
            bg.clear();
            bg.fillColor = new Color(255, 255, 255, 255);
            bg.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
            bg.fill();
        }

        this._phase = 'fade_out';
        this._timer = 0;

        tween(this._panel)
            .to(0.15, { scale: new Vec3(1, 1, 1) })
            .to(0.3, { opacity: 0 }, { easing: 'quadOut' })
            .call(() => {
                this._panel!.active = false;
                // 恢复背景遮罩为黑色，避免影响下次show
                if (bg) {
                    bg.clear();
                    bg.fillColor = new Color(0, 0, 0, 0);
                    bg.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
                    bg.fill();
                }
                if (this._titleLabel) this._titleLabel.node.active = true;
                if (this._subLabel) this._subLabel.node.active = true;
                this._phase = 'done';
                onDone?.();
            })
            .start();
    }

    /** 播放黑屏过渡 */
    showBlackFade(duration: number, onDone?: () => void): void {
        this.ensurePanel();
        if (!this._panel) return;

        this._panel.active = true;
        if (this._titleLabel) this._titleLabel.node.active = false;
        if (this._subLabel) this._subLabel.node.active = false;

        const bg = this._panel.getChildByName('Bg')?.getComponent(Graphics);
        if (bg) {
            bg.clear();
            bg.fillColor = new Color(0, 0, 0, 255);
            bg.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
            bg.fill();
        }

        this._panel.opacity = 0;
        tween(this._panel)
            .to(duration * 0.4, { opacity: 255 })
            .call(() => onDone?.())
            .to(duration * 0.6, { opacity: 0 })
            .call(() => {
                this._panel!.active = false;
                if (this._titleLabel) this._titleLabel.node.active = true;
                if (this._subLabel) this._subLabel.node.active = true;
            })
            .start();
    }

    update(dt: number): void {
        if (this._phase === 'done' || !this._panel) return;

        this._timer += dt;

        if (this._phase === 'fade_in') {
            // 0.5s 淡入+缩放
            const t = Math.min(1, this._timer / 0.5);
            this._panel.opacity = Math.floor(t * 255);
            const s = 0.8 + 0.2 * t;
            this._panel.setScale(s, s, 1);
            if (t >= 1) {
                this._phase = 'hold';
                this._timer = 0;
            }
        } else if (this._phase === 'hold') {
            // 停留1s
            if (this._timer >= 1.0) {
                this._phase = 'fade_out';
                this._timer = 0;
            }
        } else if (this._phase === 'fade_out' && this._titleLabel?.node.active) {
            // 0.5s 淡出（仅标题模式，闪白模式用tween）
            const t = Math.min(1, this._timer / 0.5);
            this._panel.opacity = Math.floor((1 - t) * 255);
            if (t >= 1) {
                this._panel.active = false;
                this._phase = 'done';
                this._onDone?.();
                this._onDone = null;
            }
        }
    }

    private ensurePanel(): void {
        if (this._panel) return;

        const canvas = this.node;

        const panel = new Node('TitleOverlay');
        canvas.addChild(panel);
        panel.setPosition(0, 0, 200);
        panel.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        this._panel = panel;

        // 背景（透明，不遮挡）
        const bgNode = new Node('Bg');
        panel.addChild(bgNode);
        bgNode.setPosition(0, 0, -1);
        bgNode.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const bgGfx = bgNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 0);
        bgGfx.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
        bgGfx.fill();

        // 主标题
        const titleNode = new Node('Title');
        panel.addChild(titleNode);
        titleNode.setPosition(0, 40, 0);
        titleNode.addComponent(UITransform).setContentSize(600, 80);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '飞奔的奶酪';
        titleLabel.fontSize = 56;
        titleLabel.lineHeight = 68;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        // 简单描边效果：用阴影模拟
        titleLabel.enableBold = true;
        this._titleLabel = titleLabel;

        // 副标题
        const subNode = new Node('Subtitle');
        panel.addChild(subNode);
        subNode.setPosition(0, -40, 0);
        subNode.addComponent(UITransform).setContentSize(500, 40);
        const subLabel = subNode.addComponent(Label);
        subLabel.string = '';
        subLabel.fontSize = 24;
        subLabel.lineHeight = 32;
        subLabel.color = new Color(255, 255, 200, 255);
        subLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._subLabel = subLabel;

        panel.active = false;
    }
}
