import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { Box } from 'ink';
import { render } from 'ink-testing-library';
import 仪表盘 from '../../src/组件/仪表盘.js';

/** 与 App 里面板内容区一致的宽度，方便直接对照真实界面 */
const 条宽 = 74;

function 渲染进度条(百分比: number): { 条: string; 帧: string } {
    let 帧 = '';
    // render 放进 act 里，否则 Ink 内部的挂载副作用会打出「not wrapped in act」告警
    act(() => {
        const 实例 = render(
            // column 方向才会让子元素在交叉轴上 stretch 到 74 列；
            // 默认的 row 方向下仪表盘会按内容收缩，进度条就只有十几列
            <Box width={条宽} flexDirection="column">
                <仪表盘 已用百分比={百分比} />
            </Box>
        );
        帧 = 实例.lastFrame() ?? '';
        实例.unmount();
    });

    const 非空行 = 帧.split('\n').filter((行) => 行.trim() !== '');
    // 第一行是「内存占用 … 62.5%」，最后一行才是进度条
    return { 条: 非空行[非空行.length - 1] ?? '', 帧 };
}

function 统计(百分比: number) {
    const { 条, 帧 } = 渲染进度条(百分比);
    return {
        帧,
        条,
        填充: (条.match(/#/g) ?? []).length,
        空白: (条.match(/\./g) ?? []).length,
    };
}

describe('仪表盘进度条', () => {
    it('填充列数与百分比成正比，且整条正好铺满可用宽度', () => {
        for (const 百分比 of [0, 25, 50, 75, 100]) {
            const { 填充, 空白 } = 统计(百分比);
            // Yoga 把百分比宽度向下取整，所以期望值也用 floor，不留 ±1 的容差
            expect(填充, `${百分比}%`).toBe(Math.floor((条宽 * 百分比) / 100));
            expect(填充 + 空白, `${百分比}% 未铺满整行`).toBe(条宽);
        }
    });

    /**
     * 回归测试：进度条中间不能有空洞。
     *
     * 百分比宽度经 Yoga 换算后是小数（74 列里的 55% = 40.7）。早先填充段与空白段
     * 是并排的两个盒子，填充段占 0~40.7、空白段从 40.7 起，取整后第 40 列谁都不写，
     * 条的中间就凭空多出一个空格 —— 实测约一半的百分比都会踩到，而「填充+空白」的
     * 总列数照样接近满宽，所以旧断言的 ±1 容差把它完全放过去了。
     * 改成「点铺满整行做底、井号按百分比盖在上面」之后，取整误差只会落到条的末端。
     */
    it('任何百分比下填充段与空白段之间都不留空列', () => {
        for (let 千分比 = 0; 千分比 <= 1000; 千分比 += 5) {
            const { 条 } = 统计(千分比 / 10);
            expect(条.replace(/\s+$/, ''), `${千分比 / 10}%`).toMatch(/^#*\.*$/);
        }
    });

    /**
     * 回归测试：Ink 的 flexShrink 默认是 0（与 Web 相反）。
     * 少了显式的 flexShrink={0}，512 个字符的填充串会把盒子撑到远超百分比宽度，
     * 再被 flex 布局挤回去，实测 50% 只画出约一半的列数 —— 界面看着正常，数字全错。
     */
    it('50% 必须画出一半的列数', () => {
        expect(统计(50).填充).toBe(条宽 / 2);
    });

    it('超出 0-100 的百分比被夹取，不会画出负数或溢出的条', () => {
        expect(统计(-30).填充).toBe(0);
        expect(统计(150).填充).toBe(条宽);
    });

    it('百分比文字同样被夹取', () => {
        expect(统计(150).帧).toContain('100.0%');
        expect(统计(-30).帧).toContain('0.0%');
    });

    it('保留一位小数', () => {
        expect(统计(62.5).帧).toContain('62.5%');
        expect(统计(60.25).帧).toContain('60.3%');
    });

    it('进度条只用 ASCII，关掉颜色也能看出形状', () => {
        const { 条 } = 统计(50);
        expect(条).toMatch(/^[#.]+$/);
    });
});
