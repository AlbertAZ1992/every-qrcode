import { SEED_UNIFORMS_WGSL } from "./shared-shaders.js";
import { CANOPY_GAP_RATE } from "./tree-constants.js";

export const TREE_BLOCK_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct BlockOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) blockType: u32,
  @location(2) column: f32,
  @location(3) row: f32,
  @location(4) uv: vec2f,
  @location(5) layer: f32,
  @location(6) @interpolate(flat) neighborMask: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> blockTypes: array<u32>;
@group(0) @binding(2) var<storage, read> blockPositions: array<vec4f>;
@group(0) @binding(3) var<storage, read> blockHeights: array<f32>;
@group(0) @binding(4) var<storage, read> blockBaseY: array<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> BlockOutput {
  var output: BlockOutput;
  let blockIndex = vertexIndex / 36u;
  let localVertexIndex = vertexIndex % 36u;
  let faceIndex = localVertexIndex / 6u;
  let quadIndex = localVertexIndex % 6u;
  let quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let uv = quad[quadIndex];
  let positionData = blockPositions[blockIndex];
  let column = positionData.x;
  let row = positionData.y;
  let blockSize = uniforms.blockSize;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let centerX = (column + 0.5) * blockSize - halfGrid;
  let centerZ = (row + 0.5) * blockSize - halfGrid;
  let baseY = blockBaseY[blockIndex];
  let height = mix(blockHeights[blockIndex], blockSize, uniforms.progress);
  let treeProgress = 1.0 - uniforms.progress;
  let layer = baseY / blockSize;
  let revealStart = clamp(layer / 42.0, 0.0, 0.46);
  let layerRise = select(
    1.0,
    smoothstep(revealStart, min(1.0, revealStart + 0.42), treeProgress),
    baseY > 0.001,
  );
  let semanticAbsorb = 1.0 - smoothstep(0.68, 0.98, treeProgress);
  let layerScale = select(1.0, layerRise * semanticAbsorb, baseY > 0.001);
  let animatedBaseY = baseY * layerRise;
  let animatedHeight = height * layerScale;
  let halfWidth = blockSize * 0.5;
  var localPos = vec3f(0.0);
  var normal = vec3f(0.0);

  if (faceIndex == 0u) {
    localPos = vec3f(
      centerX + (uv.x - 0.5) * blockSize * layerScale,
      animatedBaseY + animatedHeight,
      centerZ + (uv.y - 0.5) * blockSize * layerScale,
    );
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (faceIndex == 1u) {
    localPos = vec3f(
      centerX + (uv.x - 0.5) * blockSize * layerScale,
      animatedBaseY,
      centerZ + (0.5 - uv.y) * blockSize * layerScale,
    );
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (faceIndex == 2u) {
    localPos = vec3f(
      centerX + (uv.x - 0.5) * blockSize * layerScale,
      animatedBaseY + uv.y * animatedHeight,
      centerZ + halfWidth * layerScale,
    );
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (faceIndex == 3u) {
    localPos = vec3f(
      centerX + (0.5 - uv.x) * blockSize * layerScale,
      animatedBaseY + uv.y * animatedHeight,
      centerZ - halfWidth * layerScale,
    );
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (faceIndex == 4u) {
    localPos = vec3f(
      centerX + halfWidth * layerScale,
      animatedBaseY + uv.y * animatedHeight,
      centerZ + (uv.x - 0.5) * blockSize * layerScale,
    );
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    localPos = vec3f(
      centerX - halfWidth * layerScale,
      animatedBaseY + uv.y * animatedHeight,
      centerZ + (0.5 - uv.x) * blockSize * layerScale,
    );
    normal = vec3f(-1.0, 0.0, 0.0);
  }

  let blockType = blockTypes[blockIndex];
  output.position = projectPosition(localPos);
  output.normal = normal;
  output.blockType = blockType;
  output.column = column;
  output.row = row;
  output.uv = uv;
  output.layer = layer;
  output.neighborMask = u32(positionData.w);
  return output;
}

fn qrModuleMask(uv: vec2f, neighborMask: u32) -> f32 {
  let up = (neighborMask & 1u) != 0u;
  let right = (neighborMask & 2u) != 0u;
  let down = (neighborMask & 4u) != 0u;
  let left = (neighborMask & 8u) != 0u;
  let radius = 0.46;
  var mask = 1.0;
  if (!left && !up && uv.x < radius && uv.y < radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(radius, radius)));
  }
  if (!right && !up && uv.x > 1.0 - radius && uv.y < radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(1.0 - radius, radius)));
  }
  if (!left && !down && uv.x < radius && uv.y > 1.0 - radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(radius, 1.0 - radius)));
  }
  if (!right && !down && uv.x > 1.0 - radius && uv.y > 1.0 - radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(1.0 - radius, 1.0 - radius)));
  }
  return mask;
}

