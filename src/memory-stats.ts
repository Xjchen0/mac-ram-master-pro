/**
 * [Mentor Note] 内存解析层
 *
 * 本模块只做「字符串 → 数字」的纯计算，不 import child_process，
 * 因此可以在任意操作系统上被单元测试直接覆盖（CI 用 ubuntu runner 即可）。
 *
 * ⚠️ 页大小（Page Size）必须由 vm_stat 自己声明的头部解析，绝不能硬编码：
 *    Intel Mac 是 4096 字节，Apple Silicon 是 16384 字节。
 *    历史版本把 4096 写死，导致所有 Apple Silicon 机器上的内存数值被低估整整 4 倍
 *    （实测同一时刻：显示 15.0%，真实 59.9%）。
 *
 * 关于「已用内存」的口径：这里沿用 wired + active + compressor。
 * 它与活动监视器的「已使用内存」并不完全相等 —— 活动监视器约为
 * App Memory（匿名页）+ Wired + Compressed，且不含 active 里的 file-backed 页。
 * 因此两者可能相差几个百分点，这是口径差异而非 bug。
 */

import type { 内存统计结果 } from './类型.js';

/** 页大小兜底值：Apple Silicon 全部为 16384（vm_stat 头部缺失时的保守回退） */
export const 默认页大小 = 16384;

/** vm_stat 首行形如：Mach Virtual Memory Statistics: (page size of 16384 bytes) */
const 页大小正则 = /page size of (\d+) bytes/;

/**
 * 冒号锚定是刻意的：它保证 "Pages active" 不会命中 "Pages inactive:"
 * 或 "Pages reactivated:" 这两行。放宽成前缀匹配会立刻读到错误的页数。
 */
const 字段关键字 = [
    'Pages wired down',
    'Pages active',
    'Pages inactive',
    'Pages occupied by compressor',
] as const;

type 字段名 = (typeof 字段关键字)[number];

/** 正则提升为模块级常量，避免每次采样重新编译（旧实现每 tick 编译 5 个） */
const 字段正则表: ReadonlyMap<字段名, RegExp> = new Map(
    字段关键字.map((关键字) => [关键字, new RegExp(`${关键字}:\\s+(\\d+)`)])
);

/**
 * 从 vm_stat 头部解析真实页大小。
 * 头部缺失或非法时回退到 默认页大小 并告警 —— 不抛异常，
 * 因为调用方拿到 null 时 UI 会保留上一次有效状态，抛异常只会把可恢复的降级变成崩溃。
 */
export function 解析页大小(输出: string): number {
    const 匹配 = 页大小正则.exec(输出);
    if (!匹配) {
        console.warn(`[memory-stats] vm_stat 未声明页大小，回退到 ${默认页大小} 字节`);
        return 默认页大小;
    }
    const 页大小 = parseInt(匹配[1], 10);
    if (!Number.isFinite(页大小) || 页大小 <= 0) {
        console.warn(`[memory-stats] vm_stat 页大小非法（${匹配[1]}），回退到 ${默认页大小} 字节`);
        return 默认页大小;
    }
    return 页大小;
}

/**
 * 单遍解析 vm_stat 全文。必需字段缺失、输出畸形或总内存非法时返回 null。
 * 每行只尝试尚未命中的关键字，取代旧实现里针对全文的多次独立扫描。
 */
export function 解析内存统计(输出: string, 总字节: number): 内存统计结果 | null {
    if (!Number.isFinite(总字节) || 总字节 <= 0) return null;

    const 页大小 = 解析页大小(输出);
    const 页数 = new Map<字段名, number>();
    const 待查 = new Set<字段名>(字段关键字);

    for (const 行 of 输出.split('\n')) {
        for (const 关键字 of 待查) {
            const 匹配 = 字段正则表.get(关键字)!.exec(行);
            if (匹配) {
                页数.set(关键字, parseInt(匹配[1], 10));
                待查.delete(关键字);
            }
        }
        if (待查.size === 0) break;
    }

    if (待查.size > 0) {
        console.warn(`[memory-stats] vm_stat 输出缺少字段: ${[...待查].join(', ')}`);
        return null;
    }

    const 取字节 = (关键字: 字段名) => (页数.get(关键字) ?? 0) * 页大小;

    const 已用字节 =
        取字节('Pages wired down') + 取字节('Pages active') + 取字节('Pages occupied by compressor');

    return {
        已用字节,
        可释放字节: 取字节('Pages inactive'),
        总字节,
        已用百分比: Math.round((已用字节 / 总字节) * 1000) / 10,
    };
}

/**
 * 清理前后的 inactive（可释放）页差值，即 purge 真正腾出的空间。
 * 负值截断为 0（清理期间其它进程可能又占用了内存）；任一侧采集失败返回 0。
 */
export function 计算释放字节(清理前: 内存统计结果 | null, 清理后: 内存统计结果 | null): number {
    if (!清理前 || !清理后) return 0;
    return Math.max(0, 清理前.可释放字节 - 清理后.可释放字节);
}
