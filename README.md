# 🚀 RAM Master | Mac 运存清理大师 (永久免费版)

一款具有 **Apple 级审美** 的开源 macOS 运存优化工具。专为极致体验设计，一键清空不活跃缓存，让你的 Mac 瞬间回春。

---

## ✨ 核心亮点 (Key Features)

- **Apple 级 UI/UX 体验**：
  - **极致审美**：采用深空灰 (Space Gray) 基调，配合翡翠绿 (Emerald Green) HSL 配色。
  - **毛玻璃效果**：深度定制的 `backdrop-filter` 面板，完美契合 macOS 系统质感。
  - **灵动动画**：基于 `Framer Motion` 的物理引擎级过渡，每一帧都丝滑顺畅。
- **底层精准优化**：
  - **智能解析**：解析 `vm_stat` 头部拿到真实页大小再换算字节数，同时兼容 4K 页的 Intel Mac 与 16K 页的 Apple Silicon（页大小是内核常量，硬编码会让后者所有读数小 4 倍）。
  - **原生清理**：调用系统自带的 `/usr/sbin/purge` 命令行工具回收不活跃 (Inactive) 内存。它是 `root:wheel` 属主的**用户态** CLI 而非内核接口，无管理员权限时会非零退出 —— 本应用如实上报退出码、耗时与实际释放量，失败时给出明确错误提示，不用动画掩盖。
- **SOTA 架构设计**：
  - **中文化编程**：代码逻辑采用全中文命名与注释，降低初学者理解成本。
  - **隔离沙箱**：主进程与渲染进程通过 `ContextBridge` 严格隔离，杜绝安全风险。
  - **零容忍报错**：主进程 / preload / 渲染层共享同一份 IPC 契约类型 (`src/shared/ipc-contracts.ts`)，全链路无 `any`，`npm run typecheck` 三段配置一并把关。
  - **测试兜底**：34 个用例覆盖解析层纯函数与界面行为，`npm test` 可在任意平台运行。

---

## 🛠 技术栈 (Tech Stack)

- **核心框架**: `Electron 28` (跨桌面开发基石)
- **构建工具**: `Vite 5` (极致的开发与打包速度)
- **UI 框架**: `React 18` + `TypeScript`
- **动画引擎**: `Framer Motion` (苹果级动效的秘密武器)
- **字体方案**: `Outfit` (现代感极强的无衬线字体)

---

## 📦 开发者快速上手 (Quick Start)

### 1. 环境准备
确保你已安装 `Node.js` (推荐 v18+)

### 2. 初始化项目
```bash
# 安装依赖
npm install
```

### 3. 开发环境运行
```bash
# 启动 Vite 服务与 Electron
npm run dev
# 在另一个终端启动
npm run electron:dev
```

### 4. 构建发布
```bash
# 生成 macOS 安装包
npm run dist
```

---

## ✅ 测试与类型检查 (Testing)

```bash
npm test            # 跑一遍全部用例
npm run test:watch  # 监听模式
npm run typecheck   # 主进程 / 渲染层 / 测试三段 tsconfig 全量检查
```

测试全部基于 `tests/fixtures/vm-stat-样本.ts` 里的真实 `vm_stat` 文本样本，**不执行任何 macOS 命令**，因此在 Linux CI 上同样能跑（见 `.github/workflows/ci.yml`）。分两层：

- `tests/memory-stats.test.ts` —— 解析层纯函数：页大小换算、关键字互不污染、畸形输入返回 `null`。其中「同一份页数据在两种页大小下必须恰好相差 4 倍」是钉死页大小硬编码 bug 的回归测试。
- `tests/App.test.tsx` —— 组件行为：轮询节奏、窗口隐藏 / 失焦时暂停轮询、数值节点不被反复重挂载、清理成功与失败两条横幅。失败横幅那条覆盖的正是旧实现完全静默的路径。

---

## 👨‍🏫 编程导师笔记 (Mentor Notes)

> **什么是 Inactive Memory (不活跃内存)？**
> 想象你的桌面上堆满了之前看过的书（缓存），虽然你现在没在看，但它们占着地方。当你需要摊开一张大地图时，`purge` 就像是一位管家，迅速把这些没用的书收回书架，把干净的桌面（物理内存）腾出来给你的新任务。

> **为什么「已用内存」和活动监视器对不上？**
> 本应用的口径是 `wired + active + compressor`（联动页 + 活跃页 + 压缩页），直接来自 `vm_stat`。活动监视器的「已使用内存」口径不同：约为 App 内存（匿名页）+ 联动内存 + 已压缩，且**不计入** `active` 里那部分文件映射页。所以两边差上几个百分点是口径差异，不是算错了 —— 这是刻意选择的取舍：只用一条 `vm_stat` 就能拿到，无需私有 API。

> **`purge` 需要管理员权限**
> `/usr/sbin/purge` 是系统自带的用户态命令行工具，属主 `root:wheel`。没有提权时它会以退出码 1 失败并输出 `Operation not permitted`。本应用不会绕过权限，而是把退出码和错误原文如实显示在红色横幅里 —— 看到失败提示是正常的，说明你的机器没有授予管理员权限。

---

## 📄 开源许可证
本项目采用 **MIT License**。永久免费，鼓励二次开发，致敬开源精神。

---

**由 顶级全栈架构师 & 编程导师 倾情打造**

