import { describe, expect, it } from "vitest";

import {
  CURRENT_GENERATOR_VERSION,
  isGeneratorVersion,
  resolveGeneratorVersion,
  SUPPORTED_GENERATOR_VERSIONS,
} from "./generator-version";

describe("generator version contract", () => {
  it("starts with one explicit, supported generator version", () => {
    expect(CURRENT_GENERATOR_VERSION).toBe(1);
    expect(SUPPORTED_GENERATOR_VERSIONS).toEqual([1]);
    expect(isGeneratorVersion(1)).toBe(true);
  });

  it("defaults to the current version and rejects unknown versions", () => {
    expect(resolveGeneratorVersion()).toBe(1);
    expect(() => resolveGeneratorVersion(2)).toThrowError("Unsupported generator version: 2");
  });
});
