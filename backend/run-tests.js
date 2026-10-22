import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory =
  dirname(fileURLToPath(import.meta.url))

const testsDirectory =
  join(backendDirectory, 'tests')

const mode = process.argv[2] ?? 'all'

if (!['all', 'db', 'unit'].includes(mode)) {
  throw new Error(
    'Unsupported test mode. Use all, db or unit.'
  )
}

function collectTests(directory) {
  const files = []

  for (const entry of readdirSync(
    directory,
    { withFileTypes: true }
  )) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectTests(path))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const isDbTest =
      entry.name.endsWith('.db.js')

    const isUnitTest =
      entry.name.endsWith('.test.js')

    const shouldInclude =
      mode === 'all'
        ? isDbTest || isUnitTest
        : mode === 'db'
          ? isDbTest
          : isUnitTest

    if (shouldInclude) {
      files.push(path)
    }
  }

  return files
}

const files =
  collectTests(testsDirectory).sort()

if (files.length === 0) {
  throw new Error(
    `No test files found for mode: ${mode}`
  )
}

console.log(
  `Running ${files.length} test files (${mode}).`
)

const nodeArguments = [
  ...(mode === 'unit'
    ? []
    : ['--env-file=.env.test']),
  '--test',
  '--test-reporter=spec',
  '--test-concurrency=1',
  ...files,
]

const result = spawnSync(
  process.execPath,
  nodeArguments,
  {
    cwd: backendDirectory,
    stdio: 'inherit',
    shell: false,
  }
)

if (result.error) {
  throw result.error
}

if (result.signal) {
  console.error(
    `Test process terminated by signal: ${result.signal}`
  )
}

process.exitCode = result.status ?? 1