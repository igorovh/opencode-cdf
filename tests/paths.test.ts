import path from "node:path"
import { describe, expect, test } from "bun:test"
import { expandHome, resolveCandidatePath } from "../src/paths.ts"

describe("expandHome", () => {
  test("expands a home-relative path", () => {
    expect(expandHome("~/code/app", "/home/tester")).toBe(path.join("/home/tester", "code/app"))
  })

  test("does not expand a tilde in a regular name", () => {
    expect(expandHome("~archive/project", "/home/tester")).toBe("~archive/project")
  })
})

describe("resolveCandidatePath", () => {
  test("resolves relative paths from the active directory", () => {
    expect(resolveCandidatePath("../other", path.join("C:", "Code", "Current"))).toBe(
      path.normalize(path.join("C:", "Code", "other")),
    )
  })

  test("rejects empty input", () => {
    expect(() => resolveCandidatePath("  ", "/code")).toThrow("Project path cannot be empty")
  })
})
