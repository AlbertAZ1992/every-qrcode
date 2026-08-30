export const SEED_UNIFORMS_WGSL = /* wgsl */ `
struct Uniforms {
  aspectRatio: f32,
  time: f32,
  itemCount: f32,
  progress: f32,
  gridSize: f32,
  cameraBobX: f32,
  cameraBobY: f32,
  blockSize: f32,
  toggleAge: f32,
  flowerHue: f32,
  leafHue: f32,
  fruitHue: f32,
  fruitfulness: f32,
  flowerHueSpread: f32,
  leafHueSpread: f32,
  sceneEffect: f32,
  themePrimary: vec4f,
  themeSecondary: vec4f,
  themeThird: vec4f,
  themeFourth: vec4f,
  themeFifth: vec4f,
  terrainWater: vec4f,
  terrainShore: vec4f,
  terrainMeadow: vec4f,
  terrainRidge: vec4f,
  terrainSummit: vec4f,
  camera: vec4f,
}

fn hsvToRgb(hsv: vec3f) -> vec3f {
  let shifted = fract(vec3f(hsv.x) + vec3f(1.0, 0.6666667, 0.3333333));
  let rgb = clamp(abs(shifted * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
  return hsv.z * mix(vec3f(1.0), rgb, hsv.y);
}

fn themeInk() -> vec3f {
  var ink = uniforms.themePrimary.rgb;
  var luminance = dot(ink, vec3f(0.2126, 0.7152, 0.0722));
  let secondaryLuminance = dot(uniforms.themeSecondary.rgb, vec3f(0.2126, 0.7152, 0.0722));
  if (secondaryLuminance < luminance) {
    ink = uniforms.themeSecondary.rgb;
    luminance = secondaryLuminance;
  }
  let fourthLuminance = dot(uniforms.themeFourth.rgb, vec3f(0.2126, 0.7152, 0.0722));
  if (fourthLuminance < luminance) {
    ink = uniforms.themeFourth.rgb;
  }
  return mix(ink, vec3f(0.02), 0.32);
}

fn sceneWind() -> f32 {
  return 1.0 - step(0.51, abs(uniforms.sceneEffect));
}

fn sceneRain() -> f32 {
  return 1.0 - step(0.51, abs(uniforms.sceneEffect - 1.0));
}

fn sceneSnow() -> f32 {
  return 1.0 - step(0.51, abs(uniforms.sceneEffect - 2.0));
}

fn sceneBreeze() -> f32 {
  return sceneWind() * 0.72 + sceneRain() * 0.12;
}

fn sceneBranchBreeze() -> f32 {
  return sceneWind() * 0.42 + sceneRain() * 0.08;
}

fn themeFlower(noise: f32) -> vec3f {
  let tier = fract(noise * 7.31);
  let flowerMain = uniforms.themePrimary.rgb;
  let flowerDeep = mix(themeInk(), flowerMain, 0.58);
  let tone = mix(flowerDeep, flowerMain, smoothstep(0.24, 0.88, tier));
  return clamp(tone, vec3f(0.0), vec3f(1.0));
}

fn themeLeaf(noise: f32) -> vec3f {
  let tier = fract(noise * 5.17);
  let leafMain = uniforms.themeFourth.rgb;
  let leafDeep = mix(themeInk(), leafMain, 0.54);
  return mix(leafDeep, leafMain, smoothstep(0.22, 0.86, tier));
}

fn themeGrass(noise: f32) -> vec3f {
  let tier = fract(noise * 7.31);
  var hue = mix(uniforms.themeSecondary.rgb, uniforms.themeFourth.rgb, tier * 0.18);
  if (tier > 0.78) { hue = mix(uniforms.themeSecondary.rgb, uniforms.themeThird.rgb, 0.32); }
  let deep = mix(themeInk(), hue, 0.72 + tier * 0.1);
  return deep;
}

fn qrContrast(hue: vec3f) -> vec3f {
  let luminance = dot(hue, vec3f(0.2126, 0.7152, 0.0722));
  let correction = smoothstep(0.78, 0.96, luminance) * 0.12;
  return mix(hue, themeInk(), correction);
}

fn themeQr(blockType: u32, noise: f32) -> vec3f {
  var hue = uniforms.themePrimary.rgb;
  if (blockType == 3u) {
    hue = uniforms.themeSecondary.rgb;
  } else if (blockType == 4u) {
    hue = mix(uniforms.themeThird.rgb, uniforms.themeFourth.rgb, 0.58);
  } else if (blockType == 2u || blockType == 5u) {
    hue = uniforms.themeFourth.rgb;
  }
  let shade = 0.9 + fract(noise * 5.53) * 0.1;
  return qrContrast(hue) * shade;
}

fn themeBark(noise: f32) -> vec3f {
  let barkBase = mix(themeInk(), uniforms.themeFourth.rgb, 0.52);
  let barkLight = mix(uniforms.themeFourth.rgb, uniforms.themeSecondary.rgb, 0.24);
  return mix(barkBase, barkLight, 0.18 + noise * 0.24);
}

fn themeSnow() -> vec3f {
  return mix(uniforms.themeFifth.rgb, vec3f(1.0), 0.78);
}

fn projectPosition(localPos: vec3f) -> vec4f {
  let progress = uniforms.progress;
  let isoAngleY = mix(0.78, 0.0, progress) + uniforms.cameraBobX;
  let isoAngleX = mix(-0.55, -1.5708, progress) + uniforms.cameraBobY;
  let cy = cos(isoAngleY);
  let sy = sin(isoAngleY);
  let cx = cos(isoAngleX);
  let sx = sin(isoAngleX);
  let ryX = localPos.x * cy - localPos.z * sy;
  let ryZ = localPos.x * sy + localPos.z * cy;
  let rxY = localPos.y * cx - ryZ * sx;
  let rxZ = localPos.y * sx + ryZ * cx;
  let portraitBoost = select(1.0, 1.2, uniforms.aspectRatio < 0.8);
  let morphPulse = 1.0 + sin(progress * 3.14159265) * 0.035;
  let viewScale = (mix(41.5, 46.4, progress) / uniforms.gridSize)
    * portraitBoost * morphPulse * uniforms.camera.x;
  let scaleX = viewScale / max(uniforms.aspectRatio, 1.0);
  let scaleY = viewScale / max(1.0 / uniforms.aspectRatio, 1.0);
  let yOffset = mix(-0.12, 0.08, progress);
  let xOffset = mix(0.0, 0.015, progress);
  return vec4f(
    (ryX + xOffset) * scaleX,
    (rxY + yOffset) * scaleY,
    rxZ * 0.01 + 0.5,
    1.0,
  );
}
`;

