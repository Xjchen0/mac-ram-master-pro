import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, 频道映射 } from '../shared/ipc-contracts';

/**
 * [Mentor Note]
 * 为了保证安全，我们不直接在网页里运行系统命令。
 * 我们搭建了一座“桥梁” (ContextBridge)，只允许网页发送特定的指令（获取统计、清理内存）。
 * 这样即便是网页被攻击，黑客也无法控制你的电脑。
 *
 * ⚠️ 本文件运行在 sandbox 化的 preload 环境里（Electron 20+ 默认开启，本项目未关闭）。
 * 那里的 require 只是受限 polyfill，仅能加载 electron / events / timers / url，
 * **无法 require 相对路径的自建模块**。一旦这么写，preload 会在加载阶段直接抛错，
 * window.electronAPI 变成 undefined，界面永远停在「正在监测系统状态...」。
 *
 * 因此这里对 shared 契约只用 `import type`（编译期完全擦除，不产生任何运行时 require），
 * 频道名以字面量写出，再用 `satisfies 频道映射` 与契约做编译期比对 ——
 * 任一边把字符串改歪都会编译失败，既保住沙箱安全又不会两端漂移。
 */
const 频道 = {
    获取统计: '获取统计',
    清理内存: '清理内存'
} satisfies 频道映射;

const 桥接接口: ElectronAPI = {
    获取内存数据: () => ipcRenderer.invoke(频道.获取统计),
    执行大扫除: () => ipcRenderer.invoke(频道.清理内存)
};

contextBridge.exposeInMainWorld('electronAPI', 桥接接口);
