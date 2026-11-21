// How `bun run record` and `bun run tui` set up the real OpenCode TUI with this plugin (opencode-tui-recorder).
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { defineRecorder } from "opencode-tui-recorder"

// Saved projects besides the session's own; each becomes a folder in repos/, shown as ~/repos/<name>.
const PROJECTS = [
  { name: "acme-web", favorite: true },
  { name: "billing", favorite: false },
  { name: "docs-site", favorite: false },
  { name: "dotfiles", favorite: false },
]

export default defineRecorder({
  config: ({ plugin, options }) => ({ "cli.json": { plugins: [{ package: plugin, options }] } }),
  sessions: [{ project: "acme-api", title: "Fix the login redirect" }],
  // /cdf moves an open session, and opens a new one only from the home screen.
  attach: true,
  ready: {
    label: "the session title",
    test: (lines, { sessions }) => lines.some((line) => sessions.some((s) => line.includes(s.title))),
  },
  // The plugin's storage file; "latest" is the release channel's state directory.
  async seed({ work, sessions }) {
    const projects = [
      ...sessions.map((s) => ({ name: s.project, path: s.directory, favorite: true })),
      ...PROJECTS.map((p) => ({ ...p, path: path.join(work, "repos", p.name) })),
    ]
    for (const project of projects) mkdirSync(project.path, { recursive: true })
    for (const channel of ["latest", "beta", "dev"]) {
      const dir = path.join(work, "state", "opencode", channel, "tui")
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, "plugin.cdf.projects.json"), JSON.stringify({ version: 1, projects }))
    }
  },
})
