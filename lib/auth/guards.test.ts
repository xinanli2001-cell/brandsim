import { describe, it, expect } from "vitest";
import { AuthError, assertUser, assertTeacher } from "./guards";

const teacher = { id: "u1", role: "teacher" };
const student = { id: "u2", role: "student" };

describe("assertUser", () => {
  it("returns the user when present", () => {
    expect(assertUser(teacher)).toBe(teacher);
  });
  it("throws AuthError 401 when null", () => {
    try { assertUser(null); throw new Error("should have thrown"); }
    catch (e) { expect(e).toBeInstanceOf(AuthError); expect((e as AuthError).status).toBe(401); }
  });
});

describe("assertTeacher", () => {
  it("returns the user when role is teacher", () => {
    expect(assertTeacher(teacher)).toBe(teacher);
  });
  it("throws AuthError 403 when role is student", () => {
    try { assertTeacher(student); throw new Error("should have thrown"); }
    catch (e) { expect(e).toBeInstanceOf(AuthError); expect((e as AuthError).status).toBe(403); }
  });
  it("throws AuthError 401 when null", () => {
    try { assertTeacher(null); throw new Error("should have thrown"); }
    catch (e) { expect(e).toBeInstanceOf(AuthError); expect((e as AuthError).status).toBe(401); }
  });
});
