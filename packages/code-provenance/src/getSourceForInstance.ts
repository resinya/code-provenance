import type { Fiber } from 'react-reconciler'

import type { SourceLocation } from './types.js'

/** 读取 Fiber 上由 @babel/plugin-transform-react-jsx-source 注入的源码位置 */
export function getSourceForInstance(
  instance: Fiber | null | undefined,
): SourceLocation | undefined {
  const debugSource = (instance as any)?._debugSource
  if (!debugSource) {
    return
  }

  const { columnNumber = 1, fileName, lineNumber = 1 } = debugSource

  return { columnNumber, fileName, lineNumber }
}
