import { _decorator, Component } from 'cc';
import { cocosLocalToHtml, getRoomLocalPoint } from '../core/RoomCoord';

const { ccclass } = _decorator;

/** 猫出生点：Room2 大房间等关卡单独指定猫的位置 */
@ccclass('CatSpawnMarker')
export class CatSpawnMarker extends Component {
    toSpawn(mapW: number, mapH: number): { x: number; y: number } {
        const p = getRoomLocalPoint(this.node);
        return cocosLocalToHtml(p.x, p.y, mapW, mapH);
    }
}
