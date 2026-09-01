import {
  mixFamily,
  resolveGeneratorVersion,
  type EveryQRCodeIdentity,
  type GeneratorVersion,
  type RandomStream,
} from "@every-qrcode/core";

export const SEED_TOPOLOGIES = [
  "soft-sphere",
  "faceted-sphere",
  "segmented-shell",
  "gel-shell",
  "terraced-world",
  "open-core",
  "ring-habitat",
] as const;

export type SeedTopology = (typeof SEED_TOPOLOGIES)[number];

export const TREE_ARCHETYPES = [
  "round",
  "umbrella",
  "conifer",
  "banana",
  "willow",
  "windswept",
  "cloud",
  "multi-trunk",
] as const;

export type TreeArchetype = (typeof TREE_ARCHETYPES)[number];

export const TREE_ARCHETYPE_WEIGHTS: Readonly<Record<TreeArchetype, number>> = {
  banana: 0.08,
  cloud: 0.15,
  conifer: 0.12,
  "multi-trunk": 0.12,
  round: 0.36,
  umbrella: 0.06,
  willow: 0.08,
  windswept: 0.03,
};

const TREE_ARCHETYPE_SELECTION_ORDER: readonly TreeArchetype[] = [
  "round",
  "cloud",
  "conifer",
  "umbrella",
  "willow",
  "banana",
  "multi-trunk",
  "windswept",
];

export const SEED_MATERIALS = [
  "tidal",
  "molten",
  "crystal",
  "gel",
  "garden",
  "energy",
  "machine",
] as const;

export type SeedMaterial = (typeof SEED_MATERIALS)[number];

export type SeedForm = "terrain" | "tree";

export type SeedPalette = {
  readonly accent: number;
  readonly atmosphere: number;
  readonly base: number;
  readonly dark: number;
  readonly region: number;
};

type SeedRecipe = {
  readonly id: string;
  readonly label: string;
  readonly material: SeedMaterial;
  readonly palette: SeedPalette;
  readonly topology: SeedTopology;
};

export type SeedModuleAnchor = {
  readonly index: number;
  readonly normal: readonly [number, number, number];
  readonly qr: readonly [number, number, number];
  readonly relief: number;
  readonly surface: readonly [number, number, number];
};

export type SeedFeatureAnchor = {
  readonly normal: readonly [number, number, number];
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly score: number;
};

export type SeedSatellite = {
  readonly inclination: number;
  readonly orbit: number;
  readonly phase: number;
  readonly scale: number;
};

export type SeedModel = {
  readonly archetype: TreeArchetype;
  readonly eccentricity: number;
  readonly features: readonly SeedFeatureAnchor[];
  readonly generatorVersion: GeneratorVersion;
  readonly material: SeedMaterial;
  readonly morphSeed: number;
  readonly modules: readonly SeedModuleAnchor[];
  readonly name: string;
  readonly palette: SeedPalette;
  readonly recipeId: string;
  readonly recipeLabel: string;
  readonly qrSize: number;
  readonly satellites: readonly SeedSatellite[];
  readonly topology: SeedTopology;
};

export type CreateSeedModelOptions = {
  readonly generatorVersion?: GeneratorVersion;
};

export const SEED_BLOCK_TYPES = {
  branch: 5,
  cherryBlossom: 1,
  dirt: 0,
  fallenPetals: 4,
  grass: 3,
  trunk: 2,
} as const;

export type SeedBlock = {
  readonly baseY: number;
  readonly column: number;
  readonly index: number;
  readonly layer: number;
  readonly row: number;
  readonly type: number;
};

export type SeedBlockField = {
  readonly baseY: Float32Array;
  readonly blockSize: number;
  readonly blocks: readonly SeedBlock[];
  readonly heights: Float32Array;
  readonly positions: Float32Array;
  readonly qrSize: number;
  readonly types: Uint32Array;
};

