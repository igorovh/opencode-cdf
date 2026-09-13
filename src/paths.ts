import { stat, realpath } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

export function expandHome(value: string, home: string = homedir()): string {
  if (value === "~") return home
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(home, value.slice(2))
  return value
}

export function resolveCandidatePath(value: string, baseDirectory: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("Project path cannot be empty.")
  return path.normalize(path.resolve(baseDirectory, expandHome(trimmed)))
}

export async function validateProjectPath(value: string, baseDirectory: string): Promise<string> {
  const resolved = resolveCandidatePath(value, baseDirectory)

  try {
    const info = await stat(resolved)
    if (!info.isDirectory()) throw new Error("The selected path is not a directory.")
    return path.normalize(await realpath(resolved))
  } catch (error) {
    if (error instanceof Error && error.message === "The selected path is not a directory.") throw error
    throw new Error(`Directory does not exist or cannot be accessed: ${resolved}`)
  }
}
