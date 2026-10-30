import type { Fiber } from 'react-reconciler'

/** React 19 服务端组件的调试记录，没有 Fiber 的 tag 字段 */
type ServerComponentRecord = { name?: string }

export function getDisplayNameForInstance(
  instance: Fiber | ServerComponentRecord,
): string {
  // React 19 的 server owner 是调试记录，不是客户端 Fiber 节点。
  if (!('tag' in instance)) return instance.name || 'Server Component'
  const { elementType, tag } = instance

  // https://github.com/facebook/react/blob/7c8e5e7ab8bb63de911637892392c5efd8ce1d0f/packages/react-reconciler/src/ReactWorkTags.js
  switch (tag) {
    case 0: // FunctionComponent
    case 1: // ClassComponent
      return (
        elementType.displayName ||
        elementType.name ||
        instance.type?.displayName ||
        instance.type?.name ||
        'Anonymous Component'
      )

    case 3:
      return 'HostRoot'

    case 4:
      return 'HostPortal'

    case 5: // HostComponent:
      return elementType

    case 6: // HostText:
      return 'String'

    case 7: // Fragment
      return 'React.Fragment'

    case 8:
      return 'Mode'

    case 9: // ContextConsumer
      return 'Context.Consumer'

    case 10: // ContextProvider
      return 'Context.Provider'

    case 11: // ForwardRef
      return 'React.forwardRef'

    case 12:
      return 'Profiler'

    case 13:
      return 'SuspenseComponent'

    case 14:
    case 15:
      // 尝试从被包裹的组件上取名字
      return (
        elementType.type?.name ??
        Symbol.keyFor?.(elementType.$$typeof) ??
        'React.memo'
      )

    case 16: // LazyComponent
      return 'React.lazy'

    case 17:
      return 'IncompleteClassComponent'

    case 18:
      return 'DehydratedFragment'

    case 19:
      return 'SuspenseListComponent'

    case 21:
      return 'ScopeComponent'

    case 22:
      return 'OffscreenComponent'

    case 23:
      return 'LegacyHiddenComponent'

    case 24:
      return 'CacheComponent'

    // @ts-expect-error - TS2678 - 25 不在旧版 WorkTag 类型中，但新版 React 存在
    case 25:
      return 'TracingMarkerComponent'

    // @ts-expect-error - TS2678 - 26 不在旧版 WorkTag 类型中，但新版 React 存在
    case 26:
      return 'HostHoistable'

    // @ts-expect-error - TS2678 - 27 不在旧版 WorkTag 类型中，但新版 React 存在
    case 27:
      return 'HostSingleton'

    // @ts-expect-error - TS2678 - 28 不在旧版 WorkTag 类型中，但新版 React 存在
    case 28:
      return 'IncompleteFunctionComponent'

    // @ts-expect-error - TS2678 - 29 不在旧版 WorkTag 类型中，但新版 React 存在
    case 29:
      return 'Throw'

    default:
      console.warn(`未识别的 React Fiber tag：${tag}`, instance)
      return 'Unknown Component'
  }
}
