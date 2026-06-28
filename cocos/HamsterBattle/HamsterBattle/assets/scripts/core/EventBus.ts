import { EventTarget } from 'cc';

export enum GameEvents {
    ConfigReady = 'config-ready',
    SaveChanged = 'save-changed',
    LevelSelected = 'level-selected',
    GamePaused = 'game-paused',
    GameResumed = 'game-resumed',
    GameWin = 'game-win',
    GameLose = 'game-lose',
}

class GameEventBus {
    readonly target = new EventTarget();

    on<T extends (...args: never[]) => void>(event: GameEvents, callback: T, target?: object): void {
        this.target.on(event, callback, target);
    }

    off<T extends (...args: never[]) => void>(event: GameEvents, callback: T, target?: object): void {
        this.target.off(event, callback, target);
    }

    emit(event: GameEvents, ...args: unknown[]): void {
        this.target.emit(event, ...args);
    }
}

export const eventBus = new GameEventBus();
