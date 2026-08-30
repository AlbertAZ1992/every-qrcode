import { describe, expect, it } from "vitest";

describe("replaceRendererCanvas", () => {
  it("replaces a canvas before a renderer with another context type mounts", async () => {
    const modulePath = "./renderer-canvas";
    const canvasModule = await import(modulePath).catch(() => null);

    expect(canvasModule).not.toBeNull();
    if (!canvasModule) return;

    const replacement = { dataset: {} };
    let inserted: unknown;
    const original = {
      cloneNode: () => replacement,
      replaceWith: (next: unknown) => {
        inserted = next;
      },
    };
    const next = canvasModule.replaceRendererCanvas(original, "terrain");

    expect(next).toBe(replacement);
    expect(inserted).toBe(replacement);
    expect(replacement.dataset).toEqual({ everyQrcodeCanvas: "terrain" });
  });
});
