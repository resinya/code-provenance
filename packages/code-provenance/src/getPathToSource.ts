import type { PathModifier } from './types.js'

/** 拼出 `文件:行:列` 路径；缺省行列号时按 1 处理 */
export function getPathToSource(
  source: { fileName: string; lineNumber?: number; columnNumber?: number },
  pathModifier?: PathModifier,
): string {
  const { columnNumber = 1, fileName, lineNumber = 1 } = source

  let path = `${fileName}:${lineNumber}:${columnNumber}`
  if (pathModifier) {
    path = pathModifier(path)
  }

  return path
}
