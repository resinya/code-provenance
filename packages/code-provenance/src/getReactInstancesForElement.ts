import { getReactInstanceForElement } from './getReactInstanceForElement.js'

/** 收集元素对应的 React 实例及其 owner 链（含 DOM 父元素上的实例） */
export function getReactInstancesForElement(element: HTMLElement): any[] {
  const instances = new Set<any>()
  // 图表库、标尺等可能在 React 节点之下插入纯 DOM，
  // 因此除了 React owner 链，还要沿 DOM 父元素继续向上找源码。
  let currentElement: HTMLElement | null = element
  while (currentElement) {
    let instance: any = getReactInstanceForElement(currentElement)
    while (instance && !instances.has(instance)) {
      instances.add(instance)
      instance = instance._debugOwner || instance.owner
    }
    currentElement = currentElement.parentElement
  }

  return Array.from(instances)
}
