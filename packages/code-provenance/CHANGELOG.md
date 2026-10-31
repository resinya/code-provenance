# @resinya/code-provenance

## 1.0.0

### Major Changes

- 首次发布。核心思路借鉴自 [ericclemmons/click-to-component](https://github.com/ericclemmons/click-to-component)，在此基础上二次开发：
  - 核心包由 JavaScript 迁移到 TypeScript，附带完整类型声明
  - 支持 React 19 / Next 16：解析 `_debugStack` 调用栈，配合 source map 与 Next 开发接口还原服务端组件源码
  - 多编辑器支持：VS Code / VS Code Insiders / Cursor / TRAE（国际版 / 国内版）/ IntelliJ IDEA
  - 路径映射能力：`projectRoot` / `projectName` / `pathModifier`，适配容器与远程路径
  - 源码解析请求去重与操作序号失效机制，避免热更新后沿用旧行号