const SEED_RECIPES: readonly SeedRecipe[] = [
  {
    id: "tideglass",
    label: "Tideglass",
    material: "tidal",
    palette: {
      accent: 0xe8f6ef,
      atmosphere: 0x8edcff,
      base: 0x3099d4,
      dark: 0x1d5876,
      region: 0x83c96b,
    },
    topology: "soft-sphere",
  },
  {
    id: "cinderveil",
    label: "Cinderveil",
    material: "molten",
    palette: {
      accent: 0xffca52,
      atmosphere: 0xff7845,
      base: 0x252631,
      dark: 0x14151d,
      region: 0xff5937,
    },
    topology: "segmented-shell",
  },
  {
    id: "prismbloom",
    label: "Prismbloom",
    material: "crystal",
    palette: {
      accent: 0xffda72,
      atmosphere: 0xc9b9ff,
      base: 0x9d87e5,
      dark: 0x4c4175,
      region: 0x70d8c6,
    },
    topology: "faceted-sphere",
  },
  {
    id: "jellyhalo",
    label: "Jellyhalo",
    material: "gel",
    palette: {
      accent: 0xffc660,
      atmosphere: 0xffd9e8,
      base: 0xef8ead,
      dark: 0x914769,
      region: 0x86d9d0,
    },
    topology: "gel-shell",
  },
  {
    id: "mosswhorl",
    label: "Mosswhorl",
    material: "garden",
    palette: {
      accent: 0xffdc7d,
      atmosphere: 0xbce8bd,
      base: 0x8bc56b,
      dark: 0x315b43,
      region: 0x4d8f63,
    },
    topology: "terraced-world",
  },
  {
    id: "hollowlight",
    label: "Hollowlight",
    material: "energy",
    palette: {
      accent: 0xffef98,
      atmosphere: 0x83e8df,
      base: 0x344269,
      dark: 0x181d39,
      region: 0x66dfd0,
    },
    topology: "open-core",
  },
  {
    id: "orbit-forge",
    label: "Orbit Forge",
    material: "machine",
    palette: {
      accent: 0xf5dfb8,
      atmosphere: 0x91d9dc,
      base: 0xd2a15d,
      dark: 0x5d3d33,
      region: 0x327b84,
    },
    topology: "ring-habitat",
  },
];

const NAME_ENDINGS = ["Haven", "Reach", "Drift", "Basin", "Arc", "Garden", "Crown"] as const;

function selectTreeArchetype(gene: number): TreeArchetype {
  let threshold = 0;
  for (const archetype of TREE_ARCHETYPE_SELECTION_ORDER) {
    threshold += TREE_ARCHETYPE_WEIGHTS[archetype];
    if (gene < threshold) return archetype;
  }
  return "round";
}

export const SEED_QR_GROUND_SIDE = 2.12;
export const SEED_QR_GROUND_Y = -0.82;
export const SEED_QR_QUIET_ZONE = 4;
export const SEED_BLOCK_SIZE = 0.0245;

function pushSeedBlock(
  blocks: SeedBlock[],
  column: number,
  row: number,
  baseY: number,
  type: number,
): void {
  blocks.push({
    baseY,
    column,
    index: blocks.length,
    layer: Math.round(baseY / SEED_BLOCK_SIZE),
    row,
    type,
  });
}

function baseBlockType(active: boolean, radiusSquared: number, canopySquared: number): number {
  if (!active) return SEED_BLOCK_TYPES.dirt;
  if (radiusSquared < 6.25) return SEED_BLOCK_TYPES.cherryBlossom;
  if (radiusSquared >= canopySquared) return SEED_BLOCK_TYPES.grass;
  return SEED_BLOCK_TYPES.fallenPetals;
}

function canopyLayerNoise(column: number, row: number, salt: number): number {
  const value = Math.sin(column * 127.1 + row * 311.7 + salt * 43.7) * 43_758.5;
  return value - Math.floor(value);
}

