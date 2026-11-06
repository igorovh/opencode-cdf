// @bun
// src/tui.tsx
import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import path3 from "path";
import { Plugin } from "@opencode/plugin/tui";
import { useKeyboard, usePaste, useTerminalDimensions } from "@opentui/solid";
import { For, Show, createMemo, createSignal } from "solid-js";

// src/favorites.ts
import path from "path";
var INITIAL_STATE = {
  version: 1,
  projects: []
};
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function pathIdentity(value, platform = process.platform) {
  const normalized = path.normalize(value);
  const root = path.parse(normalized).root;
  const withoutTrailingSeparators = normalized === root ? normalized : normalized.replace(/[\\/]+$/, "");
  return platform === "win32" || platform === "darwin" ? withoutTrailingSeparators.toLocaleLowerCase("en-US") : withoutTrailingSeparators;
}
function samePath(left, right, platform = process.platform) {
  return pathIdentity(left, platform) === pathIdentity(right, platform);
}
function sanitizeProjects(value) {
  if (!Array.isArray(value))
    return [];
  const projects = [];
  const seenPaths = new Set;
  for (const candidate of value) {
    if (!isRecord(candidate))
      continue;
    if (typeof candidate.name !== "string" || typeof candidate.path !== "string")
      continue;
    const name = candidate.name.trim();
    const projectPath = candidate.path.trim();
    if (!name || !projectPath)
      continue;
    const identity = pathIdentity(projectPath);
    if (seenPaths.has(identity))
      continue;
    seenPaths.add(identity);
    projects.push({
      name,
      path: path.normalize(projectPath),
      favorite: candidate.favorite === true
    });
  }
  return projects;
}
function sortProjects(projects) {
  return [...projects].sort((left, right) => {
    if (left.favorite !== right.favorite)
      return left.favorite ? -1 : 1;
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    return byName || left.path.localeCompare(right.path, undefined, { sensitivity: "base" });
  });
}
function filterProjects(projects, query, displayPath = (value) => value) {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle)
    return [...projects];
  return projects.filter((project) => [project.name, project.path, displayPath(project.path)].some((field) => field.toLocaleLowerCase("en-US").includes(needle)));
}
function truncateTail(text, max) {
  const chars = Array.from(text);
  return chars.length <= max ? text : `\u2026${chars.slice(-(max - 1)).join("")}`;
}
function findConflict(projects, candidate) {
  if (projects.some((project) => samePath(project.path, candidate.path)))
    return "path";
  const name = candidate.name.trim().toLocaleLowerCase("en-US");
  if (projects.some((project) => project.name.trim().toLocaleLowerCase("en-US") === name))
    return "name";
  return;
}

// src/paths.ts
import { stat, realpath } from "fs/promises";
import { homedir } from "os";
import path2 from "path";

class ProjectPathError extends Error {
}
function expandHome(value, home = homedir(), platform = process.platform) {
  if (value === "~")
    return home;
  if (value.startsWith("~/") || platform === "win32" && value.startsWith("~\\")) {
    return path2.join(home, value.slice(2));
  }
  return value;
}
function resolveCandidatePath(value, baseDirectory) {
  const trimmed = value.trim();
  if (!trimmed)
    throw new ProjectPathError("Project path cannot be empty.");
  return path2.normalize(path2.resolve(baseDirectory, expandHome(trimmed)));
}
async function canonicalPath(value) {
  try {
    return path2.normalize(await realpath(value));
  } catch {
    return path2.normalize(value);
  }
}
async function validateProjectPath(value, baseDirectory) {
  const resolved = resolveCandidatePath(value, baseDirectory);
  let isDirectory;
  try {
    isDirectory = (await stat(resolved)).isDirectory();
  } catch {
    throw new ProjectPathError(`Directory does not exist or cannot be accessed: ${resolved}`);
  }
  if (!isDirectory)
    throw new ProjectPathError("The selected path is not a directory.");
  return canonicalPath(resolved);
}

