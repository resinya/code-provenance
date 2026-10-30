<p align="center">
  <img src="./assets/logo-wordmark.png" alt="code-provenance — 点击页面，追溯源码" width="640" />
</p>

# code-provenance

在浏览器中 <kbd>Option+Click</kbd> 页面上的 React 组件，直接在编辑器中打开对应的源码文件。

支持 VS Code、VS Code Insiders、Cursor、TRAE（国际版 / 国内版）和 IntelliJ IDEA。
浏览器注入面板可直接切换编辑器；npm 接入通过 `editor` 属性选择。

## 致谢与灵感来源

本项目的核心思路——在浏览器中点击 React 组件并在编辑器中打开源码——
借鉴自 [ericclemmons/click-to-component](https://github.com/ericclemmons/click-to-component)
（npm 包名 `click-to-react-component`）。

原项目通过读取 React Fiber 上的 `_debugSource` 实现了一键跳转源码，
本项目在此基础上进行了二次魔改：将核心包从 JavaScript 迁移到 TypeScript，
扩展了编辑器支持与 React 版本适配，并新增了浏览器临注入工具等能力。
感谢原作者 [Eric Clemmons](https://github.com/ericclemmons) 及所有贡献者的工作。

## 相比原项目的改进

| 改进点 | 说明 |
| --- | --- |
| TypeScript 重写 | 核心包由 JavaScript 迁移到 TypeScript，附带完整类型声明 |
| React 19 / Next 16 支持 | 通过解析 `_debugStack` 调用栈，配合 source map 与 Next 开发接口 `/__nextjs_original-stack-frames` 还原服务端组件源码 |
| 多编辑器支持 | VS Code / VS Code Insiders / Cursor / TRAE（国际版 / 国内版）/ IntelliJ IDEA |
| 浏览器临注入工具 | `apps/browser-inspector` 打包为独立脚本，通过 DevTools Snippet 注入任意页面，目标项目无需改任何代码 |
| 路径映射 | `projectRoot` / `projectName` / `pathModifier`，适配 IDEA 相对路径与容器/远程路径映射 |
| 浮层面板 | 浏览器注入方式提供可视化面板：开始/结束选择、编辑器切换、状态提示 |
| 热更新安全 | 源码解析请求去重 + 操作序号失效机制，避免热更新后沿用旧行号 |

## 两种使用方式

### 方式一：作为 npm 包集成到项目中

在目标项目里安装 `code-provenance` 并在入口挂载 `<CodeProvenance />`，
开发环境下 <kbd>Option+Click</kbd> 组件即可跳转源码；生产构建会被 tree-shaking 自动移除。
适合**自己拥有源码、长期启用**的项目。

详细接入说明见 [packages/code-provenance/README.md](packages/code-provenance/README.md)。

### 方式二：浏览器临时代码块注入（无需修改目标项目）

用 `apps/browser-inspector` 把工具打包成独立脚本，粘贴到浏览器的
DevTools Snippet（代码块）中运行，即可对任意本地开发页面进行源码定位。
目标项目**无需安装依赖、无需修改入口或构建配置**，适合临时调试第三方/线上本地页面。

详细使用说明见 [apps/browser-inspector/README.md](apps/browser-inspector/README.md)。

这是一个 pnpm + Turborepo monorepo：

| 路径 | 说明 |
| --- | --- |
| [packages/code-provenance](packages/code-provenance) | 主包，发布到 npm 的 React 组件 |
| [apps/cra](apps/cra) | Create React App 示例 |
| [apps/next](apps/next) | Next.js 示例 |
| [apps/browser-inspector](apps/browser-inspector) | 浏览器临时检查工具：打包为独立脚本注入目标页面运行 |

## 快速开始

```shell
pnpm install
pnpm build
pnpm dev
```

`pnpm build` 会先编译 `packages/code-provenance`（TypeScript → `dist/`），
示例项目与浏览器注入工具都依赖该编译产物。

使用方式与详细配置见 [packages/code-provenance/README.md](packages/code-provenance/README.md)。
