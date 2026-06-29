import { director, Director, Scene } from 'cc';
import { RoomRoot } from './RoomRoot';

/** Room{N}Edit 场景打开时自动挂编辑器组件，无需手拖脚本 */
const EDIT_SCENE_ROOMS: Record<string, number> = {
    Room1Edit: 1,
    Room2Edit: 2,
};

const ROOM_SIZE: Record<number, { mapW: number; mapH: number }> = {
    1: { mapW: 675, mapH: 975 },
    2: { mapW: 1013, mapH: 1463 },
};

function setupRoomEditScene(scene: Scene): void {
    const roomId = EDIT_SCENE_ROOMS[scene.name];
    if (!roomId) {
        return;
    }
    const canvas = scene.getChildByName('Canvas');
    const room = canvas?.getChildByName(`Room${roomId}`);
    if (!room) {
        console.warn(`[RoomEditInit] 场景 ${scene.name} 下找不到 Room${roomId}`);
        return;
    }

    const size = ROOM_SIZE[roomId] ?? ROOM_SIZE[1];
    const root = room.getComponent(RoomRoot) ?? room.addComponent(RoomRoot);
    root.roomId = roomId;
    root.mapW = size.mapW;
    root.mapH = size.mapH;

    void import('./RoomGuideGizmo').then(({ RoomGuideGizmo }) => {
        const gizmo = room!.getComponent(RoomGuideGizmo) ?? room!.addComponent(RoomGuideGizmo);
        gizmo.roomId = roomId;
        gizmo.mapW = size.mapW;
        gizmo.mapH = size.mapH;
        gizmo.rebuild();
    });
}

export class RoomEditInit {
    private static _installed = false;

    static install(): void {
        if (this._installed) {
            return;
        }
        this._installed = true;
        director.on(Director.EVENT_AFTER_SCENE_LAUNCH, setupRoomEditScene);
    }
}

RoomEditInit.install();
