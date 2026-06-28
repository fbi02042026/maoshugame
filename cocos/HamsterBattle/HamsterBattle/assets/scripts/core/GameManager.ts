import { _decorator, Component, director, game } from 'cc';
import { eventBus, GameEvents } from './EventBus';
import { GameConfig } from './GameConfig';
import { SaveSystem } from './SaveSystem';
import { SceneNames } from './SceneNames';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    @property
    currentLevel = 1;

    @property
    paused = false;

    configReady = false;

    static get instance(): GameManager | null {
        return this._instance;
    }

    onLoad(): void {
        if (GameManager._instance && GameManager._instance !== this) {
            this.node.destroy();
            return;
        }
        GameManager._instance = this;
        director.addPersistRootNode(this.node);
        game.frameRate = 60;
    }

    onDestroy(): void {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
    }

    async bootstrap(): Promise<void> {
        SaveSystem.load();
        await GameConfig.loadAll();
        this.configReady = true;
        eventBus.emit(GameEvents.ConfigReady);
    }

    setLevel(levelId: number): void {
        this.currentLevel = Math.max(1, Math.min(8, levelId));
        eventBus.emit(GameEvents.LevelSelected, this.currentLevel);
    }

    goMenu(): void {
        director.loadScene(SceneNames.Menu);
    }

    goGame(levelId?: number): void {
        if (typeof levelId === 'number') {
            this.setLevel(levelId);
        }
        director.loadScene(SceneNames.Game);
    }

    setPaused(value: boolean): void {
        this.paused = value;
        eventBus.emit(value ? GameEvents.GamePaused : GameEvents.GameResumed);
    }
}
