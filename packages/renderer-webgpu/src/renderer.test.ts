import { createEveryQRCodeIdentity } from "@every-qrcode/core";
import { expect, it, vi } from "vitest";

import * as seedModel from "./seed-model";
import * as rendererModule from "./renderer";
import * as gpuSceneModule from "./gpu-scene";
import { createSeedGpuScene, type SeedGpuScene } from "./gpu-scene";
import { SEED_POST_SHADER, SEED_WEATHER_SHADER } from "./shared-shaders";
import { TERRAIN_SHADER } from "./terrain-shaders";
import {
  TREE_BLOCK_SHADER,
  TREE_BRANCH_SHADER,
  TREE_BUTTERFLY_SHADER,
  TREE_FALLING_PETAL_SHADER,
  TREE_FLOWER_SHADER,
  TREE_GRASS_SHADER,
} from "./tree-shaders";

function sceneDimensions(scene: SeedGpuScene): readonly [number, number, number] {
  const minimum = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const maximum = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let segment = 0; segment < scene.segmentCount; segment++) {
    const offset = segment * 12;
    for (const pointOffset of [0, 4]) {
      for (let axis = 0; axis < 3; axis++) {
        const value = scene.segments[offset + pointOffset + axis];
        if (value === undefined) throw new RangeError("Segment coordinate");
        minimum[axis] = Math.min(minimum[axis] ?? value, value);
        maximum[axis] = Math.max(maximum[axis] ?? value, value);
      }
    }
  }
  return [0, 1, 2].map((axis) => (maximum[axis] ?? 0) - (minimum[axis] ?? 0)) as [
    number,
    number,
    number,
  ];
}

it("reports WebGPU initialization failures to adapters", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const onError = vi.fn();
  const identity = await createEveryQRCodeIdentity("https://example.com/fallback");
  const model = await seedModel.createSeedModel(identity);

  try {
    rendererModule.mountSeed({ dataset: {} } as HTMLCanvasElement, model, {}, "tree", { onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0]?.[0]).toEqual(new Error("This browser does not support WebGPU"));
  } finally {
    consoleError.mockRestore();
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

function flowerHeightQuantile(scene: SeedGpuScene, quantile: number): number {
  const heights = Array.from({ length: scene.flowerCount }, (_, index) => {
    const height = scene.flowers[index * 4 + 2];
    if (height === undefined) throw new RangeError("Flower height");
    return height;
  }).sort((left, right) => left - right);
  return heights[Math.min(heights.length - 1, Math.floor(heights.length * quantile))] ?? 0;
}

function flowerFootprint(scene: SeedGpuScene): readonly [number, number] {
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = Number.NEGATIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < scene.flowerCount; index++) {
    const offset = index * 4;
    const column = scene.flowers[offset] ?? 0;
    const row = scene.flowers[offset + 1] ?? 0;
    minColumn = Math.min(minColumn, column);
    maxColumn = Math.max(maxColumn, column);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }
  return [
    (maxColumn - minColumn) * seedModel.SEED_BLOCK_SIZE,
    (maxRow - minRow) * seedModel.SEED_BLOCK_SIZE,
  ];
}

it("builds one stable WebGPU base column for every QR cell", async () => {
  const createField = Reflect.get(seedModel, "createSeedBlockField");
  expect(createField).toBeTypeOf("function");
  if (typeof createField !== "function") return;

  const identity = await createEveryQRCodeIdentity("https://example.com/webgpu-field");
  const model = await seedModel.createSeedModel(identity);
  const field = createField(model);
  const baseCells = field.blocks.filter((block: { layer: number }) => block.layer === 0);
  const darkIndices = new Set(model.modules.map((module) => module.index));
  const coloredIndices = new Set(
    baseCells
      .filter((block: { type: number }) => block.type !== seedModel.SEED_BLOCK_TYPES.dirt)
      .map((block: { column: number; row: number }) => block.row * model.qrSize + block.column),
  );

  expect(baseCells).toHaveLength(model.qrSize * model.qrSize);
  expect(coloredIndices).toEqual(darkIndices);
  expect(
    new Set(
      baseCells
        .filter((block: { type: number }) => block.type !== seedModel.SEED_BLOCK_TYPES.dirt)
        .map((block: { type: number }) => block.type),
    ).size,
  ).toBeGreaterThan(1);
  expect(
    new Set(
      baseCells.map((block: { column: number; row: number }) => `${block.column}:${block.row}`),
    ),
  ).toHaveLength(model.qrSize * model.qrSize);
  expect(field.positions).toHaveLength(field.blocks.length * 4);
  expect(field.baseY).toHaveLength(field.blocks.length);
  expect(field.types).toHaveLength(field.blocks.length);
});

it("keeps the canonical QR field unchanged for the terrain upper form", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/shared-qr-morph");
  const model = await seedModel.createSeedModel(identity);
  const tree = seedModel.createSeedBlockField(model, "tree");
  const field = seedModel.createSeedBlockField(model, "terrain");
  const baseBlocks = field.blocks.filter((block) => block.layer === 0);

  const signature = (block: (typeof baseBlocks)[number]): readonly number[] => [
    block.column,
    block.row,
    block.baseY,
    block.type,
  ];
  expect(baseBlocks.map(signature)).toEqual(
    tree.blocks.filter((block) => block.layer === 0).map(signature),
  );
  expect(field.blocks).toHaveLength(model.qrSize * model.qrSize);
});