@fragment
fn fragmentMain(input: BlockOutput) -> @location(0) vec4f {
  let normal = normalize(input.normal);
  let blockSeed = input.column * 17.3 + input.row * 31.1 + input.layer * 73.7;
  let noiseA = fract(sin(blockSeed) * 43758.5);
  let noiseB = fract(sin(blockSeed * 1.7 + 127.1) * 43758.5);
  let noiseC = fract(sin(blockSeed * 2.3 + 311.7) * 43758.5);
  let center = uniforms.gridSize * 0.5;
  let shadowDelta = vec2f(input.column, input.row) - vec2f(center + 1.5);
  let shadowDistance = length(shadowDelta);
  let canopyRadius = uniforms.gridSize * 0.46;
  let canopyShadow = 1.0 - smoothstep(2.5, canopyRadius, shadowDistance);
  let trunkOcclusion = (1.0 - smoothstep(0.0, 3.75, shadowDistance)) * 0.2;
  let treeShadow = 1.0 - canopyShadow * 0.35 - trunkOcclusion;
  let layerRatio = min(input.layer / 15.0, 1.0);
  let canopyOcclusion = 0.65 + layerRatio * 0.35;
  var albedo = vec3f(0.5);
  if (normal.y > 0.5) {
    if (input.blockType == 0u) {
      let groundBase = mix(uniforms.themeFifth.rgb, uniforms.themeThird.rgb, 0.42);
      let dirtLight = mix(groundBase, vec3f(1.0), 0.48);
      let dirtMid = mix(groundBase, uniforms.themeThird.rgb, 0.13);
      let dirtDark = mix(groundBase, uniforms.themeThird.rgb, 0.24);
      if (noiseA < 0.4) {
        albedo = mix(dirtLight, dirtMid, noiseA / 0.4);
      } else if (noiseA < 0.7) {
        albedo = mix(dirtMid, dirtDark, (noiseA - 0.4) / 0.3);
      } else {
        albedo = mix(dirtDark, dirtDark * 0.85, (noiseA - 0.7) / 0.3);
      }
      albedo *= (1.0 + (noiseB - 0.5) * 0.18 + (noiseC - 0.5) * 0.08) * treeShadow;
      let groundRadius = distance(vec2f(input.column, input.row), vec2f(center));
      let petalSpeckle = noiseC * step(groundRadius, canopyRadius);
      let fallenPetal = themeFlower(noiseB);
      albedo = mix(albedo, fallenPetal, step(0.85, petalSpeckle) * 0.4);
    } else if (input.blockType == 1u) {
      let light = mix(themeFlower(noiseB), vec3f(1.0), 0.22);
      let middle = themeFlower(noiseB);
      let deep = mix(themeFlower(noiseB), themeInk(), 0.22);
      let rich = mix(themeFlower(noiseB), themeInk(), 0.36);
      if (noiseA < 0.33) {
        albedo = mix(light, middle, noiseA / 0.33);
      } else if (noiseA < 0.66) {
        albedo = mix(middle, deep, (noiseA - 0.33) / 0.33);
      } else {
        albedo = mix(deep, rich, (noiseA - 0.66) / 0.34);
      }
      let edgeDistance = min(min(input.uv.x, 1.0 - input.uv.x), min(input.uv.y, 1.0 - input.uv.y));
      let edgeShade = mix(0.88, 1.0, smoothstep(0.0, 0.12, edgeDistance));
      albedo *= (1.0 + (noiseB - 0.5) * 0.15) * canopyOcclusion * edgeShade;
    } else if (input.blockType == 2u) {
      let bark = themeBark(noiseA);
      albedo = bark * (1.0 + (noiseB - 0.5) * 0.15) * (0.6 + layerRatio * 0.4);
    } else if (input.blockType == 3u) {
      let dark = mix(themeLeaf(noiseB), themeInk(), 0.42);
      let middle = mix(themeLeaf(noiseB), themeInk(), 0.18);
      let bright = mix(themeLeaf(noiseB), vec3f(1.0), 0.12);
      let brown = mix(uniforms.themeFourth.rgb, themeInk(), 0.38);
      if (noiseA < 0.3) {
        albedo = mix(bright, middle, noiseA / 0.3);
      } else if (noiseA < 0.6) {
        albedo = mix(middle, dark, (noiseA - 0.3) / 0.3);
      } else {
        albedo = mix(dark, brown, (noiseA - 0.6) / 0.4);
      }
      albedo *= 1.0 + (noiseB - 0.5) * 0.2;
    } else {
      let sand = mix(uniforms.themeThird.rgb, uniforms.themeFifth.rgb, 0.68 + noiseB * 0.16);
      let fallen = mix(sand, themeFlower(noiseB), max(0.0, noiseA - 0.4) * 0.35);
      albedo = fallen * (1.0 + (noiseB - 0.5) * 0.12) * treeShadow;
    }
    albedo *= vec3f(1.1, 1.08, 1.02);
  } else {
    let sideSun = normalize(vec3f(-0.405616, 0.861934, -0.304212));
    let sideLight = 0.3 + max(dot(normal, sideSun), 0.0) * 0.65;
    if (input.blockType == 1u) {
      let deep = mix(themeFlower(noiseA), themeInk(), 0.3);
      let middle = themeFlower(noiseA);
      albedo = mix(deep, middle, noiseA);
    } else if (input.blockType == 2u) {
      albedo = themeBark(noiseA);
    } else if (input.blockType == 3u) {
      let dark = mix(themeLeaf(noiseA), themeInk(), 0.42);
      let middle = mix(themeLeaf(noiseA), themeInk(), 0.18);
      albedo = mix(dark, middle, noiseA);
    } else {
      albedo = mix(uniforms.themeFourth.rgb, uniforms.themeThird.rgb, noiseA);
    }
    albedo *= sideLight;
  }
  let sunDirection = normalize(vec3f(-0.405616, 0.861934, -0.304212));
  let sun = max(dot(normal, sunDirection), 0.0);
  let up = max(normal.y, 0.0);
  let lit = albedo * (
    vec3f(0.28, 0.28, 0.30) + 1.2 * sun * 0.85
      + vec3f(0.90, 0.85, 0.95) * up * 0.18
      + vec3f(0.55, 0.60, 0.50) * 0.15
  );
  let mapped = clamp(
    (lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14),
    vec3f(0.0),
    vec3f(1.0),
  );
  var treeColor = pow(mapped, vec3f(1.0 / 2.2));
  let gray = dot(treeColor, vec3f(0.299, 0.587, 0.114));
  treeColor = mix(vec3f(gray), treeColor, 1.25);
  let qrPaper = mix(uniforms.themeFifth.rgb, vec3f(1.0), 0.52);
  let qrReveal = smoothstep(0.64, 0.96, uniforms.progress);
  if (
    uniforms.progress > 0.94 &&
    input.blockType != 0u &&
    abs(normal.y) > 0.5 &&
    qrModuleMask(input.uv, input.neighborMask) < 0.5
  ) {
    discard;
  }
  var qrMaterial = treeColor;
  if (input.blockType > 0u) { qrMaterial = themeQr(input.blockType, noiseA); }
  let inactiveColor = mix(treeColor, qrPaper, qrReveal);
  let activeColor = mix(treeColor, qrMaterial, qrReveal);
  var color = select(inactiveColor, activeColor, input.blockType != 0u);
  var snowPatch = 0.2 + step(0.68, noiseC) * 0.3;
  if (input.blockType == 0u) {
    snowPatch = 0.68 + noiseC * 0.2;
  }
  let snowCover = sceneSnow() * (1.0 - qrReveal) * step(0.5, normal.y) * snowPatch;
  color = mix(color, themeSnow(), snowCover);
  return vec4f(color, 1.0);
}
`;

export const TREE_BRANCH_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct BranchOutput {
  @builtin(position) position: vec4f,
  @location(0) normalX: f32,
  @location(1) normalY: f32,
  @location(2) normalZ: f32,
  @location(3) depth: f32,
  @location(4) seed: f32,
  @location(5) ringT: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> segments: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> BranchOutput {
  var output: BranchOutput;
  let segmentIndex = vertexIndex / 48u;
  let localIndex = vertexIndex % 48u;
  let sideIndex = localIndex / 6u;
  let triangleVertex = localIndex % 6u;
  let startData = segments[segmentIndex * 3u];
  let endData = segments[segmentIndex * 3u + 1u];
  let metadata = segments[segmentIndex * 3u + 2u];
  let visibility = smoothstep(0.38, 0.88, 1.0 - uniforms.progress);
  if (visibility < 0.01) {
    output.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return output;
  }
  let angleStart = f32(sideIndex) * 0.78539816;
  let angleEnd = f32(sideIndex + 1u) * 0.78539816;
  var ringT = 0.0;
  var angle = angleStart;
  if (triangleVertex == 1u || triangleVertex == 4u || triangleVertex == 5u) {
    angle = angleEnd;
  }
  if (triangleVertex == 2u || triangleVertex == 3u || triangleVertex == 5u) {
    ringT = 1.0;
  }
  let center = mix(startData.xyz, endData.xyz, ringT);
  let radius = mix(startData.w, endData.w, ringT) * visibility;
  let axis = normalize(endData.xyz - startData.xyz);
  var reference = vec3f(0.0, 1.0, 0.0);
  if (abs(dot(axis, reference)) > 0.95) {
    reference = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(axis, reference));
  let bitangent = normalize(cross(tangent, axis));
  let depth = metadata.x;
  let windAmount = clamp(depth / 4.0, 0.0, 1.0) * 0.016 * visibility
    * sceneBranchBreeze();
  let windBase = sin(uniforms.time * 0.45 + center.x * 15.0 + center.z * 10.0);
  let windTurbulence = sin(uniforms.time * 1.1 + center.x * 40.0 + center.z * 30.0);
  let windX = windBase * windAmount + windTurbulence * windAmount * 0.25;
  let windZ = sin(uniforms.time * 0.35 + center.z * 12.0 + center.x * 8.0);
  let windedCenter = center + vec3f(windX, 0.0, windZ * windAmount * 0.6);
  let radial = tangent * cos(angle) + bitangent * sin(angle);
  let localPos = windedCenter + radial * radius;
  output.position = projectPosition(localPos);
  output.normalX = radial.x;
  output.normalY = radial.y;
  output.normalZ = radial.z;
  output.depth = depth;
  output.seed = metadata.y;
  output.ringT = ringT;
  return output;
}

@fragment
fn fragmentMain(input: BranchOutput) -> @location(0) vec4f {
  let normal = normalize(vec3f(input.normalX, input.normalY, input.normalZ));
  let depthT = clamp(input.depth / 5.0, 0.0, 1.0);
  let isStem = select(0.0, 1.0, input.depth < -0.5 && input.depth > -1.5);
  let isOrbit = select(0.0, 1.0, input.depth <= -1.5);
  let noiseA = fract(sin(input.seed * 43.7 + input.depth * 17.3) * 43758.5);
  let noiseB = fract(sin(input.seed * 73.1 + input.depth * 31.1 + 127.1) * 43758.5);
  var bark = themeBark(noiseA);
  bark = mix(bark, themeLeaf(noiseA), isStem);
  bark = mix(bark, mix(uniforms.themeThird.rgb, uniforms.themeFifth.rgb, 0.32), isOrbit);
  let barkHighlight = mix(uniforms.themeFourth.rgb, uniforms.themeThird.rgb, 0.22);
  bark = mix(bark, barkHighlight, depthT * depthT * 0.2);
  let grooveAngle = fract(sin(input.seed * 127.1 + input.ringT * 31.1) * 43758.5) * 6.28;
  let grooveA = sin(grooveAngle * 8.0 + noiseA * 3.0) * 0.5 + 0.5;
  let grooveB = sin(grooveAngle * 14.0 + noiseB * 5.0 + 1.7) * 0.5 + 0.5;
  let grooveC = sin(grooveAngle * 22.0 + noiseA * 7.0) * 0.5 + 0.5;
  let grooves = (grooveA * 0.5 + grooveB * 0.3 + grooveC * 0.2) * 0.18 + 0.82;
  let rings = sin(input.ringT * 18.0 + noiseB * 6.0) * 0.07 + 0.93;
  let knotNoise = sin(input.seed * 47.3 + input.ringT * 13.0 + noiseA * 8.0);
  let knot = smoothstep(0.88, 0.95, knotNoise) * 0.1;
  let organicTexture = bark * (1.0 + (noiseA - 0.5) * 0.12) * grooves * rings - knot;
  bark = mix(bark, organicTexture, 1.0 - isOrbit * 0.82 - isStem * 0.34);
  let sunDirection = normalize(vec3f(-0.405616, 0.861934, -0.304212));
  let diffuse = max(dot(normal, sunDirection), 0.0);
  let backLight = max(dot(-normal, sunDirection), 0.0);
  let subsurface = backLight * depthT * 0.06 * vec3f(0.6, 0.3, 0.2);
  let sky = max(normal.y, 0.0) * 0.08 * vec3f(0.85, 0.80, 0.90);
  let lit = bark * (vec3f(0.25, 0.25, 0.28) + 1.2 * diffuse * 0.82)
    * (0.75 + depthT * 0.25) + subsurface + sky;
  let exposed = lit * 1.05;
  let mapped = clamp(
    (exposed * (2.51 * exposed + 0.03)) /
      (exposed * (2.43 * exposed + 0.59) + 0.14),
    vec3f(0.0),
    vec3f(1.0),
  );
  var color = pow(mapped, vec3f(1.0 / 2.2));
  let gray = dot(color, vec3f(0.299, 0.587, 0.114));
  color = mix(vec3f(gray), color, 1.25);
  let snowCover = sceneSnow() * smoothstep(0.25, 0.9, normal.y)
    * (0.2 + step(0.68, noiseB) * 0.28);
  color = mix(color, themeSnow(), snowCover);
  return vec4f(color, 1.0);
}
`;

