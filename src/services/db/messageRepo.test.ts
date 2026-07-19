import { describe, expect, it } from "vitest";
import { toFtsQuery } from "./messageRepo";

describe("toFtsQuery", () => {
  it("quotes and prefix-matches a single token", () => {
    expect(toFtsQuery("foo")).toBe('"foo"*');
  });

  it("quotes each token of a multi-token query", () => {
    expect(toFtsQuery("foo ba")).toBe('"foo"* "ba"*');
  });

  it("collapses arbitrary whitespace between tokens", () => {
    expect(toFtsQuery("  foo\t bar\n baz ")).toBe('"foo"* "bar"* "baz"*');
  });

  it("escapes embedded double quotes so they are literals", () => {
    expect(toFtsQuery('fo"o')).toBe('"fo""o"*');
  });

  it("treats FTS metacharacters as literal text (no throw semantics)", () => {
    expect(toFtsQuery('"foo (bar')).toBe('"""foo"* "(bar"*');
  });

  it("returns null for an empty or whitespace-only query", () => {
    expect(toFtsQuery("")).toBeNull();
    expect(toFtsQuery("   \t\n ")).toBeNull();
  });
});
