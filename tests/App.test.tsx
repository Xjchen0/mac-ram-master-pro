import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/renderer/App';
import type { 内存统计结果, 清理结果 } from '../src/shared/ipc-contracts';

const 采样结果: 内存统计结果 = {
    已用字节: 10_284_089_344, // 9.58 GB
    可释放字节: 5_862_031_360, // 5.46 GB
    总字节: 17_179_869_184,
    已用百分比: 59.9
};

const 轮询间隔 = 2000;
const 最短清理动效 = 600;
const 横幅停留 = 5000;

let 获取内存数据: Mock<[], Promise<内存统计结果 | null>>;
let 执行大扫除: Mock<[], Promise<清理结果>>;
let 有焦点: boolean;

/** 推进假定时器，同时冲刷 promise 微任务 */
const 推进 = async (毫秒: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(毫秒);
    });
};

const 设置可见性 = async (值: 'visible' | 'hidden') => {
    await act(async () => {
        Object.defineProperty(document, 'visibilityState', { value: 值, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

const 派发窗口事件 = async (名称: 'focus' | 'blur') => {
    await act(async () => {
        window.dispatchEvent(new Event(名称));
    });
};

/** 渲染并冲刷首次采样，让界面离开加载屏 */
const 渲染并就绪 = async () => {
    const 结果 = render(<App />);
    await 推进(0);
    return 结果;
};

beforeEach(() => {
    获取内存数据 = vi.fn<[], Promise<内存统计结果 | null>>().mockResolvedValue(采样结果);
    执行大扫除 = vi.fn<[], Promise<清理结果>>().mockResolvedValue({
        成功: true,
        耗时毫秒: 143,
        释放字节: 1_073_741_824,
        退出码: 0
    });
    window.electronAPI = { 获取内存数据, 执行大扫除 };

    // jsdom 的 hasFocus / visibilityState 行为随版本而异，显式钉住以保证确定性
    有焦点 = true;
    vi.spyOn(document, 'hasFocus').mockImplementation(() => 有焦点);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('首屏与数据渲染', () => {
    it('首次采样返回前显示加载屏', async () => {
        render(<App />);
        expect(screen.getByText('正在监测系统状态...')).toBeInTheDocument();
        // 消费掉挂起的 setState，否则它会在用例结束后触发 act 警告
        await 推进(0);
    });

    it('挂载后立即取一次数，之后每 2 秒一次', async () => {
        render(<App />);
        await 推进(0);
        expect(获取内存数据).toHaveBeenCalledTimes(1);

        await 推进(轮询间隔);
        expect(获取内存数据).toHaveBeenCalledTimes(2);

        await 推进(轮询间隔);
        expect(获取内存数据).toHaveBeenCalledTimes(3);
    });

    it('把契约里的字节数与百分比渲染成界面文本', async () => {
        await 渲染并就绪();

        expect(screen.getByText('60')).toBeInTheDocument(); // Math.round(59.9)
        expect(screen.getByText('9.58')).toBeInTheDocument(); // Occupied GB
        expect(screen.getByText('5.46')).toBeInTheDocument(); // Purgeable GB
        expect(screen.getByText('RAM MASTER')).toBeInTheDocument();
    });

    it('采样返回 null 时保留上一次有效状态，不回退到加载屏', async () => {
        await 渲染并就绪();
        获取内存数据.mockResolvedValue(null);

        await 推进(轮询间隔);

        expect(screen.getByText('60')).toBeInTheDocument();
        expect(screen.queryByText('正在监测系统状态...')).not.toBeInTheDocument();
    });
});

describe('轮询的可见性门控', () => {
    it('窗口隐藏后停止轮询，恢复可见后立即继续', async () => {
        await 渲染并就绪();
        const 隐藏前次数 = 获取内存数据.mock.calls.length;

        await 设置可见性('hidden');
        await 推进(轮询间隔 * 5);
        expect(获取内存数据).toHaveBeenCalledTimes(隐藏前次数);

        await 设置可见性('visible');
        expect(获取内存数据).toHaveBeenCalledTimes(隐藏前次数 + 1);
    });

    /**
     * visibilitychange 覆盖不到「别的应用抢走焦点但本窗口仍可见」这种情况，
     * 所以必须同时监听 window 的 blur / focus。
     */
    it('失焦后停止轮询，重新聚焦后继续', async () => {
        await 渲染并就绪();
        const 失焦前次数 = 获取内存数据.mock.calls.length;

        有焦点 = false;
        await 派发窗口事件('blur');
        await 推进(轮询间隔 * 5);
        expect(获取内存数据).toHaveBeenCalledTimes(失焦前次数);

        有焦点 = true;
        await 派发窗口事件('focus');
        expect(获取内存数据).toHaveBeenCalledTimes(失焦前次数 + 1);
    });

    it('重复收到 focus 事件不会叠加出多个计时器', async () => {
        await 渲染并就绪();
        await 派发窗口事件('focus');
        await 派发窗口事件('focus');

        const 基准 = 获取内存数据.mock.calls.length;
        await 推进(轮询间隔);
        expect(获取内存数据).toHaveBeenCalledTimes(基准 + 1);
    });

    it('卸载后彻底停止轮询', async () => {
        const { unmount } = await 渲染并就绪();
        const 卸载前次数 = 获取内存数据.mock.calls.length;

        unmount();
        await 推进(轮询间隔 * 5);

        expect(获取内存数据).toHaveBeenCalledTimes(卸载前次数);
    });
});

describe('渲染稳定性（旧实现每轮采样都会重挂载数值节点）', () => {
    it('百分比变化时复用同一个 DOM 节点，而不是卸载重建', async () => {
        await 渲染并就绪();
        const 数值节点 = screen.getByText('60');

        获取内存数据.mockResolvedValue({ ...采样结果, 已用百分比: 61.2 });
        await 推进(轮询间隔);

        // 旧实现写着 key={系统状态.percentage}，每轮采样都会让这个节点被整棵重建
        expect(screen.getByText('61')).toBe(数值节点);
    });

    it('数值未变时不触发多余的 DOM 更新', async () => {
        await 渲染并就绪();
        const 数值节点 = screen.getByText('60');

        await 推进(轮询间隔);
        await 推进(轮询间隔);

        expect(screen.getByText('60')).toBe(数值节点);
    });
});

describe('一键清理如实上报', () => {
    it('点击后进入清理态并禁用按钮', async () => {
        await 渲染并就绪();
        let 已解决 = false;
        执行大扫除.mockImplementation(
            () =>
                new Promise((解决) => {
                    setTimeout(() => {
                        已解决 = true;
                        解决({ 成功: true, 耗时毫秒: 900, 释放字节: 0, 退出码: 0 });
                    }, 900);
                })
        );

        fireEvent.click(screen.getByRole('button'));
        await 推进(100);

        expect(screen.getByText('PURGING SYSTEM...')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
        expect(已解决).toBe(false);
    });

    it('成功时展示真实释放量与耗时', async () => {
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        expect(screen.getByText(/已释放 1\.00 GB/)).toBeInTheDocument();
        expect(screen.getByText(/耗时 143ms/)).toBeInTheDocument();
        expect(screen.getByRole('button')).not.toBeDisabled();
    });

    /**
     * 这条覆盖的正是旧实现完全静默的路径：
     * 旧代码只有 `if (结果.success)` 没有 else，purge 因权限不足失败时
     * 用户看到的仍然是一段 2 秒的成功动画。
     */
    it('失败时展示错误横幅与退出码，而不是静默', async () => {
        执行大扫除.mockResolvedValue({
            成功: false,
            耗时毫秒: 14,
            退出码: 1,
            错误信息: 'Unable to purge disk buffers: Operation not permitted'
        });
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        expect(screen.getByText(/清理未完成（退出码 1）/)).toBeInTheDocument();
        expect(screen.getByText(/Operation not permitted/)).toBeInTheDocument();
        expect(screen.queryByText(/已释放/)).not.toBeInTheDocument();
    });

    it('退出码拿不到时不显示括号，但依然报错', async () => {
        执行大扫除.mockResolvedValue({
            成功: false,
            耗时毫秒: 8,
            退出码: null,
            错误信息: 'purge 被信号终止'
        });
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        expect(screen.getByText(/清理未完成：purge 被信号终止/)).toBeInTheDocument();
        expect(screen.queryByText(/退出码/)).not.toBeInTheDocument();
    });

    it('成功但没测得内存变化时如实说明，不谎报释放量', async () => {
        执行大扫除.mockResolvedValue({
            成功: true,
            耗时毫秒: 220,
            释放字节: 0,
            退出码: 0
        });
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        expect(screen.getByText(/未测得可释放内存变化/)).toBeInTheDocument();
    });

    it('失败最多等 600ms 就能看到，不再是固定演满 2 秒', async () => {
        执行大扫除.mockResolvedValue({
            成功: false,
            耗时毫秒: 14,
            退出码: 1,
            错误信息: 'Operation not permitted'
        });
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);
        expect(screen.getByText(/清理未完成/)).toBeInTheDocument();
    });

    /**
     * 这里断言定时器计数而不是「横幅从 DOM 消失」：
     * Vitest 的假定时器默认不接管 requestAnimationFrame，而 AnimatePresence 的
     * 退场动画正是靠 rAF 驱动的，所以状态清空后节点仍会挂在退场动画里不摘除。
     * 计数断言直接对应本用例要验证的东西 —— 自动隐藏的 setTimeout 被 effect 正常调度并消费。
     */
    it('停留时间到点后自动隐藏的定时器会被消费掉', async () => {
        await 渲染并就绪();
        const 稳态计时器数 = vi.getTimerCount(); // 只剩轮询的 setInterval

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);
        expect(screen.getByText(/已释放/)).toBeInTheDocument();
        expect(vi.getTimerCount()).toBe(稳态计时器数 + 1); // 多出一个自动隐藏 setTimeout

        await 推进(横幅停留 + 100);
        expect(vi.getTimerCount()).toBe(稳态计时器数); // 已触发，定时器归还
    });

    it('卸载时清掉轮询与自动隐藏定时器，不留悬挂计时器', async () => {
        const { unmount } = await 渲染并就绪();
        expect(vi.getTimerCount()).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        // 旧实现的两个嵌套 setTimeout 从未被 clearTimeout，卸载后照样触发 setState
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('再次清理会先清掉上一条横幅', async () => {
        await 渲染并就绪();

        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);
        expect(screen.getByText(/已释放 1\.00 GB/)).toBeInTheDocument();

        执行大扫除.mockResolvedValue({
            成功: false,
            耗时毫秒: 9,
            退出码: 1,
            错误信息: 'Operation not permitted'
        });
        fireEvent.click(screen.getByRole('button'));
        await 推进(最短清理动效 + 50);

        expect(screen.getByText(/清理未完成/)).toBeInTheDocument();
        expect(screen.queryByText(/已释放/)).not.toBeInTheDocument();
    });
});