it("uses a normalized QR-derived terrain height field", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/upper-form-only");
  const model = await seedModel.createSeedModel(identity);
  const terrainScene = createSeedGpuScene(model, "terrain");
  const terrain = seedModel.createSeedBlockField(model, "terrain");

  expect(terrainScene.flowerCount).toBe(0);
  expect(terrainScene.segmentCount).toBe(0);
  expect(Math.max(...terrain.heights)).toBeGreaterThan(0.7);
  expect(Math.min(...terrain.heights)).toBe(0);
  expect(TERRAIN_SHADER).toContain("@builtin(instance_index) instanceIndex");
  expect(TERRAIN_SHADER).toContain("fn terrainBandColor");
  expect(TERRAIN_SHADER).toContain("fn terrainShadow");
});

it("settles the terrain morph with a critically damped spring", () => {
  let position = 0;
  let velocity = 0;
  for (let frame = 0; frame < 90; frame += 1) {
    [position, velocity] = rendererModule.stepTerrainSpring(position, velocity, 1, 1 / 60);
    expect(position).toBeGreaterThanOrEqual(0);
    expect(position).toBeLessThanOrEqual(1);
  }
  expect(position).toBeCloseTo(1, 3);
  expect(Math.abs(velocity)).toBeLessThan(0.01);
});

it("does not declare WGSL reserved words as terrain locals", () => {
  expect(TERRAIN_SHADER).not.toMatch(/\b(?:let|var|const)\s+active\b/);
});

it("declares terrain QR color mutable before shading its side faces", () => {
  expect(TERRAIN_SHADER).toContain("var qrColor = mix(");
  expect(TERRAIN_SHADER).not.toContain("let qrColor = mix(");
});

it("uses bright semantic terrain bands instead of shadow-colored rock strata", () => {
  expect(TERRAIN_SHADER).toContain("terrainWater: vec4f");
  expect(TERRAIN_SHADER).toContain("terrainShore: vec4f");
  expect(TERRAIN_SHADER).toContain("terrainMeadow: vec4f");
  expect(TERRAIN_SHADER).toContain("terrainRidge: vec4f");
  expect(TERRAIN_SHADER).toContain("terrainSummit: vec4f");
  expect(TERRAIN_SHADER).toContain("let water = uniforms.terrainWater.rgb");
  expect(TERRAIN_SHADER).toContain("let summit = uniforms.terrainSummit.rgb");
  expect(TERRAIN_SHADER).toContain("return max(shadow, 0.74);");
  expect(TERRAIN_SHADER).toContain("input.valleyOcclusion * 0.18");
  expect(TERRAIN_SHADER).not.toContain(
    "mix(uniforms.themeFifth.rgb, uniforms.themeFourth.rgb, 0.5)",
  );
});

it("uses a lifted terrain profile instead of a shallow terrain slab", () => {
  expect(TERRAIN_SHADER).toContain("fn terrainReliefProfile");
  expect(TERRAIN_SHADER).toContain("pow(heightValue, 0.72) * 12.6");
  expect(TERRAIN_SHADER).not.toContain("pow(heightValue, 0.88) * 10.8");
});

it("allocates one complete vec4 for empty GPU storage fields", () => {
  const minimumStorageBufferByteLength = Reflect.get(
    rendererModule,
    "minimumStorageBufferByteLength",
  );
  expect(minimumStorageBufferByteLength).toBeTypeOf("function");
  if (typeof minimumStorageBufferByteLength !== "function") return;

  expect(minimumStorageBufferByteLength(0)).toBe(16);
  expect(minimumStorageBufferByteLength(4)).toBe(16);
  expect(minimumStorageBufferByteLength(32)).toBe(32);
});

it("keeps every raised layer on its original QR column", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/fixed-qr-columns");
  const model = await seedModel.createSeedModel(identity);
  const field = seedModel.createSeedBlockField(model);
  const baseColumns = new Set(
    field.blocks
      .filter((block) => block.layer === 0)
      .map((block) => `${block.column}:${block.row}`),
  );

  for (const block of field.blocks) {
    const offset = block.index * 4;
    expect(baseColumns).toContain(`${block.column}:${block.row}`);
    expect(field.positions[offset]).toBe(block.column);
    expect(field.positions[offset + 1]).toBe(block.row);
    expect(field.positions[offset + 2]).toBe(0);
  }
});

it("packs QR neighbors so connected runs render as rounded capsules", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/rounded-qr-runs");
  const model = await seedModel.createSeedModel(identity);
  const field = seedModel.createSeedBlockField(model);
  const activeIndices = new Set(model.modules.map((module) => module.index));
  const verticalCell = field.blocks.find((block) => {
    if (block.layer !== 0 || block.type === seedModel.SEED_BLOCK_TYPES.dirt) return false;
    const index = block.row * model.qrSize + block.column;
    return activeIndices.has(index - model.qrSize) && activeIndices.has(index + model.qrSize);
  });

  expect(verticalCell).toBeDefined();
  if (!verticalCell) return;
  const neighborMask = field.positions[verticalCell.index * 4 + 3] ?? 0;
  expect(neighborMask & 1).toBe(1);
  expect(neighborMask & 4).toBe(4);
  expect(TREE_BLOCK_SHADER).toContain("fn qrModuleMask");
  expect(TREE_BLOCK_SHADER).toContain("qrModuleMask(input.uv, input.neighborMask)");
  expect(TREE_BLOCK_SHADER).toContain("abs(normal.y) > 0.5");
});