export const TREE_SHADOW_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct ShadowOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> ShadowOutput {
  let quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let uv = quad[vertexIndex];
  let gridWidth = uniforms.gridSize * uniforms.blockSize;
  let center = vec2f(gridWidth * 0.045, gridWidth * 0.03);
  let radius = vec2f(gridWidth * 0.38, gridWidth * 0.31);
  let localPos = vec3f(
    center.x + uv.x * radius.x,
    uniforms.blockSize * 1.018,
    center.y + uv.y * radius.y,
  );
  var output: ShadowOutput;
  output.position = projectPosition(localPos);
  output.uv = uv;
  return output;
}

@fragment
fn fragmentMain(input: ShadowOutput) -> @location(0) vec4f {
  let visibility = smoothstep(0.30, 0.82, 1.0 - uniforms.progress);
  let canopy = 1.0 - smoothstep(0.18, 1.0, length(input.uv));
  let trunk = 1.0 - smoothstep(
    0.02,
    0.24,
    length((input.uv - vec2f(-0.08, -0.02)) * vec2f(1.65, 1.0)),
  );
  let directional = 1.0 - smoothstep(
    0.15,
    0.92,
    length((input.uv - vec2f(0.22, 0.13)) * vec2f(0.82, 1.32)),
  );
  let alpha = (canopy * 0.105 + directional * 0.045 + trunk * 0.11) * visibility;
  let shadowColor = mix(themeInk(), themeLeaf(0.32), 0.34);
  return vec4f(shadowColor, alpha);
}
`;

export const TREE_GRASS_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct GrassOutput {
  @builtin(position) position: vec4f,
  @location(0) normalX: f32,
  @location(1) normalY: f32,
  @location(2) normalZ: f32,
  @location(3) seed: f32,
  @location(4) bladeT: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> grass: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> GrassOutput {
  var output: GrassOutput;
  let verticesPerBlade = 3u;
  let bladeIndex = vertexIndex / verticesPerBlade;
  let bladeVertex = vertexIndex % verticesPerBlade;
  let data = grass[bladeIndex];
  let visibility = smoothstep(0.0, 0.3, 1.0 - uniforms.progress);
  if (visibility < 0.01) {
    output.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return output;
  }

  let blockSize = uniforms.blockSize;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let seed = data.z;
  let baseX = data.x * blockSize - halfGrid;
  let baseZ = data.y * blockSize - halfGrid;
  let bladeHeight = blockSize * data.w * visibility;
  let angle = seed * 6.2831853;
  let halfWidth = blockSize * 0.22;
  let tiltX = (seed - 0.5) * 0.4;
  let tiltZ = (fract(seed * 7.13) - 0.5) * 0.4;
  let windBase = sin(uniforms.time * 0.45 + data.x * 0.25 + data.y * 0.15) * 0.02;
  let windTurbulence =
    sin(uniforms.time * 1.1 + data.x * 0.8 + data.y * 0.6) * 0.005;
  let windX = (windBase + windTurbulence) * sceneBreeze();
  let windZ = sin(uniforms.time * 0.35 + data.x * 0.15 + data.y * 0.25)
    * 0.012 * sceneBreeze();
  let tipX = baseX + (tiltX + windX) * bladeHeight * 4.0;
  let tipZ = baseZ + (tiltZ + windZ) * bladeHeight * 4.0;
  let yLift = blockSize;
  var localPos = vec3f(0.0);
  var normal = vec3f(0.0, 0.3, 0.3);
  var bladeT = 0.0;
  if (bladeVertex == 0u) {
    localPos = vec3f(
      baseX - halfWidth * cos(angle),
      yLift,
      baseZ - halfWidth * sin(angle),
    );
  } else if (bladeVertex == 1u) {
    localPos = vec3f(
      baseX + halfWidth * cos(angle),
      yLift,
      baseZ + halfWidth * sin(angle),
    );
  } else {
    let curlDroop = bladeHeight * seed * 0.15;
    localPos = vec3f(tipX, yLift + bladeHeight - curlDroop, tipZ);
    normal = vec3f(0.0, 0.9, 0.3);
    bladeT = 1.0;
  }
  output.position = projectPosition(localPos);
  output.normalX = normal.x;
  output.normalY = normal.y;
  output.normalZ = normal.z;
  output.seed = seed;
  output.bladeT = bladeT;
  return output;
}

@fragment
fn fragmentMain(input: GrassOutput) -> @location(0) vec4f {
  let normal = normalize(vec3f(input.normalX, input.normalY, input.normalZ));
  let tier = fract(input.seed * 7.31);
  let baseColor = mix(themeGrass(tier), themeInk(), 0.24);
  let tipColor = themeGrass(tier + 0.19);
  var bladeColor = mix(baseColor, tipColor, input.bladeT);
  bladeColor *= 0.82 + fract(input.seed * 11.3) * 0.22;
  let baseOcclusion = mix(0.58, 1.0, smoothstep(0.0, 0.72, input.bladeT));
  bladeColor *= baseOcclusion;
  let sunDirection = normalize(vec3f(-0.405616, 0.861934, -0.304212));
  let diffuse = max(dot(normal, sunDirection), 0.0);
  let backLight = max(dot(-normal, sunDirection), 0.0);
  let transmitted = mix(themeInk(), bladeColor, 0.48);
  let tipGlow = pow(input.bladeT, 3.0) * 0.08 * tipColor;
  let lit = bladeColor * (0.31 + diffuse * 0.94)
    + backLight * transmitted * 0.42 + tipGlow;
  let exposed = lit * 1.1;
  let mapped = clamp(
    (exposed * (2.51 * exposed + 0.03)) /
      (exposed * (2.43 * exposed + 0.59) + 0.14),
    vec3f(0.0),
    vec3f(1.0),
  );
  var color = pow(mapped, vec3f(1.0 / 2.2));
  let gray = dot(color, vec3f(0.299, 0.587, 0.114));
  color = mix(vec3f(gray), color, 1.6);
  let snowCover = sceneSnow() * smoothstep(0.52, 1.0, input.bladeT) * 0.78;
  color = mix(color, themeSnow(), snowCover);
  return vec4f(color, 1.0);
}
`;

