import { _decorator, Component } from 'cc';
import { cocosLocalCenterToHtmlRect, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass, property } = _decorator;

@ccclass('PowerupMarker')
export class PowerupMarker extends Component {
    @property
    powerupType = 'toycar';

    toPowerup(mapW: number, mapH: number) {
        const lp = getRoomLocalPoint(this.node);
        const p = cocosLocalCenterToHtmlRect(
            lp.x,
            lp.y,
            32,
            32,
            mapW,
            mapH,
        );
        return {
            x: p.x + p.w / 2,
            y: p.y + p.h / 2,
            type: this.powerupType as 'toycar',
            collected: false,
        };
    }
}
