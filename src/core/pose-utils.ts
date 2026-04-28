/**
 * Pose 工具函数 — 可复用于各子游戏
 */

/**
 * 检查 landmarks 是否含关键关节（双肩 11,12 或双髋 23,24）
 * 用于判断检测到的 landmark 是否来自完整人体（而非单手臂等误检）
 */
export function hasKeyJoints(
  landmarks: any[],
  visibilityThreshold: number = 0.5
): boolean {
  const keyIndices = [11, 12, 23, 24];
  return keyIndices.some(i =>
    landmarks[i] && (landmarks[i].visibility ?? 0) >= visibilityThreshold
  );
}