it("extrudes stable QR columns before the semantic tree appears", async () => {
  const createField = Reflect.get(seedModel, "createSeedBlockField");
  expect(createField).toBeTypeOf("function");
  if (typeof createField !== "function") return;

  const identity = await createEveryQRCodeIdentity("https://example.com/webgpu-layers");
  const model = await seedModel.createSeedModel(identity);
  const field = createField(model);
  const stacked = field.blocks.filter((block: { layer: number }) => block.layer > 0);
  const scene = createSeedGpuScene(model);
  const grassCells = new Set(
    field.blocks
      .filter(
        (block: { layer: number; type: number }) =>
          block.layer === 0 && block.type === seedModel.SEED_BLOCK_TYPES.grass,
      )
      .map((block: { column: number; row: number }) => `${block.column}:${block.row}`),
  );

  expect(stacked.length).toBeGreaterThan(model.modules.length);
  expect(scene.segmentCount).toBeGreaterThan(60);
  expect(scene.flowerCount).toBeGreaterThan(1_200);
  expect(scene.grassCount).toBeGreaterThan(8);
  expect(scene.leafCount).toBeLessThan(scene.blossomCount);
  expect(scene.segments).toHaveLength(scene.segmentCount * 12);
  expect(scene.flowers).toHaveLength(scene.flowerCount * 4);
  expect(scene.grass).toHaveLength(scene.grassCount * 4);
  expect(scene.groundPetals).toHaveLength(scene.groundPetalCount * 4);
  expect(scene.fallingPetals).toHaveLength(scene.fallingPetalCount * 4);
  for (let index = 0; index < scene.grassCount; index++) {
    const offset = index * 4;
    expect(grassCells).toContain(
      `${Math.round(scene.grass[offset] ?? 0)}:${Math.round(scene.grass[offset + 1] ?? 0)}`,
    );
  }
});

it("bakes static ground petals and dynamic canopy emitters as separate elements", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/petal-lifecycle");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);

  expect(scene.groundPetalCount).toBeGreaterThanOrEqual(70);
  expect(scene.groundPetalCount).toBeLessThanOrEqual(100);
  expect(scene.fallingPetalCount).toBe(10);
  for (let index = 0; index < scene.groundPetalCount; index++) {
    expect(scene.groundPetals[index * 4 + 2]).toBeLessThan(seedModel.SEED_BLOCK_SIZE * 1.2);
  }
  for (let index = 0; index < scene.fallingPetalCount; index++) {
    expect(scene.fallingPetals[index * 4 + 2]).toBeGreaterThan(seedModel.SEED_BLOCK_SIZE * 4);
  }
});

it("builds a dense crown from branch-tip clusters and surface fill", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/reference-canopy-density");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);

  expect(scene.flowerCount).toBeGreaterThan(1_500);
  expect(scene.flowerCount).toBeLessThan(12_000);
  expect(scene.blossomCount).toBeGreaterThan(scene.leafCount * 10);
});

it("preserves a broad canopy and a visibly raised tree", async () => {
  const identity = await createEveryQRCodeIdentity("https://bai22222du.com");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);
  const [width, height, depth] = sceneDimensions(scene);
  const groundWidth = model.qrSize * seedModel.SEED_BLOCK_SIZE;

  const minimumSpread = model.archetype === "conifer" ? 0.5 : 0.6;
  expect(Math.min(width, depth), model.archetype).toBeGreaterThan(groundWidth * minimumSpread);
  expect(height, model.archetype).toBeGreaterThan(groundWidth * 0.5);
});

it("replaces the absorbed QR volume with a continuous flower surface", async () => {
  const identity = await createEveryQRCodeIdentity("https://bai22222du.com");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);
  const occupiedCells = new Set<string>();
  for (let organ = 0; organ < scene.flowerCount; organ++) {
    const offset = organ * 4;
    occupiedCells.add(
      `${Math.round(scene.flowers[offset] ?? 0)}:${Math.round(scene.flowers[offset + 1] ?? 0)}`,
    );
  }

  const center = model.qrSize / 2;
  const radiusSquared = (model.qrSize * 0.46) ** 2;
  let canopyCells = 0;
  let coveredCells = 0;
  for (let row = 0; row < model.qrSize; row++) {
    for (let column = 0; column < model.qrSize; column++) {
      const distanceSquared = (column - center) ** 2 + (row - center) ** 2;
      if (distanceSquared >= radiusSquared || distanceSquared < 6.25) continue;
      canopyCells++;
      if (occupiedCells.has(`${column}:${row}`)) coveredCells++;
    }
  }

  const minimumCoverage = model.archetype === "conifer" ? 0.5 : 0.62;
  expect(coveredCells / canopyCells, model.archetype).toBeGreaterThan(minimumCoverage);
});

it("uses organic sub-cell offsets instead of a flat QR-cell canopy", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/reference-organ-offsets");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);
  let fractionalCount = 0;
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  for (let organ = 0; organ < scene.flowerCount; organ++) {
    const offset = organ * 4;
    const column = scene.flowers[offset] ?? 0;
    const row = scene.flowers[offset + 1] ?? 0;
    const height = scene.flowers[offset + 2] ?? 0;
    if (Math.abs(column - Math.round(column)) > 0.02) fractionalCount++;
    if (Math.abs(row - Math.round(row)) > 0.02) fractionalCount++;
    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
  }

  expect(fractionalCount).toBeGreaterThan(scene.flowerCount);
  expect(maxHeight - minHeight).toBeGreaterThan(seedModel.SEED_BLOCK_SIZE * 8);
});