// src/tui.tsx
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
var VISIBLE_CARDS = 6;
var DIALOG_WIDTH = 116;
var PATH_CHROME_WIDTH = 10;
var ACTIONS = [{
  id: "cdf.add",
  kind: "add",
  title: "Add project",
  hint: "add",
  bind: "ctrl+a"
}, {
  id: "cdf.favorite",
  kind: "toggle",
  title: "Toggle favorite",
  hint: "favorite",
  bind: "ctrl+f"
}, {
  id: "cdf.remove",
  kind: "remove",
  title: "Remove project",
  hint: "delete",
  bind: "ctrl+d"
}];
function activeDirectory(context) {
  const route = context.ui.router.current();
  if (route.type === "session") {
    const session = context.data.session.get(route.sessionID);
    if (session)
      return session.location.directory;
  }
  return context.location?.directory ?? context.data.location.default().directory;
}
function CdfCommand(props) {
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [{
      id: "cdf.open",
      title: "Change directory favorite",
      description: "Open saved projects and manage favorites",
      group: "CDF",
      palette: true,
      slash: {
        name: "cdf"
      },
      suggested: true,
      run: props.open
    }]
  }));
  return null;
}
function CdfDialog(props) {
  const initialIndex = Math.max(0, props.initialPath ? props.projects.findIndex((project) => samePath(project.path, props.initialPath ?? "")) : 0);
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(initialIndex);
  const [hoverIndex, setHoverIndex] = createSignal();
  const [scrollOffset, setScrollOffset] = createSignal(Math.min(Math.max(0, initialIndex - VISIBLE_CARDS + 1), Math.max(0, props.projects.length - VISIBLE_CARDS)));
  const filtered = createMemo(() => filterProjects(props.projects, query(), props.context.ui.format.path));
  const resetNavigation = () => {
    setSelectedIndex(0);
    setScrollOffset(0);
    setHoverIndex(undefined);
  };
  const selectedProject = () => filtered()[selectedIndex()];
  const moveSelection = (delta) => {
    const count = filtered().length;
    if (count === 0)
      return;
    const next = ((selectedIndex() + delta) % count + count) % count;
    setSelectedIndex(next);
    setScrollOffset((offset) => {
      let nextOffset = offset;
      if (next < nextOffset)
        nextOffset = next;
      if (next >= nextOffset + VISIBLE_CARDS)
        nextOffset = next - VISIBLE_CARDS + 1;
      return Math.min(Math.max(nextOffset, 0), Math.max(0, count - VISIBLE_CARDS));
    });
  };
  const scrollRows = (delta) => {
    const count = filtered().length;
    setHoverIndex(undefined);
    setScrollOffset((offset) => Math.min(Math.max(offset + delta, 0), Math.max(0, count - VISIBLE_CARDS)));
  };
  const runForSelection = (kind) => {
    const project = selectedProject();
    if (!project) {
      props.context.ui.toast.show({
        title: "CDF",
        message: "No project selected.",
        variant: "warning"
      });
      return;
    }
    props.finish({
      kind,
      project
    });
  };
  props.context.keymap.layer(() => ({
    mode: "modal",
    priority: 100,
    commands: [{
      title: "Previous project",
      group: "CDF",
      bind: "up,ctrl+p",
      run: () => moveSelection(-1)
    }, {
      title: "Next project",
      group: "CDF",
      bind: "down,ctrl+n",
      run: () => moveSelection(1)
    }, ...ACTIONS.map((action) => ({
      id: action.id,
      title: action.title,
      group: "CDF",
      bind: action.bind,
      run: () => action.kind === "add" ? props.finish({
        kind: "add"
      }) : runForSelection(action.kind)
    }))]
  }));
  useKeyboard((key) => {
    const consume = () => {
      key.preventDefault();
      key.stopPropagation();
    };
    if (key.name === "escape") {
      consume();
      props.finish({
        kind: "cancel"
      });
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      consume();
      runForSelection("project");
      return;
    }
    if (key.name === "backspace") {
      consume();
      setQuery((value) => Array.from(value).slice(0, -1).join(""));
      resetNavigation();
      return;
    }
    if (!key.ctrl && !key.meta && !key.option && /^[^\x00-\x1F\x7F]+$/u.test(key.sequence)) {
      consume();
      setQuery((value) => value + key.sequence);
      resetNavigation();
    }
  });
  usePaste((event) => {
    const text = new TextDecoder().decode(event.bytes).replace(/[\x00-\x1F\x7F]+/g, " ").trim();
    if (!text)
      return;
    event.preventDefault();
    setQuery((value) => value + text);
    resetNavigation();
  });
  const theme = createMemo(() => props.context.theme.surface("dialog"));
  const accent = () => theme().text.action.primary.base;
  const visibleCards = createMemo(() => {
    const offset = scrollOffset();
    return filtered().slice(offset, offset + VISIBLE_CARDS).map((project, position) => ({
      project,
      index: offset + position
    }));
  });
  const cardBackground = (index) => {
    if (index === selectedIndex())
      return theme().background.raised.high;
    if (index === hoverIndex())
      return theme().background.raised.base;
    return;
  };
  const emptyMessage = () => props.projects.length === 0 ? `No saved projects. Press ${shortcut(ACTIONS[0])} to add one.` : `No matches for \u201C${query().trim()}\u201D.`;
  const dimensions = useTerminalDimensions();
  const pathWidth = () => Math.max(10, Math.min(DIALOG_WIDTH, dimensions().width - 2) - PATH_CHROME_WIDTH);
  const shortcut = (action) => props.context.keymap.shortcuts(action.id)[0] ?? action.bind;
  const hints = () => [["enter", "open"], ...ACTIONS.map((action) => [shortcut(action), action.hint])];
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$3 = _$createElement("text"), _el$5 = _$createElement("text"), _el$7 = _$createElement("box"), _el$8 = _$createElement("box"), _el$9 = _$createElement("text"), _el$12 = _$createElement("text"), _el$14 = _$createElement("box");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$7);
    _$insertNode(_el$, _el$14);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 1);
    _$setProp(_el$, "paddingLeft", 2);
    _$setProp(_el$, "paddingRight", 2);
    _$setProp(_el$, "paddingTop", 1);
    _$setProp(_el$, "paddingBottom", 1);
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$5);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "justifyContent", "space-between");
    _$insertNode(_el$3, _$createTextNode(`Projects`));
    _$insertNode(_el$5, _$createTextNode(`esc`));
    _$insertNode(_el$7, _el$8);
    _$insertNode(_el$7, _el$12);
    _$setProp(_el$7, "flexDirection", "row");
    _$setProp(_el$7, "justifyContent", "space-between");
    _$insertNode(_el$8, _el$9);
    _$setProp(_el$8, "flexDirection", "row");
    _$insertNode(_el$9, _$createTextNode(`\u276F `));
    _$insert(_el$8, _$createComponent(Show, {
      get when() {
        return query();
      },
      get fallback() {
        return (() => {
          var _el$15 = _$createElement("text");
          _$insertNode(_el$15, _$createTextNode(`\u258Ftype to filter\u2026`));
          _$effect((_$p) => _$setProp(_el$15, "fg", theme().text.muted, _$p));
          return _el$15;
        })();
      },
      get children() {
        return [(() => {
          var _el$1 = _$createElement("text");
          _$insert(_el$1, query);
          _$effect((_$p) => _$setProp(_el$1, "fg", theme().text.base, _$p));
          return _el$1;
        })(), (() => {
          var _el$10 = _$createElement("text");
          _$insertNode(_el$10, _$createTextNode(`\u258F`));
          _$effect((_$p) => _$setProp(_el$10, "fg", accent(), _$p));
          return _el$10;
        })()];
      }
    }), null);
    _$insert(_el$12, (() => {
      var _c$ = _$memo(() => filtered().length === props.projects.length);
      return () => _c$() ? `${props.projects.length}` : `${filtered().length}/${props.projects.length}`;
    })());
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return filtered().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$17 = _$createElement("text");
          _$insert(_el$17, emptyMessage);
          _$effect((_$p) => _$setProp(_el$17, "fg", theme().text.muted, _$p));
          return _el$17;
        })();
      },
      get children() {
        var _el$13 = _$createElement("box");
        _$setProp(_el$13, "flexDirection", "column");
        _$setProp(_el$13, "onMouseScroll", (event) => {
          if (event.scroll?.direction === "up")
            scrollRows(-1);
          if (event.scroll?.direction === "down")
            scrollRows(1);
        });
        _$insert(_el$13, _$createComponent(For, {
          get each() {
            return visibleCards();
          },
          children: (item) => {
            const selected = () => item.index === selectedIndex();
            const current = () => samePath(item.project.path, props.currentDirectory);
            return (() => {
              var _el$18 = _$createElement("box"), _el$19 = _$createElement("box"), _el$20 = _$createElement("text"), _el$21 = _$createElement("text"), _el$22 = _$createElement("box"), _el$23 = _$createElement("box"), _el$24 = _$createElement("box"), _el$25 = _$createElement("text"), _el$26 = _$createElement("text"), _el$29 = _$createElement("text");
              _$insertNode(_el$18, _el$19);
              _$insertNode(_el$18, _el$22);
              _$setProp(_el$18, "flexDirection", "row");
              _$setProp(_el$18, "onMouseOver", () => setHoverIndex(item.index));
              _$setProp(_el$18, "onMouseOut", () => setHoverIndex((hovered) => hovered === item.index ? undefined : hovered));
              _$setProp(_el$18, "onMouseDown", (event) => {
                event.preventDefault();
                props.finish({
                  kind: "project",
                  project: item.project
                });
              });
              _$insertNode(_el$19, _el$20);
              _$insertNode(_el$19, _el$21);
              _$setProp(_el$19, "flexDirection", "column");
              _$setProp(_el$19, "width", 2);
              _$insert(_el$20, () => selected() ? "\u258C" : " ");
              _$insert(_el$21, () => selected() ? "\u258C" : " ");
              _$insertNode(_el$22, _el$23);
              _$insertNode(_el$22, _el$29);
              _$setProp(_el$22, "flexDirection", "column");
              _$setProp(_el$22, "flexGrow", 1);
              _$insertNode(_el$23, _el$24);
              _$setProp(_el$23, "flexDirection", "row");
              _$setProp(_el$23, "justifyContent", "space-between");
              _$insertNode(_el$24, _el$25);
              _$insertNode(_el$24, _el$26);
              _$setProp(_el$24, "flexDirection", "row");
              _$insert(_el$25, () => item.project.favorite ? "\u2605 " : "  ");
              _$insert(_el$26, () => item.project.name);
              _$insert(_el$23, _$createComponent(Show, {
                get when() {
                  return current();
                },
                get children() {
                  var _el$27 = _$createElement("text");
                  _$insertNode(_el$27, _$createTextNode(`current `));
                  _$effect((_$p) => _$setProp(_el$27, "fg", theme().text.muted, _$p));
                  return _el$27;
                }
              }), null);
              _$insert(_el$29, () => "  " + truncateTail(props.context.ui.format.path(item.project.path), pathWidth()));
              _$effect((_p$) => {
                var _v$5 = cardBackground(item.index), _v$6 = accent(), _v$7 = accent(), _v$8 = theme().text.feedback.warning.base, _v$9 = selected() ? accent() : theme().text.base, _v$0 = theme().text.muted;
                _v$5 !== _p$.e && (_p$.e = _$setProp(_el$18, "backgroundColor", _v$5, _p$.e));
                _v$6 !== _p$.t && (_p$.t = _$setProp(_el$20, "fg", _v$6, _p$.t));
                _v$7 !== _p$.a && (_p$.a = _$setProp(_el$21, "fg", _v$7, _p$.a));
                _v$8 !== _p$.o && (_p$.o = _$setProp(_el$25, "fg", _v$8, _p$.o));
                _v$9 !== _p$.i && (_p$.i = _$setProp(_el$26, "fg", _v$9, _p$.i));
                _v$0 !== _p$.n && (_p$.n = _$setProp(_el$29, "fg", _v$0, _p$.n));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined,
                i: undefined,
                n: undefined
              });
              return _el$18;
            })();
          }
        }));
        return _el$13;
      }
    }), _el$14);
    _$setProp(_el$14, "flexDirection", "row");
    _$setProp(_el$14, "gap", 2);
    _$insert(_el$14, _$createComponent(For, {
      get each() {
        return hints();
      },
      children: ([key, label]) => (() => {
        var _el$30 = _$createElement("box"), _el$31 = _$createElement("text"), _el$32 = _$createElement("text");
        _$insertNode(_el$30, _el$31);
        _$insertNode(_el$30, _el$32);
        _$setProp(_el$30, "flexDirection", "row");
        _$setProp(_el$30, "gap", 1);
        _$insert(_el$31, key);
        _$insert(_el$32, label);
        _$effect((_p$) => {
          var _v$1 = accent(), _v$10 = theme().text.muted;
          _v$1 !== _p$.e && (_p$.e = _$setProp(_el$31, "fg", _v$1, _p$.e));
          _v$10 !== _p$.t && (_p$.t = _$setProp(_el$32, "fg", _v$10, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$30;
      })()
    }));
    _$effect((_p$) => {
      var _v$ = theme().text.base, _v$2 = theme().text.muted, _v$3 = accent(), _v$4 = theme().text.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$5, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$9, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$12, "fg", _v$4, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$;
  })();
}
var tui_default = Plugin.define({
  id: "cdf",
  setup(context) {
    const [state, updateState] = context.storage.store("projects", {
      initial: INITIAL_STATE
    });
    const projects = () => {
      const stored = state;
      return sortProjects(sanitizeProjects(stored.projects));
    };
    const toastError = (message) => {
      context.ui.toast.show({
        title: "CDF",
        message,
        variant: "error"
      });
    };
    const addProject = async () => {
      const currentDirectory = activeDirectory(context);
      const enteredPath = await context.ui.dialog.prompt({
        title: "Add project",
        description: `Relative paths are resolved from ${context.ui.format.path(currentDirectory)}`,
        placeholder: "Path to project",
        value: context.ui.format.path(currentDirectory)
      });
      if (enteredPath === undefined)
        return;
      let projectPath;
      try {
        projectPath = await validateProjectPath(enteredPath, currentDirectory);
      } catch (error) {
        toastError(errorMessage(error));
        return;
      }
      const duplicatePath = projects().find((project) => samePath(project.path, projectPath));
      if (duplicatePath) {
        toastError(`This path is already saved as \u201C${duplicatePath.name}\u201D.`);
        return;
      }
      const enteredName = await context.ui.dialog.prompt({
        title: "Project name",
        description: context.ui.format.path(projectPath),
        value: path3.basename(projectPath),
        placeholder: "Display name"
      });
      if (enteredName === undefined)
        return;
      const name = enteredName.trim();
      if (!name) {
        toastError("Project name cannot be empty.");
        return;
      }
      const conflict = findConflict(projects(), {
        name,
        path: projectPath
      });
      if (conflict === "name") {
        toastError(`A project named \u201C${name}\u201D already exists.`);
        return;
      }
      if (conflict === "path") {
        toastError("This project path is already saved.");
        return;
      }
      const favorite = await context.ui.dialog.select({
        title: "Favorite status",
        current: true,
        options: [{
          title: "\u2605 Favorite",
          description: "Show this project at the top",
          value: true
        }, {
          title: "Regular",
          description: "Show this project below favorites",
          value: false
        }]
      });
      if (favorite === undefined)
        return;
      let lateConflict;
      await updateState((draft) => {
        const stored = sanitizeProjects(draft.projects);
        lateConflict = findConflict(stored, {
          name,
          path: projectPath
        });
        if (lateConflict)
          return;
        draft.version = 1;
        draft.projects = [...stored, {
          name,
          path: projectPath,
          favorite
        }];
      });
      if (lateConflict) {
        toastError(lateConflict === "name" ? `A project named \u201C${name}\u201D already exists.` : "This project path is already saved.");
        return;
      }
      context.ui.toast.show({
        title: "CDF",
        message: `Saved \u201C${name}\u201D.`,
        variant: "success"
      });
      return projectPath;
    };
    const toggleFavorite = async (selected) => {
      let favorite;
      await updateState((draft) => {
        const stored = sanitizeProjects(draft.projects);
        const project = stored.find((candidate) => samePath(candidate.path, selected.path));
        if (!project)
          return;
        project.favorite = !project.favorite;
        favorite = project.favorite;
        draft.version = 1;
        draft.projects = stored;
      });
      if (favorite === undefined) {
        toastError(`\u201C${selected.name}\u201D is no longer saved.`);
        return;
      }
      context.ui.toast.show({
        title: "CDF",
        message: favorite ? `Added \u201C${selected.name}\u201D to favorites.` : `Removed \u201C${selected.name}\u201D from favorites.`,
        variant: "success"
      });
    };
    const removeProject = async (selected) => {
      const confirmed = await context.ui.dialog.confirm({
        title: `Remove \u201C${selected.name}\u201D?`,
        message: context.ui.format.path(selected.path),
        label: {
          confirm: "Remove",
          cancel: "Cancel"
        }
      });
      if (!confirmed)
        return false;
      let removed = false;
      await updateState((draft) => {
        const stored = sanitizeProjects(draft.projects);
        const kept = stored.filter((project) => !samePath(project.path, selected.path));
        removed = kept.length < stored.length;
        draft.version = 1;
        draft.projects = kept;
      });
      if (!removed) {
        toastError(`\u201C${selected.name}\u201D is no longer saved.`);
        return false;
      }
      context.ui.toast.show({
        title: "CDF",
        message: `Removed \u201C${selected.name}\u201D.`,
        variant: "success"
      });
      return true;
    };
    const openProject = async (project) => {
      let projectPath;
      try {
        projectPath = await validateProjectPath(project.path, activeDirectory(context));
      } catch (error) {
        toastError(errorMessage(error));
        return;
      }
      const route = context.ui.router.current();
      try {
        if (route.type === "session") {
          const current = context.data.session.get(route.sessionID);
          if (current && samePath(await canonicalPath(current.location.directory), projectPath)) {
            context.ui.toast.show({
              title: "CDF",
              message: `Already in \u201C${project.name}\u201D.`,
              variant: "info"
            });
            return;
          }
          await context.client.session.move({
            sessionID: route.sessionID,
            directory: projectPath
          });
          context.data.session.invalidate(route.sessionID);
          await context.data.session.sync(route.sessionID);
          context.ui.toast.show({
            title: "CDF",
            message: `Moved session to \u201C${project.name}\u201D.`,
            variant: "success"
          });
          return;
        }
        const session = await context.client.session.create({
          title: project.name,
          location: {
            directory: projectPath
          }
        });
        context.data.session.invalidate(session.id);
        context.ui.router.navigate({
          type: "session",
          sessionID: session.id
        });
        context.ui.toast.show({
          title: "CDF",
          message: `Opened \u201C${project.name}\u201D.`,
          variant: "success"
        });
      } catch (error) {
        toastError(`Could not open \u201C${project.name}\u201D: ${errorMessage(error)}`);
      }
    };
    const showMenu = (currentDirectory, initialPath) => new Promise((resolve) => {
      let settled = false;
      const finish = (choice) => {
        if (settled)
          return;
        settled = true;
        context.ui.dialog.clear();
        resolve(choice);
      };
      context.ui.dialog.set({
        size: "xlarge",
        centered: true
      });
      context.ui.dialog.show(() => _$createComponent(CdfDialog, {
        context,
        get projects() {
          return projects();
        },
        currentDirectory,
        initialPath,
        finish
      }), () => finish({
        kind: "cancel"
      }));
    });
    const openMenu = async () => {
      try {
        await runMenu();
      } catch (error) {
        context.ui.dialog.clear();
        toastError(errorMessage(error));
      }
    };
    const runMenu = async () => {
      let focusPath;
      while (true) {
        const selected = await showMenu(await canonicalPath(activeDirectory(context)), focusPath);
        if (selected.kind === "project") {
          await openProject(selected.project);
          return;
        }
        if (selected.kind === "cancel")
          return;
        if (selected.kind === "add")
          focusPath = await addProject() ?? focusPath;
        if (selected.kind === "toggle") {
          await toggleFavorite(selected.project);
          focusPath = selected.project.path;
        }
        if (selected.kind === "remove") {
          const list = projects();
          const index = list.findIndex((project) => samePath(project.path, selected.project.path));
          const neighbor = list[index + 1] ?? list[index - 1];
          focusPath = await removeProject(selected.project) ? neighbor?.path : selected.project.path;
        }
      }
    };
    return context.ui.slot({
      append: "app",
      render: () => _$createComponent(CdfCommand, {
        context,
        open: openMenu
      })
    });
  }
});
export {
  tui_default as default
};
