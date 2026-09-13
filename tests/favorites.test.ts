import { describe, expect, test } from "bun:test"
import path from "node:path"
import { findConflict, pathIdentity, samePath, sanitizeProjects, sortProjects } from "../src/favorites.ts"

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
