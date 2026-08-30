import type { QRMatrix } from "./qr.js";

export type QRSvgPath = {
  readonly path: string;
  readonly size: number;
};

function validateQuietZone(quietZone: number): void {
  if (!Number.isInteger(quietZone) || quietZone < 0 || quietZone > 16) {
    throw new RangeError("QR quiet zone");
  }
}

export function createQRSvgPath(matrix: QRMatrix, quietZone = 4): QRSvgPath {
  validateQuietZone(quietZone);
  const commands: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    let column = 0;
    while (column < matrix.size) {
      if (matrix.cells[row * matrix.size + column] !== 1) {
        column += 1;
        continue;
      }
      const start = column;
      while (column < matrix.size && matrix.cells[row * matrix.size + column] === 1) {
        column += 1;
      }
      const width = column - start;
      commands.push(`M${start + quietZone} ${row + quietZone}h${width}v1h-${width}z`);
    }
  }
  return { path: commands.join(""), size: matrix.size + quietZone * 2 };
}
