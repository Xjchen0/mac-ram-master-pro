/**
 * 采集层与界面层共享的数据形状。
 *
 * TUI 是单进程程序，采样函数被组件直接调用，
 * 因此这里不再有 Electron 时期的 IPC 频道名与 preload 桥接。
 */

/** 一次 vm_stat 采样的结果。全部是原始字节数，格式化留给界面层 */
export interface 内存统计结果 {
    已用字节: number;
    可释放字节: number;
    总字节: number;
    已用百分比: number;
}

export interface 清理成功 {
    成功: true;
    耗时毫秒: number;
    释放字节: number;
    退出码: number;
}

export interface 清理失败 {
    成功: false;
    耗时毫秒: number;
    /** 拿不到退出码时为 null（例如进程被信号杀死），界面不应假装它是 0 */
    退出码: number | null;
    错误信息: string;
}

/** 判别联合：`成功` 字段是判别式，两个分支的必填项不同，漏字段会在编译期报错 */
export type 清理结果 = 清理成功 | 清理失败;
