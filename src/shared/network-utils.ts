// 检测当前客户端是否通过局域网访问
// 如果是局域网访问，资源从本地服务器加载（更快）
// 如果是外网访问，资源从 CDN 加载（本地服务器不可达）

const LAN_PATTERS: RegExp[] = [
  /^127\./,           // 127.0.0.1
  /^10\./,           // 10.x.x.x
  /^192\.168\./,    // 192.168.x.x
  /^::1$/,           // IPv6 localhost
  /^fd/,             // IPv6 ULA (local)
  /^169\.254\./,    // Link-local
];

// 匹配 172.16.0.0/12
function isPrivate172(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const second = parseInt(parts[1], 10);
  return second >= 16 && second <= 31;
}

export function isLanClient(): boolean {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;

  // localhost 也算局域网
  if (host === 'localhost' || host === '127.0.0.1') return true;

  for (const pattern of LAN_PATTERS) {
    if (pattern.test(host)) return true;
  }

  if (isPrivate172(host)) return true;

  return false;
}

// 获取 WASM 基础路径
// 局域网：从本地 node_modules 加载（Vite dev server 自动 serve）
// 外网：从 jsDelivr CDN 加载
export function getWasmPath(): string {
  if (isLanClient()) {
    // Vite 会自动 serve /node_modules/ 下的文件
    return '/node_modules/@mediapipe/tasks-vision/wasm';
  }
  return 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
}