export const SEED_WEATHER_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct RainOutput {
  @builtin(position) position: vec4f,
  @location(0) alpha: f32,
  @location(1) uv: vec2f,
  @location(2) snow: f32,
  @location(3) seed: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> rainData: array<vec4f>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> RainOutput {
  var output: RainOutput;
  let verticesPerDrop = 6u;
  let dropIndex = vertexIndex / verticesPerDrop;
  let localVertex = vertexIndex % verticesPerDrop;
  let snow = sceneSnow();
  let visibility = smoothstep(0.0, 0.3, 1.0 - uniforms.progress)
    * max(sceneRain(), snow);
  if (visibility < 0.01) {
    output.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return output;
  }
  let data = rainData[dropIndex];
  let blockSize = uniforms.blockSize;
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let seed = data.w;
  let cycleRate = mix(0.45 + seed * 0.3, 0.18 + seed * 0.12, snow);
  let cycle = fract(uniforms.time * cycleRate + data.z * 10.0);
  let dropY = mix(blockSize * 45.0, blockSize * 0.5, cycle);
  let baseX = data.x * blockSize - halfGrid + mix(0.015 * cycle, 0.0, snow);
  let baseZ = data.y * blockSize - halfGrid
    + mix(0.008 * cycle, 0.0, snow);
  let rainQuad = array<vec2f, 6>(
    vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let snowQuad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let rainPoint = rainQuad[localVertex];
  let snowPoint = snowQuad[localVertex];
  let point = mix(rainPoint, snowPoint, snow);
  let flakeSize = blockSize * (0.16 + seed * 0.22);
  let streakLength = mix(blockSize * (2.5 + seed * 1.5), flakeSize, snow);
  let streakWidth = mix(blockSize * 0.06, flakeSize, snow);
  let fadeTop = smoothstep(0.0, 0.1, cycle);
  let fadeBottom = 1.0 - smoothstep(0.85, 1.0, cycle);
  output.alpha = fadeTop * fadeBottom * visibility
    * mix(0.16 + seed * 0.12, 0.68 + seed * 0.2, snow);
  output.uv = snowPoint;
  output.snow = snow;
  output.seed = seed;
  output.position = projectPosition(vec3f(
    baseX + point.x * streakWidth,
    dropY + point.y * streakLength,
    baseZ,
  ));
  return output;
}

@fragment
fn fragmentMain(input: RainOutput) -> @location(0) vec4f {
  let radius = length(input.uv);
  let softFlake = 1.0 - smoothstep(0.48, 1.0, radius);
  let armA = 1.0 - smoothstep(0.055, 0.14, abs(input.uv.y));
  let armB = 1.0 - smoothstep(0.055, 0.14, abs(input.uv.y * 0.5 - input.uv.x * 0.866));
  let armC = 1.0 - smoothstep(0.055, 0.14, abs(input.uv.y * 0.5 + input.uv.x * 0.866));
  let crystal = max(max(armA, armB), armC) * (1.0 - smoothstep(0.68, 1.0, radius));
  let detailedFlake = max(softFlake * 0.42, crystal);
  let flakeShape = mix(softFlake, detailedFlake, step(0.58, fract(input.seed * 7.31)));
  if (input.snow > 0.5 && flakeShape < 0.02) { discard; }
  let rainGray = vec3f(0.56, 0.60, 0.64);
  let alpha = input.alpha * mix(1.0, flakeShape, input.snow);
  return vec4f(mix(rainGray, themeSnow(), input.snow), alpha);
}
`;

export const SEED_POST_SHADER = /* wgsl */ `
${SEED_UNIFORMS_WGSL}

struct PostOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
@group(0) @binding(2) var sceneSampler: sampler;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> PostOutput {
  let triangle = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let position = triangle[vertexIndex];
  var output: PostOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = vec2f(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: PostOutput) -> @location(0) vec4f {
  let center = vec2f(0.5);
  let strength = sin(uniforms.progress * 3.14159265) * 0.006;
  let direction = (input.uv - center) * strength;
  var color = vec4f(0.0);
  for (var index = 0u; index < 8u; index++) {
    let sampleOffset = f32(index) / 7.0;
    color += textureSample(sceneTexture, sceneSampler,
      clamp(input.uv - direction * sampleOffset, vec2f(0.0), vec2f(1.0)));
  }
  color /= 8.0;
  let distanceFromCenter = length(input.uv - center);
  let vignette = 1.0 - distanceFromCenter * distanceFromCenter * strength * 5.0;
  return vec4f(color.rgb * vignette, color.a);
}
`;
