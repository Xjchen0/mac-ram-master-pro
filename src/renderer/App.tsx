import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import type { ElectronAPI, 内存统计结果, 清理结果 } from '../shared/ipc-contracts';
import { 字节转GB } from './格式化';
import 仪表盘 from './components/仪表盘';
import 详情面板 from './components/详情面板';
import 清理按钮 from './components/清理按钮';
import './global.css';

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

const 轮询间隔毫秒 = 2000;

/**
 * 过渡动效的下界。purge 常常几百毫秒就返回，直接展示结果会显得“一闪而过”；
 * 但这个等待是有上界的 —— 失败原因最多 600ms 就会出现，
 * 不再是旧版那种无论成功失败都固定演 2 秒的假动画。
 */
const 最短清理动效毫秒 = 600;

/** 结果横幅停留时长，足够读完一条错误信息 */
const 横幅停留毫秒 = 5000;

const 延迟 = (毫秒: number) => new Promise<void>((解决) => setTimeout(解决, 毫秒));

// 纯静态子树提升为模块级常量，永不参与 diff
const 标题栏 = (
    <div className="pt-4 flex items-center justify-between z-10">
        <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                RAM MASTER
            </h1>
            <span className="text-[10px] text-accent-color font-bold tracking-[0.2em] uppercase opacity-80">Professional Edition</span>
        </div>
        <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ type: "spring", stiffness: 200 }}
        >
            <ShieldCheck className="text-accent-color w-7 h-7 filter drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
        </motion.div>
    </div>
);

const 背景氛围灯 = (
    <>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-accent-color/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
    </>
);

const App: React.FC = () => {
    const [系统状态, 设置系统状态] = useState<内存统计结果 | null>(null);
    const [正在清理, 设置正在清理] = useState(false);
    const [清理结果, 设置清理结果] = useState<清理结果 | null>(null);

    useEffect(() => {
        let 计时器: ReturnType<typeof setInterval> | null = null;

        const 获取数据 = async () => {
            const 数据 = await window.electronAPI.获取内存数据();
            if (数据) 设置系统状态(数据);
        };
        const 启动轮询 = () => {
            if (计时器 !== null) return;
            获取数据();
            计时器 = setInterval(获取数据, 轮询间隔毫秒);
        };
        const 停止轮询 = () => {
            if (计时器 === null) return;
            clearInterval(计时器);
            计时器 = null;
        };

        /**
         * visibilitychange 覆盖最小化 / 隐藏 / 窗口被完全遮挡，
         * 但“别的应用抢走焦点而本窗口仍可见”不会触发它，所以要一并监听 focus / blur。
         * 三者汇入同一个判断，避免各管一段导致状态打架。
         */
        const 评估可见性 = () => {
            if (document.visibilityState === 'visible' && document.hasFocus()) 启动轮询();
            else 停止轮询();
        };

        document.addEventListener('visibilitychange', 评估可见性);
        window.addEventListener('focus', 评估可见性);
        window.addEventListener('blur', 评估可见性);
        评估可见性();

        return () => {
            停止轮询();
            document.removeEventListener('visibilitychange', 评估可见性);
            window.removeEventListener('focus', 评估可见性);
            window.removeEventListener('blur', 评估可见性);
        };
    }, []);

    // 横幅自动消失改由 effect 驱动，清理函数会连带清掉定时器 ——
    // 旧实现是两个从未被 clearTimeout 的嵌套 setTimeout，卸载后照样触发 setState。
    useEffect(() => {
        if (!清理结果) return;
        const 计时器 = setTimeout(() => 设置清理结果(null), 横幅停留毫秒);
        return () => clearTimeout(计时器);
    }, [清理结果]);

    const 执行一键清理 = useCallback(async () => {
        设置正在清理(true);
        设置清理结果(null);

        const [结果] = await Promise.all([
            window.electronAPI.执行大扫除(),
            延迟(最短清理动效毫秒)
        ]);

        设置正在清理(false);
        设置清理结果(结果);
    }, []);

    if (!系统状态) return (
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-accent-color border-t-transparent rounded-full"
            />
            <div className="text-zinc-500 font-medium tracking-widest animate-pulse">正在监测系统状态...</div>
        </div>
    );

    return (
        <div className="p-8 flex flex-col h-full space-y-8 select-none relative overflow-hidden">
            {标题栏}

            <仪表盘 已用百分比={系统状态.已用百分比} 正在清理={正在清理} />

            <详情面板
                已用文本={字节转GB(系统状态.已用字节)}
                可释放文本={字节转GB(系统状态.可释放字节)}
            />

            <清理按钮 正在清理={正在清理} 清理结果={清理结果} 点击清理={执行一键清理} />

            {背景氛围灯}
        </div>
    );
};

export default App;
