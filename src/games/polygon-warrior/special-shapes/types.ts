export type SpecialEffectType = 'freeze';

export interface SpecialEffect {
  type: SpecialEffectType;
  duration: number;
  apply(): void;
  remove(): void;
}