export const TREE_FLOWER_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct FlowerOutput {
  @builtin(position) position: vec4f,
  @location(0) petalT: f32,
  @location(1) normalX: f32,
  @location(2) normalY: f32,
  @location(3) normalZ: f32,
  @location(4) seed: f32,
  @location(5) isCenter: f32,
  @location(6) lateral: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> flowers: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> FlowerOutput {
  var output: FlowerOutput;
  let verticesPerFlower = 150u;
  let flowerIndex = vertexIndex / verticesPerFlower;
  let localIndex = vertexIndex % verticesPerFlower;
  let data = flowers[flowerIndex];
  let column = data.x;
  let row = data.y;
  let topY = data.z;
  let rawSeed = data.w;
  let isFrond = step(5.0, rawSeed);
  let isOrb = step(3.0, rawSeed) * (1.0 - isFrond);
  let isFruit = step(2.0, rawSeed) * (1.0 - isOrb) * (1.0 - isFrond);
  let isRegularLeaf = step(1.0, rawSeed) * (1.0 - isFruit)
    * (1.0 - isOrb) * (1.0 - isFrond);
  let isLeaf = max(isRegularLeaf, isFrond);
  let seed = rawSeed - isRegularLeaf - 2.0 * isFruit
    - 3.0 * isOrb - 5.0 * isFrond;
  output.seed = rawSeed;
  let visibility = smoothstep(0.0, 0.6, 1.0 - uniforms.progress);
  if (visibility < 0.01) {
    output.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return output;
  }
  let blockSize = 0.0245;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let centerX = column * blockSize - halfGrid;
  let centerZ = row * blockSize - halfGrid;
  let groundPetal = step(topY, blockSize * 2.5);
  let gapColumn = floor((column + 0.5) / 2.0);
  let gapRow = floor((row + 0.5) / 2.0);
  let gapSample = fract(sin(
    gapColumn * 12.9898 + gapRow * 78.233 + uniforms.flowerHue * 91.37
  ) * 43758.5453);
  let gridCenter = uniforms.gridSize * 0.5;
  let interiorRadius = distance(vec2f(column, row), vec2f(gridCenter))
    / max(uniforms.gridSize * 0.46, 1.0);
  let interiorMask = 1.0 - step(0.76, interiorRadius);
  let canopyOrgan = (1.0 - groundPetal) * (1.0 - isFruit)
    * (1.0 - isOrb) * (1.0 - isFrond);
  let densityVisibility = 1.0 - canopyOrgan * interiorMask
    * (1.0 - step(${CANOPY_GAP_RATE.toFixed(2)}, gapSample));
  let windFactor = (1.0 - groundPetal) * visibility * (1.0 - isOrb);
  let windBase = sin(uniforms.time * 0.45 + column * 0.25 + row * 0.15)
    * 0.028 * sceneBreeze();
  let windTurbulence = sin(uniforms.time * 1.1 + column * 0.8 + row * 0.6)
    * 0.008 * sceneBreeze();
  let swayX = (windBase + windTurbulence) * windFactor;
  let swayZ = sin(uniforms.time * 0.35 + column * 0.15 + row * 0.25)
    * 0.018 * sceneBreeze();
  let organicScale = blockSize * (0.84 + seed * 0.3);
  let orbScale = mix(organicScale, blockSize * 13.0, isOrb);
  let baseScale = mix(orbScale, blockSize * 1.4, isFrond)
    * visibility * densityVisibility;
  let flowerScale = mix(baseScale, baseScale * 1.12, isLeaf);
  var petalLength = mix(flowerScale * 0.92, flowerScale * 1.45, isLeaf);
  var petalWidth = mix(flowerScale * 0.42, flowerScale * 0.28, isLeaf);
  var curlHeight = mix(blockSize * 0.18, blockSize * 0.08, isLeaf)
    * visibility * densityVisibility;
  petalLength = mix(petalLength, flowerScale * 3.2, isFrond);
  petalWidth = mix(petalWidth, flowerScale * 0.32, isFrond);
  let flowerVariant = floor(seed * 3.0);
  if (isLeaf < 0.5 && isFruit < 0.5 && isOrb < 0.5) {
    if (flowerVariant < 0.5) {
      petalLength *= 0.92;
      petalWidth *= 1.28;
      curlHeight *= 1.35;
    } else if (flowerVariant < 1.5) {
      petalLength *= 0.78;
      petalWidth *= 1.05;
      curlHeight *= 1.85;
    } else {
      petalLength *= 1.42;
      petalWidth *= 0.72;
      curlHeight *= 0.72;
    }
  }
  let centerRadius = mix(blockSize * 0.12, blockSize * 0.04, isLeaf)
    * visibility * densityVisibility;
  let baseRotation = seed * 6.28318;
  let tiltAngle = (seed * 0.25 + 0.05) * (1.0 - isLeaf * 0.5);
  let tiltDirection = seed * 6.28318 * 3.17;
  let tiltAxisX = cos(tiltDirection);
  let tiltAxisZ = sin(tiltDirection);
  var localOffset = vec3f(0.0);
  var normal = vec3f(0.0, 1.0, 0.0);
  output.petalT = 0.0;
  output.isCenter = 0.0;
  output.lateral = 0.0;

  if (isFruit > 0.5 || isOrb > 0.5) {
    let fruitQuad = array<vec2f, 6>(
      vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
      vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    );
    let cell = localIndex / 6u;
    let latitude = cell / 5u;
    let longitude = cell % 5u;
    let fruitUv = fruitQuad[localIndex % 6u];
    let theta = (f32(latitude) + fruitUv.y) * 0.2 * 3.14159;
    let phi = (f32(longitude) + fruitUv.x) * 0.2 * 6.28318 + baseRotation;
    let fruitNormal = vec3f(sin(theta) * cos(phi), cos(theta), sin(theta) * sin(phi));
    let fruitRadius = flowerScale * mix(0.64 + seed * 0.10, 1.0, isOrb);
    let shoulder = 0.9 + sin(theta) * 0.1;
    let dimple = pow(max(cos(theta), 0.0), 8.0) * fruitRadius * 0.14;
    localOffset = vec3f(
      fruitNormal.x * fruitRadius * shoulder,
      fruitNormal.y * fruitRadius * 1.05 - dimple,
      fruitNormal.z * fruitRadius * shoulder,
    );
    normal = normalize(vec3f(fruitNormal.x, fruitNormal.y / 1.05, fruitNormal.z));
    output.petalT = fruitUv.y;
  } else if (localIndex < 120u) {
    let petalIndex = localIndex / 24u;
    let petalVertex = localIndex % 24u;
    let segmentIndex = petalVertex / 6u;
    let triangleVertex = petalVertex % 6u;
    var rowIndex = segmentIndex;
    var side = -1.0;
    if (triangleVertex == 1u || triangleVertex == 4u || triangleVertex == 5u) {
      side = 1.0;
    }
    if (triangleVertex == 2u || triangleVertex == 3u || triangleVertex == 5u) {
      rowIndex = segmentIndex + 1u;
    }
    let petalT = f32(rowIndex) * 0.25;
    output.petalT = petalT;
    output.lateral = side;
    let angle = f32(petalIndex) * 1.25664 + baseRotation;
    var petalScale = 1.0;
    if (isLeaf > 0.5 && petalIndex >= 3u) { petalScale = 0.0; }
    if (isFrond > 0.5 && petalIndex >= 1u) { petalScale = 0.0; }
    let distance = petalT * petalLength * petalScale;
    let halfWidth = petalWidth * sin(petalT * 3.14159)
      * sqrt(1.0 - petalT * 0.3) * petalScale;
    let sideOffset = side * halfWidth;
    let curl = curlHeight * 4.0 * petalT * (1.0 - petalT);
    localOffset = vec3f(
      distance * cos(angle) + sideOffset * -sin(angle),
      curl,
      distance * sin(angle) + sideOffset * cos(angle),
    );
    let curlSlope = curlHeight * 4.0 * (1.0 - 2.0 * petalT);
    normal = normalize(vec3f(
      -curlSlope * cos(angle) + side * 0.2 * sin(angle),
      1.0,
      -curlSlope * sin(angle) - side * 0.2 * cos(angle),
    ));
  } else {
    output.isCenter = 1.0;
    let diskVertex = localIndex - 120u;
    let triangleIndex = diskVertex / 3u;
    let triangleVertex = diskVertex % 3u;
    let angleIndex = select(triangleIndex, triangleIndex + 1u, triangleVertex == 2u);
    if (triangleVertex > 0u) {
      let angle = f32(angleIndex) * 0.62832 + baseRotation;
      localOffset = vec3f(cos(angle) * centerRadius, curlHeight * 0.72,
        sin(angle) * centerRadius);
    } else {
      localOffset.y = curlHeight * 0.8;
    }
  }

  let tiltCos = cos(tiltAngle);
  let tiltSin = sin(tiltAngle);
  let dotAxis = tiltAxisX * localOffset.x + tiltAxisZ * localOffset.z;
  let tiltedOffset = vec3f(
    localOffset.x * tiltCos - tiltAxisZ * localOffset.y * tiltSin
      + tiltAxisX * dotAxis * (1.0 - tiltCos),
    localOffset.y * tiltCos
      + (tiltAxisZ * localOffset.x - tiltAxisX * localOffset.z) * tiltSin,
    localOffset.z * tiltCos + tiltAxisX * localOffset.y * tiltSin
      + tiltAxisZ * dotAxis * (1.0 - tiltCos),
  );
  let normalDotAxis = tiltAxisX * normal.x + tiltAxisZ * normal.z;
  normal = normalize(vec3f(
    normal.x * tiltCos - tiltAxisZ * normal.y * tiltSin
      + tiltAxisX * normalDotAxis * (1.0 - tiltCos),
    normal.y * tiltCos + (tiltAxisZ * normal.x - tiltAxisX * normal.z) * tiltSin,
    normal.z * tiltCos + tiltAxisX * normal.y * tiltSin
      + tiltAxisZ * normalDotAxis * (1.0 - tiltCos),
  ));
  let spin = uniforms.time * 0.055 * isOrb;
  let spinCos = cos(spin);
  let spinSin = sin(spin);
  let spunOffset = vec3f(
    tiltedOffset.x * spinCos - tiltedOffset.z * spinSin,
    tiltedOffset.y,
    tiltedOffset.x * spinSin + tiltedOffset.z * spinCos,
  );
  normal = normalize(vec3f(
    normal.x * spinCos - normal.z * spinSin,
    normal.y,
    normal.x * spinSin + normal.z * spinCos,
  ));
  let localPos = vec3f(
    centerX + swayX + spunOffset.x * visibility,
    topY + spunOffset.y * visibility,
    centerZ + swayZ * windFactor + spunOffset.z * visibility,
  );
  output.position = projectPosition(localPos);
  output.normalX = normal.x;
  output.normalY = normal.y;
  output.normalZ = normal.z;
  return output;
}

@fragment
fn fragmentMain(input: FlowerOutput) -> @location(0) vec4f {
  let normal = normalize(vec3f(input.normalX, input.normalY, input.normalZ));
  let isFrond = step(5.0, input.seed);
  let isOrb = step(3.0, input.seed) * (1.0 - isFrond);
  let isFruit = step(2.0, input.seed) * (1.0 - isOrb) * (1.0 - isFrond);
  let isRegularLeaf = step(1.0, input.seed) * (1.0 - isFruit)
    * (1.0 - isOrb) * (1.0 - isFrond);
  let isLeaf = max(isRegularLeaf, isFrond);
  let seed = input.seed - isRegularLeaf - 2.0 * isFruit
    - 3.0 * isOrb - 5.0 * isFrond;
  var baseColor = vec3f(0.0);
  if (isOrb > 0.5) {
    let continent = sin(normal.x * 9.0 + seed * 11.0)
      + sin(normal.y * 13.0 - normal.z * 7.0)
      + sin((normal.x + normal.z) * 17.0 + seed * 5.0) * 0.45;
    let landMask = smoothstep(0.1, 0.72, continent);
    let ocean = mix(uniforms.themePrimary.rgb, uniforms.themeFifth.rgb, 0.12);
    let land = mix(uniforms.themeSecondary.rgb, uniforms.themeThird.rgb, 0.24);
    let latitudeLight = 0.9 + normal.y * 0.1;
    baseColor = mix(ocean, land, landMask) * latitudeLight;
    let polarCap = smoothstep(0.7, 0.94, abs(normal.y));
    baseColor = mix(baseColor, uniforms.themeFifth.rgb, polarCap * 0.72);
    let highlight = smoothstep(0.86, 0.98, fract(continent * 4.1 + seed));
    baseColor = mix(baseColor, uniforms.themeThird.rgb, highlight * 0.2);
  } else if (isFruit > 0.5) {
    let shadow = mix(uniforms.themeThird.rgb, themeInk(), 0.44);
    let skin = mix(uniforms.themeThird.rgb, uniforms.themePrimary.rgb, 0.28);
    let highlight = mix(skin, vec3f(1.0), 0.32);
    baseColor = mix(shadow, skin, 0.45 + normal.y * 0.25);
    baseColor = mix(baseColor, highlight, pow(max(normal.y, 0.0), 3.0) * 0.42);
  } else if (isLeaf > 0.5) {
    let tier = fract(seed * 5.17);
    let leafBase = mix(themeLeaf(tier), themeInk(), 0.18);
    let leafTip = themeLeaf(tier + 0.16);
    baseColor = mix(leafBase, leafTip, input.petalT);
    let vein = 1.0 - smoothstep(0.025, 0.17, abs(input.lateral));
    let edge = smoothstep(0.72, 1.0, abs(input.lateral));
    let tipShade = smoothstep(0.82, 1.0, input.petalT);
    baseColor *= 1.0 - vein * 0.20 - edge * 0.07 - tipShade * 0.08;
  } else if (input.isCenter > 0.5) {
    baseColor = vec3f(0.92, 0.78, 0.35) * (0.9 + fract(seed * 13.3) * 0.15);
  } else {
    let base = themeFlower(seed);
    let tip = themeFlower(seed + 0.071);
    baseColor = mix(base, tip, input.petalT);
    baseColor *= 1.0 - (1.0 - abs(input.petalT - 0.5) * 2.0) * 0.08;
  }
  let clusterShade = mix(0.78, 1.0, smoothstep(0.16, 0.86, fract(seed * 13.37)));
  let shadeAmount = (1.0 - isFruit) * (1.0 - isOrb);
  baseColor *= mix(1.0, clusterShade, shadeAmount);
  let sunDirection = normalize(vec3f(-0.405616, 0.861934, -0.304212));
  let diffuse = max(dot(normal, sunDirection), 0.0);
  let backLight = max(dot(-normal, sunDirection), 0.0);
  let flowerSubsurface = themeFlower(seed);
  let leafSubsurface = themeLeaf(seed);
  let fruitSubsurface = mix(uniforms.themeThird.rgb, vec3f(1.0), 0.18);
  let organSubsurface = mix(flowerSubsurface, leafSubsurface, isLeaf);
  var subsurfaceColor = mix(organSubsurface, fruitSubsurface, isFruit);
  let subsurface = backLight * 0.22 * subsurfaceColor;
  let sky = max(normal.y, 0.0) * 0.05 * uniforms.themeFifth.rgb;
  let underside = mix(0.55, 1.0, max(normal.y, 0.0))
    * mix(0.92, 1.0, fract(seed * 11.3));
  let viewDirection = normalize(vec3f(0.398015, 0.597022, 0.696526));
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0)
    * 0.07 * themeFlower(seed + 0.19);
  let lit = baseColor * underside * (vec3f(0.28, 0.28, 0.30) + 1.2 * diffuse * 0.88)
    + subsurface + sky + rim;
  let exposed = lit * 0.9;
  let mapped = clamp(
    (exposed * (2.51 * exposed + 0.03)) /
      (exposed * (2.43 * exposed + 0.59) + 0.14),
    vec3f(0.0),
    vec3f(1.0),
  );
  var color = pow(mapped, vec3f(1.0 / 2.2));
  let gray = dot(color, vec3f(0.299, 0.587, 0.114));
  color = mix(vec3f(gray), color, 1.9);
  let snowCover = sceneSnow() * smoothstep(0.18, 0.92, normal.y)
    * (0.38 + step(0.62, fract(seed * 9.17)) * 0.3);
  color = mix(color, themeSnow(), snowCover);
  return vec4f(color, 1.0);
}
`;

export const TREE_FALLING_PETAL_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct PetalOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) seed: f32,
  @location(2) petalT: f32,
  @location(3) lateral: f32,
  @location(4) fade: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> petals: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> PetalOutput {
  var output: PetalOutput;
  let verticesPerPetal = 24u;
  let petalIndex = vertexIndex / verticesPerPetal;
  let localIndex = vertexIndex % verticesPerPetal;
  let data = petals[petalIndex];
  let seed = data.w;
  let visibility = smoothstep(0.0, 0.35, 1.0 - uniforms.progress) * sceneWind();
  let cycleRate = 0.052 + seed * 0.025;
  let cycle = fract(uniforms.time * cycleRate + seed * 7.31);
  let fallT = smoothstep(0.03, 0.94, cycle);
  let fade = smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.92, 1.0, cycle));
  let blockSize = uniforms.blockSize;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let groundY = blockSize * 1.12;
  let originX = data.x * blockSize - halfGrid;
  let originZ = data.y * blockSize - halfGrid;
  let phase = seed * 31.416;
  let driftX = sin(uniforms.time * 0.71 + phase) * blockSize * (1.2 + seed * 2.2);
  let driftZ = cos(uniforms.time * 0.53 + phase * 1.37) * blockSize * (1.0 + seed * 1.8);
  let travelX = (fallT - 0.5) * blockSize * (seed - 0.5) * 4.0;
  let travelZ = sin(fallT * 6.28318 + phase) * blockSize * 0.7;
  let windPulse = 0.72 + sin(uniforms.time * 0.8 + phase) * 0.28;
  let windTravelX = fallT * blockSize * (5.0 + seed * 5.0) * windPulse;
  let windTravelZ = fallT * blockSize * (seed - 0.5) * 2.2;
  let petalCenter = vec3f(
    originX + driftX + travelX + windTravelX,
    mix(data.z, groundY, fallT) + sin(fallT * 3.14159) * blockSize * 0.45,
    originZ + driftZ + travelZ + windTravelZ,
  );
  let center = petalCenter;

  let stripVertex = localIndex % 24u;
  let segmentIndex = stripVertex / 6u;
  let triangleVertex = stripVertex % 6u;
  var rowIndex = segmentIndex;
  var side = -1.0;
  if (triangleVertex == 1u || triangleVertex == 4u || triangleVertex == 5u) {
    side = 1.0;
  }
  if (triangleVertex == 2u || triangleVertex == 3u || triangleVertex == 5u) {
    rowIndex = segmentIndex + 1u;
  }
  let petalT = f32(rowIndex) * 0.25;
  let scale = blockSize * (0.72 + seed * 0.28) * visibility;
  let length = scale * petalT;
  let envelope = pow(max(sin(petalT * 3.14159), 0.0), 0.72);
  let petalWidth = scale * 0.42 * envelope * sqrt(1.0 - petalT * 0.28);
  let width = petalWidth;
  let curl = scale * 0.18 * 4.0 * petalT * (1.0 - petalT);
  let spin = uniforms.time * (0.8 + seed * 1.4) + phase;
  let spinCos = cos(spin);
  let spinSin = sin(spin);
  let local = vec3f(length, curl, side * width);
  let petalOffset = vec3f(
    local.x * spinCos - local.z * spinSin,
    local.y,
    local.x * spinSin + local.z * spinCos,
  );
  let spun = petalOffset;
  let tilt = 0.45 + fallT * 1.05 + sin(uniforms.time * 1.2 + phase) * 0.28;
  let tiltCos = cos(tilt);
  let tiltSin = sin(tilt);
  let offset = vec3f(
    spun.x,
    spun.y * tiltCos - spun.z * tiltSin,
    spun.y * tiltSin + spun.z * tiltCos,
  );
  let normal = normalize(vec3f(spinSin * tiltSin, tiltCos, spinCos * tiltSin));
  output.position = projectPosition(center + offset);
  output.normal = normal;
  output.seed = seed;
  output.petalT = petalT;
  output.lateral = side;
  output.fade = fade * visibility;
  return output;
}

@fragment
fn fragmentMain(input: PetalOutput) -> @location(0) vec4f {
  let tier = fract(input.seed * 7.31);
  let base = mix(themeFlower(tier), themeInk(), 0.12);
  let tip = mix(themeFlower(tier), vec3f(1.0), 0.28);
  var color = mix(base, tip, input.petalT);
  let vein = 1.0 - smoothstep(0.03, 0.22, abs(input.lateral));
  color *= 1.0 - vein * 0.08;
  let sunDirection = normalize(vec3f(-0.405616, 0.861934, -0.304212));
  let diffuse = max(dot(input.normal, sunDirection), 0.0);
  let backLight = max(dot(-input.normal, sunDirection), 0.0);
  let transmitted = mix(themeFlower(tier), vec3f(1.0), 0.35);
  let lit = color * (0.38 + diffuse * 0.94) + backLight * transmitted * 0.3;
  return vec4f(lit, input.fade);
}
`;

