import { _decorator, Color, Component, Graphics, Node as CCNode, Vec3 } from 'cc';
import { colorFromHex } from '../core/ColorUtil';
import { GameConfig } from '../core/GameConfig';
import type { CatRuntimeState } from './CatTypes';

const { ccclass } = _decorator;

/** 猫视野：全圆警戒圈 + 朝向扇形（对照浏览器 drawCat） */
@ccclass('CatVisionEffects')
export class CatVisionEffects extends Component {
    private gfx: Graphics | null = null;
    private _visionNode: CCNode | null = null;
    private _smoothAngle = 0;
    private _worldPos = new Vec3();

    onLoad(): void {
        const parent = this.node.parent;
        const n = new CCNode('VisionFan');
        n.layer = this.node.layer;
        if (parent) {
            parent.addChild(n);
            n.setSiblingIndex(this.node.getSiblingIndex());
        } else {
            this.node.addChild(n);
        }
        this._visionNode = n;
        this.gfx = n.addComponent(Graphics);
    }

    onDestroy(): void {
        if (this._visionNode?.isValid) {
            this._visionNode.destroy();
        }
        this._visionNode = null;
    }

    sync(cat: CatRuntimeState, catNode: CCNode): void {
        const gfx = this.gfx;
        const visionNode = this._visionNode;
        if (!gfx || !visionNode) return;

        catNode.getWorldPosition(this._worldPos);
        visionNode.setWorldPosition(this._worldPos);

        gfx.clear();

        const cfg = GameConfig.constants;
        const range = cfg.catVisionRange;
        const half = cfg.catVisionAngleRad / 2;

        // 全圆警戒圈：睡觉时也显示（对照浏览器 drawCat），身后进圈同样涨警戒
        const ringColor = cat.alertValue > 50 ? '#FF4444' : '#FFA500';
        gfx.lineWidth = 2;
        gfx.strokeColor = colorFromHex(ringColor);
        gfx.strokeColor.a = cat.alertValue > 50 ? 100 : 75;
        gfx.circle(0, 0, range);
        gfx.stroke();

        // 视野锥：睡觉/吃惊/蓄力时不显示
        const hideFan = cat.state === 'sleeping' || cat.state === 'surprised' || cat.state === 'charging';
        if (hideFan) return;

        const len = Math.hypot(cat.vx, cat.vy);
        const targetAngle = len > 0.05 ? Math.atan2(-cat.vy, cat.vx) : this._smoothAngle;
        let diff = targetAngle - this._smoothAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this._smoothAngle += diff * 0.15;

        const alpha = cat.state === 'chase' ? 0.28 : 0.22;
        const fanColor = cat.state === 'chase' ? '#FF2222' : '#FF6600';
        gfx.fillColor = colorFromHex(fanColor);
        gfx.fillColor.a = Math.floor(alpha * 255);
        gfx.moveTo(0, 0);
        const steps = 24;
        for (let i = 0; i <= steps; i += 1) {
            const a = this._smoothAngle - half + (half * 2 * i) / steps;
            gfx.lineTo(Math.cos(a) * range, Math.sin(a) * range);
        }
        gfx.close();
        gfx.fill();
    }
}
