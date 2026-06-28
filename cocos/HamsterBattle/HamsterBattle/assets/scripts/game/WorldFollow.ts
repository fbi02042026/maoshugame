import { _decorator, Camera, Component, Node, Vec3 } from 'cc';
import { lerp } from '../collision/CollisionUtil';
import { DESIGN_HEIGHT } from '../core/DesignConstants';
import { htmlToCocos } from '../core/MapCoords';

/** HTML 第一关镜头 zoom */
export const HTML_L1_ZOOM = 0.75;

/** 按地图高度填满屏幕的缩放（当前偏近） */
export function calcMapFillZoom(mapHeight: number, fillRatio = 0.92): number {
    return DESIGN_HEIGHT / (mapHeight * fillRatio);
}

/** L1 固定镜头 zoom */
export const L1_CAMERA_ZOOM = 1.2;

const { ccclass, property } = _decorator;

@ccclass('WorldFollow')
export class WorldFollow extends Component {
    @property(Node)
    worldRoot: Node | null = null;

    @property(Node)
    target: Node | null = null;

    @property(Camera)
    viewCamera: Camera | null = null;

    @property
    smooth = 6;

    zoom = 1;
    targetZoom = 1.2;

    /** 开场运镜用：固定注视点（Cocos 世界坐标，与角色同一空间） */
    fixedFocusX: number | null = null;
    fixedFocusY: number | null = null;

    private _baseOrtho = DESIGN_HEIGHT / 2;

    onLoad(): void {
        if (this.viewCamera) {
            this._baseOrtho = this.viewCamera.orthoHeight || DESIGN_HEIGHT / 2;
        }
    }

    setFixedFocusHtml(hx: number, hy: number, mapW: number, mapH: number): void {
        const p = htmlToCocos(hx, hy, mapW, mapH);
        this.fixedFocusX = p.x;
        this.fixedFocusY = p.y;
    }

    clearFixedFocus(): void {
        this.fixedFocusX = null;
        this.fixedFocusY = null;
    }

    lateUpdate(dt: number): void {
        if (!this.worldRoot) {
            return;
        }
        const t = Math.min(1, this.smooth * dt);
        this.zoom = lerp(this.zoom, this.targetZoom, t);

        let fx = 0;
        let fy = 0;
        if (this.fixedFocusX !== null && this.fixedFocusY !== null) {
            fx = this.fixedFocusX;
            fy = this.fixedFocusY;
        } else if (this.target) {
            fx = this.target.position.x;
            fy = this.target.position.y;
        } else {
            return;
        }

        // 只缩放 World 层，不改相机 orthoHeight，避免 HUD/引导框跟着变
        const z = Math.max(0.1, this.zoom);
        this.worldRoot.setScale(z, z, 1);
        this.worldRoot.setPosition(-fx * z, -fy * z, 0);

        if (this.viewCamera) {
            this.viewCamera.orthoHeight = this._baseOrtho;
        }
    }
}
