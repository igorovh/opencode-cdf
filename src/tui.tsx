/** @jsxImportSource @opentui/solid */

import path from "node:path"
import { Plugin } from "@opencode/plugin/tui"
import type { RGBA } from "@opentui/core"
import { useKeyboard, usePaste } from "@opentui/solid"
import { For, Show, createMemo, createSignal } from "solid-js"
import {
  INITIAL_STATE,
  filterProjects,
  findConflict,
  truncateTail,
  samePath,
  sanitizeProjects,
  sortProjects,
  type FavoritesState,
  type ProjectEntry,
} from "./favorites.ts"
import { validateProjectPath } from "./paths.ts"

type TuiContext = Plugin.Context

type MenuChoice =
  | { kind: "project"; project: ProjectEntry }
  | { kind: "add" }
  | { kind: "toggle"; project: ProjectEntry }
  | { kind: "remove"; project: ProjectEntry }
  | { kind: "cancel" }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const MAX_PATH_WIDTH = 100
const VISIBLE_CARDS = 6

function activeDirectory(context: TuiContext): string {
  const route = context.ui.router.current()
  if (route.type === "session") {
    const session = context.data.session.get(route.sessionID)
    if (session) return session.location.directory
  }
  return context.location?.directory ?? context.data.location.default().directory
}

function CdfCommand(props: { context: TuiContext; open: () => Promise<void> }) {
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "cdf.open",
        title: "Change directory favorite",
        description: "Open saved projects and manage favorites",
        group: "CDF",
        palette: true,
        slash: { name: "cdf" },
        suggested: true,
        run: props.open,
      },
    ],
  }))
  return null
}

