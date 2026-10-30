<p align="center">
  <img src="./assets/logo-wordmark.png" alt="code-provenance — 点击页面，追溯源码" width="640" />
</p>

# code-provenance

在浏览器中 <kbd>Option+Click</kbd> 页面上的 React 组件，直接在编辑器中打开对应的源码文件。

支持 VS Code、VS Code Insiders、Cursor、TRAE（国际版 / 国内版）和 IntelliJ IDEA。
浏览器注入面板可直接切换编辑器；npm 接入通过 `editor` 属性选择。

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
