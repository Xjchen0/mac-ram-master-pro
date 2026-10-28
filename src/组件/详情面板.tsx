import React from 'react';
import { Box, Text } from 'ink';
import { 强调色 } from '../配色.js';

interface 属性 {
    已用文本: string;
    可释放文本: string;
    总计文本: string;
}

function 数据行({ 标签, 值, 值颜色 }: { 标签: string; 值: string; 值颜色?: string }) {
    return (
        <Box justifyContent="space-between">
            <Text dimColor>{标签}</Text>
            <Text color={值颜色} bold={Boolean(值颜色)}>
                {值}
            </Text>
        </Box>
    );
}

/** 只接收预先格式化好的字符串，memo 比较因此廉价且稳定（不会因字节级抖动而重渲染） */
function 详情面板({ 已用文本, 可释放文本, 总计文本 }: 属性) {
    return (
        <Box flexDirection="column">
            <数据行 标签="已用" 值={`${已用文本} GB`} 值颜色={强调色} />
            <数据行 标签="可释放" 值={`${可释放文本} GB`} />
            <数据行 标签="总计" 值={`${总计文本} GB`} />
        </Box>
    );
}

export default React.memo(详情面板);
