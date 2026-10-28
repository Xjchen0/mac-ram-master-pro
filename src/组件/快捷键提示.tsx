import React from 'react';
import { Box, Text } from 'ink';
import { 强调色, 警告色 } from '../配色.js';

interface 属性 {
    正在清理: boolean;
    已暂停: boolean;
    /** 非交互模式只采一次样、没有轮询，传 null，不能说谎报「每 N 秒刷新」 */
    刷新秒数: number | null;
    /** stdout 不是终端（被重定向到管道/文件）时没有按键来源，不该继续提示快捷键 */
    支持按键: boolean;
}

function 快捷键提示({ 正在清理, 已暂停, 刷新秒数, 支持按键 }: 属性) {
    const 状态文本 = 正在清理
        ? '清理中…'
        : 已暂停
          ? '已暂停'
          : 刷新秒数 === null
            ? '单次采样'
            : `每 ${刷新秒数} 秒刷新`;
    const 状态颜色 = 正在清理 ? 强调色 : 已暂停 ? 警告色 : undefined;

    return (
        <Box justifyContent="space-between">
            {支持按键 ? (
                <Text>
                    <Text color={强调色} bold>
                        c
                    </Text>
                    <Text dimColor> 清理    </Text>
                    <Text color={强调色} bold>
                        p
                    </Text>
                    <Text dimColor> {已暂停 ? '继续' : '暂停'}    </Text>
                    <Text color={强调色} bold>
                        q
                    </Text>
                    <Text dimColor> 退出</Text>
                </Text>
            ) : (
                <Text dimColor>非交互模式：stdout 不是终端</Text>
            )}
            <Text color={状态颜色} dimColor={!状态颜色}>
                {状态文本}
            </Text>
        </Box>
    );
}

export default React.memo(快捷键提示);
