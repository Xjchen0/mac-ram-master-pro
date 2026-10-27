/**
 * [Mentor Note] 主进程与渲染进程之间的唯一契约
 *
 * 这里同时定义频道名常量与全部载荷类型，让 main.ts / preload.ts / App.tsx / 测试
 * 四方引用同一份定义，杜绝字符串频道名漂移和 Promise<any>。
 *
 * 所有字段都是纯 number / string / boolean，可被 contextBridge 安全序列化。
 */

/** IPC 频道名常量 */
export const 频道 = {
    获取统计: '获取统计',
    清理内存: '清理内存',
} as const;

/**
 * 供沙箱化的 preload 做编译期比对用。
 * preload 在 sandbox 下无法 require 相对路径的自建模块，只能把频道名写成字面量，
 * 再用 `satisfies 频道映射` 钉住 —— 任一边改了字符串都会编译失败。
 */
export type 频道映射 = typeof 频道;

/** 内存采样结果：一律传原始字节数与 number 百分比，格式化交给 UI 层 */
export interface 内存统计结果 {
    已用字节: number;
    可释放字节: number;
    总字节: number;
    /** 0–100，保留一位小数 */
    已用百分比: number;
}

export interface 清理成功 {
    成功: true;
    耗时毫秒: number;
    /** purge 前后 inactive 页的真实差值；测不到时为 0 */
    释放字节: number;
    退出码: number;
}

export interface 清理失败 {
    成功: false;
    耗时毫秒: number;
    /** child_process 的 err.code；拿不到时为 null */
    退出码: number | null;
    /** 面向用户展示的 stderr / message 摘要 */
    错误信息: string;
}

export type 清理结果 = 清理成功 | 清理失败;

/** preload 通过 contextBridge 暴露给渲染进程的完整 API 形状 */
export interface ElectronAPI {
    获取内存数据: () => Promise<内存统计结果 | null>;
    执行大扫除: () => Promise<清理结果>;
}
