import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import { 采集内存统计, 执行清理 } from './内存.js';
import { 字节转GB } from './格式化.js';
import { 强调色, 危险色 } from './配色.js';
import type { 内存统计结果, 清理结果 } from './类型.js';
import 仪表盘 from './组件/仪表盘.js';
import 详情面板 from './组件/详情面板.js';
import 清理横幅 from './组件/清理横幅.js';
import 快捷键提示 from './组件/快捷键提示.js';

export const 轮询间隔毫秒 = 2000;

/**
 * 过渡动效的下界。purge 常常几十毫秒就返回（失败时尤其快，实测 21ms），
 * 状态一闪而过会让人以为没响应。但这个等待是有上界的 ——
 * 失败原因最多 600ms 就会出现，不再是旧 GUI 版本那样无论成败都固定演满 2 秒。
 */
const 最短清理动效毫秒 = 600;

/** 结果横幅停留时长，足够读完一条错误信息 */
const 横幅停留毫秒 = 5000;

/** 连续失败多少次才改口报错：单次失败很可能只是 vm_stat 恰好被系统卡了一下 */
const 连续失败容忍次数 = 3;

const 延迟 = (毫秒: number) => new Promise<void>((解决) => setTimeout(解决, 毫秒));

// 纯静态子树提升为模块级常量，永不参与 diff
const 标题栏 = (
    <Box justifyContent="space-between">
        <Text bold color={强调色}>
            RAM MASTER
        </Text>
        <Text dimColor>Terminal Edition</Text>
    </Box>
);

interface 属性 {
    /**
     * stdout 不是终端时传 false：只采一次样、不轮询、不监听按键。
     * 否则 `ram-master > log.txt` 会无限追加帧，把文件灌满。
     */
    交互模式?: boolean;
    /** 非交互模式下，唯一一次采样渲染完毕后回调，供入口退出进程 */
    on采样结束?: (成功: boolean) => void;
}

function App({ 交互模式 = true, on采样结束 }: 属性) {
    const { exit, waitUntilRenderFlush } = useApp();
    const { isRawModeSupported } = useStdin();
    const 可接收按键 = 交互模式 && isRawModeSupported;

    const [系统状态, 设置系统状态] = useState<内存统计结果 | null>(null);
    const [正在清理, 设置正在清理] = useState(false);
    const [清理结果, 设置清理结果] = useState<清理结果 | null>(null);
    const [已暂停, 设置已暂停] = useState(false);
    const [连续失败, 设置连续失败] = useState(0);

    useEffect(() => {
        /**
         * 取消标记是必需的：暂停或卸载之后才返回的采样结果必须丢弃，
         * 否则慢一拍到达的响应会覆盖暂停时刻的画面，让「已暂停」变成假的。
         * 这与旧 GUI 版本卸载后 setState 的泄漏是同一类问题。
         */
        let 已取消 = false;

        const 取一次 = async () => {
            const 数据 = await 采集内存统计();
            if (已取消) return null;
            if (数据) {
                设置系统状态(数据);
                设置连续失败(0);
            } else {
                设置连续失败((旧值) => 旧值 + 1);
            }
            return 数据;
        };

        if (!交互模式) {
            void (async () => {
                const 数据 = await 取一次();
                if (已取消) return;
                // 等这一帧真正写出去再退出，否则非交互模式会输出空界面
                await waitUntilRenderFlush();
                on采样结束?.(Boolean(数据));
                exit();
            })();
            return () => {
                已取消 = true;
            };
        }

        if (已暂停) {
            return () => {
                已取消 = true;
            };
        }

        void 取一次();
        const 计时器 = setInterval(() => void 取一次(), 轮询间隔毫秒);

        return () => {
            已取消 = true;
            clearInterval(计时器);
        };
    }, [交互模式, 已暂停, on采样结束, waitUntilRenderFlush, exit]);

    // 横幅自动消失由 effect 驱动，清理函数连带清掉定时器；
    // 旧实现是两个从未被 clearTimeout 的嵌套 setTimeout，卸载后照样触发 setState。
    useEffect(() => {
        if (!清理结果) return;
        const 计时器 = setTimeout(() => 设置清理结果(null), 横幅停留毫秒);
        return () => clearTimeout(计时器);
    }, [清理结果]);

    const 执行一键清理 = useCallback(async () => {
        设置正在清理(true);
        设置清理结果(null);

        const [结果] = await Promise.all([执行清理(), 延迟(最短清理动效毫秒)]);

        设置正在清理(false);
        设置清理结果(结果);
    }, []);

    useInput(
        (输入, key) => {
            if (输入 === 'q' || key.escape) {
                exit();
                return;
            }
            if (输入 === 'p') {
                设置已暂停((旧值) => !旧值);
                return;
            }
            // 清理进行中忽略重复按键，否则会并发起多个 purge 并把释放量算乱
            if (输入 === 'c' && !正在清理) void 执行一键清理();
        },
        { isActive: 可接收按键 }
    );

    const 详情 = useMemo(() => {
        if (!系统状态) return null;
        return {
            已用文本: 字节转GB(系统状态.已用字节),
            可释放文本: 字节转GB(系统状态.可释放字节),
            总计文本: 字节转GB(系统状态.总字节),
        };
    }, [系统状态]);

    // 非交互模式只采一次样，没有「下一次」可以等，一次失败就是最终答案。
    // 沿用容忍次数的话脚本会拿到退出码 1，屏幕上却还写着「正在读取内存状态…」——
    // 这正好是本项目一直在消除的那种谎报。
    const 读取失败 = !系统状态 && 连续失败 >= (交互模式 ? 连续失败容忍次数 : 1);

    return (
        <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
            {标题栏}

            {读取失败 ? (
                <Box flexDirection="column" borderStyle="round" borderColor={危险色} paddingX={1}>
                    <Text color={危险色} bold>
                        无法读取内存数据
                    </Text>
                    {/* 这里刻意不 truncate：非交互模式下 Ink 按虚拟的 80 列裁剪，
                        排错信息会被切掉尾巴；而错误面板是整块替换数据面板，多一行不会引起跳动 */}
                    <Text dimColor>
                        已连续 {连续失败} 次采样失败。本工具依赖 vm_stat 与 sysctl，请确认正在 macOS 上运行。
                    </Text>
                </Box>
            ) : 详情 && 系统状态 ? (
                <Box
                    flexDirection="column"
                    borderStyle="round"
                    borderColor={强调色}
                    paddingX={1}
                    gap={1}
                >
                    <仪表盘 已用百分比={系统状态.已用百分比} />
                    <详情面板
                        已用文本={详情.已用文本}
                        可释放文本={详情.可释放文本}
                        总计文本={详情.总计文本}
                    />
                </Box>
            ) : (
                <Text dimColor>正在读取内存状态…</Text>
            )}

            <清理横幅 清理结果={清理结果} />

            <快捷键提示
                正在清理={正在清理}
                已暂停={已暂停}
                刷新秒数={交互模式 ? 轮询间隔毫秒 / 1000 : null}
                支持按键={可接收按键}
            />
        </Box>
    );
}

export default App;
