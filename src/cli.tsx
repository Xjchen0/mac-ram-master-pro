#!/usr/bin/env node
import { render } from 'ink';
import App from './App.js';

/**
 * 非交互模式（stdout 被重定向）下采样失败要让退出码非零，
 * 这样 `ram-master | ...` 之类的脚本能判断出这次没读到数据。
 */
let 退出码 = 0;

/**
 * 必须是模块级的稳定引用：App 把它放进了 effect 依赖数组，
 * 内联箭头函数每次渲染都换身份，会让非交互模式反复重新采样。
 */
function 处理采样结束(成功: boolean): void {
    if (!成功) 退出码 = 1;
}

/**
 * stdout 不是终端时（管道、重定向、CI）不轮询、不监听按键，
 * 否则 `ram-master > log.txt` 会把文件灌满重绘帧。
 */
const 交互模式 = Boolean(process.stdout.isTTY);

/**
 * 备用屏交给 Ink 自己接管：进入/退出、隐藏/恢复光标都嵌在它的渲染生命周期里，
 * 在 render() 之前手写 \x1b[?1049h 会和它的首帧绘制抢同一个屏幕。
 * 非交互环境下 Ink 会自动忽略这个选项，不需要我们分支处理。
 */
const 实例 = render(<App 交互模式={交互模式} on采样结束={处理采样结束} />, {
    exitOnCtrlC: true,
    alternateScreen: true,
});

/**
 * Ink 一个信号处理器都不注册，SIGTERM / SIGHUP 会直接终止进程 ——
 * 终端被留在备用屏、光标还是隐藏的，用户只能盲敲 reset。
 * 这里调 unmount() 复用 Ink 自己的还原逻辑，不再复制一遍转义序列。
 * SIGINT 刻意不接，exitOnCtrlC 已经管了。
 */
for (const 信号 of ['SIGTERM', 'SIGHUP'] as const) {
    process.on(信号, () => {
        实例.unmount();
        process.exit(0);
    });
}

process.on('uncaughtException', (错误) => {
    // 先 unmount 还原主屏再报错。顺序反了的话错误信息会写进备用屏幕，
    // 用户看到的是一片黑屏加一个不显示光标的终端。
    try {
        实例.unmount();
    } catch {
        // 卸载本身可能就是这个异常的来源，此时还原终端比抛出二次异常更重要
    }
    console.error(错误);
    process.exit(1);
});

try {
    await 实例.waitUntilExit();
} catch (错误) {
    // waitUntilExit 被 reject 时 Ink 不一定已经卸载完，
    // 补一次 unmount() 把主屏还原出来再打印错误（unmount 自身有重入保护）
    实例.unmount();
    console.error(错误);
    退出码 = 1;
}

process.exitCode = 退出码;
