import { stat, realpath } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

export class ProjectPathError extends Error {}

export function expandHome(value: string, home: string = homedir(), platform: NodeJS.Platform = process.platform): string {
  if (value === "~") return home
  // A backslash is a valid file name character outside Windows.
  if (value.startsWith("~/") || (platform === "win32" && value.startsWith("~\\"))) {
    return path.join(home, value.slice(2))
  }
  return value
}

export function resolveCandidatePath(value: string, baseDirectory: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ProjectPathError("Project path cannot be empty.")
  return path.normalize(path.resolve(baseDirectory, expandHome(trimmed)))
}

export async function canonicalPath(value: string): Promise<string> {
  try {
    return path.normalize(await realpath(value))
  } catch {
    return path.normalize(value)
  }
}

export async function validateProjectPath(value: string, baseDirectory: string): Promise<string> {
  const resolved = resolveCandidatePath(value, baseDirectory)

  let isDirectory: boolean
  try {
    isDirectory = (await stat(resolved)).isDirectory()
  } catch {
    throw new ProjectPathError(`Directory does not exist or cannot be accessed: ${resolved}`)
  }
  if (!isDirectory) throw new ProjectPathError("The selected path is not a directory.")
  return canonicalPath(resolved)
}
