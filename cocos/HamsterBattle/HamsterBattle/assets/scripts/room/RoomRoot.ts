import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

/** 房间元数据：尺寸、关卡 roomId（勿加 executeInEditMode，避免编辑器加载失败） */
@ccclass('RoomRoot')
export class RoomRoot extends Component {
    @property
    roomId = 1;

    @property
    mapW = 675;

    @property
    mapH = 975;

    getMapSize(): { mapW: number; mapH: number } {
        return { mapW: this.mapW, mapH: this.mapH };
    }
}
