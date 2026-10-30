import { FloatingPortal } from '@floating-ui/react-dom-interactions'
import * as React from 'react'

import { ContextMenu } from './ContextMenu.js'
import { getPathToSource } from './getPathToSource.js'
import { getReactInstancesForElement } from './getReactInstancesForElement.js'
import { getSourceForInstance } from './getSourceForInstance.js'
import { openSource } from './openSource.js'
import { createSourceResolver, hasSourceStack } from './resolveSources.js'
import type { CodeProvenanceProps, SourceLocation } from './types.js'

export const State = {
  IDLE: 'IDLE',
  HOVER: 'HOVER',
  SELECT: 'SELECT',
} as const

export type State = (typeof State)[keyof typeof State]

/** 高亮当前目标元素的样式；可用 --code-provenance-cursor / --code-provenance-outline 覆盖 */
const highlightStyle = `
[data-code-provenance-target] {
  cursor: var(--code-provenance-cursor, context-menu) !important;
  outline: solid 2px #38bdf8;
  outline: var(--code-provenance-outline, #38bdf8 solid 2px) !important;
  outline-offset: 2px;
}
`

export function CodeProvenance({
  editor = 'vscode',
  pathModifier,
  projectRoot,
  projectName,
  portalId,
  active = false,
  onStatus,
}: CodeProvenanceProps) {
  const [state, setState] = React.useState<State>(State.IDLE)

  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  const resolveSources = React.useMemo(
    () => createSourceResolver({ projectRoot }),
    [projectRoot],
  )

  // 单调递增的操作序号：新的交互让进行中的异步解析与打开动作失效
  const operation = React.useRef(0)
  React.useEffect(() => {
    operation.current++
    return () => {
      operation.current++
    }
  }, [active, resolveSources, editor, pathModifier, projectName])

  const onClick = React.useCallback(
    async function handleClick(event: MouseEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-code-provenance-ignore]')
      )
        return

      if (
        (state === State.HOVER || active || event.altKey) &&
        event.target instanceof HTMLElement
      ) {
        event.preventDefault()
        event.stopPropagation()

        const request = ++operation.current
        const instances = getReactInstancesForElement(event.target)
        const label =
          event.target.tagName.toLowerCase() +
          (event.target.id ? `#${event.target.id}` : '')
        if (
          !instances.some(
            (instance) =>
              getSourceForInstance(instance) || hasSourceStack(instance),
          )
        ) {
          onStatus?.(
            `点击到 ${label}。` +
              (instances.length
                ? '该元素没有源码位置信息或可解析的调用栈。请确认开发调试信息是否保留。'
                : '该元素及父元素未找到可识别的 React 节点。请确认是否点击了覆盖层，或内容是否在另一个 iframe。'),
          )
          return
        }

        onStatus?.(`正在解析 ${label} 的源码位置…`)
        try {
          const entries = await resolveSources(instances)
          if (request !== operation.current) return
          if (!entries.length) {
            onStatus?.(
              '已找到 React 调用栈，但未能映射到项目源码。请确认 source map 可用，或右键查看上层组件。',
            )
            return
          }
          const { source } = entries[0]
          onStatus?.(`正在打开编辑器：${getPathToSource(source, pathModifier)}`)
          await openSource(source, { editor, pathModifier, projectRoot, projectName })
          if (request === operation.current) setState(active ? State.HOVER : State.IDLE)
        } catch (error) {
          if (request === operation.current)
            onStatus?.(`源码定位失败：${(error as Error).message}`)
        }
      }
    },
    [active, editor, onStatus, pathModifier, projectRoot, projectName, state, resolveSources],
  )

  const onClose = React.useCallback(
    async function handleClose(source?: SourceLocation) {
      const request = ++operation.current
      setState(active ? State.HOVER : State.IDLE)
      if (!source) return
      onStatus?.(`正在打开编辑器：${getPathToSource(source, pathModifier)}`)
      try {
        await openSource(source, { editor, pathModifier, projectRoot, projectName })
      } catch (error) {
        if (request === operation.current)
          onStatus?.(`打开编辑器失败：${(error as Error).message}`)
      }
    },
    [active, editor, onStatus, pathModifier, projectRoot, projectName],
  )

  const onContextMenu = React.useCallback(
    function handleContextMenu(event: MouseEvent) {
      const { target } = event
      if (
        target instanceof Element &&
        target.closest('[data-code-provenance-ignore]')
      )
        return

      if (
        (state === State.HOVER || active || event.altKey) &&
        target instanceof HTMLElement
      ) {
        event.preventDefault()
        operation.current++
        setState(State.SELECT)
        setTarget(target)
      }
    },
    [active, state],
  )

  const onKeyDown = React.useCallback(
    function handleKeyDown(event: KeyboardEvent) {
      switch (state) {
        case State.IDLE:
          if (event.altKey) setState(State.HOVER)
          break

        default:
      }
    },
    [state],
  )

  const onKeyUp = React.useCallback(
    function handleKeyUp(event: KeyboardEvent) {
      switch (state) {
        case State.HOVER:
          if (!active && !event.altKey) setState(State.IDLE)
          break

        default:
      }
    },
    [active, state],
  )

  const onMouseMove = React.useCallback(
    function handleMouseMove(event: MouseEvent) {
      if (!(event.target instanceof HTMLElement)) {
        return
      }
      if (event.target.closest('[data-code-provenance-ignore]')) return

      switch (state) {
        case State.IDLE:
        case State.HOVER:
          setTarget(event.target)
          // 修饰键可能在页面获得焦点之前就已按下。
          if (active || event.altKey) setState(State.HOVER)
          else if (state === State.HOVER) setState(State.IDLE)
          break

        default:
          break
      }
    },
    [active, state],
  )

  const onBlur = React.useCallback(
    function handleBlur() {
      switch (state) {
        case State.HOVER:
          if (!active) setState(State.IDLE)
          break

        default:
      }
    },
    [active, state],
  )

  React.useEffect(() => {
    setState(active ? State.HOVER : State.IDLE)
  }, [active])

  React.useEffect(
    function toggleIndicator() {
      for (const element of Array.from(
        document.querySelectorAll('[data-code-provenance-target]'),
      )) {
        if (element instanceof HTMLElement) {
          delete element.dataset.codeProvenanceTarget
        }
      }

      if (state === State.IDLE) {
        delete window.document.body.dataset.codeProvenance
        if (target) {
          delete target.dataset.codeProvenanceTarget
        }
        return
      }

      if (target instanceof HTMLElement) {
        window.document.body.dataset.codeProvenance = state
        target.dataset.codeProvenanceTarget = state
      }
    },
    [state, target],
  )

  React.useEffect(
    function addEventListenersToWindow() {
      window.addEventListener('click', onClick, { capture: true })
      window.addEventListener('contextmenu', onContextMenu, { capture: true })
      window.addEventListener('keydown', onKeyDown, { capture: true })
      window.addEventListener('keyup', onKeyUp, { capture: true })
      window.addEventListener('mousemove', onMouseMove, { capture: true })
      window.addEventListener('blur', onBlur)

      return function removeEventListenersFromWindow() {
        window.removeEventListener('click', onClick, { capture: true })
        window.removeEventListener('contextmenu', onContextMenu, {
          capture: true,
        })
        window.removeEventListener('keydown', onKeyDown, { capture: true })
        window.removeEventListener('keyup', onKeyUp, { capture: true })
        window.removeEventListener('mousemove', onMouseMove, { capture: true })
        window.removeEventListener('blur', onBlur)
      }
    },
    [onClick, onContextMenu, onKeyDown, onKeyUp, onMouseMove, onBlur],
  )

  return (
    <>
      <style>{highlightStyle}</style>

      <FloatingPortal id={portalId}>
        <ContextMenu
          onClose={onClose}
          pathModifier={pathModifier}
          active={active}
          resolveSources={resolveSources}
        />
      </FloatingPortal>
    </>
  )
}
