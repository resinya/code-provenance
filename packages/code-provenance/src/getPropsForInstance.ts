import type { Fiber } from 'react-reconciler'

/** 提取实例上有辨识度的标量 props，用于右键菜单展示 */
export function getPropsForInstance(instance: Fiber): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  Object.entries(instance.memoizedProps || {}).forEach(([key, value]) => {
    const type = typeof value

    // 跳过部分取值：即使是标量，辨识度也不够
    if (['key'].includes(key) || value === instance.type?.defaultProps?.[key]) {
      return
    }

    // 标量值
    if (
      ['string', 'number', 'boolean', 'symbol'].includes(type) ||
      value instanceof String ||
      value instanceof Number ||
      value instanceof Boolean ||
      value instanceof Symbol
    ) {
      props[key] = value
    }
  })

  return props
}
