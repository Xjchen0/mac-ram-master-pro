import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { render } from 'ink-testing-library';
import App, { 轮询间隔毫秒 } from '../src/App.js';
import { 采集内存统计, 执行清理 } from '../src/内存.js';
import type { 内存统计结果, 清理结果 } from '../src/类型.js';

vi.mock('../src/内存.js', () => ({
    采集内存统计: vi.fn(),
    执行清理: vi.fn(),
}));

const 采样 = vi.mocked(采集内存统计);
const 清理 = vi.mocked(执行清理);

const 采样结果: 内存统计结果 = {
    已用字节: 10 * 1024 ** 3,
    可释放字节: 5 * 1024 ** 3,
    总字节: 16 * 1024 ** 3,
    已用百分比: 62.5,
};

const 清理成功: 清理结果 = {
    成功: true,
    耗时毫秒: 143,
    释放字节: 1024 ** 3,
    退出码: 0,
};

const 清理失败: 清理结果 = {
    成功: false,
    耗时毫秒: 21,
    退出码: 1,
    错误信息: 'Unable to purge disk buffers: Operation not permitted',
};

/** render 放进 act 里，否则 Ink 内部的挂载副作用会打出「not wrapped in act」告警 */
function 挂载(节点: ReactElement) {
    let 实例!: ReturnType<typeof render>;
    act(() => {
        实例 = render(节点);
    });
    补上写入回调(实例.stdout);

    // 卸载同样要包在 act 里：Ink 的 unmount 会触发 React 清理与一次收尾渲染
    const 原卸载 = 实例.unmount;
    实例.unmount = () => {
        act(() => {
            原卸载();
        });
    };
    return 实例;
}

/**
 * ink-testing-library 的假 stdout.write 只收集帧、从不回调，
 * 而 Ink 的 waitUntilRenderFlush() 恰恰是靠 write('', 回调) 判断「这一帧已经写出去了」。
 * 缺了它，非交互模式会永远卡在冲刷那一步 —— 这是测试替身的缺口，不是产品行为
 * （真实 stdout 会正常回调，命令行实跑已验证）。
 */
function 补上写入回调(stdout: { write: (帧: string) => void }): void {
    const 原写入 = stdout.write;
    stdout.write = ((帧: string, 回调?: () => void) => {
        原写入(帧);
        回调?.();
    }) as (帧: string) => void;
}

/** 放行一个悬着的 mock promise，并把随之而来的 setState 收进 act */
async function 放行<T>(解决: ((值: T) => void) | undefined, 值: T): Promise<void> {
    await act(async () => {
        解决?.(值);
    });
}

/** 推进假定时器并把 React 的更新与副作用一起冲刷掉 */
async function 推进(毫秒: number): Promise<void> {
    await act(async () => {
        vi.advanceTimersByTime(毫秒);
    });
}

/** 只冲刷微任务（等 await 落地），不推进时间 */
async function 冲刷(): Promise<void> {
    await act(async () => {});
}

