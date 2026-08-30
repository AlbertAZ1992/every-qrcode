import type { SeedScenePalette } from "./renderer.js";

type Color = readonly [number, number, number];

export type TerrainScenePalette = readonly [Color, Color, Color, Color, Color];

function clamp(channel: number): number {
  return Math.max(0, Math.min(1, channel));
}

function luminance(color: Color): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function mix(left: Color, right: Color, amount: number): Color {
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
  ];
}

function saturate(color: Color, amount: number): Color {
  const gray = luminance(color);
  return [
    clamp(gray + (color[0] - gray) * amount),
    clamp(gray + (color[1] - gray) * amount),
    clamp(gray + (color[2] - gray) * amount),
  ];
}

function targetLuminance(color: Color, target: number): Color {
  const current = luminance(color);
  if (Math.abs(current - target) < 0.000_1) return color;
  if (current < target) {
    const amount = (target - current) / Math.max(0.000_1, 1 - current);
    return mix(color, [1, 1, 1], amount);
  }
  return mix(color, [0, 0, 0], (current - target) / Math.max(0.000_1, current));
}

function terrainTone(color: Color, target: number, saturation: number): Color {
  return targetLuminance(saturate(color, saturation), target);
}

export function createTerrainPalette(theme: SeedScenePalette): TerrainScenePalette {
  const [primary, secondary, third, fourth, fifth] = theme;
  return [
    terrainTone(mix(primary, fifth, 0.1), 0.42, 1.18),
    terrainTone(mix(third, fifth, 0.24), 0.68, 1.12),
    terrainTone(mix(secondary, fifth, 0.06), 0.54, 1.16),
    terrainTone(mix(secondary, fourth, 0.34), 0.34, 1.14),
    terrainTone(mix(fifth, [1, 1, 1], 0.42), 0.88, 1.04),
  ];
}
