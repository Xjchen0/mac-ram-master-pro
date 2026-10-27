/**
 * 主进程一律只传原始字节数，格式化统一收敛在渲染层这一处，
 * 避免旧实现那样在主进程用 .toFixed() 生成字符串、再让渲染层 parseFloat 回去。
 */
export function 字节转GB(字节: number, 小数位 = 2): string {
    return (字节 / 1024 ** 3).toFixed(小数位);
}
