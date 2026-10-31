# 浏览器临时入口

把当前仓库中的 CodeProvenance 打包为独立脚本，在目标页面临时运行。
目标项目无需添加依赖、修改入口、Vite 配置或锁文件。

> 如果目标项目是你自己的项目、可以修改源码，
> 更推荐直接安装 npm 包 `@resinya/code-provenance` 并挂载 `<CodeProvenance />`，
> 接入方式见 [packages/code-provenance/README.md](../../packages/code-provenance/README.md)。

## 准备和启动

在本仓库根目录执行：

```powershell
pnpm install
pnpm inspector:serve
```

服务会先构建脚本，然后仅监听本机 `127.0.0.1:4179`。
构建产物为 `apps/browser-inspector/dist/inspector.js` 和对应 source map。
仅生成产物可执行 `pnpm inspector:build`。
修改工具代码后重新启动服务以重新构建。

## React 19 / Next 16

React 16/18 继续读取 `_debugSource`。React 19 改为解析 `_debugStack`：
Next 客户端脚本通过浏览器可读的 source map 还原源码（包含 Turbopack 的分段映射），
服务端组件和 Webpack 内部地址通过目标页面同源的
`/__nextjs_original-stack-frames` 开发接口映射。

目标 Next 项目应使用 `next dev` 启动，接入方式仍然是运行同一个 Snippet。
映射需要 source map 或 Next 开发接口可用；生产页面和其他 React 19 构建工具不保证支持。
Next 的内部接口可能随版本变化，接口不可用或响应不兼容时会显示错误。

Next 返回相对路径时，默认通过它的 `__nextjs_launch-editor` 接口打开编辑器，
编辑器由 Next 开发服务器选择。若想明确使用工具配置的 VS Code / Cursor / TRAE / IDEA，
加载前指定本机项目根目录：

```js
window.__CP_OPTIONS__ = {
  editor: 'vscode',
  projectRoot: 'D:/resin-blog', // 换成目标项目在本机的真实目录
}
```

工具已加载时可执行 `window.__CP__.mount({ projectRoot: 'D:/resin-blog' })`。
容器或远程路径仍使用 `pathModifier` 映射。映射期间显示解析状态；
结束选择或退出会取消后续打开编辑器的动作。只合并进行中的映射请求，
下一次选择重新读取映射，避免热更新后继续使用旧行号。

## 在 EasyV 中启用

1. 按平常方式启动 EasyV，打开需要调试的本地开发页面。
2. 按 F12，进入 **Sources → Snippets → New snippet**。
3. 将本目录的 `load-in-browser.js` 内容粘贴进去并保存。
4. 运行该 Snippet，页面右下角应出现 **源码定位 · 已加载** 面板。
5. 点击 **开始选择**，无需按 Alt，移动鼠标查看高亮，单击打开源码，右键选择上层组件。
6. 点击 **结束选择** 恢复普通操作，点击 **退出** 卸载工具。

也可以按住 Alt（Mac 为 Option）使用临时选择。Windows 使用左 Alt 即可。
如果仍没有高亮，请先看右下角面板是否出现；未出现代表入口没有成功运行在当前页面。
若页面被嵌在 iframe 中，需要在对应 frame 中加载，顶层页面的工具收不到 iframe 内的事件。

面板会直接提示“没有源码位置信息”或“没有找到 React 节点”。
部署页面即使域名包含 dev，也不代表 React 保留开发调试信息。
面板中的**编辑器**下拉框可切换 VS Code、VS Code Insiders、Cursor、TRAE、TRAE CN 和 IntelliJ IDEA。
**测试编辑器**链接随当前选项更新：VS Code 系列测试设置页，IDEA 测试打开指定项目。
测试链接不代表目标元素已有源码位置。

从旧版升级时，重新复制最新的 `load-in-browser.js` 后运行。
加载片段每次获取当前构建，入口会自动卸载旧版本，无需刷新目标页面。

如果页面限制外部脚本加载，也可以将 `dist/inspector.js` 的完整内容直接
粘贴到 Snippet 中运行，此方式不需要本地 HTTP 服务。

刷新页面会退出工具。重复执行加载片段会复用已有实例。

## 配置和卸载

加载前可以设置：