export const TREE_BUTTERFLY_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct ButterflyOutput {
  @builtin(position) position: vec4f,
  @location(0) wingT: f32,
  @location(1) seed: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> butterflyData: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> ButterflyOutput {
  var output: ButterflyOutput;
  let verticesPerButterfly = 6u;
  let butterflyIndex = vertexIndex / verticesPerButterfly;
  let localVertex = vertexIndex % verticesPerButterfly;
  let visibility = smoothstep(0.0, 0.4, 1.0 - uniforms.progress) * sceneWind();
  if (visibility < 0.01) {
    output.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return output;
  }
  let data = butterflyData[butterflyIndex];
  let orbitRadius = data.x;
  let orbitSpeed = data.y;
  let heightOffset = data.z;
  let seed = data.w;
  output.seed = seed;
  let blockSize = uniforms.blockSize;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let time = uniforms.time;
  let phase = seed * 6.28318;
  let orbitAngle = time * orbitSpeed + phase;
  let gust = sin(time * 0.42 + phase * 2.0) * blockSize * 2.4;
  let wobble = sin(time * 2.5 + seed * 8.0) * 0.3;
  let bobY = sin(time * 1.8 + seed * 5.0) * blockSize * 1.8;
  let centerColumn = uniforms.gridSize * 0.5 + cos(orbitAngle + wobble) * orbitRadius;
  let centerRow = uniforms.gridSize * 0.5 + sin(orbitAngle + wobble) * orbitRadius;
  let center = vec3f(
    centerColumn * blockSize - halfGrid + gust,
    blockSize * heightOffset + bobY,
    centerRow * blockSize - halfGrid,
  );
  let directionX = -sin(orbitAngle + wobble);
  let directionZ = cos(orbitAngle + wobble);
  let flapAngle = sin(time * (14.0 + seed * 10.0) + seed * 10.0) * 0.9;
  let wingSpan = blockSize * (0.72 + seed * 0.24) * visibility;
  let wingLength = blockSize * (0.66 + seed * 0.2) * visibility;
  let isRightWing = localVertex >= 3u;
  let wingVertex = localVertex % 3u;
  let wingSign = select(-1.0, 1.0, isRightWing);
  output.wingT = 0.0;
  var localPosition = center;
  if (wingVertex > 0u) {
    let forwardSign = select(-1.0, 1.0, wingVertex == 1u);
    let outwardScale = select(0.85, 1.0, wingVertex == 1u);
    let upwardScale = select(0.5, 0.7, wingVertex == 1u);
    let wingUp = sin(flapAngle * wingSign) * wingSpan * upwardScale;
    let wingOut = cos(flapAngle * wingSign) * wingSpan * outwardScale;
    localPosition = vec3f(
      center.x + directionZ * wingOut * wingSign
        + directionX * wingLength * 0.55 * forwardSign,
      center.y + wingUp,
      center.z - directionX * wingOut * wingSign
        + directionZ * wingLength * 0.55 * forwardSign,
    );
    output.wingT = select(0.7, 1.0, wingVertex == 1u);
  }
  output.position = projectPosition(localPosition);
  return output;
}

@fragment
fn fragmentMain(input: ButterflyOutput) -> @location(0) vec4f {
  let tier = fract(input.seed * 3.17);
  var wingBase = mix(themeInk(), uniforms.themePrimary.rgb, 0.78);
  var wingTip = mix(uniforms.themePrimary.rgb, uniforms.themeSecondary.rgb, 0.42);
  if (tier > 0.5) {
    wingBase = mix(themeInk(), uniforms.themeThird.rgb, 0.76);
    wingTip = mix(uniforms.themeThird.rgb, uniforms.themeFourth.rgb, 0.42);
  }
  var color = mix(wingBase, wingTip, input.wingT);
  color *= mix(0.62, 1.0, smoothstep(0.0, 0.25, input.wingT));
  let mapped = clamp(
    (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14),
    vec3f(0.0),
    vec3f(1.0),
  );
  return vec4f(pow(mapped, vec3f(1.0 / 2.2)), 0.9);
}
`;
