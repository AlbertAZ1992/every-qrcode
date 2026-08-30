import { describe, expect, it } from "vitest";

import { createQRDerivedFields } from "./qr-fields";
import { QR_ROLE_CODES, createQRRoleMap } from "./qr-roles";
import { createQRMatrix, qrCell } from "./qr";

function countRole(roles: Uint8Array, role: number): number {
  return roles.reduce((count, value) => count + Number(value === role), 0);
}

async function hashCells(cells: Uint8Array): Promise<string> {
  const copy = new Uint8Array(cells.length);
  copy.set(cells);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("QR Profile v1", () => {
  it("copies the encoder matrix in canonical row-major orientation", () => {
    const matrix = createQRMatrix("https://example.com/");
    expect(matrix).toMatchObject({
      errorCorrection: "M",
      maskPattern: 4,
      profileVersion: 1,
      size: 25,
      symbolVersion: 2,
    });
    expect(matrix.cells.slice(8 * matrix.size, 9 * matrix.size).join("")).toBe(
      "1001111111101100111010001",
    );
  });

  it("keeps the three finder centers in canonical screen positions", () => {
    const matrix = createQRMatrix("https://example.com/");
    expect(qrCell(matrix, 3, 3)).toBe(1);
    expect(qrCell(matrix, matrix.size - 4, 3)).toBe(1);
    expect(qrCell(matrix, 3, matrix.size - 4)).toBe(1);
    expect(() => qrCell(matrix, -1, 0)).toThrow("QR coordinate");
  });

  it("rejects payloads above the frozen version-six budget", () => {
    expect(() => createQRMatrix(`https://example.com/${"a".repeat(500)}`)).toThrow("too long");
  });

  it.each([
    [1, 1, 21, 2, "4d68abf37c6e7298668c3d4101b5e93f055533b896d1293f2678ebcd1a2af21f"],
    [2, 2, 25, 6, "8aa5eb57af520f7408575497135ee75a4662a63461e2b6e1a2c9e3844c068117"],
    [14, 3, 29, 0, "686f3a3bb52ea6634ab073b92d84c62082e59aac1adb962d9c22eaa3811620a7"],
    [30, 4, 33, 6, "acf0ee00c0dbbad7c6398dd6ecacc6e2d065f028700ecfd0b6b3e33216d61dab"],
    [50, 5, 37, 2, "ceebc7becdb6a598209373e1c60e26bc6d50a01850173a03fb8b6326a5e4f478"],
    [72, 6, 41, 2, "387bddd7f417b92205b8175d0880aa6e7abe008655ee598ece47d045e9b265e2"],
  ])(
    "freezes the version, mask, and matrix for profile fixture length %i",
    async (length, version, size, mask, hash) => {
      const matrix = createQRMatrix(`https://e.co/${"a".repeat(length)}`);
      expect(matrix).toMatchObject({ maskPattern: mask, size, symbolVersion: version });
      expect(await hashCells(matrix.cells)).toBe(hash);
    },
  );
});

describe("QR role map", () => {
  const roleCounts = [
    { alignment: 0, data: 208, remainder: 0, timing: 10 },
    { alignment: 25, data: 352, remainder: 7, timing: 18 },
    { alignment: 25, data: 560, remainder: 7, timing: 26 },
    { alignment: 25, data: 800, remainder: 7, timing: 34 },
    { alignment: 25, data: 1072, remainder: 7, timing: 42 },
    { alignment: 25, data: 1376, remainder: 7, timing: 50 },
  ] as const;

  it.each([1, 2, 3, 4, 5, 6])("maps every function and payload cell for version %i", (version) => {
    const size = 17 + 4 * version;
    const roles = createQRRoleMap(version);
    const expected = roleCounts[version - 1];
    expect(roles).toHaveLength(size ** 2);
    expect(roles.every((role) => role <= QR_ROLE_CODES["fixed-dark"])).toBe(true);
    expect(countRole(roles, QR_ROLE_CODES.data)).toBe(expected?.data);
    expect(countRole(roles, QR_ROLE_CODES.finder)).toBe(147);
    expect(countRole(roles, QR_ROLE_CODES.separator)).toBe(45);
    expect(countRole(roles, QR_ROLE_CODES.timing)).toBe(expected?.timing);
    expect(countRole(roles, QR_ROLE_CODES.alignment)).toBe(expected?.alignment);
    expect(countRole(roles, QR_ROLE_CODES.format)).toBe(30);
    expect(countRole(roles, QR_ROLE_CODES.remainder)).toBe(expected?.remainder);
    expect(roles[(size - 8) * size + 8]).toBe(QR_ROLE_CODES["fixed-dark"]);
  });

  it("distinguishes finder, separator, timing, format, and alignment cells", () => {
    const roles = createQRRoleMap(2);
    const size = 25;
    expect(roles[3 * size + 3]).toBe(QR_ROLE_CODES.finder);
    expect(roles[7 * size + 7]).toBe(QR_ROLE_CODES.separator);
    expect(roles[6 * size + 8]).toBe(QR_ROLE_CODES.timing);
    expect(roles[8 * size + 8]).toBe(QR_ROLE_CODES.format);
    expect(roles[18 * size + 18]).toBe(QR_ROLE_CODES.alignment);
  });
});

describe("QR derived fields", () => {
  it("produces finite row-major fields with the same matrix size", () => {
    const matrix = createQRMatrix("https://example.com/");
    const fields = createQRDerivedFields(matrix);
    for (const field of [
      fields.density3x3,
      fields.density5x5,
      fields.blur,
      fields.darkDistance,
      fields.lightDistance,
      fields.edge,
      fields.roles,
    ]) {
      expect(field).toHaveLength(matrix.size ** 2);
      expect(Array.from(field).every(Number.isFinite)).toBe(true);
    }
    expect(Math.min(...fields.density3x3)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fields.density3x3)).toBeLessThanOrEqual(1);
    expect(Math.max(...fields.edge)).toBeLessThanOrEqual(1);
  });

  it("returns zero distance for a cell's own class", () => {
    const matrix = createQRMatrix("https://example.com/");
    const fields = createQRDerivedFields(matrix);
    matrix.cells.forEach((cell, index) => {
      expect(cell === 1 ? fields.darkDistance[index] : fields.lightDistance[index]).toBe(0);
    });
  });
});
