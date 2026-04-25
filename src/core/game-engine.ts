import { SwingResult } from '../types/swing.js';
import { IGameMode, GameConfig } from '../types/game.js';
import { SoundManager } from '../shared/sound-manager.js';
import { Point } from '../types/swing.js';

export enum GameState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export class GameEngine {
  private state: GameState = GameState.IDLE;
  private score: number = 0;
  private lives: number;
  private combo: number = 0;
  private lastSliceTime: number = 0;
  private lastSlicePos: Point = { x: 0, y: 0 };
  private readonly config: GameConfig;
  private currentMode: IGameMode | null = null;
  private soundManager: SoundManager;
  private restartTimer: number | null = null;
  private practiceMode: boolean = false;

  constructor(config?: Partial<GameConfig>) {
    this.config = {
      swingThreshold: 0.25,
      comboWindow: 500,      // 500ms 连击窗口
      maxLives: 3,
      difficulty: 1.0,
      practiceMode: false,
      ...config
    };
    this.lives = this.config.maxLives;
    this.practiceMode = this.config.practiceMode ?? false;
    this.soundManager = new SoundManager();
  }

  setGameMode(mode: IGameMode): void {
    this.currentMode = mode;
  }

  start(): void {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.lives = this.config.maxLives;
    this.combo = 0;
    console.log('Game started');
  }

  update(swingResult: SwingResult): void {
    if (this.state !== GameState.PLAYING) return;

    // 委托给当前游戏模式
    if (this.currentMode) {
      this.currentMode.update(swingResult);
    }
  }

  /** 实际切中水果时调用（由游戏模式调用） */
  onFruitSliced(pos: Point, points: number): void {
    const now = Date.now();
    const timeSinceLastSlice = now - this.lastSliceTime;

    // 连击检测
    if (timeSinceLastSlice < this.config.comboWindow) {
      this.combo++;
      if (this.combo >= 3) {
        this.soundManager.play('combo');
      }
    } else {
      this.combo = 1;
    }

    this.lastSliceTime = now;
    this.lastSlicePos = pos;
    this.score += this.combo * points;

    this.soundManager.play('slice');
    console.log(`Sliced! +${this.combo * points} (combo x${this.combo})`);
  }

  getLastSliceInfo(): { pos: Point; time: number } {
    return { pos: this.lastSlicePos, time: this.lastSliceTime };
  }

  loseLife(): void {
    // 练习模式下不减少生命值
    if (this.practiceMode) {
      console.log('练习模式：生命值不减');
      return;
    }

    this.lives--;
    this.soundManager.play('life_lost');
    
    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private gameOver(): void {
    // 练习模式下不触发游戏结束
    if (this.practiceMode) {
      console.log('练习模式：游戏继续');
      return;
    }

    this.state = GameState.GAME_OVER;
    this.soundManager.play('game_over');
    console.log(`Game Over! Final Score: ${this.score}`);

    // 5秒后自动重启
    this.restartTimer = window.setTimeout(() => {
      this.restart();
    }, 5000);
  }

  setPracticeMode(enabled: boolean): void {
    this.practiceMode = enabled;
    if (enabled) {
      this.lives = 999; // 练习模式生命值设为无限
      console.log('练习模式已启用');
    } else {
      this.lives = this.config.maxLives;
    }
  }

  isPracticeMode(): boolean {
    return this.practiceMode;
  }

  restart(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.score = 0;
    this.lives = this.config.maxLives;
    this.combo = 0;
    this.lastSliceTime = 0;
    this.lastSlicePos = { x: 0, y: 0 };
    this.state = GameState.PLAYING;
    console.log('Game restarted');
  }

  getScore(): number {
    return this.score;
  }

  getLives(): number {
    return this.lives;
  }

  getState(): GameState {
    return this.state;
  }

  getCombo(): number {
    return this.combo;
  }

  destroy(): void {
    this.soundManager.destroy();
    if (this.currentMode) {
      this.currentMode.destroy();
    }
  }
}
