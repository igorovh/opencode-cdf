import { readdir, readFile } from "node:fs/promises"
import { isBuiltin } from "node:module"
import path from "node:path"

// Modules the OpenCode host swaps for its own copies; anything else would load a second runtime.
const ALLOWED = new Set([
  "@opencode/plugin",
  "@opencode/plugin/tui",
  "effect",
  "@opentui/core",
  "@opentui/solid",
  "@opentui/solid/components",
  "@opentui/solid/jsx-runtime",
  "solid-js",
  "solid-js/store",
])

const IMPORT = /(?:^|[;\s])(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^import\s*["']([^"']+)["']/gm

const files = (await readdir("dist")).filter((file) => file.endsWith(".js"))
if (files.length === 0) throw new Error("dist/ is empty. Run `bun run compile` first.")

const problems: string[] = []
for (const file of files) {
  const source = await readFile(path.join("dist", file), "utf8")
  if (/\bjsxDEV\b|react\/jsx|jsx-dev-runtime/.test(source)) problems.push(`${file}: JSX was not compiled by Solid`)
  for (const match of source.matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2] ?? match[3]
    if (!specifier || specifier.startsWith(".") || isBuiltin(specifier)) continue
    if (!ALLOWED.has(specifier)) problems.push(`${file}: imports ${specifier}, which the host does not provide`)
  }
}

if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
console.log(`dist/ OK (${files.length} file${files.length === 1 ? "" : "s"})`)
