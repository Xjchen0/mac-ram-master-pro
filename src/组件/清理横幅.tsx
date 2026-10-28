import React from 'react';
import { Box, Text } from 'ink';
import type { 清理结果 } from '../类型.js';
import { 字节转GB } from '../格式化.js';
import { 危险色, 强调色 } from '../配色.js';

interface 属性 {
    清理结果: 清理结果 | null;
}

/**
 * 横幅无论有没有内容都固定占 2 行。
 * 结果出现和消失时如果让布局自己撑开，整个界面会上下跳两格，
 * 在原地重绘的 TUI 里比在 GUI 里刺眼得多。
 *
 * 不加边框：边框会把它撑到 4 行，空闲时界面中间就是一大块空洞。
 * 靠颜色和加粗已经足够醒目。
 */
const 横幅高度 = 2;

function 生成主文案(结果: 清理结果): string {
    if (!结果.成功) {
        const 退出码部分 = 结果.退出码 === null ? '' : `（退出码 ${结果.退出码}）`;
        return `清理未完成${退出码部分}：${结果.错误信息}`;
    }
    // 释放量为 0 时不能谎报「已释放 0.00 GB」，那会让人以为清理生效了
    const 释放文本 =
        结果.释放字节 > 0 ? `已释放 ${字节转GB(结果.释放字节)} GB` : '未测得可释放内存变化';
    return `${释放文本} · 耗时 ${结果.耗时毫秒}ms`;
}

/**
 * 旧 GUI 版本只处理了 success 分支，purge 失败时界面什么都不显示，
 * 用户无法区分「清理成功」和「根本没权限」。这里把失败摆到台面上，
 * 并给出可执行的下一步 —— 这是本工具最容易被误解的地方。
 */
function 清理横幅({ 清理结果 }: 属性) {
    // 空位不留白：占位文案既填满了固定高度，也顺手教会用户 c 是清理键
    if (!清理结果) {
        return (
            <Box height={横幅高度}>
                <Text dimColor wrap="truncate-end">
                    按 c 清理内存，结果显示在这里
                </Text>
            </Box>
        );
    }

    const 颜色 = 清理结果.成功 ? 强调色 : 危险色;
    const 提示 = 清理结果.成功
        ? '按 c 可再次清理'
        : '/usr/sbin/purge 属主是 root:wheel，需要管理员权限才会生效';

    return (
        <Box height={横幅高度} flexDirection="column">
            <Text color={颜色} bold wrap="truncate-end">
                {生成主文案(清理结果)}
            </Text>
            <Text dimColor wrap="truncate-end">
                {提示}
            </Text>
        </Box>
    );
}

export default React.memo(清理横幅);