it("keeps every DNA-shaped branch inside the QR-anchored organ envelope", async () => {
  const urls = ["https://example.com", "https://neu.salon/zh-cn"];
  for (const url of urls) {
    const model = await seedModel.createSeedModel(await createEveryQRCodeIdentity(url));
    const scene = createSeedGpuScene(model);
    const halfGrid = model.qrSize * seedModel.SEED_BLOCK_SIZE * 0.5;
    let organRadius = 0;
    let organTop = 0;
    for (let organ = 0; organ < scene.flowerCount; organ++) {
      const offset = organ * 4;
      const x = (scene.flowers[offset] ?? 0) * seedModel.SEED_BLOCK_SIZE - halfGrid;
      const z = (scene.flowers[offset + 1] ?? 0) * seedModel.SEED_BLOCK_SIZE - halfGrid;
      organRadius = Math.max(organRadius, Math.hypot(x, z));
      organTop = Math.max(organTop, scene.flowers[offset + 2] ?? 0);
    }
    for (let segment = 0; segment < scene.segmentCount; segment++) {
      const offset = segment * 12;
      for (const pointOffset of [0, 4]) {
        const x = scene.segments[offset + pointOffset] ?? 0;
        const y = scene.segments[offset + pointOffset + 1] ?? 0;
        const z = scene.segments[offset + pointOffset + 2] ?? 0;
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(organRadius * 1.05);
        expect(y).toBeLessThanOrEqual(organTop);
      }
    }
  }
});

it("builds large flowers and leaves from smooth four-segment surface strips", () => {
  expect(TREE_FLOWER_SHADER).toContain("blockSize * (0.84 + seed * 0.3)");
  expect(TREE_FLOWER_SHADER).toContain("let petalIndex = localIndex / 24u");
  expect(TREE_FLOWER_SHADER).toContain("let petalT = f32(rowIndex) * 0.25");
  expect(TREE_FLOWER_SHADER).toContain("let segmentIndex = petalVertex / 6u");
  expect(TREE_FLOWER_SHADER).toContain("sin(petalT * 3.14159)");
  expect(TREE_FLOWER_SHADER).toContain("sqrt(1.0 - petalT * 0.3)");
  expect(TREE_FLOWER_SHADER).toContain("isLeaf > 0.5 && petalIndex >= 3u");
  expect(TREE_FLOWER_SHADER).not.toContain("flowerOutline");
  expect(TREE_FLOWER_SHADER).not.toContain("leafOutline");
  expect(TREE_FLOWER_SHADER).toContain("mix(vec3f(gray), color, 1.9)");
});

it("adds a restrained hanging fringe to common broadleaf crowns", () => {
  const supportsCanopyFringe = Reflect.get(gpuSceneModule, "supportsCanopyFringe");
  expect(supportsCanopyFringe).toBeTypeOf("function");
  if (typeof supportsCanopyFringe !== "function") return;

  expect(supportsCanopyFringe("round")).toBe(true);
  expect(supportsCanopyFringe("umbrella")).toBe(true);
  expect(supportsCanopyFringe("cloud")).toBe(true);
  expect(supportsCanopyFringe("conifer")).toBe(false);
});

it("leaves small grouped gaps inside the crown without thinning its outline", () => {
  const gapRate = Reflect.get(gpuSceneModule, "CANOPY_GAP_RATE");
  const columnGapRate = Reflect.get(gpuSceneModule, "CANOPY_COLUMN_GAP_RATE");
  expect(gapRate).toBeGreaterThanOrEqual(0.08);
  expect(gapRate).toBeLessThanOrEqual(0.11);
  expect(columnGapRate).toBeGreaterThanOrEqual(0.12);
  expect(columnGapRate).toBeLessThanOrEqual(0.15);
  expect(TREE_FLOWER_SHADER).toContain("let densityVisibility");
  expect(TREE_FLOWER_SHADER).toContain("let interiorMask");
  expect(TREE_FLOWER_SHADER).toContain("/ 2.0");
  expect(TREE_FLOWER_SHADER).toContain("uniforms.flowerHue * 91.37");
  expect(TREE_FLOWER_SHADER).toContain("step(0.10, gapSample)");
});

it("keeps the base trunk shorter than the crown", () => {
  const baseTrunkHeight = Reflect.get(gpuSceneModule, "baseTrunkHeight");
  expect(baseTrunkHeight).toBeTypeOf("function");
  if (typeof baseTrunkHeight !== "function") return;

  expect(baseTrunkHeight(0.5, 1)).toBeCloseTo(0.325);
});

it("clamps interactive tree zoom to a useful viewing range", () => {
  const clampSeedZoom = Reflect.get(rendererModule, "clampSeedZoom");
  expect(clampSeedZoom).toBeTypeOf("function");
  if (typeof clampSeedZoom !== "function") return;

  expect(clampSeedZoom(0.4)).toBe(0.82);
  expect(clampSeedZoom(1.25)).toBe(1.25);
  expect(clampSeedZoom(2)).toBe(1.45);
});

