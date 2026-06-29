import { _decorator, Color, Component, Graphics, UITransform } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

/** 编辑器里可视化碰撞盒（仅调试用，发布可删） */
@ccclass('CollisionBoxGizmo')
@executeInEditMode(true)
export class CollisionBoxGizmo extends Component {
    @property
    width = 64;

    @property
    height = 64;

    @property
    color: Color = new Color(0, 255, 0, 80);

    onEnable(): void {
        this.draw();
    }

    draw(): void {
        let gfx = this.getComponent(Graphics);
        if (!gfx) {
            gfx = this.addComponent(Graphics);
        }
        gfx.clear();
        gfx.fillColor = this.color;
        gfx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        gfx.fill();
        const ui = this.getComponent(UITransform) ?? this.addComponent(UITransform);
        ui.setContentSize(this.width, this.height);
        ui.setAnchorPoint(0.5, 0.5);
    }
}
