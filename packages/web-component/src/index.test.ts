import { describe, expect, it } from "vitest";

import { defineEveryQRCodeElement, EVERY_QR_CODE_TAG } from "./index";

describe("defineEveryQRCodeElement", () => {
  it("is safe to import and call during server rendering", () => {
    expect(EVERY_QR_CODE_TAG).toBe("every-qr-code");
    expect(defineEveryQRCodeElement()).toBe(false);
  });
});
