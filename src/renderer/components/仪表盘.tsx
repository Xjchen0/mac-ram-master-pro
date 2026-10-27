import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** 半径 125 的圆周长，作为 strokeDasharray 基准 */
const 圆周长 = 785;

interface 属性 {
    已用百分比: number;
    正在清理: boolean;
}

/**
 * 中间数值刻意不设 key。
 * 旧实现写的是 key={系统状态.percentage}，而百分比几乎每轮采样都在变，
 * React 于是每 2 秒把这个节点整棵卸载重建、并重放一次进场动画。
 * 数值现在原地更新，平滑过渡交给下面已经带动画的圆弧。
 */
const 仪表盘: React.FC<属性> = ({ 已用百分比, 正在清理 }) => {
    const 圆弧偏移 = useMemo(() => 圆周长 - (圆周长 * 已用百分比) / 100, [已用百分比]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="relative w-72 h-72 flex items-center justify-center">
                {/* 背景装饰环 */}
                <div className="absolute inset-0 rounded-full border-[1px] border-white/5 scale-110" />
                <div className="absolute inset-0 rounded-full border-[1px] border-white/5 scale-125 opacity-50" />

                {/* 动态圆形进度条 */}
                <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                    <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--accent-color)" />
                            <stop offset="100%" stopColor="#00f2fe" />
                        </linearGradient>
                    </defs>
                    <circle
                        cx="144"
                        cy="144"
                        r="125"
                        stroke="rgba(255,255,255,0.03)"
                        strokeWidth="16"
                        fill="transparent"
                    />
                    <motion.circle
                        cx="144"
                        cy="144"
                        r="125"
                        stroke="url(#progressGradient)"
                        strokeWidth="16"
                        fill="transparent"
                        strokeDasharray={圆周长}
                        initial={{ strokeDashoffset: 圆周长 }}
                        animate={{ strokeDashoffset: 圆弧偏移 }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        strokeLinecap="round"
                    />
                </svg>

                {/* 中间数值展示 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="flex items-baseline">
                        <span className="text-7xl font-black tracking-tighter tabular-nums">
                            {Math.round(已用百分比)}
                        </span>
                        <span className="text-2xl font-bold ml-1 text-zinc-500">%</span>
                    </div>
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 opacity-60">Memory Usage</span>
                </div>

                {/* 清理时的冲击波特效 */}
                <AnimatePresence>
                    {正在清理 && (
                        <>
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.5, opacity: 1 }}
                                exit={{ scale: 2, opacity: 0 }}
                                className="absolute inset-0 rounded-full border-2 border-accent-color/30"
                            />
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.8, opacity: 0.5 }}
                                exit={{ scale: 2.5, opacity: 0 }}
                                transition={{ delay: 0.2 }}
                                className="absolute inset-0 rounded-full border-2 border-accent-color/10"
                            />
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default React.memo(仪表盘);
