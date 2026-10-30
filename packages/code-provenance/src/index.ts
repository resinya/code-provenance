import type * as React from 'react'

import { CodeProvenance as Component } from './CodeProvenance.js'
import type { CodeProvenanceProps } from './types.js'

export type {
  CodeProvenanceProps,
  ContextMenuProps,
  Coords,
  Editor,
  PathModifier,
  ResolveSources,
  SourceLocation,
  Target,
} from './types.js'

/** 仅在开发环境渲染；生产构建由 tree-shaking 整体移除 */
export const CodeProvenance: (
  props: CodeProvenanceProps,
) => React.ReactElement | null =
  process.env.NODE_ENV === 'development' ? Component : () => null