function CdfDialog(props: {
  context: TuiContext
  projects: readonly ProjectEntry[]
  currentDirectory: string
  initialPath?: string
  finish: (choice: MenuChoice) => void
}) {
  const initialIndex = Math.max(
    0,
    props.initialPath ? props.projects.findIndex((project) => samePath(project.path, props.initialPath ?? "")) : 0,
  )
  const [query, setQuery] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(initialIndex)
  const [hoverIndex, setHoverIndex] = createSignal<number>()
  const [scrollOffset, setScrollOffset] = createSignal(
    Math.min(Math.max(0, initialIndex - VISIBLE_CARDS + 1), Math.max(0, props.projects.length - VISIBLE_CARDS)),
  )

  const filtered = createMemo(() => filterProjects(props.projects, query(), props.context.ui.format.path))

  const resetNavigation = () => {
    setSelectedIndex(0)
    setScrollOffset(0)
    setHoverIndex(undefined)
  }

  const selectedProject = (): ProjectEntry | undefined => filtered()[selectedIndex()]

  const moveSelection = (delta: number) => {
    const count = filtered().length
    if (count === 0) return
    const next = (((selectedIndex() + delta) % count) + count) % count
    setSelectedIndex(next)
    setScrollOffset((offset) => {
      let nextOffset = offset
      if (next < nextOffset) nextOffset = next
      if (next >= nextOffset + VISIBLE_CARDS) nextOffset = next - VISIBLE_CARDS + 1
      return Math.min(Math.max(nextOffset, 0), Math.max(0, count - VISIBLE_CARDS))
    })
  }

  const scrollRows = (delta: number) => {
    const count = filtered().length
    setHoverIndex(undefined)
    setScrollOffset((offset) => Math.min(Math.max(offset + delta, 0), Math.max(0, count - VISIBLE_CARDS)))
  }

  const runForSelection = (kind: "project" | "toggle" | "remove") => {
    const project = selectedProject()
    if (!project) {
      props.context.ui.toast.show({ title: "CDF", message: "No project selected.", variant: "warning" })
      return
    }
    props.finish({ kind, project })
  }

  useKeyboard((key) => {
    const consume = () => {
      key.preventDefault()
      key.stopPropagation()
    }

    if (key.ctrl && key.name === "a") {
      consume()
      props.finish({ kind: "add" })
      return
    }
    if (key.ctrl && key.name === "f") {
      consume()
      runForSelection("toggle")
      return
    }
    if (key.ctrl && key.name === "d") {
      consume()
      runForSelection("remove")
      return
    }
    if (key.name === "escape") {
      consume()
      props.finish({ kind: "cancel" })
      return
    }
    if (key.name === "up") {
      consume()
      moveSelection(-1)
      return
    }
    if (key.name === "down") {
      consume()
      moveSelection(1)
      return
    }
    if (key.name === "return" || key.name === "enter") {
      consume()
      runForSelection("project")
      return
    }
    if (key.name === "backspace") {
      consume()
      setQuery((value) => Array.from(value).slice(0, -1).join(""))
      resetNavigation()
      return
    }
    if (!key.ctrl && !key.meta && !key.option && /^[^\x00-\x1F\x7F]+$/u.test(key.sequence)) {
      consume()
      setQuery((value) => value + key.sequence)
      resetNavigation()
    }
  })

  usePaste((event) => {
    const text = new TextDecoder().decode(event.bytes).replace(/[\x00-\x1F\x7F]+/g, " ").trim()
    if (!text) return
    event.preventDefault()
    setQuery((value) => value + text)
    resetNavigation()
  })

  const theme = createMemo(() => props.context.theme.surface("dialog"))
  const accent = () => theme().text.action.primary.base

  const visibleCards = createMemo(() => {
    const offset = scrollOffset()
    return filtered()
      .slice(offset, offset + VISIBLE_CARDS)
      .map((project, position) => ({ project, index: offset + position }))
  })

  const cardBackground = (index: number): RGBA | undefined => {
    if (index === selectedIndex()) return theme().background.raised.high
    if (index === hoverIndex()) return theme().background.raised.base
    return undefined
  }

  const emptyMessage = (): string =>
    props.projects.length === 0
      ? "No saved projects. Press ctrl+a to add one."
      : `No matches for “${query().trim()}”.`

  const hints: ReadonlyArray<readonly [string, string]> = [
    ["enter", "open"],
    ["ctrl+a", "add"],
    ["ctrl+f", "favorite"],
    ["ctrl+d", "delete"],
  ]

  return (
    <box flexDirection="column" gap={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().text.base}>Projects</text>
        <text fg={theme().text.muted}>esc</text>
      </box>
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row">
          <text fg={accent()}>❯ </text>
          <Show when={query()} fallback={<text fg={theme().text.muted}>▏type to filter…</text>}>
            <text fg={theme().text.base}>{query()}</text>
            <text fg={accent()}>▏</text>
          </Show>
        </box>
        <text fg={theme().text.muted}>
          {filtered().length === props.projects.length
            ? `${props.projects.length}`
            : `${filtered().length}/${props.projects.length}`}
        </text>
      </box>
      <Show when={filtered().length > 0} fallback={<text fg={theme().text.muted}>{emptyMessage()}</text>}>
        <box
          flexDirection="column"
          onMouseScroll={(event) => {
            if (event.scroll?.direction === "up") scrollRows(-1)
            if (event.scroll?.direction === "down") scrollRows(1)
          }}
        >
          <For each={visibleCards()}>
            {(item) => {
              const selected = () => item.index === selectedIndex()
              const current = () => samePath(item.project.path, props.currentDirectory)
              return (
                <box
                  flexDirection="row"
                  backgroundColor={cardBackground(item.index)}
                  onMouseOver={() => setHoverIndex(item.index)}
                  onMouseOut={() => setHoverIndex((hovered) => (hovered === item.index ? undefined : hovered))}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    props.finish({ kind: "project", project: item.project })
                  }}
                >
                  <box flexDirection="column" width={2}>
                    <text fg={accent()}>{selected() ? "▌" : " "}</text>
                    <text fg={accent()}>{selected() ? "▌" : " "}</text>
                  </box>
                  <box flexDirection="column" flexGrow={1}>
                    <box flexDirection="row" justifyContent="space-between">
                      <box flexDirection="row">
                        <text fg={theme().text.feedback.warning.base}>{item.project.favorite ? "★ " : "  "}</text>
                        <text fg={selected() ? accent() : theme().text.base}>{item.project.name}</text>
                      </box>
                      <Show when={current()}>
                        <text fg={theme().text.muted}>current </text>
                      </Show>
                    </box>
                    <text fg={theme().text.muted}>
                      {"  " + truncateTail(props.context.ui.format.path(item.project.path), MAX_PATH_WIDTH)}
                    </text>
                  </box>
                </box>
              )
            }}
          </For>
        </box>
      </Show>
      <box flexDirection="row" gap={2}>
        <For each={hints}>
          {([key, label]) => (
            <box flexDirection="row" gap={1}>
              <text fg={accent()}>{key}</text>
              <text fg={theme().text.muted}>{label}</text>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}

export default Plugin.define({
  id: "cdf",
  setup(context) {
    const [state, updateState] = context.storage.store<FavoritesState>("projects", {
      initial: INITIAL_STATE,
    })

    const projects = (): ProjectEntry[] => {
      const stored = state as unknown as { projects?: unknown }
      return sortProjects(sanitizeProjects(stored.projects))
    }

    const toastError = (message: string) => {
      context.ui.toast.show({ title: "CDF", message, variant: "error" })
    }

    const addProject = async (): Promise<string | undefined> => {
      const currentDirectory = activeDirectory(context)
      const enteredPath = await context.ui.dialog.prompt({
        title: "Add project",
        description: `Relative paths are resolved from ${context.ui.format.path(currentDirectory)}`,
        placeholder: "Path to project",
        value: currentDirectory,
      })
      if (enteredPath === undefined) return

      let projectPath: string
      try {
        projectPath = await validateProjectPath(enteredPath, currentDirectory)
      } catch (error) {
        toastError(errorMessage(error))
        return
      }

      const duplicatePath = projects().find((project) => samePath(project.path, projectPath))
      if (duplicatePath) {
        toastError(`This path is already saved as “${duplicatePath.name}”.`)
        return
      }

      const enteredName = await context.ui.dialog.prompt({
        title: "Project name",
        description: context.ui.format.path(projectPath),
        value: path.basename(projectPath),
        placeholder: "Display name",
      })
      if (enteredName === undefined) return

      const name = enteredName.trim()
      if (!name) {
        toastError("Project name cannot be empty.")
        return
      }

      const conflict = findConflict(projects(), { name, path: projectPath })
      if (conflict === "name") {
        toastError(`A project named “${name}” already exists.`)
        return
      }
      if (conflict === "path") {
        toastError("This project path is already saved.")
        return
      }

      const favorite = await context.ui.dialog.select<boolean>({
        title: "Favorite status",
        current: true,
        options: [
          { title: "★ Favorite", description: "Show this project at the top", value: true },
          { title: "Regular", description: "Show this project below favorites", value: false },
        ],
      })
      if (favorite === undefined) return

      await updateState((draft) => {
        draft.version = 1
        draft.projects = [...sanitizeProjects(draft.projects), { name, path: projectPath, favorite }]
      })
      context.ui.toast.show({ title: "CDF", message: `Saved “${name}”.`, variant: "success" })
      return projectPath
    }

    const toggleFavorite = async (selected: ProjectEntry): Promise<void> => {
      await updateState((draft) => {
        const stored = sanitizeProjects(draft.projects)
        const project = stored.find((candidate) => samePath(candidate.path, selected.path))
        if (project) project.favorite = !project.favorite
        draft.version = 1
        draft.projects = stored
      })
      context.ui.toast.show({
        title: "CDF",
        message: selected.favorite ? `Removed “${selected.name}” from favorites.` : `Added “${selected.name}” to favorites.`,
        variant: "success",
      })
    }

    const removeProject = async (selected: ProjectEntry): Promise<boolean> => {
      const confirmed = await context.ui.dialog.confirm({
        title: `Remove “${selected.name}”?`,
        message: context.ui.format.path(selected.path),
        label: { confirm: "Remove", cancel: "Cancel" },
      })
      if (!confirmed) return false

      await updateState((draft) => {
        draft.version = 1
        draft.projects = sanitizeProjects(draft.projects).filter(
          (project) => !samePath(project.path, selected.path),
        )
      })
      context.ui.toast.show({ title: "CDF", message: `Removed “${selected.name}”.`, variant: "success" })
      return true
    }

    const openProject = async (project: ProjectEntry): Promise<void> => {
      let projectPath: string
      try {
        projectPath = await validateProjectPath(project.path, activeDirectory(context))
      } catch (error) {
        toastError(errorMessage(error))
        return
      }

      const route = context.ui.router.current()
      try {
        if (route.type === "session") {
          const current = context.data.session.get(route.sessionID)
          if (current && samePath(current.location.directory, projectPath)) {
            context.ui.toast.show({ title: "CDF", message: `Already in “${project.name}”.`, variant: "info" })
            return
          }

          await context.client.session.move({ sessionID: route.sessionID, directory: projectPath })
          context.data.session.invalidate(route.sessionID)
          await context.data.session.sync(route.sessionID)
          context.ui.toast.show({ title: "CDF", message: `Moved session to “${project.name}”.`, variant: "success" })
          return
        }

        const session = await context.client.session.create({
          title: project.name,
          location: { directory: projectPath },
        })
        context.data.session.invalidate(session.id)
        context.ui.router.navigate({ type: "session", sessionID: session.id })
        context.ui.toast.show({ title: "CDF", message: `Opened “${project.name}”.`, variant: "success" })
      } catch (error) {
        toastError(`Could not open “${project.name}”: ${errorMessage(error)}`)
      }
    }

    const showMenu = (initialPath?: string): Promise<MenuChoice> =>
      new Promise((resolve) => {
        let settled = false
        const finish = (choice: MenuChoice) => {
          if (settled) return
          settled = true
          context.ui.dialog.clear()
          resolve(choice)
        }

        context.ui.dialog.set({ size: "xlarge", centered: true })
        context.ui.dialog.show(
          () => (
            <CdfDialog
              context={context}
              projects={projects()}
              currentDirectory={activeDirectory(context)}
              initialPath={initialPath}
              finish={finish}
            />
          ),
          () => finish({ kind: "cancel" }),
        )
      })

    const openMenu = async (): Promise<void> => {
      let focusPath: string | undefined
      while (true) {
        const selected = await showMenu(focusPath)

        if (selected.kind === "project") {
          await openProject(selected.project)
          return
        }
        if (selected.kind === "cancel") return
        if (selected.kind === "add") focusPath = (await addProject()) ?? focusPath
        if (selected.kind === "toggle") {
          await toggleFavorite(selected.project)
          focusPath = selected.project.path
        }
        if (selected.kind === "remove") {
          const list = projects()
          const index = list.findIndex((project) => samePath(project.path, selected.project.path))
          const neighbor = list[index + 1] ?? list[index - 1]
          focusPath = (await removeProject(selected.project)) ? neighbor?.path : selected.project.path
        }
      }
    }

    return context.ui.slot({
      append: "app",
      render: () => <CdfCommand context={context} open={openMenu} />,
    })
  },
})
