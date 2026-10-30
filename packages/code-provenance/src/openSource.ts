import { getPathToSource } from './getPathToSource.js'
import { getUrl } from './getUrl.js'
import { isAbsolutePath } from './resolveSources.js'
import type { CodeProvenanceProps, SourceLocation } from './types.js'

/** 打开源码位置；未配置本机项目时，Next 相对路径交给开发服务器。 */
export async function openSource(
  source: SourceLocation,
  {
    editor,
    pathModifier,
    projectRoot,
    projectName,
  }: Pick<CodeProvenanceProps, 'pathModifier' | 'projectRoot' | 'projectName'> & {
    editor: string
  },
): Promise<void> {
  let path = getPathToSource(source, pathModifier)
  if (projectRoot && !isAbsolutePath(path))
    path = projectRoot.replace(/[\\/]$/, '') + '/' + path
  if (
    source.openWithNext &&
    !isAbsolutePath(path) &&
    !(editor === 'idea' && projectName)
  ) {
    const match = /^(.*):(\d+):(\d+)$/.exec(path)
    if (!match) throw new Error('pathModifier 必须保留路径末尾的 :行号:列号。')
    const query = new URLSearchParams({
      file: match[1],
      line1: match[2],
      column1: match[3],
    })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    try {
      const response = await fetch(`/__nextjs_launch-editor?${query}`, {
        signal: controller.signal,
      })
      if (!response.ok)
        throw new Error(
          'Next 未能打开编辑器。可配置 projectRoot 后使用工具指定的编辑器。',
        )
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('Next 打开编辑器请求超时，请稍后重试。')
      throw error
    } finally {
      clearTimeout(timer)
    }
    return
  }
  window.location.assign(
    getUrl({ editor, pathToSource: path, projectRoot, projectName }),
  )
}
