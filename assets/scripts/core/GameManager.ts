import { _decorator, Component, director, game } from 'cc';
import { eventBus, GameEvents } from './EventBus';
import { GameConfig } from './GameConfig';
import { SaveSystem } from './SaveSystem';
import { SceneNames } from './SceneNames';
import type { ChapterConfig, ChapterProgress, RoomResult } from '../data/ChapterTypes';
import { CHAPTERS, generateRoomSequence } from '../data/ChapterTypes';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    @property
    currentLevel = 1;

    @property
    paused = false;

    configReady = false;

    // 章节模式状态
    chapterMode = false;
    chapterConfig: ChapterConfig | null = null;
    chapterProgress: ChapterProgress | null = null;
    roomSequence: number[] = [];

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
        this.clearChapterState();
        director.loadScene(SceneNames.Menu);
    }

    goGame(levelId?: number): void {
        this.clearChapterState();
        if (typeof levelId === 'number') {
            this.setLevel(levelId);
        }
        director.loadScene(SceneNames.Game);
    }

    // ========== 章节模式 ==========

    startChapter(chapterId: number): void {
        const chapter = CHAPTERS.find((c) => c.id === chapterId);
        if (!chapter) {
            console.error(`[GameManager] 章节 ${chapterId} 不存在`);
            return;
        }
        this.chapterMode = true;
        this.chapterConfig = chapter;
        this.roomSequence = generateRoomSequence(chapter);
        this.chapterProgress = {
            chapterId,
            completedRoomIndices: [],
            totalFoodCollected: 0,
            livesRemaining: 3,
            selectedTalentId: null,
            currentRoomIndex: 0,
        };
        console.log(`[GameManager] 开启章节 ${chapter.name}，房间序列:`, this.roomSequence);
        this.goCurrentRoom();
    }

    goCurrentRoom(): void {
        if (!this.chapterMode || !this.chapterProgress || !this.roomSequence.length) return;
        const roomLevelId = this.roomSequence[this.chapterProgress.currentRoomIndex];
        this.currentLevel = roomLevelId;
        director.loadScene(SceneNames.Game);
    }

    onRoomComplete(result: RoomResult): boolean {
        if (!this.chapterMode || !this.chapterProgress || !this.chapterConfig) return false;

        const progress = this.chapterProgress;
        progress.completedRoomIndices.push(progress.currentRoomIndex);
        progress.totalFoodCollected += result.foodCollected;
        progress.livesRemaining = result.livesRemaining;

        const isLastRoom = progress.currentRoomIndex >= this.roomSequence.length - 1;

        if (isLastRoom) {
            // 最后一个房间：保存奖励，让 GameController 显示结算
            this.saveChapterRewards(true);
            return false; // 没有下一个房间
        } else {
            // 进入下一个房间
            progress.currentRoomIndex += 1;
            console.log(`[GameManager] 房间完成，进入第 ${progress.currentRoomIndex + 1} 个房间`);
            this.goCurrentRoom();
            return true; // 已加载下一个房间
        }
    }

    onRoomFail(): boolean {
        if (!this.chapterMode) return false;
        // 让 GameController 显示结算，不自动处理
        return false;
    }

    private saveChapterRewards(won: boolean): void {
        if (!this.chapterConfig || !this.chapterProgress) return;
        const chapter = this.chapterConfig;
        const progress = this.chapterProgress;

        if (won) {
            const coins = chapter.rewardCoins + progress.totalFoodCollected * 10;
            SaveSystem.addCoins(coins);
            SaveSystem.recordChapterClear(chapter.id);
            if (chapter.id + 1 > SaveSystem.data.unlockedChapter) {
                SaveSystem.unlockChapter(chapter.id + 1);
            }
            console.log(`[GameManager] 章节通关！获得 ${coins} 金币`);
        }

        if (chapter.isTutorial && chapter.id === 0) {
            SaveSystem.completeTutorialStep(1);
        } else if (chapter.isTutorial && chapter.id === 1) {
            SaveSystem.completeTutorialStep(2);
        }
    }

    private clearChapterState(): void {
        this.chapterMode = false;
        this.chapterConfig = null;
        this.chapterProgress = null;
        this.roomSequence = [];
    }

    setPaused(value: boolean): void {
        this.paused = value;
        eventBus.emit(value ? GameEvents.GamePaused : GameEvents.GameResumed);
    }
}
