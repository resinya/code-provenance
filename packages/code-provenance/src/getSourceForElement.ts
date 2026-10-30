import { getReactInstanceForElement } from './getReactInstanceForElement.js'
import { getSourceForInstance } from './getSourceForInstance.js'
import type { SourceLocation } from './types.js'

export function getSourceForElement(
  element: HTMLElement,
): SourceLocation | undefined {
  const instance = getReactInstanceForElement(element)
  const source = getSourceForInstance(instance)

  if (source) return source

  const fallbackSource = getFirstParentElementWithSource(element)
  return fallbackSource
}

function getFirstParentElementWithSource(
  element: HTMLElement,
): SourceLocation | undefined {
  const parentElement = element.parentElement
  if (parentElement === null) {
    console.warn('未能找到该元素对应的 React 实例', element)
    throw new Error('该元素没有可用的父元素')
  }

  const instance = getReactInstanceForElement(parentElement)
  const source = getSourceForInstance(instance)

  if (source) return source
  else return getFirstParentElementWithSource(element)
}
