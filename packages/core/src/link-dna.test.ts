import { describe, expect, it } from "vitest";

import { createDNAContext, digestToHex, mixFamily } from "./link-dna";
import { parseLink } from "./url";

describe("Link DNA v1", () => {
  it("derives stable namespaced family, site, and page digests", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    expect(digestToHex(dna.familyDigest)).toBe(
      "0d670ae21d20120d2509d1d02c791c123ddd9941f4901b01684c7580011e0234",
    );
    expect(digestToHex(dna.siteDigest)).toBe(
      "7d02b41774e673239643da6c5fd3381c33df8f7d8e0bf599a0472447ad49fc7a",
    );
    expect(digestToHex(dna.pageDigest)).toBe(
      "c0b0850b5761ae303d58b3dcd7a9b4ac4b5acfbbaa2b81edb48151d911c029b6",
    );
  });

  it("creates fresh streams for the same named channel", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    const first = await dna.channel("site", "seed/v1/material");
    const second = await dna.channel("site", "seed/v1/material");
    expect([first.nextUint32(), first.nextUint32()]).toEqual([
      second.nextUint32(),
      second.nextUint32(),
    ]);
  });

  it("isolates different named channels", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    const material = await dna.channelSeed("site", "seed/v1/material");
    const orbit = await dna.channelSeed("site", "seed/v1/orbit");
    expect(material).not.toEqual(orbit);
  });

  it("preserves site identity without collapsing page identity", async () => {
    const first = await createDNAContext(parseLink("https://example.com/a"));
    const second = await createDNAContext(parseLink("https://example.com/b"));
    const insecure = await createDNAContext(parseLink("http://example.com/a"));
    expect(first.familyDigest).toEqual(second.familyDigest);
    expect(first.siteDigest).toEqual(second.siteDigest);
    expect(first.siteDigest).toEqual(insecure.siteDigest);
    expect(first.pageDigest).not.toEqual(second.pageDigest);
    expect(first.pageDigest).not.toEqual(insecure.pageDigest);
  });

  it("freezes the channel seed and sfc32-v1 sequence", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    expect(await dna.channelSeed("site", "seed/v1/material")).toEqual([
      3_859_631_081, 2_369_313_368, 3_985_471_602, 277_486_575,
    ]);
    const stream = await dna.channel("site", "seed/v1/material");
    expect([
      stream.nextUint32(),
      stream.nextUint32(),
      stream.nextUint32(),
      stream.nextUint32(),
    ]).toEqual([2_211_463_729, 4_160_855_592, 2_382_196_590, 1_221_163_826]);
  });

  it("returns defensive digest and seed copies", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    const original = dna.siteDigest[0];
    const digest = dna.siteDigest;
    digest[0] = (digest[0] ?? 0) ^ 255;
    expect(dna.siteDigest[0]).toBe(original);
    expect(await dna.channelSeed("site", "seed/v1/material")).not.toBe(
      await dna.channelSeed("site", "seed/v1/material"),
    );
  });

  it("rejects mutable or ambiguous channel labels", async () => {
    const dna = await createDNAContext(parseLink("https://example.com/"));
    await expect(dna.channel("site", "Tree Material")).rejects.toThrow("channel label");
    await expect(dna.channel("site", "a".repeat(129))).rejects.toThrow("channel label");
  });

  it("mixes family values only inside explicit bounds", () => {
    expect(mixFamily(0.8, 0.2, 0.75)).toBeCloseTo(0.65);
    expect(() => mixFamily(0.8, 0.2, 1.1)).toThrow("familyWeight");
  });
});
