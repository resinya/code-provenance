import { AnyMap, originalPositionFor } from '@jridgewell/trace-mapping'

import { getSourceForInstance } from './getSourceForInstance.js'
import type { SourceLocation } from './types.js'

/** 解析后的一帧调用栈（兼容 V8 与 Firefox 格式） */
export type StackFrame = {
  methodName: string
  file: string
  line1: number
  column1: number
  arguments: unknown[]
}

export function parseStack(stack: unknown): StackFrame[] {
  if (typeof stack !== 'string') return []
  return stack.split('\n').flatMap((line): StackFrame[] => {
    let text = line.trim()
    let methodName = '<unknown>'
    if (text.startsWith('at ')) {
      text = text.slice(3)
      const start = text.indexOf(' (')
      if (start !== -1 && text.endsWith(')')) {
        methodName = text.slice(0, start)
        text = text.slice(start + 2, -1)
      }
    } else {
      const at = text.indexOf('@')
      if (at === -1) return []
      methodName = text.slice(0, at) || methodName
      text = text.slice(at + 1)
    }
    // 贪心匹配文件名，以保留 Windows 盘符和 URL 端口。
    const match = /^(.*):(\d+):(\d+)$/.exec(text)
    if (!match || !match[1] || match[1] === '<anonymous>') return []
    return [
      {
        methodName,
        file: match[1],
        line1: Number(match[2]),
        column1: Number(match[3]),
        arguments: [],
      },
    ]
  })
}

function getFrames(instance: any): StackFrame[] {
  const stack = instance._debugStack || instance.debugStack
  const frames = parseStack(typeof stack === 'string' ? stack : stack?.stack)
  if (frames.length) return frames
  // React Server Component 的 owner 也可能携带序列化的调用栈元组。
  if (!Array.isArray(instance.stack)) return []
  return instance.stack.flatMap(
    ([methodName, file, line1, column1]: any[]): StackFrame[] =>
      typeof file === 'string' && Number.isFinite(line1) && line1 > 0
        ? [
            {
              methodName,
              file,
              line1,
              column1: column1 || 1,
              arguments: [],
            },
          ]
        : [],
  )
}

export function hasSourceStack(instance: any): boolean {
  return getFrames(instance).length > 0
}

export function isAbsolutePath(path: string): boolean {
  return /^(?:[a-z]:[\\/]|\/|\\\\)/i.test(path)
}

