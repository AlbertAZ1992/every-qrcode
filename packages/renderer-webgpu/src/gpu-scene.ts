import {
  SEED_BLOCK_SIZE,
  type SeedForm,
  type TreeArchetype,
  type SeedModel,
} from "./seed-model.js";

export { CANOPY_GAP_RATE } from "./tree-constants.js";

type Vec3 = readonly [number, number, number];

type TreeMetrics = {
  readonly archetype: TreeArchetype;
  readonly branchCount: number;
  readonly branchLengthScale: number;
  readonly canopyBaseY: number;
  readonly canopyDepth: number;
  readonly canopyDensity: number;
  readonly canopyDomeHeight: number;
  readonly canopyOffsetX: number;
  readonly canopyOffsetZ: number;
  readonly canopyRadius: number;
  readonly canopyRoundness: number;
  readonly canopyTiering: number;
  readonly maxHeight: number;
  readonly minHeight: number;
  readonly trunkHeight: number;
  readonly trunkLean: number;
  readonly trunkRadius: number;
};

type TreeSegment = {
  readonly depth: number;
  readonly end: Vec3;
  readonly endRadius: number;
  readonly seed: number;
  readonly start: Vec3;
  readonly startRadius: number;
};

type TreeTip = {
  readonly position: Vec3;
  readonly radius: number;
};

type TwigBurstSpec = {
  readonly baseAzimuth: number;
  readonly depth: number;
  readonly end: Vec3;
  readonly endRadius: number;
  readonly seed: number;
  readonly start: Vec3;
  readonly startRadius: number;
};

type CrownBranchSpec = {
  readonly count: number;
  readonly index: number;
  readonly seed: number;
};

export type TreeAppearance = {
  readonly bloomDensity: number;
  readonly flowerHue: number;
  readonly flowerHueSpread: number;
  readonly fruitHue: number;
  readonly fruitfulness: number;
  readonly leafDensity: number;
  readonly leafHue: number;
  readonly leafHueSpread: number;
};

export type SeedGpuScene = {
  readonly appearance: TreeAppearance;
  readonly blossomCount: number;
  readonly butterflies: Float32Array;
  readonly butterflyCount: number;
  readonly fallingPetalCount: number;
  readonly fallingPetals: Float32Array;
  readonly flowerCount: number;
  readonly flowers: Float32Array;
  readonly fruitCount: number;
  readonly grass: Float32Array;
  readonly grassCount: number;
  readonly groundPetalCount: number;
  readonly groundPetals: Float32Array;
  readonly leafCount: number;
  readonly rain: Float32Array;
  readonly rainCount: number;
  readonly segmentCount: number;
  readonly segments: Float32Array;
};

type PackedOrgans = {
  readonly blossomCount: number;
  readonly data: Float32Array;
  readonly fruitCount: number;
  readonly leafCount: number;
};

function sceneSeed(model: SeedModel): number {
  return model.morphSeed;
}

function random(seed: number, first: number, second = 0, salt = 0): number {
  const angle = first * 127.1 + second * 311.7 + salt * 43.7 + seed * 7_919;
  const value = Math.sin(angle) * 43_758.5;
  return value - Math.floor(value);
}

const FLOWER_HUES = [0.96, 0.02, 0.08, 0.78, 0.63, 0.51] as const;
const LEAF_HUES = [0.29, 0.37, 0.48, 0.12, 0.96, 0.74] as const;
function paletteHue(palette: readonly number[], gene: number, jitter: number): number {
  const index = Math.min(palette.length - 1, Math.floor(gene * palette.length));
  return ((palette[index] ?? 0) + (jitter - 0.5) * 0.024 + 1) % 1;
}

