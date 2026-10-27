/**
 * vm_stat 输出样本。
 * 测试完全基于这些文本，不会真的执行 vm_stat，因此可以在 ubuntu runner 上跑。
 */

/** 实机采集：Apple Silicon（arm64），页大小 16384 */
export const 样本_arm64_16384 = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    24096.
Pages active:                                 358873.
Pages inactive:                               357790.
Pages speculative:                               294.
Pages throttled:                                   0.
Pages wired down:                             157231.
Pages purgeable:                                9425.
"Translation faults":                      948925113.
Pages copy-on-write:                        45137308.
Pages zero filled:                            725196382.
Pages reactivated:                          31006573.
Pages purged:                                4370963.
File-backed pages:                            230368.
Anonymous pages:                              486589.
Pages stored in compressor:                   243190.
Pages occupied by compressor:                 111587.
Decompressions:                             17719188.
Compressions:                               37086107.
Pageins:                                   131458852.
Pageouts:                                       5961.
Swapins:                                      430345.
Swapouts:                                    1712468.`;

/**
 * 与上面**完全相同的页数**，只把页大小声明换成 Intel 的 4096。
 * 这样「同一份页数据在两种页大小下必须恰好差 4 倍」这条回归断言才能精确成立 ——
 * 它钉死的正是历史上把 4096 写死、导致 Apple Silicon 数值被低估 4 倍的 bug。
 */
export const 样本_intel_4096 = 样本_arm64_16384.replace(
    'page size of 16384 bytes',
    'page size of 4096 bytes'
);

/** 各字段取值刻意错开，用于验证冒号锚定没有被 inactive / reactivated 污染 */
export const 样本_易混淆 = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                                        100.
Pages active:                                      200.
Pages inactive:                                    300.
Pages speculative:                                 400.
Pages throttled:                                     0.
Pages wired down:                                  500.
Pages purgeable:                                   600.
Pages reactivated:                                9999.
Pages purged:                                     8888.
File-backed pages:                                7777.
Anonymous pages:                                  6666.
Pages stored in compressor:                       5555.
Pages occupied by compressor:                      700.`;

/** 头部缺少页大小声明 */
export const 样本_无页大小头部 = `Mach Virtual Memory Statistics:
Pages free:                                        100.
Pages active:                                      200.
Pages inactive:                                    300.
Pages wired down:                                  400.
Pages occupied by compressor:                      500.`;

/** 缺少 compressor 与 inactive 字段 */
export const 样本_缺字段 = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                        100.
Pages active:                                      200.
Pages wired down:                                  300.`;

/** 畸形输出 */
export const 样本_畸形 = `Mach Virtual Memory Statistics:
Pages free:              (garbage).
Pages active:`;

/** 样本_arm64_16384 的期望值，手算得出，测试直接引用 */
export const 期望 = {
    联动页: 157231,
    活跃页: 358873,
    非活跃页: 357790,
    压缩页: 111587,
    总字节: 17179869184 // 16 GiB，本机 hw.memsize 实测值
};