function normalizeFile(file: string): string {
  if (file.startsWith('file://')) {
    return decodeURIComponent(new URL(file).pathname).replace(
      /^\/([a-z]:)/i,
      '$1',
    )
  }
  return file
    .replace(/\\/g, '/')
    .replace(/^turbopack:\/\/\//, '')
    .replace(/^\[project\]\//, '')
    .replace(/^\.\//, '')
}

/** 把一帧（可能是 source map 还原结果或 Next 映射结果）转成源码位置；不可用返回 undefined */
function sourceFromFrame(
  frame: any,
  projectRoot?: string,
): SourceLocation | undefined {
  if (
    !frame ||
    frame.ignored ||
    typeof frame.file !== 'string' ||
    !Number.isFinite(frame.line1) ||
    frame.line1 < 1
  )
    return
  let fileName = normalizeFile(frame.file)
  if (
    /^(?:https?:|webpack-internal:|rsc:)/.test(fileName) ||
    /(?:^|\/)\_next\//.test(fileName) ||
    /(?:^|[\\/])(?:node_modules|\.next)(?:[\\/]|$)/.test(fileName)
  )
    return
  if (projectRoot && !isAbsolutePath(fileName)) {
    fileName = projectRoot.replace(/[\\/]$/, '') + '/' + fileName
  }
  return {
    fileName,
    lineNumber: frame.line1,
    columnNumber:
      Number.isFinite(frame.column1) && frame.column1 > 0 ? frame.column1 : 1,
    openWithNext: true,
  }
}

type TraceMapValue = ReturnType<typeof AnyMap>

/**
 * 只合并进行中的请求。热更新后的新选择必须基于当前 source map 重新解析，
 * 而不是沿用缓存的源码位置。
 */
export function createSourceResolver({ projectRoot }: { projectRoot?: string } = {}) {
  const pending = new Map<string, Promise<Array<SourceLocation | undefined>>>()
  const pendingMaps = new Map<string, Promise<TraceMapValue | undefined>>()

  async function clientMap(file: string): Promise<TraceMapValue | undefined> {
    const url = new URL(file)
    // Next 把客户端 source map 放在 chunk 旁边。只读取当前页面自己的
    // 开发服务器上的映射，包括带索引的 Turbopack 映射。
    if (
      url.origin !== window.location.origin ||
      !/\/_next\/static\/.*\.js$/.test(url.pathname)
    )
      return
    url.pathname += '.map'
    const key = url.href
    if (pendingMaps.has(key)) return pendingMaps.get(key)
    const request = (async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 7000)
      try {
        const response = await fetch(key, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) return
        return AnyMap(await response.json(), key)
      } finally {
        clearTimeout(timer)
      }
    })()
    pendingMaps.set(key, request)
    try {
      return await request
    } finally {
      pendingMaps.delete(key)
    }
  }

  async function mapFrames(
    frames: StackFrame[],
    isServer: boolean,
  ): Promise<Array<SourceLocation | undefined>> {
    const result: Array<SourceLocation | undefined> = new Array(frames.length)
    const internal: StackFrame[] = []
    const indices: number[] = []
    await Promise.all(
      frames.map(async (frame, index) => {
        if (!/^https?:/.test(frame.file)) {
          internal.push(frame)
          indices.push(index)
          return
        }
        try {
          const map = await clientMap(frame.file)
          if (!map) return
          const original = originalPositionFor(map, {
            line: frame.line1,
            column: Math.max(0, frame.column1 - 1),
          })
          result[index] = sourceFromFrame(
            {
              file: original.source,
              line1: original.line,
              column1: original.column === null ? 1 : original.column + 1,
            },
            projectRoot,
          )
        } catch {
          // 映射缺失或损坏不能作为源码位置的依据。
        }
      }),
    )
    if (internal.length) {
      const mapped = await mapNextFrames(internal, isServer)
      mapped.forEach((source, index) => {
        result[indices[index]] = source
      })
    }
    return result
  }

  async function mapNextFrames(
    frames: StackFrame[],
    isServer: boolean,
  ): Promise<Array<SourceLocation | undefined>> {
    const body = JSON.stringify({
      frames,
      isServer,
      isEdgeServer: false,
      isAppDirectory: true,
    })
    if (pending.has(body)) return pending.get(body) as Promise<Array<SourceLocation | undefined>>
    const request = (async (): Promise<Array<SourceLocation | undefined>> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 7000)
      try {
        const response = await fetch('/__nextjs_original-stack-frames', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })
        if (!response.ok || response.status === 204) {
          throw new Error(
            `Next 源码映射接口不可用（HTTP ${response.status}）。请确认目标页面由 next dev 启动。`,
          )
        }
        const result = await response.json()
        if (!Array.isArray(result) || result.length !== frames.length) {
          throw new Error('Next 源码映射响应格式不兼容，无法可靠确定源码行号。')
        }
        return result.map((item: any) =>
          item?.status === 'fulfilled'
            ? sourceFromFrame(item.value?.originalStackFrame, projectRoot)
            : undefined,
        )
      } catch (error) {
        if (controller.signal.aborted)
          throw new Error('Next 源码映射超时，请稍后重试。')
        throw error
      } finally {
        clearTimeout(timer)
      }
    })()
    pending.set(body, request)
    try {
      return await request
    } finally {
      pending.delete(body)
    }
  }

  return async function resolveSources(
    instances: any[],
  ): Promise<Array<{ instance: any; source: SourceLocation }>> {
    const sources = new Map<any, SourceLocation>()
    const stacks: Array<{
      instance: any
      frames: StackFrame[]
      isServer: boolean
    }> = []
    for (const instance of instances) {
      const direct = getSourceForInstance(instance)
      if (direct) {
        sources.set(instance, direct)
        continue
      }
      const frames = getFrames(instance).slice(0, 20)
      if (frames.length)
        stacks.push({
          instance,
          frames,
          isServer:
            typeof instance.tag !== 'number' ||
            frames.some((frame) => frame.file.startsWith('rsc:')),
        })
    }
    if (stacks.length) {
      const isNext =
        Boolean(
          Reflect.get(window, 'next') || Reflect.get(window, '__NEXT_DATA__'),
        ) ||
        stacks.some(({ frames }) =>
          frames.some(({ file }) =>
            /(?:\/_next\/|turbopack:|webpack-internal:|rsc:)/.test(file),
          ),
        )
      if (!isNext) {
        if (!sources.size)
          throw new Error(
            '已找到 React 调用栈，但当前自动映射仅支持 Next 本地开发页面。',
          )
      } else {
        try {
          for (const isServer of [false, true]) {
            const group = stacks.filter((stack) => stack.isServer === isServer)
            if (!group.length) continue
            const frames: StackFrame[] = []
            const indices = new Map<string, number>()
            for (const stack of group) {
              for (const frame of stack.frames) {
                const key = JSON.stringify(frame)
                if (!indices.has(key)) {
                  indices.set(key, frames.length)
                  frames.push(frame)
                }
              }
            }
            const mapped = await mapFrames(frames, isServer)
            for (const stack of group) {
              const source = stack.frames
                .map((frame) => mapped[indices.get(JSON.stringify(frame)) as number])
                .find(Boolean)
              if (source) sources.set(stack.instance, source)
            }
          }
        } catch (error) {
          if (!sources.size) throw error
        }
      }
    }
    return instances
      .filter((instance) => sources.has(instance))
      .map((instance) => ({
        instance,
        source: sources.get(instance) as SourceLocation,
      }))
  }
}
