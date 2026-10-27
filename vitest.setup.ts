import '@testing-library/jest-dom/vitest';

// jsdom 没有实现 matchMedia，而 framer-motion 初始化时会读取它
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia;
}
