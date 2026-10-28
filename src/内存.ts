import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { 解析内存统计, 计算释放字节 } from './memory-stats.js';
import type { 内存统计结果, 清理结果 } from './类型.js';

const execAsync = promisify(exec);

/**
 * [Mentor Note]
 * `hw.memsize` 是内核启动时依据物理内存条确定的常量：Mac 没有内存热插拔，
 * 休眠 / 唤醒 / 切换用户都不会改变它，只有重启会变 —— 而重启会杀掉本进程。
 * 所以按进程生命周期缓存一次即可，不需要任何失效逻辑。
 *
 * 旧实现每次采样都重新 fork 一个 `/bin/sh` 去读这个常量，
 * 按 2 秒一轮算约 4.3 万次/天的纯浪费。缓存后每轮只剩 `vm_stat` 一次 fork。
 */
let 总内存缓存: Promise<number> | null = null;

export function 获取总内存(): Promise<number> {
    if (!总内存缓存) {
        总内存缓存 = execAsync('sysctl -n hw.memsize')
            .then(({ stdout }) => {
                const 值 = parseInt(stdout.trim(), 10);
                if (!Number.isFinite(值) || 值 <= 0) {
                    throw new Error(`hw.memsize 解析失败: "${stdout.trim()}"`);
                }
                return 值;
            })
            .catch((错误) => {
                // 失败不写进缓存，让下一次采样重试，避免一次瞬时故障永久污染
                总内存缓存 = null;
                throw 错误;
            });
    }
    return 总内存缓存;
}

/**
 * 采一次内存快照；任何环节失败返回 null，界面会保留上一次有效状态。
 * 这里刻意不打印错误：轮询每 2 秒一次，一次瞬时失败就刷一行 stderr
 * 会把界面淹掉。「始终读不到数据」这件事由界面层用失败计数来呈现。
 */
export async function 采集内存统计(): Promise<内存统计结果 | null> {
    try {
        const [{ stdout }, 总字节] = await Promise.all([execAsync('vm_stat'), 获取总内存()]);
        return 解析内存统计(stdout, 总字节);
    } catch {
        return null;
    }
}

/**
 * [Mentor Note]
 * `/usr/sbin/purge` 是系统自带的「用户态」命令行工具，不是内核 API，
 * 属主为 root:wheel。没有管理员权限调用时它通常以非零码退出 ——
 * 旧实现把这种失败静默吞掉，于是用户看到的永远是一段成功动画。
 * 这里如实上报退出码、耗时与真实释放量，界面负责把它显示出来。
 */
export async function 执行清理(): Promise<清理结果> {
    const 开始时刻 = Date.now();
    const 清理前 = await 采集内存统计();

    try {
        await execAsync('purge');
        const 清理后 = await 采集内存统计();
        return {
            成功: true,
            耗时毫秒: Date.now() - 开始时刻,
            释放字节: 计算释放字节(清理前, 清理后),
            退出码: 0,
        };
    } catch (错误) {
        const 详情 = (错误 ?? {}) as { stderr?: string; message?: string; code?: number };
        const 原始信息 = (详情.stderr || 详情.message || '未知错误').toString().trim();
        return {
            成功: false,
            耗时毫秒: Date.now() - 开始时刻,
            退出码: typeof 详情.code === 'number' ? 详情.code : null,
            错误信息: 原始信息.slice(0, 200) || '清理未完成',
        };
    }
}

/** 仅供测试：清掉 hw.memsize 缓存，避免用例之间互相污染 */
export function 重置缓存(): void {
    总内存缓存 = null;
}
