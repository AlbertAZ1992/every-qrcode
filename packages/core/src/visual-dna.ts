import { QR_ROLE_CODES } from "./qr-roles.js";
import type { QRDerivedFields } from "./qr-fields.js";

export type PaletteSlot = 0 | 1 | 2 | 3 | 4;

export function qrPaletteSlot(fields: QRDerivedFields, index: number): PaletteSlot {
  const role = fields.roles[index];
  if (role === QR_ROLE_CODES.finder) return 0;
  if (role === QR_ROLE_CODES.alignment) return 1;
  if (role === QR_ROLE_CODES.timing) return 2;
  if (role === QR_ROLE_CODES.format || role === QR_ROLE_CODES["fixed-dark"]) return 3;
  return ((index + Math.floor((fields.density5x5[index] ?? 0) * 7)) % 5) as PaletteSlot;
}
