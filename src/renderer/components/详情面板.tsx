import React from 'react';

interface 属性 {
    已用文本: string;
    可释放文本: string;
}

/**
 * 接收已格式化的字符串而非原始字节数：
 * 字节每轮采样都在抖动，但保留两位小数后的文本往往连续多轮不变，
 * memo 因此能真正跳过这个子树的重渲染。
 */
const 详情面板: React.FC<属性> = ({ 已用文本, 可释放文本 }) => (
    <div className="glass-panel p-6 grid grid-cols-2 gap-8 relative z-10 overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex flex-col relative">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Occupied</span>
            <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black tabular-nums">{已用文本}</span>
                <span className="text-zinc-600 font-bold text-xs">GB</span>
            </div>
        </div>
        <div className="flex flex-col items-end relative">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Purgeable</span>
            <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black text-accent-color tabular-nums">{可释放文本}</span>
                <span className="text-zinc-600 font-bold text-xs">GB</span>
            </div>
        </div>
    </div>
);

export default React.memo(详情面板);