it("closes both triangles in every branch and organ surface quad", () => {
  const closingVertex = "triangleVertex == 1u || triangleVertex == 4u || triangleVertex == 5u";
  expect(TREE_BRANCH_SHADER).toContain(closingVertex);
  expect(TREE_FLOWER_SHADER).toContain(closingVertex);
  expect(TREE_FALLING_PETAL_SHADER).toContain(closingVertex);
});

it("builds a deep canopy from both the theme primary and accent colors", () => {
  expect(TREE_FLOWER_SHADER).toContain("fn themeFlower");
  expect(TREE_FLOWER_SHADER).toContain("uniforms.themePrimary.rgb");
  expect(TREE_FLOWER_SHADER).toContain("uniforms.themeSecondary.rgb");
  expect(TREE_FLOWER_SHADER).toContain("themeInk()");
  expect(TREE_FLOWER_SHADER).toContain("let exposed = lit * 0.9");
  expect(TREE_FLOWER_SHADER).not.toContain("vec3f(1.0, 0.55, 0.65)");
  expect(TREE_FLOWER_SHADER).not.toContain("vec3f(0.6, 0.8, 0.4)");
});

it("separates neighboring canopy organs into deterministic tonal layers", () => {
  expect(TREE_FLOWER_SHADER).toContain("let flowerMain");
  expect(TREE_FLOWER_SHADER).toContain("let flowerDeep");
  expect(TREE_FLOWER_SHADER).toContain("let clusterShade");
  expect(TREE_FLOWER_SHADER).toContain("mix(0.78, 1.0");
  expect(TREE_FLOWER_SHADER).not.toContain("let flowerLight");
});

it("themes the ground cover as part of the same five-color world", () => {
  expect(TREE_GRASS_SHADER).toContain("fn themeGrass");
  expect(TREE_GRASS_SHADER).toContain("uniforms.themeSecondary.rgb");
  expect(TREE_GRASS_SHADER).toContain("uniforms.themeFourth.rgb");
  expect(TREE_GRASS_SHADER).not.toContain("let darkGreen = vec3f(0.12, 0.32, 0.06)");
  expect(TREE_GRASS_SHADER).toContain("let bladeIndex = vertexIndex / verticesPerBlade");
  expect(TREE_GRASS_SHADER).toContain("let bladeHeight = blockSize * data.w");
  expect(TREE_GRASS_SHADER).toContain("let halfWidth = blockSize * 0.22");
});

it("keeps scene effects independent from all theme-colored materials", () => {
  expect(TREE_FLOWER_SHADER).toContain("uniforms.themePrimary.rgb");
  expect(TREE_GRASS_SHADER).toContain("uniforms.themeSecondary.rgb");
  expect(TREE_FLOWER_SHADER).not.toContain("seasonSummer()");
  expect(TREE_FLOWER_SHADER).not.toContain("seasonAutumn()");
  expect(TREE_GRASS_SHADER).not.toContain("seasonAutumn()");
});

it("animates falling petals independently from static flower geometry", () => {
  expect(TREE_FALLING_PETAL_SHADER).toContain("let cycle = fract(");
  expect(TREE_FALLING_PETAL_SHADER).toContain("mix(data.z, groundY, fallT)");
  expect(TREE_FALLING_PETAL_SHADER).toContain("themeFlower(tier)");
});

it("builds the reference-sized weather and animal fields once per Link DNA", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/season-fields");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model);

  expect(scene.rainCount).toBe(500);
  expect(scene.rain).toHaveLength(2_000);
  expect(scene.butterflyCount).toBe(10);
  expect(scene.butterflies).toHaveLength(40);
});

it("keeps deterministic rain and snow particles for terrain worlds", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/terrain-weather");
  const model = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene(model, "terrain");

  expect(scene.rainCount).toBe(500);
  expect(scene.rain).toHaveLength(2_000);
  expect(scene.butterflyCount).toBe(0);
  expect(TERRAIN_SHADER).toContain("fn sceneSnow");
  expect(TERRAIN_SHADER).toContain("let snowCover = sceneSnow()");
});

it("renders wind, rain, and snow as independent scene effects", () => {
  const effectCode = Reflect.get(rendererModule, "seedSceneEffectCode");
  expect(effectCode).toBeTypeOf("function");
  if (typeof effectCode !== "function") return;

  expect(effectCode("calm")).toBe(3);
  expect(effectCode("wind")).toBe(0);
  expect(SEED_WEATHER_SHADER).toContain("sceneRain()");
  expect(SEED_WEATHER_SHADER).toContain("sceneSnow()");
  expect(SEED_WEATHER_SHADER).toContain("mix(0.015 * cycle, 0.0, snow)");
  expect(SEED_WEATHER_SHADER).toContain("themeSnow()");
  expect(SEED_WEATHER_SHADER).toContain("let detailedFlake");
  expect(TREE_BLOCK_SHADER).toContain("snowPatch = 0.68 + noiseC * 0.2");
  expect(TREE_GRASS_SHADER).toContain("input.bladeT) * 0.78");
  expect(TREE_FALLING_PETAL_SHADER).toContain("sceneWind()");
  expect(TREE_FALLING_PETAL_SHADER).toContain("let windTravelX");
  expect(TREE_BUTTERFLY_SHADER).toContain("sceneWind()");
  expect(TREE_BRANCH_SHADER).toContain("sceneBranchBreeze()");
  expect(TREE_BRANCH_SHADER).toContain("sceneWind() * 0.42 + sceneRain() * 0.08");
  expect(TREE_FLOWER_SHADER).toContain("sceneWind() * 0.72 + sceneRain() * 0.12");
});

