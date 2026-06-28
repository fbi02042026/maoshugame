import { _decorator, Component, UITransform } from 'cc';
import { cocosLocalCenterToHtmlRect, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass, property } = _decorator;

@ccclass('CatPathMarker')
export class CatPathMarker extends Component {
    @property
    pathType = 'cat';

    toGapRect(mapW: number, mapH: number) {
        const ui = this.getComponent(UITransform);
        const w = ui?.contentSize.width ?? 80;
        const h = ui?.contentSize.height ?? 70;
        const p = getRoomLocalPoint(this.node);
        const rect = cocosLocalCenterToHtmlRect(p.x, p.y, w, h, mapW, mapH);
        return {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            type: this.pathType,
        };
    }
}
