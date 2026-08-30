import { describe, expect, it } from "vitest";

import { createQRMatrix } from "./qr";
import { createQRSvgPath } from "./qr-svg";

describe("createQRSvgPath", () => {
  it("adds a four-module quiet zone to a compact row-run path", () => {
    const matrix = createQRMatrix("https://example.com/");
    const vector = createQRSvgPath(matrix);

    expect(vector.size).toBe(matrix.size + 8);
    expect(vector.path).toMatch(/^M4 4h7v1h-7z/);
    expect(vector.path).not.toContain("undefined");
  });

  it("validates the quiet zone", () => {
    const matrix = createQRMatrix("https://example.com/");
    expect(() => createQRSvgPath(matrix, -1)).toThrow("QR quiet zone");
    expect(() => createQRSvgPath(matrix, 1.5)).toThrow("QR quiet zone");
  });
});
