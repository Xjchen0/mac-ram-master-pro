/**
 * 配色沿用 GUI 版本的 HSL 定义：
 * 翡翠绿 hsl(150,100%,50%) = #00FF80，危险红 hsl(0,100%,60%) = #FF3333。
 */
export const 强调色 = '#00FF80';
export const 危险色 = '#FF3333';
export const 警告色 = '#FFD60A';

/** 占用越高颜色越警示，这是 TUI 里替代 GUI 光晕效果的最低成本手段 */
export function 按占用取色(百分比: number): string {
    if (百分比 >= 85) return 危险色;
    if (百分比 >= 70) return 警告色;
    return 强调色;
}
