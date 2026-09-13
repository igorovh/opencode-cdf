/** @jsxImportSource @opentui/solid */

import path from "node:path"
import { Plugin } from "@opencode-ai/plugin/tui"
import type { SelectOption } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { Show, createMemo, createSignal } from "solid-js"
import {
  INITIAL_STATE,
  findConflict,
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
  finish: (choice: MenuChoice) => void
}) {
  const [query, setQuery] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const filtered = createMemo(() => {
    const needle = query().trim().toLocaleLowerCase("en-US")
    if (!needle) return [...props.projects]
    return props.projects.filter((project) =>
      `${project.name}\n${project.path}`.toLocaleLowerCase("en-US").includes(needle),
    )
  })

  const options = createMemo<SelectOption[]>(() =>
    filtered().map((project) => ({
      name: `${project.favorite ? "★ " : ""}${project.name}`,
      description: props.context.ui.format.path(project.path),
      value: project,
    })),
  )

  const selectedProject = (): ProjectEntry | undefined => filtered()[selectedIndex()]

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
    if (key.name === "backspace") {
      consume()
      setQuery((value) => Array.from(value).slice(0, -1).join(""))
      setSelectedIndex(0)
      return
    }
    if (!key.ctrl && !key.meta && !key.option && /^[^\x00-\x1F\x7F]+$/u.test(key.sequence)) {
      consume()
      setQuery((value) => value + key.sequence)
      setSelectedIndex(0)
    }
  })

  const theme = props.context.theme.contextual.overlay

  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text fg={theme.text.default}>Change directory favorite</text>
      <box flexDirection="row">
        <text fg={theme.text.subdued}>Filter: </text>
        <input
          flexGrow={1}
          placeholder="Type a project name or path"
          value={query()}
          backgroundColor={theme.background.formfield.default}
          focusedBackgroundColor={theme.background.formfield.focused}
          textColor={theme.text.formfield.default}
          focusedTextColor={theme.text.formfield.focused}
          placeholderColor={theme.text.subdued}
        />
      </box>
      <Show
        when={filtered().length > 0}
        fallback={<text fg={theme.text.subdued}>No matching projects. Press Ctrl+A to add one.</text>}
      >
        <select
          height={Math.min(24, Math.max(5, filtered().length * 2))}
          focused
          options={options()}
          selectedIndex={selectedIndex()}
          onChange={(index) => setSelectedIndex(index)}
          onSelect={(index) => {
            setSelectedIndex(index)
            runForSelection("project")
          }}
          wrapSelection
          showDescription
          showScrollIndicator
          backgroundColor={theme.background.surface.overlay}
          textColor={theme.text.default}
          focusedBackgroundColor={theme.background.surface.overlay}
          focusedTextColor={theme.text.default}
          selectedBackgroundColor={theme.background.formfield.selected}
          selectedTextColor={theme.text.formfield.selected}
          descriptionColor={theme.text.subdued}
          selectedDescriptionColor={theme.text.formfield.selected}
        />
      </Show>
      <box flexDirection="row" gap={2}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.default}>add</text>
          <text fg={theme.text.subdued}>ctrl+a</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.default}>favorite</text>
          <text fg={theme.text.subdued}>ctrl+f</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.default}>delete</text>
          <text fg={theme.text.subdued}>ctrl+d</text>
        </box>
      </box>
      <box flexDirection="row" gap={2}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.default}>open</text>
          <text fg={theme.text.subdued}>enter</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.default}>close</text>
          <text fg={theme.text.subdued}>esc</text>
        </box>
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

    const addProject = async (): Promise<void> => {
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

    const removeProject = async (selected: ProjectEntry): Promise<void> => {
      const confirmed = await context.ui.dialog.confirm({
        title: `Remove “${selected.name}”?`,
        message: context.ui.format.path(selected.path),
        label: { confirm: "Remove", cancel: "Cancel" },
      })
      if (!confirmed) return

      await updateState((draft) => {
        draft.version = 1
        draft.projects = sanitizeProjects(draft.projects).filter(
          (project) => !samePath(project.path, selected.path),
        )
      })
      context.ui.toast.show({ title: "CDF", message: `Removed “${selected.name}”.`, variant: "success" })
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

    const showMenu = (): Promise<MenuChoice> =>
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
          () => <CdfDialog context={context} projects={projects()} finish={finish} />,
          () => finish({ kind: "cancel" }),
        )
      })

    const openMenu = async (): Promise<void> => {
      while (true) {
        const selected = await showMenu()

        if (selected.kind === "project") {
          await openProject(selected.project)
          return
        }
        if (selected.kind === "cancel") return
        if (selected.kind === "add") await addProject()
        if (selected.kind === "toggle") await toggleFavorite(selected.project)
        if (selected.kind === "remove") await removeProject(selected.project)
      }
    }

    return context.ui.slot({
      append: "app",
      render: () => <CdfCommand context={context} open={openMenu} />,
    })
  },
})
