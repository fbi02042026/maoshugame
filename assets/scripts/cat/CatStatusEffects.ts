import { _decorator, Color, Component, Label, Node as CCNode, UITransform } from 'cc';
import { colorFromHex } from '../core/ColorUtil';
import type { CatRuntimeState } from './CatTypes';

const { ccclass } = _decorator;

const Z_FONT = [44, 32, 26];
const Z_POS = [
    { x: 42, y: 72 },
    { x: 58, y: 88 },
    { x: 72, y: 100 },
];

/** 猫头顶状态特效：睡觉 Zzz、警觉 ! 等 */
@ccclass('CatStatusEffects')
export class CatStatusEffects extends Component {
    private zLarge: Label | null = null;
    private zMid: Label | null = null;
    private zSmall: Label | null = null;
    private alertMark: Label | null = null;
    private questionMark: Label | null = null;
    private _time = 0;

    onLoad(): void {
        this.zLarge = this.createText('Z', Z_FONT[0], '#88AAFF', Z_POS[0].x, Z_POS[0].y);
        this.zMid = this.createText('z', Z_FONT[1], '#88AAFF', Z_POS[1].x, Z_POS[1].y);
        this.zSmall = this.createText('z', Z_FONT[2], '#88AAFF', Z_POS[2].x, Z_POS[2].y);
        this.alertMark = this.createText('!', 52, '#FF4444', 0, 88);
        this.questionMark = this.createText('?', 40, '#FFD700', 0, 82);
        this.hideAll();
    }

    sync(cat: CatRuntimeState, dt: number): void {
        this._time += dt;
        this.hideAll();

        if (cat.state === 'sleeping') {
            const bob = Math.sin(this._time * 2) * 6;
            this.showZzz(bob);
            return;
        }

        if (cat.state === 'chase' || cat.alertValue >= 100) {
            this.showAlert();
            return;
        }

        if (cat.alertValue > 15) {
            this.showQuestion('#FFA500', 44, Math.sin(this._time * 5) * 5);
            return;
        }

        if (cat.alertValue > 5) {
            this.showQuestion('#FFD700', 36, Math.sin(this._time * 4) * 4);
        }
    }

    private createText(text: string, fontSize: number, color: string, x: number, y: number): Label {
        const key = `CatFx_${text}_${fontSize}`;
        let node = this.node.getChildByName(key);
        if (!node) {
            node = new CCNode(key);
            node.layer = this.node.layer;
            this.node.addChild(node);
        }
        node.setPosition(x, y, 0);
        let ui = node.getComponent(UITransform);
        if (!ui) {
            ui = node.addComponent(UITransform);
            ui.setContentSize(80, 80);
        }
        const label = node.getComponent(Label) ?? node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = colorFromHex(color);
        label.useSystemFont = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        node.active = false;
        return label;
    }

    private hideAll(): void {
        for (const child of this.node.children) {
            if (child.name.startsWith('CatFx_')) {
                child.active = false;
            }
        }
    }

    private showZzz(bob: number): void {
        const labels = [this.zLarge, this.zMid, this.zSmall];
        for (let i = 0; i < labels.length; i += 1) {
            const label = labels[i];
            if (!label?.node) continue;
            label.node.active = true;
            label.node.setPosition(Z_POS[i].x, Z_POS[i].y + bob * (1 - i * 0.15), 0);
        }
    }

    private showAlert(): void {
        if (!this.alertMark?.node) return;
        this.alertMark.node.active = true;
        const pulse = 1 + Math.sin(this._time * 8) * 0.25;
        this.alertMark.node.setScale(pulse, pulse, 1);
        this.alertMark.node.setPosition(0, 88, 0);
    }

    private showQuestion(colorHex: string, size: number, bounce: number): void {
        if (!this.questionMark?.node) return;
        this.questionMark.node.active = true;
        this.questionMark.fontSize = size;
        this.questionMark.lineHeight = size + 6;
        this.questionMark.color = colorFromHex(colorHex);
        this.questionMark.node.setPosition(0, 82 + bounce, 0);
    }
}
