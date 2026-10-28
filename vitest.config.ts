import { defineConfig } from 'vitest/config';

/**
 * 与 tsconfig 分开的独立配置：构建关心的是 src → dist 的 ESM 产物，
 * 测试关心的是 node 环境下跑 tests/，两者的关注点不该混在一份文件里。
 */
export default defineConfig({
    test: {
        // 不再有 DOM：Ink 把 React 渲染成终端字符，node 环境就够了，
        // 也因此不需要 jsdom 和为 framer-motion 准备的 matchMedia 桩。
        environment: 'node',
        include: ['tests/**/*.test.{ts,tsx}'],
        setupFiles: ['tests/setup.ts'],
    },
});
