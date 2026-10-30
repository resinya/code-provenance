/** 内置编辑器，也可传入兼容 VS Code 文件 URL 格式的其他协议名 */
export type Editor =
  | 'vscode'
  | 'vscode-insiders'
  | 'cursor'
  | 'trae'
  | 'trae-cn'
  | 'idea'
  | (string & {})

/** 打开编辑器前改写 `文件:行:列` 路径；必须保留末尾的 :行号:列号 */
export type PathModifier = (path: string) => string

/** 一个可直接打开的源码位置 */
export type SourceLocation = {
  fileName: string
  lineNumber: number
  columnNumber: number
  /** 为 true 且路径为相对路径时，优先交给 Next 开发服务器打开编辑器 */
  openWithNext?: boolean
}

/** 把一组 React 内部实例解析为可打开的源码位置 */
export type ResolveSources = (
  instances: any[],
) => Promise<Array<{ instance: any; source: SourceLocation }>>

export type CodeProvenanceProps = {
  /** 打开源码使用的编辑器，默认 'vscode'；IDEA 使用 JetBrains Toolbox 协议 */
  editor?: Editor
  /** 打开编辑器前改写路径，用于容器/远程目录映射 */
  pathModifier?: PathModifier
  /** 本机项目根目录的绝对路径；设置后 Next 相对路径改用指定编辑器打开 */
  projectRoot?: string
  /** IDEA 中的项目名称，默认取 projectRoot 的目录名；项目重命名后需显式设置 */
  projectName?: string
  /** 右键菜单浮层容器的 id */
  portalId?: string
  /** 持续开启选择模式，无需按住 Alt/Option */
  active?: boolean
  /** 选择、解析、打开编辑器过程中的状态回调 */
  onStatus?: (message: string) => void
}

export type Coords = [MouseEvent['pageX'], MouseEvent['pageY']]

export type Target = HTMLElement

export type ContextMenuProps = {
  onClose?: (source?: SourceLocation) => void
  pathModifier?: PathModifier
  active?: boolean
  resolveSources?: ResolveSources
}
