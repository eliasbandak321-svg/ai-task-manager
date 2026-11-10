import { describe, expect, it } from 'vitest'

/*
  Enforces the architecture rule "domain code is pure": no React, no browser or Node I/O,
  no imports from the UI layers. Only Zod and other domain files may be imported.
  A rule that's checked by a test can't silently erode.
*/

// Vite loads every domain source file as plain text (test files excluded).
const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true })

const ALLOWED_IMPORT = /^(zod|\.\/[\w-]+)$/
const FORBIDDEN_GLOBALS = /\b(fetch|localStorage|sessionStorage|document|window|Math\.random|crypto\.randomUUID|Date\.now)\b/

describe('domain layer purity', () => {
  const files = Object.entries(sources) as [string, string][]

  it('finds the domain source files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s imports only zod and other domain modules', (_, source) => {
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
    expect(imports.filter((path) => !ALLOWED_IMPORT.test(path))).toEqual([])
  })

  it.each(files)('%s does not touch I/O, randomness or the clock', (_, source) => {
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') // ignore comments
    expect(code.match(FORBIDDEN_GLOBALS)).toBeNull()
  })
})
