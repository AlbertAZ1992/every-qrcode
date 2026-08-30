import type { QRMatrix } from "./qr.js";
import { createQRRoleMap } from "./qr-roles.js";

export interface QRDerivedFields {
  readonly density3x3: Float32Array;
  readonly density5x5: Float32Array;
  readonly blur: Float32Array;
  readonly darkDistance: Float32Array;
  readonly lightDistance: Float32Array;
  readonly edge: Float32Array;
  readonly roles: Uint8Array;
}

const GAUSSIAN_KERNEL = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16] as const;

function localDensity(cells: Uint8Array, size: number, radius: number): Float32Array {
  const result = new Float32Array(cells.length);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let dark = 0;
      let count = 0;
      const minRow = Math.max(0, row - radius);
      const maxRow = Math.min(size - 1, row + radius);
      const minColumn = Math.max(0, column - radius);
      const maxColumn = Math.min(size - 1, column + radius);
      for (let neighborRow = minRow; neighborRow <= maxRow; neighborRow += 1) {
        for (let neighborColumn = minColumn; neighborColumn <= maxColumn; neighborColumn += 1) {
          dark += cells[neighborRow * size + neighborColumn] ?? 0;
          count += 1;
        }
      }
      result[row * size + column] = dark / count;
    }
  }
  return result;
}

function gaussianBlur(cells: Uint8Array, size: number): Float32Array {
  const horizontal = new Float32Array(cells.length);
  const result = new Float32Array(cells.length);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let value = 0;
      for (let offset = -2; offset <= 2; offset += 1) {
        const sampleColumn = Math.max(0, Math.min(size - 1, column + offset));
        value += (cells[row * size + sampleColumn] ?? 0) * (GAUSSIAN_KERNEL[offset + 2] ?? 0);
      }
      horizontal[row * size + column] = value;
    }
  }
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let value = 0;
      for (let offset = -2; offset <= 2; offset += 1) {
        const sampleRow = Math.max(0, Math.min(size - 1, row + offset));
        value += (horizontal[sampleRow * size + column] ?? 0) * (GAUSSIAN_KERNEL[offset + 2] ?? 0);
      }
      result[row * size + column] = value;
    }
  }
  return result;
}

function distanceField(cells: Uint8Array, size: number, target: 0 | 1): Float32Array {
  const targets: Array<readonly [number, number]> = [];
  cells.forEach((value, index) => {
    if (value === target) targets.push([index % size, Math.floor(index / size)]);
  });
  const result = new Float32Array(cells.length);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let minimumSquared = Number.POSITIVE_INFINITY;
      for (const [targetColumn, targetRow] of targets) {
        const deltaColumn = column - targetColumn;
        const deltaRow = row - targetRow;
        minimumSquared = Math.min(minimumSquared, deltaColumn ** 2 + deltaRow ** 2);
      }
      result[row * size + column] = Math.sqrt(minimumSquared);
    }
  }
  return result;
}

function clampedSample(field: Float32Array, size: number, column: number, row: number): number {
  const sampleColumn = Math.max(0, Math.min(size - 1, column));
  const sampleRow = Math.max(0, Math.min(size - 1, row));
  return field[sampleRow * size + sampleColumn] ?? 0;
}

function edgeField(blur: Float32Array, size: number): Float32Array {
  const result = new Float32Array(blur.length);
  const divisor = 4 * Math.SQRT2;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const topLeft = clampedSample(blur, size, column - 1, row - 1);
      const top = clampedSample(blur, size, column, row - 1);
      const topRight = clampedSample(blur, size, column + 1, row - 1);
      const left = clampedSample(blur, size, column - 1, row);
      const right = clampedSample(blur, size, column + 1, row);
      const bottomLeft = clampedSample(blur, size, column - 1, row + 1);
      const bottom = clampedSample(blur, size, column, row + 1);
      const bottomRight = clampedSample(blur, size, column + 1, row + 1);
      const gx = topRight + 2 * right + bottomRight - topLeft - 2 * left - bottomLeft;
      const gy = bottomLeft + 2 * bottom + bottomRight - topLeft - 2 * top - topRight;
      result[row * size + column] = Math.min(1, Math.hypot(gx, gy) / divisor);
    }
  }
  return result;
}

export function createQRDerivedFields(matrix: QRMatrix): QRDerivedFields {
  const blur = gaussianBlur(matrix.cells, matrix.size);
  return {
    blur,
    darkDistance: distanceField(matrix.cells, matrix.size, 1),
    density3x3: localDensity(matrix.cells, matrix.size, 1),
    density5x5: localDensity(matrix.cells, matrix.size, 2),
    edge: edgeField(blur, matrix.size),
    lightDistance: distanceField(matrix.cells, matrix.size, 0),
    roles: createQRRoleMap(matrix.symbolVersion),
  };
}
