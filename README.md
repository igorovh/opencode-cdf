# opencode2-cdf

An OpenCode 2 beta TUI plugin for saving project directories and switching between them with `/cdf`.

## Features

- Persistent project records with `name`, `path`, and `favorite` fields.
- Favorites displayed first with a `★`, followed by regular projects.
- Filterable native OpenCode dialogs.
- Add, remove, and toggle-favorite actions.
- Native session movement through the OpenCode V2 `session.move` API.
- Creates and opens a session when a project is selected from the Home screen.

## Requirements

- OpenCode 2 beta `0.0.0-beta-19157`.
- Bun for local development and tests.

This package intentionally pins the beta plugin API. Update the OpenCode dependencies together when upgrading the
OpenCode executable.

## Install locally

Install dependencies:

```sh
bun install
```

Add the project directory to the global `plugins` array in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["E:/Projekty/WebstormProjects/opencode2-cdf"]
}
```

Restart the TUI and verify that the plugin is active:

```sh
opencode2 plugin list
```

## Usage

Run `/cdf` or choose **Change directory favorite** from the command palette.

The menu contains saved projects and supports these shortcuts:

- **Enter** — open the selected project.
- **Ctrl+A** — add a project by entering its path, display name, and favorite status.
- **Ctrl+F** — toggle the favorite star on the selected project.
- **Ctrl+D** — remove the selected project after confirmation.
- **Esc** — close the menu.

Use the arrow keys to change the selection. Typing in the filter narrows projects by name or path. The shortcuts are
active only while the CDF dialog is open.

Selecting a project while viewing a session moves that session to the selected directory. Selecting a project from
Home creates a new session in that directory. The plugin never calls `process.chdir` and never sends a synthetic prompt.

Relative paths entered during the add flow are resolved from the active session directory. `~` is expanded to the
current user's home directory. A path must exist and must be a directory before it can be saved or opened.

## Development

```sh
bun test
bun run typecheck
```
