<h1 align="center">MiMo Code Desktop</h1>

<p align="center">
  <img src="assets/readme/mimocode-banner.jpg" alt="MiMo Code Desktop" width="700">
</p>

<p align="center"><strong>基于 MiMo Code 的 macOS 桌面端应用，采用 Claude Desktop 风格界面设计。</strong></p>

---

## 项目简介

MiMo Code Desktop 是对 [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) 的 macOS 桌面端封装，采用 Electron 构建，提供类似 Claude Desktop 的原生应用体验。

### 主要特性

- 🖥️ **原生 macOS 体验** — 隐藏标题栏、毛玻璃效果、红绿灯按钮
- 🎨 **小米品牌设计** — 小米橙色 (#FF6900) 品牌色
- 📦 **一键安装** — 打包为 .app，双击即可使用
- 🌍 **多语言支持** — 支持 15 种语言
- 🔧 **侧车架构** — 后台服务独立运行，前端界面流畅

---

## 致谢与归属

本项目基于以下开源项目构建：

### MiMo Code

- **仓库**: https://github.com/XiaomiMiMo/MiMo-Code
- **作者**: Xiaomi MiMo Team
- **许可证**: MIT License
- **说明**: MiMo Code 是一个终端原生的 AI 编码助手，支持跨会话记忆、多代理协作等高级功能

### OpenCode

- **仓库**: https://github.com/anomalyco/opencode
- **作者**: OpenCode Team
- **许可证**: MIT License
- **说明**: OpenCode 是 MiMo Code 的基础框架，提供多提供商支持、TUI、LSP、MCP、插件等核心能力

### 本项目的改动

本项目在 MiMo Code 基础上进行了以下修改：

1. **Electron 桌面端封装** — 将终端应用转换为原生 macOS 应用
2. **Claude Desktop 风格界面** — 隐藏标题栏、毛玻璃效果、现代 UI
3. **小米品牌集成** — 使用小米橙色品牌色和定制图标
4. **构建系统适配** — 添加 electron-vite 构建配置
5. **二进制文件集成** — 将编译后的服务端二进制文件打包到应用中

---

## 快速开始

### 下载安装

从 [Releases](https://github.com/cl6791731/MiMo-Code/releases) 页面下载最新版本：

1. 下载对应架构的 zip 文件
2. 解压后将 `MiMo Code.app` 拖到 `/Applications` 文件夹
3. 首次打开如果提示"无法验证开发者"，请到 **系统设置 → 隐私与安全性** 点击"仍然允许"

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/cl6791731/MiMo-Code.git
cd MiMo-Code

# 安装依赖
bun install

# 构建桌面端
cd packages/desktop
OPENCODE_CHANNEL=dev bun run build

# 打包为 .app
bun run package:mac
```

---

## 项目结构

```
MiMo-Code/
├── packages/
│   ├── desktop/          # Electron 桌面端（本项目核心）
│   ├── opencode/         # MiMo Code 核心引擎
│   ├── app/              # Web UI 界面
│   ├── ui/               # UI 组件库
│   └── ...
├── .github/workflows/    # GitHub Actions CI/CD
└── ...
```

---

## 开发

```bash
# 安装依赖
bun install

# 启动桌面端开发模式
bun run dev:desktop

# 类型检查
bun turbo typecheck
```

---

## 社区交流

扫描下方二维码加入微信交流群：

<p align="center">
  <img src="assets/readme/wechat-qrcode.jpg" alt="微信交流群二维码" width="240">
</p>

---

## 许可证

本项目代码基于 [MIT License](./LICENSE) 许可证。

### 使用限制

- 使用 MiMo Code Desktop 受 [使用限制](./USE_RESTRICTIONS.md) 约束
- 使用小米 MiMo 托管服务受 [MiMo 服务条款](https://platform.xiaomimimo.com/docs/terms/user-agreement) 约束
- MiMo 名称、Logo 和商标的使用受 MiMo 商标政策约束

---

## 免责声明

本项目是基于 MiMo Code 的非官方桌面端封装，由社区开发者维护。本项目与小米公司无关联，小米公司不对此项目承担责任。
