import { Point, Circle } from './math-utils.js';

// 重新导出 math-utils 中的碰撞相关函数
export { lineCircleIntersect, pointToLineDistance } from './math-utils.js';

/**
 * 检测两个圆是否碰撞
 * @param a 圆 a
 * @param b 圆 b
 * @returns 是否碰撞
 */
export function circleCircleIntersect(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = a.radius + b.radius;
  return distSq <= radiusSum * radiusSum;
}

/**
 * 检测点是否在圆内
 * @param point 点
 * @param circle 圆
 * @returns 点是否在圆内
 */
export function pointInCircle(point: Point, circle: Circle): boolean {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/**
 * 检测矩形与圆是否碰撞
 * @param rect 矩形（x,y 为左上角）
 * @param circle 圆
 * @returns 是否碰撞
 */
export function rectCircleIntersect(
  rect: { x: number; y: number; width: number; height: number },
  circle: Circle
): boolean {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}
