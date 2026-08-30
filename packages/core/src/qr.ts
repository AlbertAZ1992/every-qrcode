import QRCode from "qrcode";

import { EveryQRCodeError, LinkTooComplexError, UnsupportedVersionError } from "./errors.js";

export interface QRMatrix {
  readonly profileVersion: number;
  readonly symbolVersion: number;
  readonly size: number;
  readonly errorCorrection: "M";
  readonly maskPattern: number;
  readonly cells: Uint8Array;
}

export interface QRProfileV1 {
  readonly profileVersion: 1;
  readonly errorCorrection: "M";
  readonly minSymbolVersion: 1;
  readonly maxSymbolVersion: 6;
  readonly boostErrorCorrection: false;
}

export const QR_PROFILE_V1: QRProfileV1 = Object.freeze({
  boostErrorCorrection: false,
  errorCorrection: "M",
  maxSymbolVersion: 6,
  minSymbolVersion: 1,
  profileVersion: 1,
});

function copyCells(code: ReturnType<typeof QRCode.create>): Uint8Array {
  const cells = new Uint8Array(code.modules.size ** 2);
  for (let row = 0; row < code.modules.size; row += 1) {
    for (let column = 0; column < code.modules.size; column += 1) {
      const value = code.modules.get(column, row);
      if (value !== 0 && value !== 1) {
        throw new EveryQRCodeError(
          "generation-failed",
          "The QR encoder returned an invalid module.",
        );
      }
      cells[row * code.modules.size + column] = value;
    }
  }
  return cells;
}

function validateEncoderResult(code: ReturnType<typeof QRCode.create>): number {
  if (!Number.isInteger(code.version) || code.version < 1) {
    throw new EveryQRCodeError("generation-failed", "The QR encoder returned an invalid version.");
  }
  if (code.version > QR_PROFILE_V1.maxSymbolVersion) throw new LinkTooComplexError();
  if (code.modules.size !== 17 + 4 * code.version) {
    throw new EveryQRCodeError(
      "generation-failed",
      "The QR encoder returned an invalid matrix size.",
    );
  }
  if (code.modules.data.length !== code.modules.size ** 2) {
    throw new EveryQRCodeError(
      "generation-failed",
      "The QR encoder returned incomplete module data.",
    );
  }
  const maskPattern = code.maskPattern;
  if (
    maskPattern === undefined ||
    !Number.isInteger(maskPattern) ||
    maskPattern < 0 ||
    maskPattern > 7
  ) {
    throw new EveryQRCodeError("generation-failed", "The QR encoder returned an invalid mask.");
  }
  return maskPattern;
}

export function createQRMatrix(payloadUrl: string, profileVersion = 1): QRMatrix {
  if (profileVersion !== QR_PROFILE_V1.profileVersion) {
    throw new UnsupportedVersionError("QR profile", profileVersion);
  }

  let code: ReturnType<typeof QRCode.create>;
  try {
    code = QRCode.create(payloadUrl, { errorCorrectionLevel: QR_PROFILE_V1.errorCorrection });
  } catch (error) {
    if (error instanceof Error && error.message.includes("too big")) {
      throw new LinkTooComplexError();
    }
    throw new EveryQRCodeError("generation-failed", "The QR encoder could not create a symbol.");
  }
  const maskPattern = validateEncoderResult(code);
  return {
    cells: copyCells(code),
    errorCorrection: QR_PROFILE_V1.errorCorrection,
    maskPattern,
    profileVersion: QR_PROFILE_V1.profileVersion,
    size: code.modules.size,
    symbolVersion: code.version,
  };
}

export function qrCell(matrix: QRMatrix, column: number, row: number): 0 | 1 {
  if (!Number.isInteger(column) || !Number.isInteger(row)) throw new RangeError("QR coordinate");
  if (column < 0 || row < 0 || column >= matrix.size || row >= matrix.size) {
    throw new RangeError("QR coordinate");
  }
  return matrix.cells[row * matrix.size + column] === 1 ? 1 : 0;
}