/** 敲一个键：Ink 同步解析输入并 setState，必须收进 act 才不会告警 */
async function 按键(stdin: { write: (数据: string) => void }, 键: string): Promise<void> {
    await act(async () => {
        stdin.write(键);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    采样.mockReset().mockResolvedValue(采样结果);
    清理.mockReset().mockResolvedValue(清理成功);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('首屏与采样', () => {
    it('采样返回前显示加载文案', () => {
        采样.mockReturnValue(new Promise(() => {}));
        const { lastFrame, unmount } = 挂载(<App />);

        expect(lastFrame()).toContain('正在读取内存状态');
        unmount();
    });

    it('采样成功后显示占用、已用、可释放与总计', async () => {
        const { lastFrame, unmount } = 挂载(<App />);
        await 冲刷();

        const 帧 = lastFrame() ?? '';
        expect(帧).toContain('62.5%');
        expect(帧).toContain('10.00 GB');
        expect(帧).toContain('5.00 GB');
        expect(帧).toContain('16.00 GB');
        unmount();
    });

    it('挂载时立刻采一次，之后按轮询间隔继续', async () => {
        const { unmount } = 挂载(<App />);
        await 冲刷();
        expect(采样).toHaveBeenCalledTimes(1);

        await 推进(轮询间隔毫秒);
        expect(采样).toHaveBeenCalledTimes(2);

        await 推进(轮询间隔毫秒 * 2);
        expect(采样).toHaveBeenCalledTimes(4);
        unmount();
    });

    it('单次失败不改口报错，连续三次才提示无法读取', async () => {
        采样.mockResolvedValue(null);
        const { lastFrame, unmount } = 挂载(<App />);

        // 挂载一次 + 一次轮询 = 两次失败，还没到阈值
        await 推进(轮询间隔毫秒);
        expect(采样).toHaveBeenCalledTimes(2);
        expect(lastFrame()).not.toContain('无法读取内存数据');

        await 推进(轮询间隔毫秒);
        expect(采样).toHaveBeenCalledTimes(3);
        expect(lastFrame()).toContain('无法读取内存数据');
        expect(lastFrame()).toContain('已连续 3 次采样失败');
        unmount();
    });

    it('一次成功就把连续失败计数清零', async () => {
        采样.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(采样结果);
        const { lastFrame, unmount } = 挂载(<App />);

        // 第 1、2 次失败，第 3 次成功 → 计数归零
        await 推进(轮询间隔毫秒 * 2);
        expect(lastFrame()).not.toContain('无法读取内存数据');

        // 再失败两次仍然不该报错，因为计数是从成功那次重新数的
        采样.mockResolvedValue(null);
        await 推进(轮询间隔毫秒 * 2);
        expect(采样).toHaveBeenCalledTimes(5);
        expect(lastFrame()).not.toContain('无法读取内存数据');
        unmount();
    });
});

describe('暂停', () => {
    it('按 p 停止轮询，再按一次恢复', async () => {
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();
        expect(采样).toHaveBeenCalledTimes(1);

        await 按键(stdin, 'p');
        expect(lastFrame()).toContain('已暂停');

        await 推进(轮询间隔毫秒 * 3);
        expect(采样).toHaveBeenCalledTimes(1);

        await 按键(stdin, 'p');
        expect(lastFrame()).not.toContain('已暂停');

        // 恢复时立刻补采一次，不让人对着两秒前的旧数据看；之后才进入正常轮询
        expect(采样).toHaveBeenCalledTimes(2);
        await 推进(轮询间隔毫秒);
        expect(采样).toHaveBeenCalledTimes(3);
        unmount();
    });

    it('暂停期间迟到的采样结果不会覆盖画面', async () => {
        let 放行采样: ((值: 内存统计结果 | null) => void) | undefined;
        采样.mockReturnValue(new Promise((解决) => void (放行采样 = 解决)));

        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 按键(stdin, 'p');

        // 暂停之后才返回的响应必须被丢弃，否则「已暂停」就是假的
        await 放行(放行采样, null);
        await 推进(轮询间隔毫秒 * 3);

        expect(lastFrame()).not.toContain('无法读取内存数据');
        unmount();
    });
});

describe('清理结果如实上报', () => {
    it('成功时显示释放量与耗时', async () => {
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);

        expect(清理).toHaveBeenCalledTimes(1);
        expect(lastFrame()).toContain('已释放 1.00 GB · 耗时 143ms');
        unmount();
    });

    /**
     * 旧 GUI 版本只处理 success 分支，purge 因权限失败时界面毫无反应，
     * 用户无从区分「清理成功」和「根本没权限」。这条是本次重写最核心的行为。
     */
    it('失败时显示退出码、原始错误与权限提示', async () => {
        清理.mockResolvedValue(清理失败);
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);

        const 帧 = lastFrame() ?? '';
        expect(帧).toContain('清理未完成（退出码 1）');
        expect(帧).toContain('root:wheel');
        unmount();
    });

    it('错误信息过长时截断，不把整屏挤乱', async () => {
        清理.mockResolvedValue({ ...清理失败, 错误信息: 'x'.repeat(200) });
        const { frames, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);

        // wrap="truncate-end" 生效时不会折行，帧数保持稳定
        expect((frames.at(-1) ?? '').split('\n').length).toBeLessThanOrEqual(20);
        unmount();
    });

    it('退出码为 null 时不编造退出码', async () => {
        清理.mockResolvedValue({ ...清理失败, 退出码: null });
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);

        expect(lastFrame()).toContain('清理未完成：');
        expect(lastFrame()).not.toContain('退出码');
        unmount();
    });

    it('释放量为 0 时不谎报已释放 0.00 GB', async () => {
        清理.mockResolvedValue({ ...清理成功, 释放字节: 0 });
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);

        expect(lastFrame()).toContain('未测得可释放内存变化');
        expect(lastFrame()).not.toContain('已释放');
        unmount();
    });

    it('清理动效有下界也有上界，不再固定演满', async () => {
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(300);
        expect(lastFrame()).toContain('清理中');

        // purge 实测 21ms 就能返回，但界面至少演满 600ms
        await 推进(300);
        expect(lastFrame()).toContain('已释放 1.00 GB');
        unmount();
    });

    it('清理进行中忽略重复按键，不会并发起多个 purge', async () => {
        let 放行清理: ((值: 清理结果) => void) | undefined;
        清理.mockReturnValue(new Promise((解决) => void (放行清理 = 解决)));

        const { stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 按键(stdin, 'c');
        await 按键(stdin, 'c');
        await 推进(600);

        expect(清理).toHaveBeenCalledTimes(1);
        await 放行(放行清理, 清理成功);
        await 推进(600);
        unmount();
    });

    it('横幅停留足够久后自动消失，回到占位文案', async () => {
        const { lastFrame, stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);
        expect(lastFrame()).toContain('已释放 1.00 GB');

        await 推进(5000);
        expect(lastFrame()).not.toContain('已释放 1.00 GB');
        expect(lastFrame()).toContain('按 c 清理内存');
        unmount();
    });
});