it("loads only the shader bundle for the selected renderer model", async () => {
  const loadShaderSources = Reflect.get(rendererModule, "loadSeedShaderSources");
  expect(loadShaderSources).toBeTypeOf("function");
  if (typeof loadShaderSources !== "function") return;

  const tree = await loadShaderSources("tree");
  const terrain = await loadShaderSources("terrain");

  expect(tree).toMatchObject({ form: "tree" });
  expect(tree).toHaveProperty("blocks");
  expect(tree).not.toHaveProperty("terrain");
  expect(terrain).toMatchObject({ form: "terrain" });
  expect(terrain).toHaveProperty("terrain");
  expect(terrain).not.toHaveProperty("blocks");
});

it("keeps gallery archetypes visibly different instead of flattening every crown", async () => {
  const cases = [
    ["https://www.albertaz.com", "cloud", 0.62],
    ["https://wikipedia.org", "conifer", 0.92],
    ["https://cloudflare.com", "round", 0.68],
  ] as const;

  for (const [url, archetype, minimumAspect] of cases) {
    const identity = await createEveryQRCodeIdentity(url, { identityScope: "site" });
    const model = await seedModel.createSeedModel(identity);
    const scene = createSeedGpuScene(model);
    const [width, height] = flowerFootprint(scene);
    const canopyHeight = flowerHeightQuantile(scene, 0.99) - flowerHeightQuantile(scene, 0.01);

    expect(model.archetype).toBe(archetype);
    expect(canopyHeight / width, archetype).toBeGreaterThan(minimumAspect);
    expect(height, archetype).toBeGreaterThan(width * 0.55);
  }
});

it("uses the gallery-sized tree framing without changing the QR endpoint", () => {
  expect(TREE_BLOCK_SHADER).toContain("mix(41.5, 46.4, progress)");
});

it("maps flat QR colors to the center, ground, and grass module layers", () => {
  expect(TREE_BLOCK_SHADER).toContain("fn themeQr");
  expect(TREE_BLOCK_SHADER).not.toContain("0.36 / max(luminance");
  expect(TREE_BLOCK_SHADER).toContain("smoothstep(0.78, 0.96, luminance) * 0.12");
  expect(TREE_BLOCK_SHADER).toContain("hue = uniforms.themePrimary.rgb");
  expect(TREE_BLOCK_SHADER).toContain("hue = uniforms.themeSecondary.rgb");
  expect(TREE_BLOCK_SHADER).toContain("hue = uniforms.themeFourth.rgb");
  expect(TREE_BLOCK_SHADER).toContain("blockType == 3u");
  expect(TREE_BLOCK_SHADER).toContain("blockType == 4u");
  expect(TREE_BLOCK_SHADER).toContain("themeQr(input.blockType, noiseA)");
  expect(TREE_BLOCK_SHADER).not.toContain("fn qrSeedMask");
});

it("uses separate theme roles for the ground and canopy", () => {
  expect(TREE_BLOCK_SHADER).toContain(
    "mix(uniforms.themeFifth.rgb, uniforms.themeThird.rgb, 0.42)",
  );
  expect(TREE_BLOCK_SHADER).toContain("let dirtMid = mix(groundBase, uniforms.themeThird.rgb");
  expect(TREE_BLOCK_SHADER).toContain("let middle = themeFlower(noiseB)");
});

it("preserves scene alpha through the post-processing pass", () => {
  expect(SEED_POST_SHADER).toContain("color.a");
  expect(SEED_POST_SHADER).not.toContain("vec4f(color.rgb * vignette, 1.0)");
});

it("keeps Link DNA tree growth stable across repeated generation", async () => {
  const identity = await createEveryQRCodeIdentity("https://example.com/stable-tree-dna");
  const firstModel = await seedModel.createSeedModel(identity);
  const secondModel = await seedModel.createSeedModel(identity);
  const otherModel = await seedModel.createSeedModel(
    await createEveryQRCodeIdentity("https://different-tree.world"),
  );
  const first = createSeedGpuScene(firstModel);
  const second = createSeedGpuScene(secondModel);
  const other = createSeedGpuScene(otherModel);

  expect(second.segments).toEqual(first.segments);
  expect(second.flowers).toEqual(first.flowers);
  expect(second.grass).toEqual(first.grass);
  expect(second.groundPetals).toEqual(first.groundPetals);
  expect(second.fallingPetals).toEqual(first.fallingPetals);
  expect(second.rain).toEqual(first.rain);
  expect(second.butterflies).toEqual(first.butterflies);
  expect(other.segments).not.toEqual(first.segments);
  expect(other.grass).not.toEqual(first.grass);
  const firstDimensions = sceneDimensions(first);
  const dimensionChanges = sceneDimensions(other).map((dimension, index) =>
    Math.abs(dimension - (firstDimensions[index] ?? dimension)),
  );
  expect(Math.max(...dimensionChanges)).toBeGreaterThan(0.04);
});

