import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// root 指向渲染进程目录，产物才是常规的 dist/renderer/index.html。
// 若沿用仓库根作为 root，Vite 会把输入路径整体保留下来，
// 产出 dist/renderer/src/renderer/index.html，主进程几乎不可能猜对。
export default defineConfig({
    plugins: [react()],
    base: './',
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'public'),
    build: {
        outDir: resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true
    }
});
