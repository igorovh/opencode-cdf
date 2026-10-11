import path from "node:path"

export interface ProjectEntry {
  name: string
  path: string
  favorite: boolean
}

export interface FavoritesState {
  version: 1
  projects: ProjectEntry[]
}

export const INITIAL_STATE: FavoritesState = {
  version: 1,
  projects: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function pathIdentity(value: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = path.normalize(value)
  const root = path.parse(normalized).root
  const withoutTrailingSeparators = normalized === root ? normalized : normalized.replace(/[\\/]+$/, "")
  return platform === "win32" ? withoutTrailingSeparators.toLocaleLowerCase("en-US") : withoutTrailingSeparators
}

export function samePath(left: string, right: string, platform: NodeJS.Platform = process.platform): boolean {
  return pathIdentity(left, platform) === pathIdentity(right, platform)
}

export function sanitizeProjects(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) return []

  const projects: ProjectEntry[] = []
  const seenPaths = new Set<string>()

  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    if (typeof candidate.name !== "string" || typeof candidate.path !== "string") continue

    const name = candidate.name.trim()
    const projectPath = candidate.path.trim()
    if (!name || !projectPath) continue

    const identity = pathIdentity(projectPath)
    if (seenPaths.has(identity)) continue
    seenPaths.add(identity)

    projects.push({
      name,
      path: path.normalize(projectPath),
      favorite: candidate.favorite === true,
    })
  }

  return projects
}

export function sortProjects(projects: readonly ProjectEntry[]): ProjectEntry[] {
  return [...projects].sort((left, right) => {
    if (left.favorite !== right.favorite) return left.favorite ? -1 : 1
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    return byName || left.path.localeCompare(right.path, undefined, { sensitivity: "base" })
  })
}

// displayPath lets "~/…" queries match the shortened path shown in the list.
export function filterProjects(
  projects: readonly ProjectEntry[],
  query: string,
  displayPath: (value: string) => string = (value) => value,
): ProjectEntry[] {
  const needle = query.trim().toLocaleLowerCase("en-US")
  if (!needle) return [...projects]
  return projects.filter((project) =>
    [project.name, project.path, displayPath(project.path)].some((field) =>
      field.toLocaleLowerCase("en-US").includes(needle),
    ),
  )
}

export function truncateTail(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `…${chars.slice(-(max - 1)).join("")}`
}

export function findConflict(
  projects: readonly ProjectEntry[],
  candidate: Pick<ProjectEntry, "name" | "path">,
): "name" | "path" | undefined {
  if (projects.some((project) => samePath(project.path, candidate.path))) return "path"
  const name = candidate.name.trim().toLocaleLowerCase("en-US")
  if (projects.some((project) => project.name.trim().toLocaleLowerCase("en-US") === name)) return "name"
  return undefined
}
