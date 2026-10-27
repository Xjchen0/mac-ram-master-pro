import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Activity } from 'lucide-react';
import type { 清理结果 } from '../../shared/ipc-contracts';
import { 字节转GB } from '../格式化';

interface 属性 {
    正在清理: boolean;
    清理结果: 清理结果 | null;
    点击清理: () => void;
}

/**
 * 把真实执行结果翻译成横幅文案。
 * 旧实现只有成功分支（App.tsx 里 `if (结果.success)` 没有 else），
 * purge 因权限不足失败时用户看到的仍然是一段成功动画。
 */
function 生成横幅(结果: 清理结果): { 文本: string; 样式: string } {
    if (!结果.成功) {
        const 退出码部分 = 结果.退出码 === null ? '' : `（退出码 ${结果.退出码}）`;
        return {
            文本: `⚠ 清理未完成${退出码部分}：${结果.错误信息}`,
            样式: 'bg-red-500/10 text-red-400 border-red-500/20'
        };
    }
    const 释放文本 =
        结果.释放字节 > 0 ? `已释放 ${字节转GB(结果.释放字节)} GB` : '未测得可释放内存变化';
    return {
        文本: `✨ ${释放文本} · 耗时 ${结果.耗时毫秒}ms`,
        样式: 'bg-accent-color/10 text-accent-color border-accent-color/20'
    };
}

const 清理按钮: React.FC<属性> = ({ 正在清理, 清理结果, 点击清理 }) => {
    const 横幅 = 清理结果 ? 生成横幅(清理结果) : null;

    return (
        <div className="pb-4 z-10">
            <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={点击清理}
                disabled={正在清理}
                className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 transition-all shimmer ${正在清理
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-white text-black glow-shadow'
                    }`}
            >
                {正在清理 ? (
                    <Activity className="animate-spin w-6 h-6" />
                ) : (
                    <Trash2 className="w-6 h-6" />
                )}
                <span className="tracking-tight">{正在清理 ? 'PURGING SYSTEM...' : 'OPTIMIZE MEMORY'}</span>
            </motion.button>

            <AnimatePresence>
                {横幅 && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="absolute bottom-12 left-0 right-0 text-center px-6"
                    >
                        <span
                            className={`${横幅.样式} inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border backdrop-blur-md`}
                        >
                            {横幅.文本}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default React.memo(清理按钮);
