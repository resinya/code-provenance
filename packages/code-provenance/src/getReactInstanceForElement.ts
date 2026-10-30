import type { Fiber } from 'react-reconciler'

/** 从 DOM 元素反查对应的 React 内部实例（Fiber） */
export function getReactInstanceForElement(
  element: HTMLElement,
): Fiber | null | undefined {
  // 优先走 React DevTools，它能直接访问 `react-dom` 的 `element` <=> Fiber 映射
  if ('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window) {
    // @ts-expect-error - TS2339 - window 上没有 React DevTools Hook 的类型声明
    const { renderers } = window.__REACT_DEVTOOLS_GLOBAL_HOOK__

    for (const renderer of renderers.values()) {
      try {
        const fiber = renderer.findFiberByHostInstance(element)

        if (fiber) {
          return fiber
        }
      } catch {
        // React 渲染中途，旧节点的引用可能在点击事件期间失效
        //（菜单等可交互元素尤其常见）
      }
    }
  }

  if ('_reactRootContainer' in element) {
    // @ts-expect-error - TS2339 - HTMLElement 上没有 _reactRootContainer 的类型声明
    return element._reactRootContainer._internalRoot.current.child
  }

  for (const key in element) {
    // Fiber 之前的 React 内部实例访问方式
    if (key.startsWith('__reactInternalInstance$')) {
      return (element as any)[key]
    }

    // Fiber 方式的 React 内部实例访问
    if (key.startsWith('__reactFiber')) {
      return (element as any)[key]
    }
  }
}
