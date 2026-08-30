import { describe, expect, it } from "vitest";

import { createEveryQRCodeIdentity } from "./identity";

describe("createEveryQRCodeIdentity", () => {
  it("creates one coherent URL, DNA, QR, and derived-field result", async () => {
    const identity = await createEveryQRCodeIdentity("example.com");
    expect(identity.link.payloadUrl).toBe("https://example.com/");
    expect(identity.dna.identityVersion).toBe(1);
    expect(identity.qr.profileVersion).toBe(1);
    expect(identity.fields.roles).toHaveLength(identity.qr.cells.length);
  });

  it("is deterministic across independent calls", async () => {
    const first = await createEveryQRCodeIdentity("example.com");
    const second = await createEveryQRCodeIdentity("https://example.com/");
    expect(first.link.siteIdentity).toBe(second.link.siteIdentity);
    expect(first.dna.siteDigest).toEqual(second.dna.siteDigest);
    expect(first.qr.cells).toEqual(second.qr.cells);
    expect(first.fields.blur).toEqual(second.fields.blur);
  });
});
