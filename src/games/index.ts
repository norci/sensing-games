import { IGameMode } from '../core/types.js';
import { PolygonWarriorGame } from './polygon-warrior/index.js';

export type { IGameMode };

const gameModes: Record<string, new (...args: any[]) => IGameMode> = {
  'polygon-warrior': PolygonWarriorGame,
};

export function getGameMode(name: string, ...args: any[]): IGameMode {
  const GameModeClass = gameModes[name];
  if (!GameModeClass) {
    throw new Error(`Game mode "${name}" not found`);
  }
  return new GameModeClass(...args);
}

export function listGameModes(): string[] {
  return Object.keys(gameModes);
}

export { PolygonWarriorGame };