describe('退出与卸载', () => {
    it('按 q 卸载界面', async () => {
        const { lastFrame, stdin } = 挂载(<App />);
        await 冲刷();
        expect(lastFrame()).toContain('RAM MASTER');

        await 按键(stdin, 'q');
        expect(lastFrame() ?? '').not.toContain('RAM MASTER');
    });

    it('卸载后清掉轮询定时器，不再继续采样', async () => {
        const { unmount } = 挂载(<App />);
        await 冲刷();
        expect(采样).toHaveBeenCalledTimes(1);

        unmount();
        await 推进(轮询间隔毫秒 * 5);
        expect(采样).toHaveBeenCalledTimes(1);
    });

    it('卸载后清掉横幅定时器', async () => {
        const { stdin, unmount } = 挂载(<App />);
        await 冲刷();

        await 按键(stdin, 'c');
        await 推进(600);
        unmount();

        // 横幅的 5 秒定时器若泄漏，这里会抛「卸载后 setState」告警
        await 推进(10_000);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('非交互模式（stdout 不是终端）', () => {
    /**
     * 这条路径要等 Ink 的 waitUntilRenderFlush()，而它内部靠 setImmediate 让出宏任务。
     * 假定时器会把 immediate 一起冻结，回调永远不落地，所以这里换回真实定时器。
     */
    beforeEach(() => {
        vi.useRealTimers();
    });

    /**
     * 真实定时器下只能靠反复让出宏任务来等 Ink 的冲刷落地。
     *
     * 每次让出必须是「独立的一个 act 作用域」：React 只在 act 退出时才冲刷更新，
     * 把 20 次让出塞进同一个 act 里，App 的 采样 → 冲刷 → exit 会在 React
     * 来得及重渲染之前一路跑完，最后一帧（采样失败的报错面板）就永远写不出来。
     */
    async function 冲刷到静止(): Promise<void> {
        for (let 次 = 0; 次 < 20; 次++) {
            await act(async () => {
                await new Promise((解决) => setImmediate(解决));
            });
        }
    }

    it('只采一次样、回调成功、然后退出，不轮询', async () => {
        const on采样结束 = vi.fn();
        const { frames, unmount } = 挂载(<App 交互模式={false} on采样结束={on采样结束} />);

        await 冲刷到静止();

        expect(采样).toHaveBeenCalledTimes(1);
        expect(on采样结束).toHaveBeenCalledWith(true);
        // 退出后 Ink 会清屏，所以要在所有帧里找，不能只看最后一帧
        expect(frames.join('\n')).toContain('单次采样');
        expect(frames.join('\n')).not.toContain('每 2 秒刷新');

        await new Promise((解决) => setTimeout(解决, 50));
        expect(采样).toHaveBeenCalledTimes(1);
        unmount();
    });

    it('采样失败时如实报错，并以非零退出码收场', async () => {
        采样.mockResolvedValue(null);
        const on采样结束 = vi.fn();
        const { frames, unmount } = 挂载(<App 交互模式={false} on采样结束={on采样结束} />);

        await 冲刷到静止();

        expect(on采样结束).toHaveBeenCalledWith(false);

        /**
         * 回归测试：交互模式要连续失败 3 次才改口报错，而非交互模式只采一次样、
         * 没有「下一次」可等。沿用那个阈值的话，进程以退出码 1 结束，
         * 画面上却永远停在「正在读取内存状态…」—— 正是本项目要消除的那种谎报。
         */
        const 末帧 = [...frames].reverse().find((帧) => 帧.includes('RAM MASTER')) ?? '';
        expect(末帧).toContain('无法读取内存数据');
        expect(末帧).not.toContain('正在读取内存状态');
        unmount();
    });
});
