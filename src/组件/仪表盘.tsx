import React from 'react';
import { Box, Text } from 'ink';
import { 按占用取色 } from '../配色.js';

interface 属性 {
    已用百分比: number;
}

/**
 * 进度条用字符而不是 Box 背景色来画：背景色在 NO_COLOR、重定向到文件、
 * 16 色终端下会被 Ink 整个丢掉，进度条就变成一行空白（实测如此）。
 * 字符则总能看见形状，颜色只是附加信息。
 *
 * 另外只用 ASCII：█ ░ ▰ 属于 East Asian Ambiguous 宽度，
 * 开了「模糊宽度按双宽」的中文终端下会和 Ink 的列数计算对不上。
 */
const 填充字符 = '#';
const 空白字符 = '.';

/**
 * 足够铺满任何终端即可，多余的会被 overflow="hidden" 裁掉。
 * 这样组件不需要知道终端有多少列，resize 时由 Yoga 重新裁剪。
 */
const 足够长 = 填充字符.repeat(512);
const 足够空的长串 = 空白字符.repeat(512);

function 仪表盘({ 已用百分比 }: 属性) {
    const 夹取 = Math.min(100, Math.max(0, 已用百分比));
    const 颜色 = 按占用取色(夹取);

    return (
        <Box flexDirection="column" gap={1}>
            <Box justifyContent="space-between">
                <Text dimColor bold>
                    内存占用
                </Text>
                <Text color={颜色} bold>
                    {夹取.toFixed(1)}%
                </Text>
            </Box>
            <Box height={1} position="relative">
                {/*
                    两段必须是「叠加」而不是「并排」：百分比宽度经 Yoga 换算后是小数
                    （例如 74 列里的 55% = 40.7），并排时填充段占 0~40.7、空白段从 40.7 起，
                    取整后第 40 列谁都不写，进度条中间就凭空多出一个空格 —— 实测约一半的
                    百分比都会踩到。空白段铺满整行做底、填充段按百分比盖在上面，
                    没被盖住的列自然还是点，取整误差就落到条的末端而不是中间。

                    Ink 的 flexShrink 默认是 0（与 Web 相反），
                    超长字符串会把盒子撑到 512 列、把百分比宽度挤掉，
                    所以填充段必须显式 flexShrink=0 保住百分比。
                */}
                <Box position="absolute" left={0} right={0} height={1} overflow="hidden">
                    <Text dimColor>{足够空的长串}</Text>
                </Box>
                <Box
                    position="absolute"
                    left={0}
                    height={1}
                    width={`${夹取}%`}
                    flexShrink={0}
                    overflow="hidden"
                >
                    <Text color={颜色}>{足够长}</Text>
                </Box>
            </Box>
        </Box>
    );
}

export default React.memo(仪表盘);
