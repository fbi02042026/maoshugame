import { _decorator, Component } from 'cc';
import { cocosLocalToHtml, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass, property } = _decorator;

@ccclass('RatHoleMarker')
export class RatHoleMarker extends Component {
    @property
    radius = 24;

    toRatHole(mapW: number, mapH: number) {
        const lp = getRoomLocalPoint(this.node);
        const p = cocosLocalToHtml(lp.x, lp.y, mapW, mapH);
        return { x: p.x, y: p.y, r: this.radius };
    }
}
