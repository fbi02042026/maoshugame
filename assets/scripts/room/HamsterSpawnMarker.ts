import { _decorator, Component } from 'cc';
import { cocosLocalToHtml, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass } = _decorator;

@ccclass('HamsterSpawnMarker')
export class HamsterSpawnMarker extends Component {
    toSpawn(mapW: number, mapH: number) {
        const p = getRoomLocalPoint(this.node);
        return cocosLocalToHtml(p.x, p.y, mapW, mapH);
    }
}