function addSeedColumnLayers(
  blocks: SeedBlock[],
  column: number,
  row: number,
  radiusSquared: number,
  qrSize: number,
): void {
  const sizeScale = qrSize / 29;
  const trunkLevels = Math.ceil(12 * sizeScale);
  const canopyBaseY = trunkLevels * SEED_BLOCK_SIZE;
  const canopyRadius = qrSize * 0.46;
  if (radiusSquared < 6.25) {
    for (let layer = 1; layer < trunkLevels; layer++) {
      pushSeedBlock(blocks, column, row, layer * SEED_BLOCK_SIZE, SEED_BLOCK_TYPES.trunk);
    }
  }
  if (radiusSquared >= canopyRadius ** 2) return;
  const canopyT = 1 - Math.sqrt(radiusSquared) / canopyRadius;
  const baseLevels = Math.ceil(18 * sizeScale);
  const blossomLevels = Math.max(4, Math.ceil(baseLevels * (0.25 + 0.75 * canopyT ** 2)));
  const heightJitter = Math.floor(4.5 * canopyT * sizeScale) * SEED_BLOCK_SIZE;
  const extraLevels = Math.floor(6 * canopyLayerNoise(column, row, 500) * sizeScale);
  for (let layer = 0; layer < blossomLevels + extraLevels; layer++) {
    pushSeedBlock(
      blocks,
      column,
      row,
      canopyBaseY + layer * SEED_BLOCK_SIZE + heightJitter,
      SEED_BLOCK_TYPES.cherryBlossom,
    );
  }
  if (radiusSquared >= 2.25) return;
  for (let layer = 0; layer < 4; layer++) {
    pushSeedBlock(
      blocks,
      column,
      row,
      canopyBaseY + layer * SEED_BLOCK_SIZE,
      SEED_BLOCK_TYPES.cherryBlossom,
    );
  }
}

function smoothTerrain(source: Float32Array, size: number, passes: number): Float32Array {
  let current = source;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(source.length);
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        let sum = 0;
        let count = 0;
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const sampleRow = row + rowOffset;
            const sampleColumn = column + columnOffset;
            if (sampleRow < 0 || sampleRow >= size || sampleColumn < 0 || sampleColumn >= size) {
              continue;
            }
            sum += current[sampleRow * size + sampleColumn] ?? 0;
            count += 1;
          }
        }
        next[row * size + column] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

function terrainEdgeMask(column: number, row: number, size: number): number {
  const center = (size - 1) * 0.5;
  const x = (column - center) / (size * 0.52);
  const z = (row - center) / (size * 0.5);
  const distance = x * x + z * z;
  const normalized = Math.max(0, Math.min(1, (distance - 0.5) / 0.48));
  const eased = normalized * normalized * (3 - 2 * normalized);
  return 1 - eased;
}

function createTerrainHeights(model: SeedModel): Float32Array {
  const source = new Float32Array(model.qrSize * model.qrSize);
  for (const module of model.modules) {
    source[module.index] = Math.min(1, 0.42 + module.relief * 2.4);
  }
  const smoothed = smoothTerrain(source, model.qrSize, 3);
  const maximum = Math.max(...smoothed, Number.EPSILON);
  const heights = new Float32Array(source.length);
  for (let row = 0; row < model.qrSize; row += 1) {
    for (let column = 0; column < model.qrSize; column += 1) {
      const index = row * model.qrSize + column;
      const contribution = source[index] ?? 0;
      const normalized = (smoothed[index] ?? 0) / maximum;
      const emphasized = Math.pow(Math.max(normalized, contribution * 0.34), 0.82);
      const mountain = emphasized * terrainEdgeMask(column, row, model.qrSize);
      heights[index] = mountain;
    }
  }
  return heights;
}

function packSeedBlockField(
  blocks: readonly SeedBlock[],
  qrSize: number,
  terrainHeights?: Float32Array,
): SeedBlockField {
  const activeBaseCells = new Set(
    blocks
      .filter((block) => block.layer === 0 && block.type !== SEED_BLOCK_TYPES.dirt)
      .map((block) => `${block.column}:${block.row}`),
  );
  const positions = new Float32Array(blocks.length * 4);
  const heights = new Float32Array(blocks.length);
  const baseY = new Float32Array(blocks.length);
  const types = new Uint32Array(blocks.length);
  for (const block of blocks) {
    const offset = block.index * 4;
    positions[offset] = block.column;
    positions[offset + 1] = block.row;
    if (block.layer === 0 && block.type !== SEED_BLOCK_TYPES.dirt) {
      const up = activeBaseCells.has(`${block.column}:${block.row - 1}`) ? 1 : 0;
      const right = activeBaseCells.has(`${block.column + 1}:${block.row}`) ? 2 : 0;
      const down = activeBaseCells.has(`${block.column}:${block.row + 1}`) ? 4 : 0;
      const left = activeBaseCells.has(`${block.column - 1}:${block.row}`) ? 8 : 0;
      positions[offset + 3] = up | right | down | left;
    }
    heights[block.index] = terrainHeights?.[block.row * qrSize + block.column] ?? SEED_BLOCK_SIZE;
    baseY[block.index] = block.baseY;
    types[block.index] = block.type;
  }
  return { baseY, blocks, blockSize: SEED_BLOCK_SIZE, heights, positions, qrSize, types };
}

