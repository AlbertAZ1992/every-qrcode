import { EveryQRCodeError } from "./errors.js";

export const QR_ROLE_CODES = {
  data: 0,
  remainder: 1,
  finder: 2,
  separator: 3,
  timing: 4,
  alignment: 5,
  format: 6,
  version: 7,
  "fixed-dark": 8,
} as const;

export type QRRole = keyof typeof QR_ROLE_CODES;

const UNASSIGNED = 255;
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172] as const;
const ALIGNMENT_CENTERS: Readonly<Record<number, readonly number[]>> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

function setRole(roles: Uint8Array, size: number, column: number, row: number, role: QRRole): void {
  roles[row * size + column] = QR_ROLE_CODES[role];
}

function setRoleIfEmpty(
  roles: Uint8Array,
  size: number,
  column: number,
  row: number,
  role: QRRole,
): void {
  const index = row * size + column;
  if (roles[index] === UNASSIGNED) roles[index] = QR_ROLE_CODES[role];
}

function markFinders(roles: Uint8Array, size: number): void {
  const origins = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const;
  for (const [startColumn, startRow] of origins) {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        setRole(roles, size, startColumn + column, startRow + row, "finder");
      }
    }
  }
}

function markSeparators(roles: Uint8Array, size: number): void {
  for (let offset = 0; offset < 8; offset += 1) {
    setRoleIfEmpty(roles, size, offset, 7, "separator");
    setRoleIfEmpty(roles, size, 7, offset, "separator");
    setRoleIfEmpty(roles, size, size - 8 + offset, 7, "separator");
    setRoleIfEmpty(roles, size, size - 8, offset, "separator");
    setRoleIfEmpty(roles, size, offset, size - 8, "separator");
    setRoleIfEmpty(roles, size, 7, size - 8 + offset, "separator");
  }
}

function markTiming(roles: Uint8Array, size: number): void {
  for (let coordinate = 8; coordinate <= size - 9; coordinate += 1) {
    setRoleIfEmpty(roles, size, coordinate, 6, "timing");
    setRoleIfEmpty(roles, size, 6, coordinate, "timing");
  }
}

function markAlignment(roles: Uint8Array, size: number, version: number): void {
  const centers = ALIGNMENT_CENTERS[version] ?? [];
  for (const centerRow of centers) {
    for (const centerColumn of centers) {
      if (roles[centerRow * size + centerColumn] !== UNASSIGNED) continue;
      for (let row = centerRow - 2; row <= centerRow + 2; row += 1) {
        for (let column = centerColumn - 2; column <= centerColumn + 2; column += 1) {
          setRole(roles, size, column, row, "alignment");
        }
      }
    }
  }
}

function markFormatAndFixedDark(roles: Uint8Array, size: number): void {
  for (let coordinate = 0; coordinate <= 5; coordinate += 1) {
    setRoleIfEmpty(roles, size, 8, coordinate, "format");
    setRoleIfEmpty(roles, size, coordinate, 8, "format");
  }
  setRoleIfEmpty(roles, size, 8, 7, "format");
  setRoleIfEmpty(roles, size, 8, 8, "format");
  setRoleIfEmpty(roles, size, 7, 8, "format");
  for (let column = size - 8; column < size; column += 1) {
    setRoleIfEmpty(roles, size, column, 8, "format");
  }
  for (let row = size - 7; row < size; row += 1) {
    setRoleIfEmpty(roles, size, 8, row, "format");
  }
  setRole(roles, size, 8, size - 8, "fixed-dark");
}

function dataTraversal(roles: Uint8Array, size: number): number[] {
  const positions: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row: number = upward ? size - 1 - step : step;
      for (const column of [right, right - 1]) {
        const index = row * size + column;
        if (roles[index] === UNASSIGNED) positions.push(index);
      }
    }
    upward = !upward;
  }
  return positions;
}

export function createQRRoleMap(symbolVersion: number): Uint8Array {
  if (!Number.isInteger(symbolVersion) || symbolVersion < 1 || symbolVersion > 6) {
    throw new RangeError("symbolVersion");
  }
  const size = 17 + 4 * symbolVersion;
  const roles = new Uint8Array(size ** 2);
  roles.fill(UNASSIGNED);
  markFinders(roles, size);
  markSeparators(roles, size);
  markTiming(roles, size);
  markAlignment(roles, size, symbolVersion);
  markFormatAndFixedDark(roles, size);

  const positions = dataTraversal(roles, size);
  const codewordBits = (TOTAL_CODEWORDS[symbolVersion] ?? 0) * 8;
  if (positions.length < codewordBits || positions.length - codewordBits > 7) {
    throw new EveryQRCodeError("generation-failed", "QR role placement did not match the profile.");
  }
  positions.forEach((index, order) => {
    roles[index] = order < codewordBits ? QR_ROLE_CODES.data : QR_ROLE_CODES.remainder;
  });
  return roles;
}
