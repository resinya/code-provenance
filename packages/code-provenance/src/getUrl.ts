/** 拼出编辑器 URL；IDEA 使用项目相对路径和从 0 开始的行列号。 */
export function getUrl({
  editor,
  pathToSource,
  projectRoot,
  projectName,
}: {
  editor: string
  pathToSource: string
  projectRoot?: string
  projectName?: string
}): string {
  const path = pathToSource.replace(/\\/g, '/')
  if (editor === 'idea') {
    const match = /^(.*):(\d+):(\d+)$/.exec(path)
    if (!match) throw new Error('pathModifier 必须保留路径末尾的 :行号:列号。')
    const root = projectRoot?.replace(/\\/g, '/').replace(/\/+$/, '')
    const project = projectName || root?.split('/').pop()
    if (!project)
      throw new Error('IDEA 需要配置 projectRoot 或 projectName，以匹配 IDE 中的项目。')

    let file = match[1]
    if (/^(?:[a-z]:\/|\/)/i.test(file)) {
      if (!root)
        throw new Error('IDEA 打开绝对路径需要配置本机 projectRoot。')
      const prefix = root + '/'
      // Windows 文件路径不区分大小写；POSIX 路径保留大小写。
      const windows = /^[a-z]:\//i.test(file) || file.startsWith('//')
      const insideRoot = windows
        ? file.toLowerCase().startsWith(prefix.toLowerCase())
        : file.startsWith(prefix)
      if (!insideRoot)
        throw new Error('源码不在 IDEA 的 projectRoot 内，请检查 projectRoot 或 pathModifier。')
      file = file.slice(prefix.length)
    }
    const query = new URLSearchParams({
      project,
      path: `${file.replace(/^\.\//, '')}:${Math.max(0, Number(match[2]) - 1)}:${Math.max(0, Number(match[3]) - 1)}`,
    })
    return `jetbrains://idea/navigate/reference?${query}`
  }

  // 保留目录分隔符和盘符，编码空格、中文、%、#、?，避免被当成 URL 参数。
  const encodedPath = encodeURI(path).replace(/[?#]/g, encodeURIComponent)
  // 修复 https://github.com/microsoft/vscode/issues/197319
  if (encodedPath[0] === '/') {
    return `${editor}://file${encodedPath}`
  }

  return `${editor}://file/${encodedPath}`
}
