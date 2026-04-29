import type { SpecialEffect } from './types.js';

export class FreezeEffect implements SpecialEffect {
  type = 'freeze' as const;
  duration = 3000;

  apply(): void {}
  remove(): void {}
}
