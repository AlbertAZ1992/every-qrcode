import { describe, expect, it } from "vitest";

import { createEveryQRCodeIdentity } from "./identity";
import { qrPaletteSlot } from "./visual-dna";

describe("qrPaletteSlot", () => {
  it("assigns deterministic semantic slots from the QR role field", async () => {
    const identity = await createEveryQRCodeIdentity("https://linkseed.dev/palette");
    const first = Array.from(identity.qr.cells, (_, index) =>
      qrPaletteSlot(identity.fields, index),
    );
    const second = Array.from(identity.qr.cells, (_, index) =>
      qrPaletteSlot(identity.fields, index),
    );

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(5);
    expect(first.every((slot) => slot >= 0 && slot <= 4)).toBe(true);
  });
});