export function createSeedBlockField(model: SeedModel, form: SeedForm = "tree"): SeedBlockField {
  const active = new Set(model.modules.map((module) => module.index));
  const blocks: SeedBlock[] = [];
  const center = model.qrSize / 2;
  const canopySquared = (model.qrSize * 0.46) ** 2;
  for (let row = 0; row < model.qrSize; row++) {
    for (let column = 0; column < model.qrSize; column++) {
      const cellIndex = row * model.qrSize + column;
      const radiusSquared = (column - center) ** 2 + (row - center) ** 2;
      const isActive = active.has(cellIndex);
      pushSeedBlock(blocks, column, row, 0, baseBlockType(isActive, radiusSquared, canopySquared));
      if (isActive && form === "tree") {
        addSeedColumnLayers(blocks, column, row, radiusSquared, model.qrSize);
      }
    }
  }
  const terrainHeights = form === "terrain" ? createTerrainHeights(model) : undefined;
  return packSeedBlockField(blocks, model.qrSize, terrainHeights);
}

function pointForTopology(
  topology: SeedTopology,
  u: number,
  v: number,
  relief: number,
  eccentricity: number,
): { normal: readonly [number, number, number]; position: readonly [number, number, number] } {
  if (topology === "ring-habitat" || topology === "open-core") {
    const major = topology === "open-core" ? 0.58 : 0.68;
    const minor = topology === "open-core" ? 0.28 : 0.22;
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI * 2;
    const ring = major + (minor + relief) * Math.cos(phi);
    const normal: readonly [number, number, number] = [
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi),
    ];
    return {
      normal,
      position: [ring * Math.cos(theta), (minor + relief) * Math.sin(phi), ring * Math.sin(theta)],
    };
  }
  const longitude = (u - 0.5) * Math.PI * 2;
  const latitude = (0.5 - v) * Math.PI;
  const radius = 0.75 + relief;
  const normal: readonly [number, number, number] = [
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.sin(longitude),
  ];
  return {
    normal,
    position: [
      normal[0] * radius * eccentricity,
      normal[1] * radius,
      (normal[2] * radius) / eccentricity,
    ],
  };
}

function createModuleAnchors(
  identity: EveryQRCodeIdentity,
  topology: SeedTopology,
  eccentricity: number,
): readonly SeedModuleAnchor[] {
  const modules: SeedModuleAnchor[] = [];
  const size = identity.qr.size;
  const moduleSize = SEED_QR_GROUND_SIDE / (size + SEED_QR_QUIET_ZONE * 2);
  const center = (size - 1) / 2;
  identity.qr.cells.forEach((active, index) => {
    if (!active) return;
    const column = index % size;
    const row = Math.floor(index / size);
    const u = (column + 0.5) / size;
    const v = (row + 0.5) / size;
    const density = identity.fields.density5x5[index] ?? 0;
    const edge = identity.fields.edge[index] ?? 0;
    const relief = (density - 0.5) * 0.075 + edge * 0.045;
    const point = pointForTopology(topology, u, v, relief, eccentricity);
    modules.push({
      index,
      normal: point.normal,
      qr: [(column - center) * moduleSize, SEED_QR_GROUND_Y + 0.024, (row - center) * moduleSize],
      relief,
      surface: point.position,
    });
  });
  return modules;
}

