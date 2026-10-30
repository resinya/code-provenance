# code-provenance

在浏览器中 <kbd>Option+Click</kbd> 页面上的 React 组件，**直接**在编辑器中打开对应的源码文件。

## 功能特性

- <kbd>Option+Click</kbd> 直接打开当前组件的源码位置
- <kbd>Option+右键</kbd> 弹出上下文菜单，可查看父级组件的 `props`、`fileName`、`columnNumber`、`lineNumber`
- 支持 [Next.js](https://nextjs.org/)、[Create React App](https://create-react-app.dev/)、[Vite](https://github.com/vitejs/vite/tree/main/packages/plugin-react) 等使用 [@babel/plugin-transform-react-jsx-source](https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-react-jsx-source) 注入源码信息的框架
- 支持 VS Code、VS Code Insiders、Cursor、TRAE 国际版 / 国内版，以及 IntelliJ IDEA 的 URL 协议唤起
- `production` 构建时自动被 **tree-shaking** 移除，不会打进正式包
- 上下文菜单支持键盘导航（<kbd>←</kbd>、<kbd>→</kbd>、<kbd>⏎</kbd>）
- 比 React DevTools 更直接：一步从页面元素跳到编辑器源码

## 安装

```shell
npm install code-provenance
```

```shell
pnpm add code-provenance
```

```shell
yarn add code-provenance
```

虽然 `code-provenance` 写在 `dependencies` 里，但 [tree-shaking](https://esbuild.github.io/api/#tree-shaking) 会在 `production` 构建中把它完全移除。

## 使用

### Create React App

```diff
+import { CodeProvenance } from 'code-provenance';
 import React from 'react';
 import ReactDOM from 'react-dom/client';
 import './index.css';

 const root = ReactDOM.createRoot(document.getElementById('root'));
 root.render(
   <React.StrictMode>
+    <CodeProvenance />
     <App />
   </React.StrictMode>
 );
```

### Next.js

```diff
+import { CodeProvenance } from 'code-provenance'
 import type { AppProps } from 'next/app'
 import '../styles/globals.css'

 function MyApp({ Component, pageProps }: AppProps) {
   return (
     <>
+      <CodeProvenance />
       <Component {...pageProps} />
     </>
   )
```

### Vite

```diff
+import { CodeProvenance } from "code-provenance";
 import React from "react";
 import ReactDOM from "react-dom/client";
 import App from "./App";
 import "./index.css";

 ReactDOM.createRoot(document.getElementById("root")!).render(
   <React.StrictMode>
     <App />
+   <CodeProvenance />
  </React.StrictMode>
 );
```

### Docusaurus

```shell
npm install @babel/plugin-transform-react-jsx-source
```

babel.config.js：

```js
module.exports = {
  presets: [require.resolve('@docusaurus/core/lib/babel/preset')],
  plugins: [
    ...(process.env.BABEL_ENV === 'development'
      ? ['@babel/plugin-transform-react-jsx-source']
      : []),
  ],
};
```

src/theme/Root.js：

```js
import { CodeProvenance } from 'code-provenance';
import React from 'react';

// 默认实现，可按需自定义
export default function Root({ children }) {
  return (
    <>
      <CodeProvenance />
      {children}
    </>
  );
}
```

## React 19 / Next.js 说明

React 19 的 Next.js 开发页面中，源码位置通过开发调用栈和 source map 解析；
React 16/18 的源码元信息仍然支持。
当 Next 返回相对路径时，由它的开发服务器负责打开编辑器。
把 `projectRoot` 设为本机项目的绝对路径，即可改用指定的编辑器 URL 协议，例如：

```jsx
<CodeProvenance editor="vscode" projectRoot="D:/my-next-project" />
```

这要求开发调试信息可用、source map / Next 开发接口可以访问。
其他 React 19 构建工具和生产构建不在此适配范围内。

## 配置项

### `editor`

默认使用 [`vscode`](https://code.visualstudio.com/)。

| 编辑器 | `editor` 值 |
| --- | --- |
| VS Code | `vscode`（默认） |
| VS Code Insiders | `vscode-insiders` |
| Cursor | `cursor` |
| TRAE 国际版 | `trae` |
| TRAE 国内版 | `trae-cn` |
| IntelliJ IDEA | `idea` |

```tsx
<CodeProvenance editor="cursor" />
<CodeProvenance editor="trae-cn" />
<CodeProvenance editor="idea" projectRoot="D:/my-project" />
```

IDEA 使用 `jetbrains://idea/navigate/reference`，需要本机安装
[JetBrains Toolbox 并注册协议](https://www.jetbrains.com/help/idea/project-tool-window.html)。
先用 IDEA 打开目标项目，再将 `projectRoot` 设为该项目在本机的真实目录。
工具会生成项目相对路径，并转换为 JetBrains 协议要求的从 0 开始的行列号，
以避开 Windows 盘符中的冒号；协议格式可见
[JetBrains 源码](https://github.com/JetBrains/intellij-community/blob/master/platform/lang-impl/src/com/intellij/navigation/NavigatorWithinProject.kt)。
`projectName` 默认取根目录名；如果 IDEA 中的项目名称不同，显式传入：

```tsx
<CodeProvenance editor="idea" projectRoot="D:/my-project" projectName="My IDEA Project" />
```

Next 返回相对路径时，未配置 `projectRoot` 默认仍交给 Next 开发服务器选择编辑器。
要确保使用所选 Cursor / TRAE / IDEA，请配置本机 `projectRoot`；
IDEA 也可使用 `projectName` 打开已知项目内的相对路径。
容器路径通过 `pathModifier` 映射到本机目录，返回值保留末尾的 `:行号:列号`。
其他兼容 `协议名://file/文件:行:列` 的编辑器仍可直接传入协议名。

## 不修改目标项目？试试浏览器注入方式

如果你想调试的项目不方便添加依赖或修改入口（例如第三方页面、线上本地环境），
可以改用本仓库的浏览器临时检查工具：把工具打包成独立脚本，
粘贴到浏览器 DevTools 的 Snippet（代码块）中即可运行。
详见 [apps/browser-inspector/README.md](../../apps/browser-inspector/README.md)。

## 本地开发

包源码使用 TypeScript 编写（`src/`），通过 `tsc` 编译到 `dist/` 后发布，
类型声明（`dist/index.d.ts`）随包一起分发，无需额外安装 `@types/*`。

克隆仓库：

```shell
git clone https://github.com/resinya/code-provenance.git
```

进入目录并安装依赖：

```shell
cd code-provenance
pnpm install
```

编译包（示例项目与浏览器注入工具都依赖编译产物 `dist/`）：

```shell
pnpm build
```

运行示例项目：

```shell
cd apps/cra
pnpm start
```

```shell
cd apps/next
pnpm dev
```

## 致谢

本包的核心思路借鉴自
[ericclemmons/click-to-component](https://github.com/ericclemmons/click-to-component)
（npm 包名 `click-to-react-component`），在此基础上进行了 TypeScript 迁移、
React 19 / Next 16 适配、多编辑器支持与路径映射等扩展。
感谢原作者 [Eric Clemmons](https://github.com/ericclemmons) 及所有贡献者。
