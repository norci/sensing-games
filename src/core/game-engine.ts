import { GameConfig, Point } from './types.js';
import { SoundManager } from '../shared/sound-manager.js';

export enum GameState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
}

export class GameEngine {
  private state: GameState = GameState.IDLE;
  private score: number = 0;
  private combo: number = 0;
  private lastSliceTime: number = 0;
  private lastSlicePos: Point = { x: 0, y: 0 };
  private readonly config: GameConfig;
  private soundManager: SoundManager;
  /** 游戏重启时的回调（由 main.ts 设置为 game.restart） */
  public onRestart!: () => void;
  private restartTimer: number | null = null;
  private speedMultiplier: number = 1.0;

  constructor(config?: Partial<GameConfig>) {
    this.config = {
      swingThreshold: 0.25,
      comboWindow: 500,
      maxLives: 3,
      difficulty: 1.0,
      practiceMode: false,
      ...config
    };
    this.soundManager = new SoundManager();
  }

  start(): void {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.combo = 0;
    console.log('Game started');
  }

  /** 实际切中水果时调用（由游戏模式调用） */
  onFruitSliced(pos: Point, points: number): void {
    const now = Date.now();
    const timeSinceLastSlice = now - this.lastSliceTime;

    if (timeSinceLastSlice < (this.config.comboWindow ?? 500)) {
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
  }

  getLastSliceInfo(): { pos: Point; time: number } {
    return { pos: this.lastSlicePos, time: this.lastSliceTime };
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.soundManager.play('game_over');
    console.log(`Game Over! Final Score: ${this.score}`);
    this.restartTimer = window.setTimeout(() => {
      this.restart();
    }, 5000);
  }

  pause(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
    }
  }

  resume(): void {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
    }
  }

  restart(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.score = 0;
    this.combo = 0;
    this.lastSliceTime = 0;
    this.lastSlicePos = { x: 0, y: 0 };
    this.state = GameState.PLAYING;
    this.onRestart();
    console.log('Game restarted');
  }

  getScore(): number {
    return this.score;
  }

  getState(): GameState {
    return this.state;
  }

  getCombo(): number {
    return this.combo;
  }

  setScore(score: number): void {
    this.score = score;
  }

  setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  destroy(): void {
    this.soundManager.destroy();
  }
}
