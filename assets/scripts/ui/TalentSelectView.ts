import {
    _decorator,
    Button,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { TALENTS, getTalentById, type TalentConfig } from '../data/ChapterTypes';

const { ccclass } = _decorator;

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

@ccclass('TalentSelectView')
export class TalentSelectView extends Component {
    private _onSelect: ((talentId: string) => void) | null = null;
    private _panel: Node | null = null;

    show(onSelect: (talentId: string) => void): void {
        this._onSelect = onSelect;
        this.ensurePanel();
        if (this._panel) {
            this._panel.active = true;
        }
    }

    hide(): void {
        if (this._panel) {
            this._panel.active = false;
        }
        this._onSelect = null;
    }

    private ensurePanel(): void {
        if (this._panel) return;

        const canvas = this.node;

        // 遮罩层
        const overlay = new Node('TalentOverlay');
        canvas.addChild(overlay);
        overlay.setPosition(0, 0, 100);
        overlay.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const overlayGfx = overlay.addComponent(Graphics);
        overlayGfx.fillColor = new Color(0, 0, 0, 180);
        overlayGfx.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
        overlayGfx.fill();

        this._panel = overlay;

        // 标题
        const titleNode = new Node('Title');
        overlay.addChild(titleNode);
        titleNode.setPosition(0, DESIGN_HEIGHT * 0.3, 0);
        titleNode.addComponent(UITransform).setContentSize(500, 60);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '选择一个天赋';
        titleLabel.fontSize = 40;
        titleLabel.lineHeight = 48;
        titleLabel.color = new Color(255, 215, 0, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 随机选3个天赋
        const shuffled = shuffleArray(TALENTS);
        const picks = shuffled.slice(0, 3);

        // 卡片横向排列
        const cardWidth = 180;
        const cardHeight = 240;
        const gap = 30;
        const startX = -(cardWidth * 3 + gap * 2) / 2 + cardWidth / 2;

        picks.forEach((talent, idx) => {
            this.createTalentCard(overlay, talent, startX + idx * (cardWidth + gap), 0, cardWidth, cardHeight);
        });
    }

    private createTalentCard(
        parent: Node,
        talent: TalentConfig,
        x: number,
        y: number,
        w: number,
        h: number,
    ): void {
        const card = new Node(`Talent_${talent.id}`);
        parent.addChild(card);
        card.setPosition(x, y, 1);
        card.addComponent(UITransform).setContentSize(w, h);
        const btn = card.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 1.05;

        // 卡片背景
        const bg = new Node('Bg');
        card.addChild(bg);
        bg.setPosition(0, 0, -1);
        const bgGfx = bg.addComponent(Graphics);
        bgGfx.fillColor = new Color(40, 40, 40, 230);
        bgGfx.roundRect(-w / 2, -h / 2, w, h, 12);
        bgGfx.fill();
        bgGfx.lineWidth = 2;
        bgGfx.strokeColor = new Color(255, 215, 0, 200);
        bgGfx.roundRect(-w / 2, -h / 2, w, h, 12);
        bgGfx.stroke();

        // 图标
        const iconNode = new Node('Icon');
        card.addChild(iconNode);
        iconNode.setPosition(0, h * 0.2, 0);
        iconNode.addComponent(UITransform).setContentSize(80, 80);
        const iconLabel = iconNode.addComponent(Label);
        iconLabel.string = talent.icon;
        iconLabel.fontSize = 56;
        iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        iconLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 名称
        const nameNode = new Node('Name');
        card.addChild(nameNode);
        nameNode.setPosition(0, -h * 0.15, 0);
        nameNode.addComponent(UITransform).setContentSize(w - 20, 40);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = talent.name;
        nameLabel.fontSize = 22;
        nameLabel.lineHeight = 28;
        nameLabel.color = new Color(255, 255, 255, 255);
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 描述
        const descNode = new Node('Desc');
        card.addChild(descNode);
        descNode.setPosition(0, -h * 0.4, 0);
        descNode.addComponent(UITransform).setContentSize(w - 24, 60);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = talent.description;
        descLabel.fontSize = 16;
        descLabel.lineHeight = 20;
        descLabel.color = new Color(200, 200, 200, 255);
        descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabel.verticalAlign = Label.VerticalAlign.CENTER;
        descLabel.overflow = Label.Overflow.SHRINK;

        card.on(Button.EventType.CLICK, () => {
            console.log(`[Talent] 选择天赋：${talent.name}`);
            this._onSelect?.(talent.id);
            this.hide();
        }, this);
    }
}