function selectFeatureAnchors(
  identity: EveryQRCodeIdentity,
  topology: SeedTopology,
  eccentricity: number,
  stream: RandomStream,
): readonly SeedFeatureAnchor[] {
  const size = identity.qr.size;
  const candidates = Array.from(identity.qr.cells, (_, index) => {
    const score =
      (identity.fields.blur[index] ?? 0) * 0.62 +
      (identity.fields.edge[index] ?? 0) * 0.28 +
      stream.next() * 0.1;
    return { index, score };
  }).sort((left, right) => right.score - left.score);
  const selected: SeedFeatureAnchor[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 9) break;
    const column = candidate.index % size;
    const row = Math.floor(candidate.index / size);
    const u = (column + 0.5) / size;
    const v = (row + 0.5) / size;
    const point = pointForTopology(topology, u, v, 0.035, eccentricity);
    const tooClose = selected.some((feature) => {
      const dot =
        feature.normal[0] * point.normal[0] +
        feature.normal[1] * point.normal[1] +
        feature.normal[2] * point.normal[2];
      return dot > 0.88;
    });
    if (!tooClose) {
      selected.push({
        normal: point.normal,
        position: point.position,
        scale: 0.16 + candidate.score * 0.16,
        score: candidate.score,
      });
    }
  }
  return selected;
}

function createSatellites(stream: RandomStream): readonly SeedSatellite[] {
  const count = 1 + Math.floor(stream.next() * 3);
  return Array.from({ length: count }, (_, index) => ({
    inclination: -0.55 + stream.next() * 1.1,
    orbit: 1.05 + index * 0.2 + stream.next() * 0.12,
    phase: stream.next() * Math.PI * 2,
    scale: 0.055 + stream.next() * 0.07,
  }));
}

async function createSeedModelV1(identity: EveryQRCodeIdentity): Promise<SeedModel> {
  const detailSource = identity.link.scope === "url" ? "page" : "site";
  const [family, familyShape, detailShape, detail, familyMorph, detailMorph, archetype] =
    await Promise.all([
      identity.dna.channel("family", "seed/v1/family"),
      identity.dna.channel("family", "tree/v1/family-shape"),
      identity.dna.channel(detailSource, "seed/v1/shape"),
      identity.dna.channel(detailSource, "seed/v1/detail"),
      identity.dna.channel("family", "morph/v1/family-structure"),
      identity.dna.channel(detailSource, "morph/v1/structure"),
      identity.dna.channel("family", "tree/v2/archetype"),
    ]);
  const recipe = SEED_RECIPES[Math.floor(family.next() * SEED_RECIPES.length)];
  if (!recipe) throw new RangeError("Tree recipe");
  const shapeGene = mixFamily(familyShape.next(), detailShape.next(), 0.82);
  const eccentricity = 0.9 + shapeGene * 0.2;
  const ending = NAME_ENDINGS[Math.floor(family.next() * NAME_ENDINGS.length)] ?? "Haven";
  return {
    archetype: selectTreeArchetype(archetype.next()),
    eccentricity,
    features: selectFeatureAnchors(identity, recipe.topology, eccentricity, detail),
    generatorVersion: 1,
    material: recipe.material,
    morphSeed: mixFamily(familyMorph.next(), detailMorph.next(), 0.78),
    modules: createModuleAnchors(identity, recipe.topology, eccentricity),
    name: `${recipe.label} ${ending}`,
    palette: recipe.palette,
    recipeId: recipe.id,
    recipeLabel: recipe.label,
    qrSize: identity.qr.size,
    satellites: createSatellites(detail),
    topology: recipe.topology,
  };
}

type SeedModelFactory = (identity: EveryQRCodeIdentity) => Promise<SeedModel>;

const SEED_MODEL_FACTORIES = {
  1: createSeedModelV1,
} satisfies Record<GeneratorVersion, SeedModelFactory>;

export async function createSeedModel(
  identity: EveryQRCodeIdentity,
  options: CreateSeedModelOptions = {},
): Promise<SeedModel> {
  const version = resolveGeneratorVersion(options.generatorVersion);
  return SEED_MODEL_FACTORIES[version](identity);
}
