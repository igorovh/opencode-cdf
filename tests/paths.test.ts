import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { expandHome, resolveCandidatePath, validateProjectPath } from "../src/paths.ts"

describe("expandHome", () => {
  test("expands a home-relative path", () => {
    expect(expandHome("~/code/app", "/home/tester")).toBe(path.join("/home/tester", "code/app"))
  })

  test("does not expand a tilde in a regular name", () => {
    expect(expandHome("~archive/project", "/home/tester")).toBe("~archive/project")
  })

  test("expands ~\\ only on Windows", () => {
    expect(expandHome("~\\code", "C:\\Users\\tester", "win32")).toBe(path.join("C:\\Users\\tester", "code"))
    expect(expandHome("~\\code", "/home/tester", "linux")).toBe("~\\code")
  })
})

describe("resolveCandidatePath", () => {
  test("resolves relative paths from the active directory", () => {
    const root = path.parse(process.cwd()).root
    expect(resolveCandidatePath("../other", path.join(root, "Code", "Current"))).toBe(path.join(root, "Code", "other"))
  })

  test("rejects empty input", () => {
    expect(() => resolveCandidatePath("  ", "/code")).toThrow("Project path cannot be empty")
  })
})

describe("validateProjectPath", () => {
  let root: string

  beforeAll(async () => {
    root = await realpath(await mkdtemp(path.join(tmpdir(), "cdf-")))
    await mkdir(path.join(root, "app"))
    await writeFile(path.join(root, "notes.txt"), "")
  })

  afterAll(() => rm(root, { recursive: true, force: true }))

  test("returns the real path of an existing directory", async () => {
    expect(await validateProjectPath("app", root)).toBe(path.join(root, "app"))
  })

  test("rejects a file", async () => {
    await expect(validateProjectPath("notes.txt", root)).rejects.toThrow("not a directory")
  })

  test("rejects a missing directory", async () => {
    await expect(validateProjectPath("missing", root)).rejects.toThrow("does not exist")
  })

  test("resolves symlinks so the same project is not saved twice", async () => {
    const link = path.join(root, "link")
    try {
      await symlink(path.join(root, "app"), link, "junction")
    } catch {
      return // Creating links can need extra privileges on Windows.
    }
    expect(await validateProjectPath("link", root)).toBe(path.join(root, "app"))
  })
})
