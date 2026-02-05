import { Project, type SourceFile } from 'ts-morph'

const project = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: {
    allowJs: true,
    jsx: 2,
  },
})

const cache = new Map<string, { text: string; file: SourceFile }>()

export function sourceFile(filePath: string, text: string) {
  const cached = cache.get(filePath)
  if (cached?.text === text) return cached.file

  const file = project.createSourceFile(filePath, text, { overwrite: true })
  cache.set(filePath, { text, file })
  return file
}