it("grows visibly different silhouettes for distinct site DNA", async () => {
  const urls = [
    "https://github.com",
    "https://wikipedia.org",
    "https://openai.com",
    "https://cloudflare.com",
    "https://react.dev",
    "https://vite.dev",
    "https://typescriptlang.org",
    "https://npmjs.com",
    "https://vercel.com",
    "https://mozilla.org",
  ];
  const scenes = await Promise.all(
    urls.map(async (url) =>
      createSeedGpuScene(await seedModel.createSeedModel(await createEveryQRCodeIdentity(url))),
    ),
  );
  const dimensions = scenes.map(sceneDimensions);
  const widths = dimensions.map(([width]) => width);
  const heights = dimensions.map(([, height]) => height);
  const depths = dimensions.map(([, , depth]) => depth);
  const silhouettes = dimensions.map(([width, height, depth]) =>
    [width, height, depth].map((value) => value.toFixed(2)).join(":"),
  );

  expect(new Set(silhouettes).size).toBeGreaterThanOrEqual(7);
  expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.22);
  expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(1.25);
  expect(Math.max(...depths) / Math.min(...depths)).toBeGreaterThan(1.22);
  expect(new Set(scenes.map((scene) => scene.segmentCount)).size).toBeGreaterThanOrEqual(4);
});

it("uses distinct supported growth grammars for each tree archetype", async () => {
  const identity = await createEveryQRCodeIdentity("https://archetype-reference.com");
  const base = await seedModel.createSeedModel(identity);
  const scenes = new Map(
    seedModel.TREE_ARCHETYPES.map((archetype) => [
      archetype,
      createSeedGpuScene({ ...base, archetype }),
    ]),
  );
  const conifer = scenes.get("conifer");
  const umbrella = scenes.get("umbrella");
  const banana = scenes.get("banana");
  const round = scenes.get("round");
  const multiTrunk = scenes.get("multi-trunk");
  if (!conifer || !umbrella || !banana || !round || !multiTrunk) {
    throw new RangeError("Archetype scene");
  }

  const [coniferWidth, coniferHeight] = sceneDimensions(conifer);
  const [umbrellaWidth, umbrellaHeight] = sceneDimensions(umbrella);
  expect(coniferHeight / coniferWidth).toBeGreaterThan(umbrellaHeight / umbrellaWidth + 0.22);
  expect(umbrellaWidth).toBeGreaterThan(coniferWidth * 1.12);
  expect(banana.segmentCount).toBeLessThan(round.segmentCount * 0.72);
  expect(new Set([...scenes.values()].map((scene) => scene.segmentCount)).size).toBeGreaterThan(5);

  const groundStarts = new Set<string>();
  const sharedStarts = new Map<string, number>();
  for (let index = 0; index < multiTrunk.segmentCount; index++) {
    const offset = index * 12;
    const startY = multiTrunk.segments[offset + 1] ?? 1;
    const depth = multiTrunk.segments[offset + 8] ?? 1;
    if (depth !== 0) continue;
    const x = multiTrunk.segments[offset] ?? 0;
    const z = multiTrunk.segments[offset + 2] ?? 0;
    const key = `${x.toFixed(2)}:${startY.toFixed(2)}:${z.toFixed(2)}`;
    if (startY <= 0.04) groundStarts.add(key);
    else sharedStarts.set(key, (sharedStarts.get(key) ?? 0) + 1);
  }
  expect(groundStarts.size).toBe(1);
  expect(Math.max(...sharedStarts.values())).toBeGreaterThanOrEqual(2);
  expect(Math.max(...sharedStarts.values())).toBeLessThanOrEqual(3);
});

it("keeps gallery trees upright with crowns lifted above the ground", async () => {
  const domains = [
    "www.albertaz.com",
    "example.com",
    "tes.com",
    "github.com",
    "wikipedia.org",
    "openai.com",
    "cloudflare.com",
    "react.dev",
    "vite.dev",
    "typescriptlang.org",
    "npmjs.com",
    "vercel.com",
  ];
  for (const domain of domains) {
    const model = await seedModel.createSeedModel(
      await createEveryQRCodeIdentity(`https://${domain}`),
    );
    const scene = createSeedGpuScene(model);
    const [width, depth] = flowerFootprint(scene);
    const groundWidth = model.qrSize * seedModel.SEED_BLOCK_SIZE;
    const flowerBottom = flowerHeightQuantile(scene, 0.05);
    const flowerTop = flowerHeightQuantile(scene, 0.95);

    expect(flowerTop, domain).toBeGreaterThan(groundWidth * 0.68);
    expect(flowerTop / Math.max(width, depth), domain).toBeGreaterThan(0.68);
    if (model.archetype !== "conifer" && model.archetype !== "willow") {
      expect(flowerBottom, domain).toBeGreaterThan(groundWidth * 0.3);
    }
  }
});

it("renders the round archetype as an upright classic rounded crown", async () => {
  const model = await seedModel.createSeedModel(
    await createEveryQRCodeIdentity("https://openai.com"),
  );
  const scene = createSeedGpuScene(model);
  const [width, depth] = flowerFootprint(scene);
  const canopyHeight = flowerHeightQuantile(scene, 0.99) - flowerHeightQuantile(scene, 0.01);
  const groundWidth = model.qrSize * seedModel.SEED_BLOCK_SIZE;
  const canopyAspect = canopyHeight / Math.max(width, depth);
  const topTail = flowerHeightQuantile(scene, 0.99) - flowerHeightQuantile(scene, 0.9);

  expect(model.archetype).toBe("round");
  expect(canopyAspect).toBeGreaterThan(0.68);
  expect(canopyAspect).toBeLessThan(0.9);
  expect(topTail).toBeLessThan(groundWidth * 0.105);
  expect(flowerHeightQuantile(scene, 0.02)).toBeGreaterThan(groundWidth * 0.38);
});

