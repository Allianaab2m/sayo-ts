import { HttpApiSchema } from "@effect/platform"
import { describe, expect, it } from "vitest"
import { NotFound, Conflict, Unauthorized } from "../errors.js"

describe("sayo-ts standard errors", () => {
  it("NotFound は status 404 のアノテーションを持つ", () => {
    expect(HttpApiSchema.getStatus(NotFound.ast, 0)).toBe(404)
  })

  it("Conflict は status 409 のアノテーションを持つ", () => {
    expect(HttpApiSchema.getStatus(Conflict.ast, 0)).toBe(409)
  })

  it("NotFound はメッセージと省略可能な resource を持つ", () => {
    const err = new NotFound({ message: "User not found", resource: "User" })
    expect(err._tag).toBe("NotFound")
    expect(err.message).toBe("User not found")
    expect(err.resource).toBe("User")
  })

  it("NotFound は resource なしでも作れる", () => {
    const err = new NotFound({ message: "Not found" })
    expect(err.resource).toBeUndefined()
  })
})
