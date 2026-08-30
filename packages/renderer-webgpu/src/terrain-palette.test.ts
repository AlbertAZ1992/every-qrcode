import { describe, expect, it } from "vitest";

import { createTerrainPalette } from "./terrain-palette";
import type { SeedScenePalette } from "./renderer";

const THEME_PALETTE: SeedScenePalette = [
  [0.1, 0.72, 0.84],
  [0.52, 0.78, 0.3],
  [0.98, 0.63, 0.18],
  [0.24, 0.2, 0.4],
  [0.94, 0.9, 0.82],
];

function luminance(color: readonly [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

describe("createTerrainPalette", () => {
  it("maps a theme into stable terrain luminance roles", () => {
    const [water, shore, meadow, ridge, summit] = createTerrainPalette(THEME_PALETTE);

    expect(luminance(water)).toBeCloseTo(0.42, 2);
    expect(luminance(shore)).toBeCloseTo(0.68, 2);
    expect(luminance(meadow)).toBeCloseTo(0.54, 2);
    expect(luminance(ridge)).toBeCloseTo(0.34, 2);
    expect(luminance(summit)).toBeCloseTo(0.88, 2);
  });

  it("keeps the supplied theme as the source instead of returning fixed colors", () => {
    const alternate: SeedScenePalette = [
      [0.62, 0.24, 0.82],
      [0.88, 0.36, 0.62],
      [0.96, 0.8, 0.28],
      [0.18, 0.12, 0.3],
      [0.84, 0.8, 0.94],
    ];

    expect(createTerrainPalette(alternate)).not.toEqual(createTerrainPalette(THEME_PALETTE));
  });

  it("keeps every derived channel inside the display gamut", () => {
    const extreme: SeedScenePalette = [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    for (const color of createTerrainPalette(extreme)) {
      expect(color.every((channel) => channel >= 0 && channel <= 1)).toBe(true);
    }
  });
});
