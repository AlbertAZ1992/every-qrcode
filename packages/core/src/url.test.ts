import { describe, expect, it } from "vitest";

import { InvalidLinkError, UnsupportedVersionError } from "./errors";
import { parseLink } from "./url";

describe("parseLink", () => {
  it("adds HTTPS to a bare hostname", () => {
    expect(parseLink("example.com")).toMatchObject({
      displayHost: "example.com",
      familyIdentity: "example.com",
      pageIdentity: "https://example.com/",
      payloadUrl: "https://example.com/",
      scope: "site",
      siteIdentity: "example.com",
    });
  });

  it("retains path, query order, and fragment", () => {
    expect(parseLink("https://Example.com/a?b=2&a=1#part").payloadUrl).toBe(
      "https://example.com/a?b=2&a=1#part",
    );
  });

  it("accepts scheme-relative, localhost, IPv4, and IPv6 inputs", () => {
    expect(parseLink("//example.com/a").payloadUrl).toBe("https://example.com/a");
    expect(parseLink("localhost:8080").payloadUrl).toBe("https://localhost:8080/");
    expect(parseLink("127.0.0.1:3000").payloadUrl).toBe("https://127.0.0.1:3000/");
    expect(parseLink("[::1]:3000").payloadUrl).toBe("https://[::1]:3000/");
  });

  it("uses WHATWG serialization for Unicode and dot segments", () => {
    expect(parseLink("例子.测试/a/../路径").payloadUrl).toBe(
      "https://xn--fsqu00a.xn--0zwm56d/%E8%B7%AF%E5%BE%84",
    );
  });

  it("removes only default ports", () => {
    expect(parseLink("http://example.com:80").payloadUrl).toBe("http://example.com/");
    expect(parseLink("https://example.com:443").payloadUrl).toBe("https://example.com/");
    expect(parseLink("https://example.com:444").siteIdentity).toBe("example.com");
  });

  it("rejects non-web protocols", () => {
    expect(() => parseLink("javascript:alert(1)")).toThrow(InvalidLinkError);
  });

  it("rejects ambiguous text and credentials", () => {
    expect(() => parseLink("not a valid url")).toThrow("does not look valid");
    expect(() => parseLink("https://user:secret@example.com/")).toThrow("username or password");
  });

  it("accepts path spaces through WHATWG encoding", () => {
    expect(parseLink("https://example.com/a b").payloadUrl).toBe("https://example.com/a%20b");
  });

  it("enforces the identity protocol version and UTF-8 input limit", () => {
    expect(() => parseLink("example.com", { identityVersion: 2 })).toThrow(UnsupportedVersionError);
    expect(() => parseLink(`https://example.com/${"界".repeat(1400)}`)).toThrow("longer");
  });
});
