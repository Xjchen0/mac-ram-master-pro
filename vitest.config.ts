import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * 独立于 vite.config.ts。
 * 那份配置带着 root / base / publicDir / build 等纯构建关注点，
 * 混进来会让测试运行去解析 index.html 入口，且 root 被改到 src/renderer 后
 * tests/ 目录会落在 root 之外。
 */
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        globals: true,
        include: ['tests/**/*.test.{ts,tsx}'],
        // App.tsx 会 import './global.css'，测试里当作空模块处理
        css: false
    }
});