it("renders banana trees with broad radial fronds instead of a blossom mound", async () => {
  const identity = await createEveryQRCodeIdentity("https://banana-reference.com");
  const base = await seedModel.createSeedModel(identity);
  const scene = createSeedGpuScene({ ...base, archetype: "banana" });
  const fronds = Array.from({ length: scene.flowerCount }, (_, index) => {
    return scene.flowers[index * 4 + 3] ?? 0;
  }).filter((seed) => seed >= 5 && seed < 6);

  expect(fronds.length).toBeGreaterThan(400);
  expect(scene.leafCount).toBeGreaterThan(scene.blossomCount);
  expect(TREE_FLOWER_SHADER).toContain("let isFrond = step(5.0, rawSeed)");
});

it("keeps every archetype lush without isolated flower towers", async () => {
  const urls = Array.from({ length: 48 }, (_, index) => `https://healthy-${index}.example.com`);
  for (const url of urls) {
    const model = await seedModel.createSeedModel(await createEveryQRCodeIdentity(url));
    const scene = createSeedGpuScene(model);
    const groundWidth = model.qrSize * seedModel.SEED_BLOCK_SIZE;
    const bulkTop = flowerHeightQuantile(scene, 0.9);
    const outerTop = flowerHeightQuantile(scene, 0.995);

    expect(outerTop - bulkTop, url).toBeLessThan(groundWidth * 0.16);
    expect(scene.flowerCount, url).toBeGreaterThan(1_350);
  }
});

it("uses a short accelerating bezier timeline for morphing", () => {
  const duration = Reflect.get(rendererModule, "MORPH_DURATION_MS");
  const evaluate = Reflect.get(rendererModule, "evaluateMorphCurve");

  expect(duration).toBeGreaterThanOrEqual(850);
  expect(duration).toBeLessThanOrEqual(1_050);
  expect(evaluate).toBeTypeOf("function");
  if (typeof evaluate !== "function") return;

  expect(evaluate(0)).toBe(0);
  expect(evaluate(1)).toBe(1);
  expect(evaluate(0.25)).toBeGreaterThan(0.25);
  expect(evaluate(0.5)).toBeGreaterThan(0.65);
  expect(evaluate(0.75)).toBeGreaterThan(evaluate(0.5));
});

it("derives stable and visibly different ecology genes from each site", async () => {
  const firstModel = await seedModel.createSeedModel(
    await createEveryQRCodeIdentity("https://example.com/tree-dna/first"),
  );
  const secondModel = await seedModel.createSeedModel(
    await createEveryQRCodeIdentity("https://second.example.com/tree-dna"),
  );
  const first = createSeedGpuScene(firstModel);
  const repeat = createSeedGpuScene(firstModel);
  const second = createSeedGpuScene(secondModel);
  const firstAppearance = Reflect.get(first, "appearance");
  const repeatAppearance = Reflect.get(repeat, "appearance");
  const secondAppearance = Reflect.get(second, "appearance");

  expect(firstAppearance).toBeDefined();
  expect(repeatAppearance).toEqual(firstAppearance);
  expect(secondAppearance).not.toEqual(firstAppearance);
  expect(Reflect.get(first, "leafCount")).toBeGreaterThan(0);
  expect(Reflect.get(first, "fruitCount")).toBeGreaterThanOrEqual(0);
  expect(
    Reflect.get(second, "leafCount") !== Reflect.get(first, "leafCount") ||
      Reflect.get(second, "fruitCount") !== Reflect.get(first, "fruitCount"),
  ).toBe(true);
});

it("keeps fruit as sparse jewel-toned accents", async () => {
  const scenes = await Promise.all(
    Array.from({ length: 12 }, async (_, index) => {
      const identity = await createEveryQRCodeIdentity(`https://fruit-${index}.example.com`);
      return createSeedGpuScene(await seedModel.createSeedModel(identity));
    }),
  );

  expect(scenes.some((scene) => scene.fruitCount > 0)).toBe(true);
  for (const scene of scenes) {
    const hue = scene.appearance.fruitHue;
    expect(hue <= 0.1 || hue >= 0.7).toBe(true);
    expect(scene.fruitCount).toBeLessThanOrEqual(Math.ceil(scene.blossomCount * 0.025));
  }
});

it("lets Link DNA choose curated fantasy flower and leaf palettes", async () => {
  const appearances = await Promise.all(
    Array.from({ length: 24 }, async (_, index) => {
      const identity = await createEveryQRCodeIdentity(`https://color-${index}.example.com`);
      const model = await seedModel.createSeedModel(identity);
      return createSeedGpuScene(model).appearance;
    }),
  );

  expect(appearances.some(({ flowerHue }) => flowerHue >= 0.45 && flowerHue <= 0.85)).toBe(true);
  expect(appearances.some(({ leafHue }) => leafHue <= 0.15 || leafHue >= 0.65)).toBe(true);
  expect(
    Math.max(...appearances.map((item) => Reflect.get(item, "flowerHueSpread"))),
  ).toBeGreaterThan(0.08);
  expect(
    Math.max(...appearances.map((item) => Reflect.get(item, "leafHueSpread"))),
  ).toBeGreaterThan(0.06);
});
