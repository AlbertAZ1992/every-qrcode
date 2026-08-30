import { describe, expect, it } from "vitest";

import { createEveryQRCodeIdentity } from "./identity";
import { parseLink } from "./url";

describe("site identity", () => {
  it("keeps one site DNA while preserving page-specific QR payloads", async () => {
    const first = await createEveryQRCodeIdentity("https://youtube.com/watch?v=video-A");
    const second = await createEveryQRCodeIdentity("https://youtube.com/watch?v=video-B");

    expect(first.dna.siteDigest).toBeInstanceOf(Uint8Array);
    expect(first.dna.siteDigest).toEqual(second.dna.siteDigest);
    expect(first.dna.pageDigest).not.toEqual(second.dna.pageDigest);
    expect(first.qr.cells).not.toEqual(second.qr.cells);
  });

  it("uses the public suffix list for domain families", () => {
    const blog = parseLink("https://blog.example.co.uk/article");
    const shop = parseLink("https://shop.example.co.uk/product");
    const project = parseLink("https://project.github.io/docs");

    expect(blog.familyIdentity).toBe("example.co.uk");
    expect(shop.familyIdentity).toBe(blog.familyIdentity);
    expect(blog.siteIdentity).not.toBe(shop.siteIdentity);
    expect(project.familyIdentity).toBe("project.github.io");
  });

  it("normalizes page imprints without changing the QR destination", () => {
    const link = parseLink("https://Example.com/article?utm_source=newsletter&b=2&a=1#details", {
      identityScope: "url",
    });

    expect(link.scope).toBe("url");
    expect(link.payloadUrl).toBe(
      "https://example.com/article?utm_source=newsletter&b=2&a=1#details",
    );
    expect(link.pageIdentity).toBe("https://example.com/article?a=1&b=2");
    expect(link.hasSensitiveQuery).toBe(false);
  });

  it("marks sensitive query data so products can block public sharing", () => {
    const link = parseLink("https://example.com/callback?access_token=secret&state=public");

    expect(link.hasSensitiveQuery).toBe(true);
  });
});
