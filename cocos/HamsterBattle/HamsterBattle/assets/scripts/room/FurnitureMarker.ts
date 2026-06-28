import { _decorator, Component, UITransform } from 'cc';
import type { FurnitureItem } from '../data/GameTypes';
import { cocosLocalCenterToHtmlRect, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass, property } = _decorator;

/** 挂在房间预制体里的每件家具上：编辑器摆位置/贴图，脚本负责碰撞数据 */
@ccclass('FurnitureMarker')
export class FurnitureMarker extends Component {
    @property
    artId = '';

    @property
    interactive = true;

    @property
    decor = false;

    @property
    catbed = false;

    @property({ tooltip: 'free / top / wall / decor / side' })
    layer = 'free';

    @property
    hideable = true;

    /** 0 表示用节点 UITransform 宽高 */
    @property
    collisionWidth = 0;

    @property
    collisionHeight = 0;

    getCollisionSize(): { w: number; h: number } {
        if (this.collisionWidth > 0 && this.collisionHeight > 0) {
            return { w: this.collisionWidth, h: this.collisionHeight };
        }
        const ui = this.getComponent(UITransform);
        if (ui) {
            return { w: ui.contentSize.width, h: ui.contentSize.height };
        }
        return { w: 64, h: 64 };
    }

    toFurnitureItem(mapW: number, mapH: number): FurnitureItem {
        const { w, h } = this.getCollisionSize();
        const pos = getRoomLocalPoint(this.node);
        const scale = this.node.scale;
        const sw = w * Math.abs(scale.x);
        const sh = h * Math.abs(scale.y);
        const rect = cocosLocalCenterToHtmlRect(pos.x, pos.y, sw, sh, mapW, mapH);
        return {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            type: this.artId || this.node.name,
            name: this.node.name,
            interactive: this.interactive,
            layer: this.layer,
            flipX: scale.x < 0,
            decor: this.decor,
            catbed: this.catbed,
            hideable: this.decor ? false : this.hideable,
        };
    }
}
