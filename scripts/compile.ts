import { rm } from "node:fs/promises"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

// The host only compiles Solid JSX outside node_modules, so github: installs need prebuilt JS.
// https://github.com/anomalyco/opencode/issues/39986
const HOST_MODULES = ["@opencode/plugin", "@opencode/plugin/*", "@opentui/*", "solid-js", "solid-js/*", "effect"]

await rm("dist", { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["src/tui.tsx"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  external: HOST_MODULES,
  plugins: [createSolidTransformPlugin({ moduleName: "@opentui/solid" })],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
for (const output of result.outputs) console.log(output.path)
