import { _decorator, Component, director, game } from 'cc';
import { eventBus, GameEvents } from './EventBus';
import { GameConfig } from './GameConfig';
import { SaveSystem } from './SaveSystem';
import { SceneNames } from './SceneNames';
import type { RunProgress } from '../data/RunTypes';
import { RUN_CONFIG, generateRunRoomSequence } from '../data/RunTypes';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    @property
    currentLevel = 1;

    @property
    paused = false;

    configReady = false;

    // 跑酷模式状态（替代旧的章节模式）
    runMode = false;
    runProgress: RunProgress | null = null;

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
        this.clearRunState();
        director.loadScene(SceneNames.Menu);
    }

    goGame(levelId?: number): void {
        this.clearRunState();
        if (typeof levelId === 'number') {
            this.setLevel(levelId);
        }
        director.loadScene(SceneNames.Game);
    }

    // ========== 新手引导模式 ==========

    /** 新手引导第1关：房间1，收集完食物直接回鼠洞结算 */
    startTutorial1(): void {
        this.runMode = true;
        this.runProgress = {
            roomSequence: [1],
            currentRoomIndex: 0,
            totalFoodCollected: 0,
            livesRemaining: 3,
            selectedTalentId: null,
            tutorialMode: true,
            hasSeenWarpDialogue: false,
            isWarping: false,
        };
        this.currentLevel = 1;
        director.loadScene(SceneNames.Game);
    }

    /** 新手引导第2关：房间1→房间2，收集完后结算 */
    startTutorial2(talentId?: string): void {
        this.runMode = true;
        this.runProgress = {
            roomSequence: [1, 2],
            currentRoomIndex: 0,
            totalFoodCollected: 0,
            livesRemaining: talentId === 'extra_life' ? 4 : 3,
            selectedTalentId: talentId ?? null,
            tutorialMode: true,
            hasSeenWarpDialogue: false,
            isWarping: false,
        };
        this.currentLevel = 1;
        director.loadScene(SceneNames.Game);
    }

    // ========== 跑酷模式（正式游戏） ==========

    /**
     * 开始一次跑酷
     * 新手引导完成后调用：随机5个房间串联，鼠洞传送
     */
    startRun(talentId?: string): void {
        const rooms = generateRunRoomSequence();
        this.runMode = true;
        this.runProgress = {
            roomSequence: rooms,
            currentRoomIndex: 0,
            totalFoodCollected: 0,
            livesRemaining: talentId === 'extra_life' ? 4 : 3,
            selectedTalentId: talentId ?? null,
            tutorialMode: false,
            hasSeenWarpDialogue: false,
            isWarping: false,
        };
        console.log('[GameManager] 跑酷开始！房间序列:', rooms);
        this.currentLevel = rooms[0];
        director.loadScene(SceneNames.Game);
    }

    /**
     * 当前房间收集完食物后到达鼠洞
     * 返回：true=已传送到下一个房间（场景加载中），false=跑酷结束（结算）
     */
    onReachRatHole(foodCollected: number, livesRemaining: number): 'warp' | 'tutorial_next' | 'complete' {
        if (!this.runMode || !this.runProgress) return 'complete';

        const progress = this.runProgress;
        progress.totalFoodCollected += foodCollected;
        progress.livesRemaining = livesRemaining;

        const isLastRoom = progress.currentRoomIndex >= progress.roomSequence.length - 1;

        if (progress.tutorialMode) {
            // 新手引导模式
            if (isLastRoom) {
                // 引导结束
                this.finishRun(true);
                return 'complete';
            } else {
                // 引导第2关：房间1→房间2
                progress.currentRoomIndex += 1;
                this.currentLevel = progress.roomSequence[progress.currentRoomIndex];
                progress.isWarping = true;
                director.loadScene(SceneNames.Game);
                return 'tutorial_next';
            }
        }

        // 正式跑酷模式
        if (isLastRoom) {
            // 最后一个房间，结算回家
            this.finishRun(true);
            return 'complete';
        } else {
            // 传送到下一个房间（时光回溯）
            progress.currentRoomIndex += 1;
            this.currentLevel = progress.roomSequence[progress.currentRoomIndex];
            progress.isWarping = true;
            director.loadScene(SceneNames.Game);
            return 'warp';
        }
    }

    /** 玩家生命耗尽 */
    onRunFailed(foodCollected: number): void {
        if (!this.runProgress) return;
        this.runProgress.totalFoodCollected += foodCollected;
        this.finishRun(false);
    }

    /** 当前是否是跑酷最后一个房间（鼠洞发金光） */
    isFinalRoom(): boolean {
        if (!this.runMode || !this.runProgress) return true;
        return this.runProgress.currentRoomIndex >= this.runProgress.roomSequence.length - 1;
    }

    /** 是否刚传送到新房间（用于触发仙人对话/鼠猫对话） */
    consumeWarpFlag(): boolean {
        if (!this.runProgress) return false;
        const warping = this.runProgress.isWarping;
        this.runProgress.isWarping = false;
        return warping;
    }

    /** 是否是第一次传送（触发仙人时光回溯台词） */
    shouldShowWarpDialogue(): boolean {
        if (!this.runProgress || this.runProgress.tutorialMode) return false;
        if (this.runProgress.hasSeenWarpDialogue) return false;
        // 第2个房间（index=1）是第一次传送后
        if (this.runProgress.currentRoomIndex === 1) {
            this.runProgress.hasSeenWarpDialogue = true;
            return true;
        }
        return false;
    }

    private finishRun(won: boolean): void {
        if (!this.runProgress) return;
        const progress = this.runProgress;
        const totalFood = progress.totalFoodCollected;

        let coins = 0;
        if (won) {
            coins = RUN_CONFIG.baseRewardCoins + totalFood * RUN_CONFIG.coinsPerFood;
        } else {
            // 失败保留一半
            coins = Math.floor(totalFood * RUN_CONFIG.coinsPerFood * RUN_CONFIG.failCoinRatio);
        }

        if (coins > 0) {
            SaveSystem.addCoins(coins);
        }
        SaveSystem.recordRunComplete(totalFood);

        // 引导完成
        if (progress.tutorialMode) {
            if (progress.roomSequence.length === 1) {
                SaveSystem.completeTutorialStep(1);
            } else {
                SaveSystem.completeTutorialStep(2);
            }
        }

        console.log(`[GameManager] 跑酷结束 won=${won}, 食物=${totalFood}, 金币=${coins}`);

        // 通知UI显示结算（GameController 会监听场景中的状态来显示）
        this.runResult = { won, coins, totalFood };
    }

    /** 结算结果（GameController 在 Game 场景中读取后清空） */
    runResult: { won: boolean; coins: number; totalFood: number } | null = null;

    private clearRunState(): void {
        this.runMode = false;
        this.runProgress = null;
        this.runResult = null;
    }

    setPaused(value: boolean): void {
        this.paused = value;
        eventBus.emit(value ? GameEvents.GamePaused : GameEvents.GameResumed);
    }
}
