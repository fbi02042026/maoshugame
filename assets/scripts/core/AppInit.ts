import { _decorator, Component, director, Director, Scene } from 'cc';
import { BootController } from '../ui/BootController';
import { ComicController } from '../ui/ComicController';
import { GameController } from '../game/GameController';
import { LoginController } from '../ui/LoginController';
import { MenuController } from '../ui/MenuController';

const { ccclass } = _decorator;

type ControllerClass = typeof Component;

const SCENE_CONTROLLERS: Record<string, ControllerClass> = {
    Boot: BootController,
    Comic: ComicController,
    Login: LoginController,
    Menu: MenuController,
    Game: GameController,
};

/**
 * 运行时给 Canvas 挂场景控制器，避免手写 .scene 里的脚本 UUID 在预览里找不到类。
 */
@ccclass('AppInit')
export class AppInit {
    private static _installed = false;

    static install(): void {
        if (this._installed) {
            return;
        }
        this._installed = true;
        director.on(Director.EVENT_AFTER_SCENE_LAUNCH, AppInit.onSceneLaunch);
    }

    private static onSceneLaunch(scene: Scene): void {
        const controller = SCENE_CONTROLLERS[scene.name];
        if (!controller) {
            return;
        }
        const canvas = scene.getChildByName('Canvas');
        if (!canvas || canvas.getComponent(controller)) {
            return;
        }
        canvas.addComponent(controller);
    }
}

AppInit.install();
