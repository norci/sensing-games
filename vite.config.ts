import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
    allowedHosts: ['ryzen.tail5472a9.ts.net', '.tail5472a9.ts.net'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  plugins: [{
    name: 'serve-wasm',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/wasm/')) {
          const fileName = req.url.slice(5).split('?')[0];
          const filePath = path.join(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm', fileName);

          try {
            const stat = await fs.promises.stat(filePath);
            const ext = path.extname(filePath);
            const mimeTypes: Record<string, string> = {
              '.js': 'application/javascript',
              '.wasm': 'application/wasm',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filePath).pipe(res);
          } catch {
            res.statusCode = 404;
            res.end();
          }
          return;
        }
        next();
      });
    }
  }]
});
