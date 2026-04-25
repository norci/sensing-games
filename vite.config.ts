import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
    allowedHosts: true,  // 允许任意域名访问（Tailscale 等）
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
