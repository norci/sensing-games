import { IGameMode } from '../core/types.js';
import { PolygonWarriorGame } from './polygon-warrior/index.js';

export type { IGameMode };

// 游戏模式注册表
const gameModes: Record<string, new (...args: any[]) => IGameMode> = {
  'polygon-warrior': PolygonWarriorGame,
};

export function getGameMode(name: string, ...args: any[]): IGameMode | null {
  const GameModeClass = gameModes[name];
  if (!GameModeClass) {
    console.error(`Game mode "${name}" not found`);
    return null;
  }
  return new GameModeClass(...args);
}

export function listGameModes(): string[] {
  return Object.keys(gameModes);
}

export { PolygonWarriorGame };