export function createTreeAppearance(model: SeedModel): TreeAppearance {
  const seed = sceneSeed(model);
  const fruitGene = random(seed, 13, 0, 7_300);
  const fruitHueGene = random(seed, 14, 0, 7_400);
  const fruitHue =
    fruitHueGene < 0.62 ? (0.94 + fruitHueGene * 0.22) % 1 : 0.72 + (fruitHueGene - 0.62) * 0.55;
  return {
    bloomDensity: 0.72 + random(seed, 10, 0, 7_000) * 0.76,
    flowerHue: paletteHue(FLOWER_HUES, random(seed, 11, 0, 7_100), random(seed, 16, 0, 7_600)),
    flowerHueSpread: 0.018 + random(seed, 17, 0, 7_700) * 0.15,
    fruitHue,
    fruitfulness: Math.max(0, (fruitGene - 0.32) / 0.68),
    leafDensity: 0.22 + random(seed, 12, 0, 7_200) * 0.36,
    leafHue: paletteHue(LEAF_HUES, random(seed, 15, 0, 7_500), random(seed, 18, 0, 7_800)),
    leafHueSpread: 0.015 + random(seed, 19, 0, 7_900) * 0.12,
  };
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scale(vector: Vec3, amount: number): Vec3 {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function direction(azimuth: number, elevation: number): Vec3 {
  const horizontal = Math.cos(elevation);
  return [Math.cos(azimuth) * horizontal, Math.sin(elevation), Math.sin(azimuth) * horizontal];
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function qrEdgeRatio(model: SeedModel): number {
  const active = new Set(model.modules.map((module) => module.index));
  let changes = 0;
  for (let row = 0; row < model.qrSize; row++) {
    for (let column = 0; column < model.qrSize; column++) {
      const index = row * model.qrSize + column;
      if (column > 0 && active.has(index) !== active.has(index - 1)) changes++;
      if (row > 0 && active.has(index) !== active.has(index - model.qrSize)) changes++;
    }
  }
  return changes / (2 * model.qrSize * (model.qrSize - 1));
}

type CanopyProfile = {
  readonly base: number;
  readonly depth: number;
  readonly height: number;
  readonly roundness: number;
  readonly tiering: number;
  readonly trunk: number;
  readonly width: number;
};

function canopyProfile(model: SeedModel): CanopyProfile {
  switch (model.archetype) {
    case "round":
      return {
        base: 0.82,
        depth: 0.96,
        height: 1.5,
        roundness: 1.65,
        tiering: 0.01,
        trunk: 1.05,
        width: 0.98,
      };
    case "umbrella":
      return {
        base: 0.72,
        depth: 1,
        height: 0.88,
        roundness: 2.1,
        tiering: 0.02,
        trunk: 0.94,
        width: 1.04,
      };
    case "conifer":
      return {
        base: 0.48,
        depth: 0.66,
        height: 2.6,
        roundness: 0.78,
        tiering: 0.05,
        trunk: 1.5,
        width: 0.68,
      };
    case "banana":
      return {
        base: 0.9,
        depth: 0.68,
        height: 0.82,
        roundness: 1.8,
        tiering: 0,
        trunk: 1.18,
        width: 0.78,
      };
    case "willow":
      return {
        base: 0.82,
        depth: 0.92,
        height: 1.08,
        roundness: 1.75,
        tiering: 0.02,
        trunk: 1.08,
        width: 0.92,
      };
    case "windswept":
      return {
        base: 0.78,
        depth: 0.86,
        height: 1,
        roundness: 1.9,
        tiering: 0.02,
        trunk: 1.08,
        width: 0.95,
      };
    case "cloud":
      return {
        base: 0.76,
        depth: 0.94,
        height: 1.48,
        roundness: 1.3,
        tiering: 0.18,
        trunk: 0.98,
        width: 0.98,
      };
    case "multi-trunk":
      return {
        base: 0.86,
        depth: 0.96,
        height: 1.08,
        roundness: 2,
        tiering: 0.02,
        trunk: 1.22,
        width: 1,
      };
  }
}

export function baseTrunkHeight(density: number, sizeScale: number): number {
  return (0.29 + density * 0.07) * sizeScale;
}

function archetypeBranchCount(archetype: TreeArchetype, gene: number): number {
  if (archetype === "banana") return 9 + Math.floor(gene * 3);
  if (archetype === "conifer") return 6;
  if (archetype === "multi-trunk") return 7 + Math.floor(gene * 2);
  if (archetype === "umbrella") return 6 + Math.floor(gene * 2);
  if (archetype === "willow") return 8 + Math.floor(gene * 2);
  if (archetype === "windswept") return 5 + Math.floor(gene * 2);
  if (archetype === "cloud") return 9 + Math.floor(gene * 2);
  return 7 + Math.floor(gene * 2);
}

function measureTree(model: SeedModel): TreeMetrics {
  const density = model.modules.length / (model.qrSize * model.qrSize);
  const edgeRatio = qrEdgeRatio(model);
  const sizeScale = model.qrSize / 29;
  const profile = canopyProfile(model);
  const heightGene = random(model.morphSeed, 1, 0, 100);
  const spreadGene = random(model.morphSeed, 2, 0, 200);
  const branchGene = random(model.morphSeed, 3, 0, 300);
  const leanGene = random(model.morphSeed, 4, 0, 400);
  const densityGene = random(model.morphSeed, 6, 0, 600);
  const depthGene = random(model.morphSeed, 7, 0, 700);
  const offsetGene = random(model.morphSeed, 8, 0, 800);
  const trunkHeight =
    baseTrunkHeight(density, sizeScale) * profile.trunk * (0.98 + heightGene * 0.18);
  const qrCanopyRadius = model.qrSize * 0.46 * SEED_BLOCK_SIZE;
  const canopyRadius = qrCanopyRadius * profile.width * (0.91 + spreadGene * 0.14);
  const canopyDepth = qrCanopyRadius * profile.depth * (0.92 + depthGene * 0.12);
  const canopyDomeHeight = qrCanopyRadius * profile.height * (0.88 + (1 - heightGene) * 0.12);
  const canopyBaseY = trunkHeight * profile.base;
  const leanDirection = random(model.morphSeed, 5, 0, 500) < 0.5 ? -1 : 1;
  const offsetAngle = offsetGene * Math.PI * 2;
  const offsetDistance =
    model.archetype === "windswept"
      ? qrCanopyRadius * (0.12 + edgeRatio * 0.06)
      : qrCanopyRadius * (0.008 + edgeRatio * 0.018);
  return {
    archetype: model.archetype,
    branchCount: archetypeBranchCount(model.archetype, branchGene),
    branchLengthScale: (0.64 + density * 0.18) * (0.88 + spreadGene * 0.22),
    canopyBaseY,
    canopyDepth,
    canopyDensity: (0.45 + density * 0.55) * (0.62 + densityGene * 0.82),
    canopyDomeHeight,
    canopyOffsetX: Math.cos(offsetAngle) * offsetDistance,
    canopyOffsetZ: Math.sin(offsetAngle) * offsetDistance,
    canopyRadius,
    canopyRoundness: profile.roundness,
    canopyTiering: profile.tiering,
    maxHeight: canopyBaseY + canopyDomeHeight * (model.archetype === "round" ? 0.85 : 0.96),
    minHeight: canopyBaseY,
    trunkHeight,
    trunkLean: (0.04 + edgeRatio * 0.03) * sizeScale * (0.42 + leanGene * 1.16) * leanDirection,
    trunkRadius: (0.024 + density * 0.008) * sizeScale,
  };
}

function trunkPoint(metrics: TreeMetrics, progress: number): Vec3 {
  return [
    metrics.trunkLean * progress ** 2 +
      metrics.trunkLean * 0.3 * Math.sin(progress * Math.PI * 1.5),
    metrics.trunkHeight * progress,
    metrics.trunkLean * 0.5 * Math.sin(progress * Math.PI * 0.8),
  ];
}

function pushSegment(segments: TreeSegment[], segment: TreeSegment): void {
  segments.push(segment);
}

function addTrunk(segments: TreeSegment[], metrics: TreeMetrics): void {
  const segmentCount = 10;
  for (let index = 0; index < segmentCount; index++) {
    const startProgress = index / segmentCount;
    const endProgress = (index + 1) / segmentCount;
    const startBulge = 1 + 0.08 * Math.sin(startProgress * Math.PI * 0.8);
    const endBulge = 1 + 0.08 * Math.sin(endProgress * Math.PI * 0.8);
    pushSegment(segments, {
      depth: 0,
      end: trunkPoint(metrics, endProgress),
      endRadius: metrics.trunkRadius * (1 - endProgress * 0.55) * endBulge,
      seed: startProgress * 0.5,
      start: trunkPoint(metrics, startProgress),
      startRadius: metrics.trunkRadius * (1 - startProgress * 0.55) * startBulge,
    });
  }
}

function addConiferTree(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  seed: number,
): void {
  addTrunk(segments, metrics);
  const tierCount = metrics.branchCount;
  for (let tier = 0; tier < tierCount; tier++) {
    const progress = tier / Math.max(1, tierCount - 1);
    const start = trunkPoint(metrics, 0.46 + progress * 0.48);
    const armCount = 5 + (tier % 2);
    const reach = metrics.canopyRadius * (0.92 - progress * 0.68);
    for (let arm = 0; arm < armCount; arm++) {
      const azimuth = (arm / armCount) * Math.PI * 2 + tier * 0.48;
      const middle = add(start, scale(direction(azimuth, 0.08), reach * 0.56));
      const end = add(start, scale(direction(azimuth, 0.14 + progress * 0.18), reach));
      const radius = metrics.trunkRadius * (0.23 - progress * 0.08);
      pushSegment(segments, {
        depth: 1,
        end: middle,
        endRadius: radius * 0.58,
        seed: random(seed, tier, arm, 3_500),
        start,
        startRadius: radius,
      });
      pushSegment(segments, {
        depth: 2,
        end,
        endRadius: radius * 0.18,
        seed: random(seed, tier, arm, 3_600),
        start: middle,
        startRadius: radius * 0.58,
      });
      tips.push({ position: end, radius: 0.12 + (1 - progress) * 0.1 });
    }
  }
}

function addBananaTree(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  seed: number,
): void {
  addTrunk(segments, metrics);
  const crown = trunkPoint(metrics, 0.96);
  for (let frond = 0; frond < metrics.branchCount; frond++) {
    const azimuth = (frond / metrics.branchCount) * Math.PI * 2;
    const reach = metrics.canopyRadius * (0.78 + random(seed, frond, 0, 3_700) * 0.2);
    let previous = crown;
    let radius = metrics.trunkRadius * 0.2;
    for (let part = 0; part < 3; part++) {
      const progress = (part + 1) / 3;
      const elevation = 0.38 - progress * 0.52;
      const end = add(crown, scale(direction(azimuth, elevation), reach * progress));
      pushSegment(segments, {
        depth: 1,
        end,
        endRadius: radius * 0.55,
        seed: random(seed, frond, part, 3_800),
        start: previous,
        startRadius: radius,
      });
      previous = end;
      radius *= 0.55;
    }
    tips.push({ position: previous, radius: 0.2 });
  }
}

function forkPoint(root: Vec3, crown: Vec3, progress: number): Vec3 {
  return [
    mix(root[0], crown[0], progress),
    mix(root[1], crown[1], progress),
    mix(root[2], crown[2], progress),
  ];
}

function addSharedForkBase(segments: TreeSegment[], metrics: TreeMetrics): Vec3 {
  const root: Vec3 = [0, 0, 0];
  const fork = trunkPoint(metrics, 0.3);
  let previous = root;
  let radius = metrics.trunkRadius * 1.18;
  for (let part = 0; part < 2; part++) {
    const end = forkPoint(root, fork, (part + 1) / 2);
    pushSegment(segments, {
      depth: 0,
      end,
      endRadius: radius * 0.88,
      seed: 0.12 + part * 0.03,
      start: previous,
      startRadius: radius,
    });
    previous = end;
    radius *= 0.88;
  }
  return fork;
}

function addForkedTree(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  seed: number,
): void {
  const trunkCount = 2 + Math.floor(random(seed, 0, 0, 3_900) * 2);
  const fork = addSharedForkBase(segments, metrics);
  for (let trunk = 0; trunk < trunkCount; trunk++) {
    const azimuth = (trunk / trunkCount) * Math.PI * 2 + 0.35;
    const crown: Vec3 = [
      metrics.canopyOffsetX + Math.cos(azimuth) * metrics.canopyRadius * 0.28,
      metrics.trunkHeight * (0.88 + random(seed, trunk, 0, 4_000) * 0.08),
      metrics.canopyOffsetZ + Math.sin(azimuth) * metrics.canopyDepth * 0.28,
    ];
    let previous = fork;
    let radius = metrics.trunkRadius * 0.72;
    for (let part = 0; part < 6; part++) {
      const end = forkPoint(fork, crown, (part + 1) / 6);
      pushSegment(segments, {
        depth: 0,
        end,
        endRadius: radius * 0.86,
        seed: random(seed, trunk, part, 4_100),
        start: previous,
        startRadius: radius,
      });
      previous = end;
      radius *= 0.86;
    }
    addForkedCrown(segments, tips, metrics, seed, trunk, crown, radius);
  }
}

function addForkedCrown(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  seed: number,
  trunk: number,
  crown: Vec3,
  radius: number,
): void {
  for (let arm = 0; arm < 4; arm++) {
    const azimuth = (arm / 4) * Math.PI * 2 + trunk * 1.7;
    const reach = metrics.canopyRadius * (0.35 + random(seed, trunk, arm, 4_200) * 0.2);
    const end = constrainToCanopy(add(crown, scale(direction(azimuth, 0.18), reach)), metrics);
    pushSegment(segments, {
      depth: 1,
      end,
      endRadius: radius * 0.24,
      seed: random(seed, trunk, arm, 4_300),
      start: crown,
      startRadius: radius * 0.72,
    });
    tips.push({ position: end, radius: 0.2 });
  }
}

function constrainToCanopy(point: Vec3, metrics: TreeMetrics): Vec3 {
  const x = point[0] - metrics.canopyOffsetX;
  const z = point[2] - metrics.canopyOffsetZ;
  const normalizedRadius = Math.hypot(x / metrics.canopyRadius, z / metrics.canopyDepth);
  const radialLimit = metrics.archetype === "windswept" ? 0.86 : 0.78;
  const radialScale = normalizedRadius > radialLimit ? radialLimit / normalizedRadius : 1;
  return [
    metrics.canopyOffsetX + x * radialScale,
    Math.min(metrics.maxHeight, Math.max(metrics.minHeight, point[1])),
    metrics.canopyOffsetZ + z * radialScale,
  ];
}

function addTwigBurst(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  spec: TwigBurstSpec,
): void {
  pushSegment(segments, {
    depth: spec.depth,
    end: spec.end,
    endRadius: spec.endRadius,
    seed: random(spec.seed, spec.depth),
    start: spec.start,
    startRadius: spec.startRadius,
  });
  const twigCount = 1 + Math.floor(random(spec.seed, segments.length, 0, 500) * 2);
  for (let twig = 0; twig < twigCount; twig++) {
    const azimuth = spec.baseAzimuth + 2.2 * (random(spec.seed, segments.length, twig, 600) - 0.5);
    const length =
      metrics.canopyRadius *
      (0.15 + 0.2 * random(spec.seed, segments.length, twig, 700)) *
      metrics.branchLengthScale;
    const elevationGene = random(spec.seed, segments.length, twig, 750);
    const elevation =
      metrics.archetype === "willow" ? -0.42 + elevationGene * 0.18 : 0.1 + 0.45 * elevationGene;
    const radius = spec.endRadius * (0.5 + 0.2 * random(spec.seed, segments.length, twig, 800));
    const end = constrainToCanopy(
      add(spec.end, scale(direction(azimuth, elevation), length)),
      metrics,
    );
    const endRadius = radius * 0.4;
    pushSegment(segments, {
      depth: spec.depth + 1,
      end,
      endRadius,
      seed: random(spec.seed, twig, 850),
      start: spec.end,
      startRadius: radius,
    });
    tips.push({ position: end, radius: 25 * endRadius });
    const secondAzimuth = azimuth + 2.2 * (random(spec.seed, segments.length, twig, 860) - 0.5);
    const secondLength = length * 0.45;
    const secondElevation =
      metrics.archetype === "willow"
        ? -0.36 + 0.14 * random(spec.seed, segments.length, twig, 870)
        : 0.1 + 0.35 * random(spec.seed, segments.length, twig, 870);
    const secondRadius = endRadius * 0.5;
    const secondEnd = constrainToCanopy(
      add(end, scale(direction(secondAzimuth, secondElevation), secondLength)),
      metrics,
    );
    pushSegment(segments, {
      depth: spec.depth + 2,
      end: secondEnd,
      endRadius: secondRadius * 0.3,
      seed: random(spec.seed, twig, 880),
      start: end,
      startRadius: endRadius,
    });
    tips.push({ position: secondEnd, radius: 15 * secondRadius });
  }
}

function addMainBranch(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  seed: number,
  branch: number,
): void {
  const start = trunkPoint(metrics, 0.7 + 0.25 * random(seed, branch, 0, 1_200));
  const azimuth =
    (branch / metrics.branchCount) * Math.PI * 2 + 0.4 * (random(seed, branch, 0, 900) - 0.5);
  const reach = metrics.canopyRadius * (0.45 + 0.28 * random(seed, branch, 0, 1_000));
  const target: Vec3 = [
    metrics.canopyOffsetX + Math.cos(azimuth) * reach,
    metrics.trunkHeight * (0.8 + 0.2 * random(seed, branch, 0, 1_050)),
    metrics.canopyOffsetZ +
      Math.sin(azimuth) * reach * (metrics.canopyDepth / metrics.canopyRadius),
  ];
  let previous = start;
  let radius = metrics.trunkRadius * (0.4 + 0.15 * random(seed, branch, 0, 1_100));
  for (let part = 0; part < 3; part++) {
    const progress = (part + 1) / 3;
    const arch = Math.sin(progress * Math.PI) * metrics.canopyRadius * 0.3 * (1 - progress);
    const end: Vec3 = [
      mix(start[0], target[0], progress) + 0.015 * (random(seed, branch, part, 150) - 0.5),
      mix(start[1], target[1], progress) + arch,
      mix(start[2], target[2], progress) + 0.015 * (random(seed, branch, part, 250) - 0.5),
    ];
    const endRadius = radius * (0.55 + 0.1 * random(seed, branch, part, 350));
    pushSegment(segments, {
      depth: 1,
      end,
      endRadius,
      seed: random(seed, branch, part, 400),
      start: previous,
      startRadius: radius,
    });
    if (part >= 1) {
      const twigTarget = constrainToCanopy(
        [
          end[0] + (random(seed, branch, part, 610) - 0.5) * metrics.canopyRadius * 0.45,
          end[1] + metrics.canopyRadius * (0.05 + 0.1 * random(seed, branch, part, 620)),
          end[2] + (random(seed, branch, part, 630) - 0.5) * metrics.canopyRadius * 0.45,
        ],
        metrics,
      );
      addTwigBurst(segments, tips, metrics, {
        baseAzimuth: azimuth,
        depth: 2,
        end: twigTarget,
        endRadius: endRadius * 0.25,
        seed,
        start: end,
        startRadius: endRadius * 0.6,
      });
    }
    previous = end;
    radius = endRadius;
  }
  tips.push({ position: previous, radius: 30 * radius });
}

function addCrownBranch(
  segments: TreeSegment[],
  tips: TreeTip[],
  metrics: TreeMetrics,
  spec: CrownBranchSpec,
): void {
  const start = trunkPoint(metrics, 0.95);
  const azimuth =
    (spec.index / spec.count) * Math.PI * 2 + 0.5 * random(spec.seed, spec.index, 0, 2_100);
  const reach = metrics.canopyRadius * (0.1 + 0.25 * random(spec.seed, spec.index, 0, 2_200));
  let radius = metrics.trunkRadius * (0.3 + 0.12 * random(spec.seed, spec.index, 0, 2_300));
  const parts = 2 + Math.floor(random(spec.seed, spec.index, 0, 2_400));
  let previous = start;
  for (let part = 0; part < parts; part++) {
    const progress = (part + 1) / parts;
    const end: Vec3 = [
      start[0] +
        Math.cos(azimuth) * reach * progress +
        0.01 * (random(spec.seed, spec.index, part, 2_500) - 0.5),
      start[1] +
        (metrics.maxHeight - start[1]) *
          progress *
          (0.7 + 0.3 * random(spec.seed, spec.index, part, 2_700)),
      start[2] +
        Math.sin(azimuth) * reach * progress +
        0.01 * (random(spec.seed, spec.index, part, 2_600) - 0.5),
    ];
    const endRadius = radius * (0.5 + 0.1 * random(spec.seed, spec.index, part, 2_800));
    pushSegment(segments, {
      depth: 1,
      end,
      endRadius,
      seed: random(spec.seed, spec.index, part, 2_900),
      start: previous,
      startRadius: radius,
    });
    previous = end;
    radius = endRadius;
  }
  tips.push({ position: previous, radius: 35 * radius });
  const twigTarget = constrainToCanopy(
    [
      previous[0] + (random(spec.seed, spec.index, 0, 3_000) - 0.5) * metrics.canopyRadius * 0.35,
      previous[1] + metrics.canopyRadius * 0.08,
      previous[2] + (random(spec.seed, spec.index, 0, 3_100) - 0.5) * metrics.canopyRadius * 0.35,
    ],
    metrics,
  );
  addTwigBurst(segments, tips, metrics, {
    baseAzimuth: azimuth,
    depth: 2,
    end: twigTarget,
    endRadius: radius * 0.3,
    seed: spec.seed,
    start: previous,
    startRadius: radius * 0.7,
  });
}

function createTree(model: SeedModel): {
  metrics: TreeMetrics;
  segments: TreeSegment[];
  tips: TreeTip[];
} {
  const metrics = measureTree(model);
  const seed = sceneSeed(model);
  const segments: TreeSegment[] = [];
  const tips: TreeTip[] = [];
  if (model.archetype === "conifer") {
    addConiferTree(segments, tips, metrics, seed);
    return { metrics, segments, tips };
  }
  if (model.archetype === "banana") {
    addBananaTree(segments, tips, metrics, seed);
    return { metrics, segments, tips };
  }
  if (model.archetype === "multi-trunk") {
    addForkedTree(segments, tips, metrics, seed);
    return { metrics, segments, tips };
  }
  addTrunk(segments, metrics);
  const crownCount = 3 + Math.floor(2 * random(seed, 0, 0, 2_000));
  for (let crown = 0; crown < crownCount; crown++) {
    addCrownBranch(segments, tips, metrics, { count: crownCount, index: crown, seed });
  }
  for (let branch = 0; branch < metrics.branchCount; branch++) {
    addMainBranch(segments, tips, metrics, seed, branch);
  }
  return { metrics, segments, tips };
}

function packSegments(segments: readonly TreeSegment[]): Float32Array {
  const packed = new Float32Array(segments.length * 12);
  segments.forEach((segment, index) => {
    const offset = index * 12;
    packed.set([...segment.start, segment.startRadius], offset);
    packed.set([...segment.end, segment.endRadius], offset + 4);
    packed.set([segment.depth, segment.seed, 0, 0], offset + 8);
  });
  return packed;
}

function toGridPoint(model: SeedModel, x: number, z: number): readonly [number, number] {
  const halfGrid = model.qrSize * SEED_BLOCK_SIZE * 0.5;
  return [(x + halfGrid) / SEED_BLOCK_SIZE, (z + halfGrid) / SEED_BLOCK_SIZE];
}

function addTipCluster(
  flowers: number[],
  model: SeedModel,
  appearance: TreeAppearance,
  tip: TreeTip,
  tipIndex: number,
): void {
  const seed = sceneSeed(model);
  if (random(seed, tipIndex, 0, 780) < 0.01) return;
  const halfGrid = model.qrSize * SEED_BLOCK_SIZE * 0.5;
  const radial = Math.hypot(tip.position[0], tip.position[2]);
  const centerBoost = 1 + 0.45 * (1 - Math.min(1, radial / (halfGrid * 0.46)));
  const density = (1 + 0.3 * random(seed, tipIndex, 3, 790)) * centerBoost;
  const clusterRadius = tip.radius * SEED_BLOCK_SIZE * 9 * density;
  const count = Math.max(40, Math.floor(60 * tip.radius * appearance.bloomDensity * density));
  for (let index = 0; index < count; index++) {
    const organSeed = random(seed, tipIndex, index, 800);
    const angle = random(seed, tipIndex, index, 810) * Math.PI * 2;
    const vertical = 2 * random(seed, tipIndex, index, 820) - 1;
    const plane = Math.sqrt(1 - vertical * vertical);
    const radius = clusterRadius * Math.sqrt(random(seed, tipIndex, index, 830));
    const x = tip.position[0] + radius * plane * Math.cos(angle) * 1.5;
    const y = tip.position[1] + radius * vertical * 1.1 + clusterRadius * 0.1;
    const z = tip.position[2] + radius * plane * Math.sin(angle) * 1.5;
    const [column, row] = toGridPoint(model, x, z);
    const isFruit = index === 0 && organSeed < appearance.fruitfulness * 0.12;
    flowers.push(column, row, y, organSeed + (isFruit ? 2 : 0));
  }
  const hangingCount = 6 + Math.floor(6 * random(seed, tipIndex, 0, 1_500));
  for (let index = 0; index < hangingCount; index++) {
    const organSeed = random(seed, tipIndex, index, 1_600);
    const angle = random(seed, tipIndex, index, 1_700) * Math.PI * 2;
    const radius = clusterRadius * 0.5;
    const x = tip.position[0] + Math.cos(angle) * radius;
    const y = tip.position[1] - SEED_BLOCK_SIZE * (0.5 + 2 * organSeed);
    const z = tip.position[2] + Math.sin(angle) * radius;
    const [column, row] = toGridPoint(model, x, z);
    flowers.push(column, row, y, organSeed);
  }
  if (random(seed, tipIndex, 2, 900) < appearance.leafDensity) {
    const angle = random(seed, tipIndex, 0, 910) * Math.PI * 2;
    const [column, row] = toGridPoint(
      model,
      tip.position[0] + Math.cos(angle) * clusterRadius * 0.4,
      tip.position[2] + Math.sin(angle) * clusterRadius * 0.4,
    );
    flowers.push(column, row, tip.position[1] - SEED_BLOCK_SIZE * 0.5, 1 + random(seed, tipIndex));
  }
}

type CanopyField = {
  readonly baseY: number;
  readonly centerColumn: number;
  readonly centerRow: number;
  readonly domeHeight: number;
  readonly innerRadius: number;
  readonly radiusColumns: number;
  readonly radiusRows: number;
  readonly salt: number;
};

type CanopyLobe = {
  readonly depth: number;
  readonly height: number;
  readonly lift: number;
  readonly salt: number;
  readonly width: number;
  readonly x: number;
  readonly z: number;
};

function createCanopyLobe(field: CanopyField, lobe: CanopyLobe, innerRadius = 0.04): CanopyField {
  return {
    baseY: field.baseY + field.domeHeight * lobe.lift,
    centerColumn: field.centerColumn + field.radiusColumns * lobe.x,
    centerRow: field.centerRow + field.radiusRows * lobe.z,
    domeHeight: field.domeHeight * lobe.height,
    innerRadius,
    radiusColumns: field.radiusColumns * lobe.width,
    radiusRows: field.radiusRows * lobe.depth,
    salt: lobe.salt,
  };
}

function roundCanopyFields(field: CanopyField): readonly CanopyField[] {
  return [
    createCanopyLobe(field, {
      depth: 0.7,
      height: 0.58,
      lift: 0,
      salt: 500,
      width: 0.6,
      x: -0.27,
      z: -0.05,
    }),
    createCanopyLobe(field, {
      depth: 0.76,
      height: 0.6,
      lift: 0.02,
      salt: 1_000,
      width: 0.62,
      x: 0.27,
      z: 0.05,
    }),
    createCanopyLobe(field, {
      depth: 0.64,
      height: 0.56,
      lift: 0.28,
      salt: 1_500,
      width: 0.6,
      x: -0.04,
      z: 0,
    }),
    createCanopyLobe(field, {
      depth: 0.48,
      height: 0.4,
      lift: 0.54,
      salt: 1_750,
      width: 0.42,
      x: 0.04,
      z: -0.02,
    }),
  ];
}

function cloudCanopyFields(field: CanopyField): readonly CanopyField[] {
  return [
    createCanopyLobe(field, {
      depth: 0.72,
      height: 0.34,
      lift: 0,
      salt: 2_000,
      width: 0.78,
      x: -0.16,
      z: -0.05,
    }),
    createCanopyLobe(field, {
      depth: 0.7,
      height: 0.34,
      lift: 0.26,
      salt: 2_500,
      width: 0.68,
      x: 0.18,
      z: 0.04,
    }),
    createCanopyLobe(field, {
      depth: 0.56,
      height: 0.3,
      lift: 0.52,
      salt: 3_000,
      width: 0.54,
      x: -0.08,
      z: -0.02,
    }),
    createCanopyLobe(field, {
      depth: 0.42,
      height: 0.24,
      lift: 0.75,
      salt: 3_250,
      width: 0.4,
      x: 0.08,
      z: 0.02,
    }),
  ];
}

function windsweptCanopyFields(field: CanopyField): readonly CanopyField[] {
  return [
    createCanopyLobe(field, {
      depth: 0.68,
      height: 0.58,
      lift: 0.02,
      salt: 3_500,
      width: 0.52,
      x: -0.2,
      z: 0.04,
    }),
    createCanopyLobe(field, {
      depth: 0.64,
      height: 0.56,
      lift: 0.2,
      salt: 4_000,
      width: 0.62,
      x: 0.25,
      z: -0.08,
    }),
    createCanopyLobe(field, {
      depth: 0.48,
      height: 0.42,
      lift: 0.42,
      salt: 4_500,
      width: 0.42,
      x: 0.54,
      z: 0.12,
    }),
  ];
}

function willowCanopyFields(field: CanopyField): readonly CanopyField[] {
  return [
    createCanopyLobe(field, {
      depth: 0.78,
      height: 0.78,
      lift: 0.16,
      salt: 5_000,
      width: 0.7,
      x: 0,
      z: 0,
    }),
    createCanopyLobe(field, {
      depth: 0.62,
      height: 0.52,
      lift: 0,
      salt: 5_300,
      width: 0.46,
      x: -0.34,
      z: -0.04,
    }),
    createCanopyLobe(field, {
      depth: 0.62,
      height: 0.52,
      lift: 0.02,
      salt: 5_600,
      width: 0.46,
      x: 0.34,
      z: 0.04,
    }),
  ];
}

function umbrellaCanopyFields(field: CanopyField): readonly CanopyField[] {
  return [
    createCanopyLobe(
      field,
      {
        depth: 0.94,
        height: 0.86,
        lift: 0.1,
        salt: 6_000,
        width: 0.98,
        x: 0,
        z: 0,
      },
      0.24,
    ),
  ];
}

function multiTrunkCanopyFields(field: CanopyField, seed: number): readonly CanopyField[] {
  const count = 2 + Math.floor(random(seed, 0, 0, 3_900) * 2);
  return Array.from({ length: count }, (_, index) => {
    const x = (index - (count - 1) * 0.5) * 0.48;
    return createCanopyLobe(field, {
      depth: 0.72,
      height: 0.82 + random(seed, index, 0, 3_950) * 0.1,
      lift: 0.08 + random(seed, index, 0, 4_000) * 0.08,
      salt: 6_500 + index * 400,
      width: 0.56,
      x,
      z: (index % 2 === 0 ? -1 : 1) * 0.05,
    });
  });
}

function createCanopyFields(model: SeedModel, metrics: TreeMetrics): readonly CanopyField[] {
  const halfGrid = model.qrSize * 0.5;
  const field: CanopyField = {
    baseY: metrics.canopyBaseY,
    centerColumn: halfGrid + metrics.canopyOffsetX / SEED_BLOCK_SIZE,
    centerRow: halfGrid + metrics.canopyOffsetZ / SEED_BLOCK_SIZE,
    domeHeight: metrics.canopyDomeHeight,
    innerRadius: 0.04,
    radiusColumns: metrics.canopyRadius / SEED_BLOCK_SIZE,
    radiusRows: metrics.canopyDepth / SEED_BLOCK_SIZE,
    salt: 0,
  };
  switch (metrics.archetype) {
    case "round":
      return roundCanopyFields(field);
    case "cloud":
      return cloudCanopyFields(field);
    case "windswept":
      return windsweptCanopyFields(field);
    case "willow":
      return willowCanopyFields(field);
    case "umbrella":
      return umbrellaCanopyFields(field);
    case "multi-trunk":
      return multiTrunkCanopyFields(field, sceneSeed(model));
    default:
      return [field];
  }
}

function canopyHeightRange(
  metrics: TreeMetrics,
  field: CanopyField,
  normalizedRadius: number,
): readonly [number, number] {
  if (metrics.archetype === "conifer") {
    const height = field.domeHeight * Math.max(0.04, 1 - normalizedRadius);
    return [field.baseY + height * 0.08, field.baseY + height];
  }
  const sphere =
    Math.max(0, 1 - normalizedRadius ** 2) ** (1 / Math.max(1, metrics.canopyRoundness));
  const verticalScale = metrics.archetype === "umbrella" ? 0.4 : 0.5;
  const center = field.baseY + field.domeHeight * 0.52;
  const halfHeight = field.domeHeight * verticalScale * sphere;
  const terrace =
    Math.floor(normalizedRadius * 4) * metrics.canopyTiering * field.domeHeight * 0.08;
  return [center - halfHeight * 0.78 - terrace, center + halfHeight - terrace];
}

const CANOPY_GAP_GROUP_SIZE = 3;
export const CANOPY_COLUMN_GAP_RATE = 0.14;

function omitsInteriorCanopyColumn(
  model: SeedModel,
  metrics: TreeMetrics,
  column: number,
  row: number,
): boolean {
  const center = model.qrSize * 0.5;
  const normalizedX =
    (column - center - metrics.canopyOffsetX / SEED_BLOCK_SIZE) /
    (metrics.canopyRadius / SEED_BLOCK_SIZE);
  const normalizedZ =
    (row - center - metrics.canopyOffsetZ / SEED_BLOCK_SIZE) /
    (metrics.canopyDepth / SEED_BLOCK_SIZE);
  if (Math.hypot(normalizedX, normalizedZ) >= 0.72) return false;

  const groupColumn = Math.floor(column / CANOPY_GAP_GROUP_SIZE);
  const groupRow = Math.floor(row / CANOPY_GAP_GROUP_SIZE);
  return random(sceneSeed(model), groupColumn, groupRow, 9_650) < CANOPY_COLUMN_GAP_RATE;
}

function addCanopyField(
  flowers: number[],
  model: SeedModel,
  metrics: TreeMetrics,
  field: CanopyField,
): void {
  const seed = sceneSeed(model);
  for (let row = 0; row < model.qrSize; row++) {
    for (let column = 0; column < model.qrSize; column++) {
      if (omitsInteriorCanopyColumn(model, metrics, column, row)) continue;
      const normalizedX = (column - field.centerColumn) / field.radiusColumns;
      const normalizedZ = (row - field.centerRow) / field.radiusRows;
      const normalizedRadius = Math.hypot(normalizedX, normalizedZ);
      if (normalizedRadius >= 1 || normalizedRadius < field.innerRadius) continue;
      const [bottomY, topY] = canopyHeightRange(metrics, field, normalizedRadius);
      const layerCount = 3 + Math.floor(random(seed, column, row, 600 + field.salt) * 3);
      for (let layer = 0; layer < layerCount; layer++) {
        const layerProgress = (layer + 0.5) / layerCount;
        const height = mix(bottomY, topY, layerProgress);
        const organCount = 2 + Math.floor(metrics.canopyDensity * 1.5);
        for (let organ = 0; organ < organCount; organ++) {
          flowers.push(
            column + 1.2 * (random(seed, column, organ, 700 + row + field.salt) - 0.5),
            row + 1.2 * (random(seed, row, organ, 800 + column + field.salt) - 0.5),
            height + (random(seed, column + row, organ, 900 + field.salt) - 0.5) * SEED_BLOCK_SIZE,
            random(seed, column, row, 1_000 + organ + layer * 10 + field.salt),
          );
        }
      }
      if (random(seed, column, row, 1_100) >= 0.35) continue;
      flowers.push(
        column + 0.5 * (random(seed, column, row, 1_200) - 0.5),
        row + 0.5 * (random(seed, row, column, 1_300) - 0.5),
        mix(bottomY, topY, 0.45),
        1 + random(seed, column, row, 1_400),
      );
    }
  }
}

function addBananaFronds(flowers: number[], model: SeedModel, metrics: TreeMetrics): void {
  const seed = sceneSeed(model);
  const center = model.qrSize * 0.5;
  const frondCount = metrics.branchCount;
  const steps = 18;
  const crossSections = 9;
  const reach = metrics.canopyRadius / SEED_BLOCK_SIZE;
  for (let frond = 0; frond < frondCount; frond++) {
    const angle = (frond / frondCount) * Math.PI * 2;
    const length = reach * (0.82 + random(seed, frond, 0, 6_600) * 0.18);
    for (let step = 0; step < steps; step++) {
      const progress = (step + 1) / steps;
      const centerColumn = center + Math.cos(angle) * length * progress;
      const centerRow = center + Math.sin(angle) * length * progress;
      const width = Math.sin(progress * Math.PI) * 1.35;
      const height =
        metrics.trunkHeight * 1.08 +
        Math.sin(progress * Math.PI * 0.92) * metrics.canopyDomeHeight * 1.08 -
        progress ** 1.7 * metrics.canopyDomeHeight * 0.32;
      for (let cross = 0; cross < crossSections; cross++) {
        const lateral = ((cross + 0.5) / crossSections - 0.5) * width;
        flowers.push(
          centerColumn - Math.sin(angle) * lateral,
          centerRow + Math.cos(angle) * lateral,
          height + (random(seed, frond, step, 6_700 + cross) - 0.5) * SEED_BLOCK_SIZE,
          5 + random(seed, frond, step, 6_800 + cross) * 0.99,
        );
      }
    }
  }
}

function addWillowCurtains(flowers: number[], model: SeedModel, metrics: TreeMetrics): void {
  const seed = sceneSeed(model);
  const center = model.qrSize * 0.5;
  const curtainCount = 18;
  const steps = 12;
  for (let curtain = 0; curtain < curtainCount; curtain++) {
    const angle = (curtain / curtainCount) * Math.PI * 2;
    const radius =
      (metrics.canopyRadius / SEED_BLOCK_SIZE) * (0.58 + random(seed, curtain, 0, 7_100) * 0.28);
    const top =
      metrics.canopyBaseY +
      metrics.canopyDomeHeight * (0.58 + random(seed, curtain, 0, 7_200) * 0.18);
    const drop = metrics.canopyDomeHeight * (0.7 + random(seed, curtain, 0, 7_300) * 0.28);
    for (let step = 0; step < steps; step++) {
      const progress = step / (steps - 1);
      flowers.push(
        center + Math.cos(angle) * radius + Math.sin(progress * Math.PI) * 0.18,
        center + Math.sin(angle) * radius,
        top - drop * progress,
        1 + random(seed, curtain, step, 7_400),
      );
    }
  }
}

export function supportsCanopyFringe(archetype: TreeArchetype): boolean {
  return archetype !== "banana" && archetype !== "conifer" && archetype !== "willow";
}

function addCanopyFringe(flowers: number[], model: SeedModel, metrics: TreeMetrics): void {
  const seed = sceneSeed(model);
  const centerColumn = model.qrSize * 0.5 + metrics.canopyOffsetX / SEED_BLOCK_SIZE;
  const centerRow = model.qrSize * 0.5 + metrics.canopyOffsetZ / SEED_BLOCK_SIZE;
  const fringeCount = 12 + Math.floor(random(seed, 0, 0, 7_500) * 5);
  for (let fringe = 0; fringe < fringeCount; fringe++) {
    const angle = (fringe / fringeCount) * Math.PI * 2;
    const radius =
      (metrics.canopyRadius / SEED_BLOCK_SIZE) * (0.68 + random(seed, fringe, 0, 7_600) * 0.24);
    const top =
      metrics.canopyBaseY +
      metrics.canopyDomeHeight * (0.38 + random(seed, fringe, 0, 7_700) * 0.22);
    const steps = 4 + Math.floor(random(seed, fringe, 0, 7_800) * 3);
    const drop = metrics.canopyDomeHeight * (0.2 + random(seed, fringe, 0, 7_900) * 0.2);
    for (let step = 0; step < steps; step++) {
      const progress = step / (steps - 1);
      const inwardCurve = Math.sin(progress * Math.PI) * 0.18;
      flowers.push(
        centerColumn + Math.cos(angle) * (radius - inwardCurve),
        centerRow + Math.sin(angle) * (radius - inwardCurve),
        top - drop * progress,
        random(seed, fringe, step, 8_000),
      );
    }
  }
}

function addCanopySurface(flowers: number[], model: SeedModel, metrics: TreeMetrics): void {
  if (metrics.archetype === "banana") {
    addBananaFronds(flowers, model, metrics);
    return;
  }
  for (const field of createCanopyFields(model, metrics)) {
    addCanopyField(flowers, model, metrics, field);
  }
  if (metrics.archetype === "willow") addWillowCurtains(flowers, model, metrics);
  if (supportsCanopyFringe(metrics.archetype)) addCanopyFringe(flowers, model, metrics);
}

function removeInteriorCanopyColumns(
  flowers: readonly number[],
  model: SeedModel,
  metrics: TreeMetrics,
): number[] {
  if (metrics.archetype === "banana" || metrics.archetype === "conifer") return [...flowers];
  const filtered: number[] = [];
  for (let offset = 0; offset < flowers.length; offset += 4) {
    const column = Math.round(flowers[offset] ?? 0);
    const row = Math.round(flowers[offset + 1] ?? 0);
    if (omitsInteriorCanopyColumn(model, metrics, column, row)) continue;
    filtered.push(
      flowers[offset] ?? 0,
      flowers[offset + 1] ?? 0,
      flowers[offset + 2] ?? 0,
      flowers[offset + 3] ?? 0,
    );
  }
  return filtered;
}

function createGroundPetals(model: SeedModel, appearance: TreeAppearance): Float32Array {
  const petals: number[] = [];
  const seed = sceneSeed(model);
  const center = model.qrSize / 2;
  const count = Math.round(80 * (0.82 + appearance.bloomDensity * 0.18));
  for (let index = 0; index < count; index++) {
    const angle = random(seed, index, 0, 10_100) * Math.PI * 2;
    const radialGene = random(seed, index, 0, 10_200);
    const radius = model.qrSize * (0.1 + radialGene ** 2 * 0.36);
    const column = center + Math.cos(angle) * radius;
    const row = center + Math.sin(angle) * radius;
    const height = SEED_BLOCK_SIZE * (1.04 + random(seed, index, 0, 10_400) * 0.06);
    const petalSeed = random(seed, index, 0, 10_500);
    petals.push(column, row, height, petalSeed);
  }
  return new Float32Array(petals);
}

function createFallingPetals(tips: readonly TreeTip[], model: SeedModel): Float32Array {
  if (tips.length === 0) return new Float32Array();
  const petals: number[] = [];
  const seed = sceneSeed(model);
  const halfGrid = model.qrSize * SEED_BLOCK_SIZE * 0.5;
  const count = 10;
  for (let index = 0; index < count; index++) {
    const tipIndex = Math.floor(random(seed, index, 0, 11_000) * tips.length) % tips.length;
    const tip = tips[tipIndex];
    if (!tip) continue;
    const angle = random(seed, index, 0, 11_100) * Math.PI * 2;
    const radius = tip.radius * SEED_BLOCK_SIZE * random(seed, index, 0, 11_200);
    const x = tip.position[0] + Math.cos(angle) * radius;
    const z = tip.position[2] + Math.sin(angle) * radius;
    const topY = tip.position[1] + SEED_BLOCK_SIZE * (0.5 + random(seed, index, 0, 11_300));
    petals.push(
      (x + halfGrid) / SEED_BLOCK_SIZE,
      (z + halfGrid) / SEED_BLOCK_SIZE,
      topY,
      random(seed, index, 0, 11_400),
    );
  }
  return new Float32Array(petals);
}

function createRain(model: SeedModel): Float32Array {
  const rain = new Float32Array(500 * 4);
  const seed = sceneSeed(model);
  const spread = model.qrSize * 1.2;
  const inset = (spread - model.qrSize) * 0.5;
  for (let index = 0; index < 500; index++) {
    const offset = index * 4;
    rain[offset] = random(seed, index, 0, 12_100) * spread - inset;
    rain[offset + 1] = random(seed, index, 0, 12_200) * spread - inset;
    rain[offset + 2] = random(seed, index, 0, 12_300);
    rain[offset + 3] = random(seed, index, 0, 12_400);
  }
  return rain;
}

function createButterflies(model: SeedModel): Float32Array {
  const butterflies = new Float32Array(10 * 4);
  const seed = sceneSeed(model);
  const orbitLimit = model.qrSize * 0.46;
  for (let index = 0; index < 10; index++) {
    const offset = index * 4;
    butterflies[offset] = orbitLimit * (0.35 + random(seed, index, 0, 13_100) * 0.55);
    butterflies[offset + 1] = 0.25 + random(seed, index, 0, 13_200) * 0.3;
    butterflies[offset + 2] = 4 + random(seed, index, 0, 13_300) * 9;
    butterflies[offset + 3] = random(seed, index, 0, 13_400);
  }
  return butterflies;
}

function packOrgans(flowers: number[]): PackedOrgans {
  let blossomCount = 0;
  let fruitCount = 0;
  let leafCount = 0;
  for (let offset = 3; offset < flowers.length; offset += 4) {
    const organType = Math.floor(flowers[offset] ?? 0);
    if (organType >= 5) leafCount++;
    else if (organType >= 2) fruitCount++;
    else if (organType >= 1) leafCount++;
    else blossomCount++;
  }
  return {
    blossomCount,
    data: new Float32Array(flowers),
    fruitCount,
    leafCount,
  };
}

function createFlowers(
  model: SeedModel,
  tips: readonly TreeTip[],
  appearance: TreeAppearance,
  metrics: TreeMetrics,
): PackedOrgans {
  const flowers: number[] = [];
  if (model.archetype === "banana") {
    addCanopySurface(flowers, model, metrics);
    return packOrgans(flowers);
  }
  const clusterTips =
    model.archetype === "round"
      ? tips.filter(
          (tip) => tip.position[1] < metrics.canopyBaseY + metrics.canopyDomeHeight * 0.72,
        )
      : tips;
  clusterTips.forEach((tip, index) => addTipCluster(flowers, model, appearance, tip, index));
  addCanopySurface(flowers, model, metrics);
  return packOrgans(removeInteriorCanopyColumns(flowers, model, metrics));
}

function createGrass(model: SeedModel): Float32Array {
  const grass: number[] = [];
  const center = model.qrSize / 2;
  const canopyRadiusSquared = (model.qrSize * 0.46) ** 2;
  for (const module of model.modules) {
    const column = module.index % model.qrSize;
    const row = Math.floor(module.index / model.qrSize);
    const radiusSquared = (column - center) ** 2 + (row - center) ** 2;
    if (radiusSquared < canopyRadiusSquared) continue;
    const bladeCount = 14 + Math.floor(8 * random(model.morphSeed, column, row, 6_100));
    for (let blade = 0; blade < bladeCount; blade++) {
      const bladeSeed = random(model.morphSeed, column, row, 6_200 + blade);
      const columnOffset = 0.85 * (random(model.morphSeed, column, row, 6_300 + blade) - 0.5);
      const rowOffset = 0.85 * (random(model.morphSeed, column, row, 6_400 + blade) - 0.5);
      const height = 0.5 + 1.2 * random(model.morphSeed, column, row, 6_500 + blade);
      grass.push(column + columnOffset, row + rowOffset, bladeSeed, height);
    }
  }
  return new Float32Array(grass);
}

function createTerrainScene(model: SeedModel, appearance: TreeAppearance): SeedGpuScene {
  const empty = new Float32Array();
  const rain = createRain(model);
  return {
    appearance,
    blossomCount: 0,
    butterflies: empty,
    butterflyCount: 0,
    fallingPetalCount: 0,
    fallingPetals: empty,
    flowerCount: 0,
    flowers: empty,
    fruitCount: 0,
    grass: empty,
    grassCount: 0,
    groundPetalCount: 0,
    groundPetals: empty,
    leafCount: 0,
    rain,
    rainCount: rain.length / 4,
    segmentCount: 0,
    segments: empty,
  };
}

function assembleScene(
  model: SeedModel,
  appearance: TreeAppearance,
  organs: PackedOrgans,
  segments: readonly TreeSegment[],
  fallingPetals: Float32Array,
): SeedGpuScene {
  const grass = createGrass(model);
  const groundPetals = createGroundPetals(model, appearance);
  const rain = createRain(model);
  const butterflies = createButterflies(model);
  return {
    appearance,
    blossomCount: organs.blossomCount,
    butterflies,
    butterflyCount: butterflies.length / 4,
    fallingPetalCount: fallingPetals.length / 4,
    fallingPetals,
    flowerCount: organs.data.length / 4,
    flowers: organs.data,
    fruitCount: organs.fruitCount,
    grass,
    grassCount: grass.length / 4,
    groundPetalCount: groundPetals.length / 4,
    groundPetals,
    leafCount: organs.leafCount,
    rain,
    rainCount: rain.length / 4,
    segmentCount: segments.length,
    segments: packSegments(segments),
  };
}

export function createSeedGpuScene(model: SeedModel, form: SeedForm = "tree"): SeedGpuScene {
  const appearance = createTreeAppearance(model);
  if (form === "terrain") {
    return createTerrainScene(model, appearance);
  }
  const tree = createTree(model);
  const organs = createFlowers(model, tree.tips, appearance, tree.metrics);
  return assembleScene(
    model,
    appearance,
    organs,
    tree.segments,
    createFallingPetals(tree.tips, model),
  );
}