```js
window.__CP_OPTIONS__ = {
  editor: 'cursor', // vscode / vscode-insiders / cursor / trae / trae-cn / idea
  // 入参包含 :行号:列号，请保留这部分。
  pathModifier: (path) => path.replace('/container/easyv/', 'D:/dtstack/easyvadmin-monorepo/'),
}
```

加载后可在 Console 中操作：

```js
window.__CP__.mounted // 是否已挂载
window.__CP__.select() // 无需按键，开始选择
window.__CP__.pause() // 结束选择
window.__CP__.unmount() // 清理工具的 React 根、浮层、监听器和高亮标记
window.__CP__.mount() // 再次启用，保留此前配置
window.__CP__.mount({ editor: 'vscode', pathModifier: (path) => path })
```

TRAE 国际版使用 `editor: 'trae'`，国内版使用 `editor: 'trae-cn'`。
使用 IDEA 时，先安装 [JetBrains Toolbox](https://www.jetbrains.com/help/idea/project-tool-window.html)
以注册 `jetbrains://` 协议，并用 IDEA 打开目标项目，再设置：

```js
window.__CP__.mount({
  editor: 'idea',
  projectRoot: 'D:/dtstack/easyvadmin-monorepo', // 本机项目根目录
  // projectName: 'EasyV', // 仅当 IDEA 中的项目名与目录名不同时填写
})
```

IDEA 使用项目相对路径，保留源码行列定位；路径不在 `projectRoot` 内时会提示检查目录映射。
面板切换编辑器会保留 `projectRoot`、`projectName` 和 `pathModifier`。

卸载保留 `window.__CP__` 控制对象，刷新页面后控制对象和配置一起消失。
更换服务端口可执行 `pnpm --filter @code-provenance/browser-inspector serve 4180`，
同时修改加载片段中的 URL。

## 实现与验证边界

- 单个 IIFE 脚本包含工具自己的 React 18.1 / ReactDOM 18.1 及依赖，
  不从目标应用导入 React，也不替换目标应用的 React。
- 工具在专用 DOM 节点及浮层容器中挂载，卸载时清理这些节点。
- 保留目标页面原有的 `pointer-events`，避免将透明标尺等层变成点击遮罩。
- 工具读取目标元素的 React Fiber、所属组件和调试信息；React 19 需要可用的调用栈和源码映射。
  对标尺等命令式创建的 DOM，会沿父元素寻找所属 React 节点；如果父组件也没有源码信息，仍无法定位。
  已编译组件、第三方包、iframe 内页面或缺少调试信息的元素不能保证可定位。
  调试 iframe 内容时需在对应 frame 的执行上下文中加载。
- 自带测试使用真实 React 16.13.1 / 18.1 / 19.2.4 渲染器和 JSDOM，覆盖跨 React 根读取源码、
  右键菜单、路径映射、重复加载、卸载、DOM 就绪前加载、业务事件阻断及手动选择。
  React 19 的 JSDOM 菜单测试模拟 Next 映射响应；独立的映射测试覆盖实际 source map 解码、
  服务端组件记录、失败响应、请求去重和热更新后重新解析。
  它们不代表已经验证 EasyV 实际页面、浏览器加载策略或编辑器协议注册。

```powershell
pnpm inspector:test
```

原生浏览器的透明层命中回归用例位于 `checks/transparent-overlay.js`，
可通过 Playwright MCP 的 `browser_run_code_unsafe` 的 `filename` 参数运行。
该用例验证选择前后都命中底层按钮，并保留标尺手柄的正常交互。

真实 Next 16 App Router 浏览器回归用例位于 `checks/next16.js`：

```powershell
pnpm inspector:serve
# 在另一个终端启动独立测试项目，不需要运行博客或连接数据库：
pnpm --filter @code-provenance/next16-fixture dev
```

通过 Playwright MCP 的 `browser_run_code_unsafe` 的 `filename` 参数运行该文件。
它检查客户端与服务端组件的实际文件和行列号、右键菜单、单击定位、选择期间的业务事件阻断，
以及暂停和卸载。source map 与 Next 映射接口使用真实响应；只有打开编辑器的请求被拦截，
因此不代表验证了操作系统实际唤起编辑器。使用 `next dev --webpack --hostname 127.0.0.1 --port 4181`
替换测试项目默认启动命令，可以针对同一用例检查 Webpack 模式。
