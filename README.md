# Logseq Preview Mode Plugin

一个为 Logseq 开发的预览模式切换插件，允许用户在编辑模式和预览模式之间快速切换。

## 功能特性

### 🎯 核心功能
- **编辑模式**: 正常显示 Logseq 块的 markdown 源码（默认 Logseq 行为）
- **预览模式**: 即使光标聚焦在块上，也无法编辑，始终保持 markdown 渲染状态
- **快速切换**: 工具栏按钮一键切换，支持键盘快捷键
- **状态记忆**: 自动记住用户的模式选择，重启后保持设置

### ⌨️ 快捷键
- `Ctrl/Cmd + Shift + P`: 快速切换预览模式

### 🎨 用户体验
- 直观的工具栏按钮，显示当前模式状态
- 模式切换时显示友好的提示消息
- 预览模式时显示视觉水印提示
- 保持文本可选择性和链接可点击性

## 技术实现

### 🏗️ 架构设计
- **轻量级实现**: 最小化依赖，纯 JavaScript 开发
- **CSS 控制**: 通过动态样式注入控制编辑行为
- **事件监听**: 智能阻止编辑相关事件，保持其他功能正常
- **状态管理**: 利用 Logseq 设置 API 实现状态持久化

### 🔧 性能优化
- 插件加载时间 < 100ms
- 动态添加/移除事件监听器，避免性能损耗
- CSS 样式的动态注入和清理
- 不影响 Logseq 启动性能

### 🛡️ 兼容性
- 支持当前稳定版本的 Logseq
- 使用最新版本的 `@logseq/libs`
- 遵循 Logseq 插件开发最佳实践

## 安装和使用

### 📦 安装

1. **克隆或下载插件**
   ```bash
   git clone <repository-url>
   cd logseq-plugin/logseq-preview-mode
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建插件**
   ```bash
   npm run build
   ```

4. **加载到 Logseq**
   - 打开 Logseq Desktop 客户端
   - 进入设置，开启开发者模式
   - 按 `t` `p` 进入插件页面
   - 点击 "Load unpacked plugin"
   - 选择 `logseq-preview-mode` 文件夹

### 🎮 使用方法

1. **工具栏按钮**: 点击工具栏中的 ✏️/🔒 按钮切换模式
2. **快捷键**: 使用 `Ctrl/Cmd + Shift + P` 快速切换
3. **状态查看**: 按钮颜色和图标会反映当前模式状态

## 开发

### 🛠️ 开发环境

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build
```

### 📁 项目结构

```
logseq-preview-mode/
├── package.json          # 插件配置和构建脚本
├── index.html           # 入口 HTML 文件
├── index.js             # 主要插件逻辑
├── dist/                 # 构建输出目录（gitignored）
├── README.md            # 说明文档
└── icon.png             # 插件图标（待添加）
```

## 原理说明

### 预览模式实现机制

1. **CSS 禁用编辑**: 通过 `pointer-events: none` 禁用块内容的编辑交互
2. **隐藏编辑元素**: 隐藏编辑光标、占位符和块控制按钮
3. **事件阻止**: 监听并阻止可能触发编辑的点击和键盘事件
4. **保持功能性**: 保持文本选择和链接点击等正常功能

### 状态管理

- 使用 `logseq.updateSettings()` 保存模式状态
- 通过 `logseq.onSettingsChanged()` 监听状态变化
- 插件启动时自动恢复上次的模式设置

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 更新日志

### v0.0.1
- 🎉 初始版本发布
- ✅ 实现基本的预览模式切换功能
- 🎨 添加工具栏按钮和状态指示
- ⌨️ 支持键盘快捷键
- 💾 实现状态持久化
- 🚀 优化性能和用户体验