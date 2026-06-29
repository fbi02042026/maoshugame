import { _decorator, Camera, Component, Node } from 'cc';
import { lerp } from '../collision/CollisionUtil';
import { DESIGN_HEIGHT } from '../core/DesignConstants';

const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Node)
    target: Node | null = null;

    @property
    smooth = 6;

    zoom = 1;
    targetZoom = 1.2;

    private _camera: Camera | null = null;

    onLoad(): void {
        this._camera = this.getComponent(Camera);
    }

    lateUpdate(dt: number): void {
        if (!this.target) {
            return;
        }
        const t = Math.min(1, this.smooth * dt);
        this.zoom = lerp(this.zoom, this.targetZoom, t);

        const targetPos = this.target.position;
        const current = this.node.position;
        this.node.setPosition(
            lerp(current.x, targetPos.x, t),
            lerp(current.y, targetPos.y, t),
            current.z,
        );

        if (this._camera) {
            this._camera.orthoHeight = (DESIGN_HEIGHT / 2) / Math.max(0.1, this.zoom);
        }
    }
}
