import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    解析页大小,
    解析内存统计,
    计算释放字节,
    默认页大小
} from '../src/main/memory-stats';
import {
    样本_arm64_16384,
    样本_intel_4096,
    样本_易混淆,
    样本_无页大小头部,
    样本_缺字段,
    样本_畸形,
    期望
} from './fixtures/vm-stat-样本';

const 已用页 = 期望.联动页 + 期望.活跃页 + 期望.压缩页;

afterEach(() => {
    vi.restoreAllMocks();
});

describe('解析页大小', () => {
    it('从 Apple Silicon 的 vm_stat 头部解析出 16384', () => {
        expect(解析页大小(样本_arm64_16384)).toBe(16384);
    });

    it('从 Intel 的 vm_stat 头部解析出 4096', () => {
        expect(解析页大小(样本_intel_4096)).toBe(4096);
    });

    it('头部缺失时回退到默认值并告警，而不是抛异常', () => {
        const 告警 = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(解析页大小(样本_无页大小头部)).toBe(默认页大小);
        expect(告警).toHaveBeenCalledOnce();
    });

    it('页大小非法（0）时同样回退', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(解析页大小('Mach Virtual Memory Statistics: (page size of 0 bytes)')).toBe(默认页大小);
    });
});

describe('解析内存统计', () => {
    it('按真实页大小 16384 算出字节数与百分比', () => {
        const 结果 = 解析内存统计(样本_arm64_16384, 期望.总字节);

        expect(结果).not.toBeNull();
        expect(结果!.已用字节).toBe(已用页 * 16384);
        expect(结果!.可释放字节).toBe(期望.非活跃页 * 16384);
        expect(结果!.总字节).toBe(期望.总字节);
        expect(结果!.已用百分比).toBe(59.9);
    });

    /**
     * 这条是钉死历史 bug 的回归测试：
     * 旧实现把页大小写死成 4096，于是同一台 Apple Silicon 机器上
     * 显示 15.0% 而真实是 59.9% —— 整整低估 4 倍。
     */
    it('同一份页数据在两种页大小下必须恰好相差 4 倍', () => {
        const arm64 = 解析内存统计(样本_arm64_16384, 期望.总字节)!;
        const intel = 解析内存统计(样本_intel_4096, 期望.总字节)!;

        expect(arm64.已用字节).toBe(intel.已用字节 * 4);
        expect(arm64.可释放字节).toBe(intel.可释放字节 * 4);
        expect(intel.已用百分比).toBe(15.0);
    });

    it('已用内存 = wired + active + compressor', () => {
        const 结果 = 解析内存统计(样本_arm64_16384, 期望.总字节)!;
        expect(结果.已用字节).toBe(
            (期望.联动页 + 期望.活跃页 + 期望.压缩页) * 16384
        );
    });

    it('"Pages active" 不会被 "Pages inactive" 或 "Pages reactivated" 污染', () => {
        const 结果 = 解析内存统计(样本_易混淆, 1024 * 1024 * 1024)!;

        // 若冒号锚定失效，active 会读到 300(inactive) 或 9999(reactivated)，结果完全不同
        expect(结果.已用字节).toBe((500 + 200 + 700) * 4096);
        expect(结果.可释放字节).toBe(300 * 4096);
    });

    it('百分比保留一位小数', () => {
        const 结果 = 解析内存统计(样本_arm64_16384, 期望.总字节)!;
        expect(String(结果.已用百分比)).toMatch(/^\d+(\.\d)?$/);
    });

    it('缺少必需字段时返回 null', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(解析内存统计(样本_缺字段, 期望.总字节)).toBeNull();
    });

    it('畸形输出返回 null', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(解析内存统计(样本_畸形, 期望.总字节)).toBeNull();
    });

    it('总内存非法时返回 null，避免除零得出 Infinity', () => {
        expect(解析内存统计(样本_arm64_16384, 0)).toBeNull();
        expect(解析内存统计(样本_arm64_16384, -1)).toBeNull();
        expect(解析内存统计(样本_arm64_16384, NaN)).toBeNull();
    });
});

describe('计算释放字节', () => {
    const 快照 = (可释放字节: number) => ({
        已用字节: 0,
        可释放字节,
        总字节: 期望.总字节,
        已用百分比: 0
    });

    it('返回清理前后可释放内存的正差值', () => {
        expect(计算释放字节(快照(5_000_000_000), 快照(3_000_000_000))).toBe(2_000_000_000);
    });

    it('差值为负时截断到 0（清理期间其它进程又占了内存）', () => {
        expect(计算释放字节(快照(3_000_000_000), 快照(5_000_000_000))).toBe(0);
    });

    it('任一侧采集失败时返回 0，不抛异常', () => {
        expect(计算释放字节(null, 快照(1))).toBe(0);
        expect(计算释放字节(快照(1), null)).toBe(0);
        expect(计算释放字节(null, null)).toBe(0);
    });
});
