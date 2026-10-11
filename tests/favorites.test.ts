import { describe, expect, test } from "bun:test"
import path from "node:path"
import {
  filterProjects,
  findConflict,
  pathIdentity,
  samePath,
  sanitizeProjects,
  sortProjects,
  truncateTail,
} from "../src/favorites.ts"

describe("sanitizeProjects", () => {
  test("keeps valid records and removes malformed and duplicate paths", () => {
    const projectPath = path.join(path.parse(process.cwd()).root, "Code", "Alpha")
    expect(
      sanitizeProjects([
        { name: " Alpha ", path: projectPath, favorite: true },
        { name: "Duplicate", path: `${projectPath}${path.sep}`, favorite: false },
        { name: "Missing path", favorite: false },
        null,
      ]),
    ).toEqual([{ name: "Alpha", path: projectPath, favorite: true }])
  })

  test("returns an empty list for invalid storage", () => {
    expect(sanitizeProjects({ projects: [] })).toEqual([])
  })
})

describe("project ordering", () => {
  test("puts favorites first and sorts each group by name", () => {
    const sorted = sortProjects([
      { name: "Zulu", path: "/z", favorite: false },
      { name: "Beta", path: "/b", favorite: true },
      { name: "Alpha", path: "/a", favorite: true },
      { name: "Delta", path: "/d", favorite: false },
    ])

    expect(sorted.map((project) => project.name)).toEqual(["Alpha", "Beta", "Delta", "Zulu"])
  })
})

describe("path comparison", () => {
  test("is case-insensitive and ignores trailing separators on Windows", () => {
    expect(samePath("C:\\Code\\App", "c:\\code\\app\\", "win32")).toBe(true)
    expect(pathIdentity("C:\\Code\\App\\", "win32")).toBe(pathIdentity("c:\\code\\app", "win32"))
  })

  test("remains case-sensitive outside Windows", () => {
    expect(samePath("/Code/App", "/code/app", "linux")).toBe(false)
  })
})

describe("findConflict", () => {
  const projects = [{ name: "Storefront", path: "C:\\Code\\Storefront", favorite: true }]

  test("detects duplicate paths", () => {
    expect(findConflict(projects, { name: "Other", path: "c:\\code\\storefront" })).toBe("path")
  })

  test("detects duplicate names", () => {
    expect(findConflict(projects, { name: "storefront", path: "C:\\Code\\Other" })).toBe("name")
  })
})

describe("filterProjects", () => {
  const projects = [
    { name: "Storefront", path: "/home/me/code/shop", favorite: true },
    { name: "Dotfiles", path: "/home/me/dotfiles", favorite: false },
  ]
  const display = (value: string) => value.replace("/home/me", "~")

  test("matches name or path case-insensitively", () => {
    expect(filterProjects(projects, "STORE").map((project) => project.name)).toEqual(["Storefront"])
    expect(filterProjects(projects, "code/shop").map((project) => project.name)).toEqual(["Storefront"])
  })

  test("matches the shortened path shown in the list", () => {
    expect(filterProjects(projects, "~/dot", display).map((project) => project.name)).toEqual(["Dotfiles"])
  })

  test("returns everything for a blank query", () => {
    expect(filterProjects(projects, "  ")).toHaveLength(2)
  })
})

describe("truncateTail", () => {
  test("keeps the end of long text", () => {
    expect(truncateTail("abcdef", 4)).toBe("…def")
    expect(truncateTail("abc", 4)).toBe("abc")
  })
})
