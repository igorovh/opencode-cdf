# Agent notes

## Checks

- Run `bun run typecheck`, `bun test`, `bun run compile` and `bun run check:dist` before you push. CI fails when
  `dist/` does not match `src/`, so commit the rebuilt `dist/` with every source change.

## Demo recordings

- `bun run record -- --out demo.gif --step "type /cdf" --step "key Enter" --step "expect Projects"` records the
  real OpenCode TUI with this checkout's plugin to a GIF, through
  [opencode-tui-recorder](https://github.com/igorovh/opencode-tui-recorder) and `recorder.config.ts`. It needs
  `opencode` V2, `ttyd` and `ffmpeg` on `PATH` (or `OPENCODE_BIN` and `TTYD_BIN`) and Playwright's Chromium. Run
  it without steps to see the step list.
- `bun run tui serve` keeps a recording open, and `bun run tui begin`, `bun run tui <step>`, `bun run tui screen`,
  `bun run tui rec-start` and `bun run tui rec-stop --out demo.gif` drive it one step at a time; every step
  prints the screen. tidy's review uses this to try steps before it records. In Git Bash, set
  `MSYS_NO_PATHCONV=1`, or `bun run tui type /cdf` types a Windows path.
- The TUI opens the session "Fix the login redirect" in `~/repos/acme-api`. `/cdf` lists five saved projects:
  `acme-api` (current) and `acme-web` as favorites, then `billing`, `docs-site` and `dotfiles`, all folders in
  `~/repos`. Opening one moves the session and shows the toast `Moved session to “<name>”.`
- `--sessions sessions.json` replaces the session with a JSON array of `{ "project", "title" }`; the first one is
  opened, and every project is also saved as a favorite. `--plugin <path>` records another checkout, such as a
  worktree of the base branch.
- `expect <text>` and `expect-not <text>` steps fail the recording when the screen does not match, so a GIF
  doubles as a test. Put them after every action, for example `type /cdf`, `key Enter`, `expect Projects`,
  `key down`, `key ctrl+f`, `expect-not ★ acme-web`. `expect-above <a> -> <b>` checks an order, such as
  `expect-above acme-web -> billing`. A failed step stops the steps but still writes the GIF, then exits with 1.
  A broken recording, such as an unknown step or a timeout, exits with 2.
- A check in a before-and-after recording should pass on the PR branch and fail on the base branch. A check
  that passes on both, such as `expect Projects`, proves nothing about the change.
- `docs/demo.gif` in the README is recorded separately with VHS (`docs/demo.tape`); see the README.
