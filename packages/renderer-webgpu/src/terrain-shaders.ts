const TERRAIN_UNIFORMS_WGSL = /* wgsl */ `
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
}

fn terrainInk() -> vec3f {
  let first = uniforms.themePrimary.rgb;
  let second = uniforms.themeSecondary.rgb;
  let fourth = uniforms.themeFourth.rgb;
  let firstLuma = dot(first, vec3f(0.2126, 0.7152, 0.0722));
  let secondLuma = dot(second, vec3f(0.2126, 0.7152, 0.0722));
  let fourthLuma = dot(fourth, vec3f(0.2126, 0.7152, 0.0722));
  var ink = select(first, second, secondLuma < firstLuma);
  let inkLuma = min(firstLuma, secondLuma);
  ink = select(ink, fourth, fourthLuma < inkLuma);
  return mix(ink, vec3f(0.015), 0.22);
}

fn terrainPaper() -> vec3f {
  return mix(uniforms.themeFifth.rgb, vec3f(1.0), 0.68);
}

fn sceneSnow() -> f32 {
  return 1.0 - step(0.51, abs(uniforms.sceneEffect - 2.0));
}

fn terrainReliefProfile(heightValue: f32) -> f32 {
  return 0.1 + pow(heightValue, 0.72) * 12.6;
}

fn terrainProject(localPos: vec3f) -> vec4f {
  let progress = uniforms.progress;
  let angleY = mix(0.79, 0.0, progress);
  let angleX = mix(-0.56, -1.5708, progress);
  let cy = cos(angleY);
  let sy = sin(angleY);
  let cx = cos(angleX);
  let sx = sin(angleX);
  let rotatedX = localPos.x * cy - localPos.z * sy;
  let rotatedZ = localPos.x * sy + localPos.z * cy;
  let rotatedY = localPos.y * cx - rotatedZ * sx;
  let depth = localPos.y * sx + rotatedZ * cx;
  let portrait = select(1.0, 1.18, uniforms.aspectRatio < 0.8);
  let pulse = 1.0 + sin(progress * 3.14159265) * 0.025;
  let scale = mix(40.0, 46.4, progress) / uniforms.gridSize * portrait * pulse;
  let scaleX = scale / max(uniforms.aspectRatio, 1.0);
  let scaleY = scale / max(1.0 / uniforms.aspectRatio, 1.0);
  let yOffset = mix(-0.045, 0.08, progress);
  return vec4f(rotatedX * scaleX, (rotatedY + yOffset) * scaleY, depth * 0.01 + 0.5, 1.0);
}
`;

export const TERRAIN_SHADER = /* wgsl */ `
${TERRAIN_UNIFORMS_WGSL}

struct TerrainOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
  @location(2) heightValue: f32,
  @location(3) heightFraction: f32,
  @location(4) shade: f32,
  @location(5) castShadow: f32,
  @location(6) valleyOcclusion: f32,
  @location(7) rimLight: f32,
  @location(8) fresnel: f32,
  @location(9) @interpolate(flat) blockType: u32,
  @location(10) @interpolate(flat) neighborMask: u32,
  @location(11) @interpolate(flat) faceIndex: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> blockTypes: array<u32>;
@group(0) @binding(2) var<storage, read> blockPositions: array<vec4f>;
@group(0) @binding(3) var<storage, read> blockHeights: array<f32>;

fn terrainHeightAt(column: i32, row: i32) -> f32 {
  let size = i32(uniforms.gridSize);
  if (column < 0 || column >= size || row < 0 || row >= size) {
    return 0.0;
  }
  return blockHeights[u32(row * size + column)];
}

fn terrainValley(height: f32, column: i32, row: i32) -> f32 {
  var highest = 0.0;
  for (var rowOffset: i32 = -1; rowOffset <= 1; rowOffset = rowOffset + 1) {
    for (var columnOffset: i32 = -1; columnOffset <= 1; columnOffset = columnOffset + 1) {
      if (columnOffset == 0 && rowOffset == 0) { continue; }
      let neighbor = terrainHeightAt(column + columnOffset, row + rowOffset);
      highest = max(highest, neighbor);
    }
  }
  return smoothstep(0.02, 0.34, max(0.0, highest - height));
}

fn terrainShadow(height: f32, column: i32, row: i32) -> f32 {
  if (height < 0.02) { return 1.0; }
  let direction = normalize(vec2f(0.42, 0.76));
  var shadow = 1.0;
  for (var stepIndex: i32 = 1; stepIndex < 7; stepIndex = stepIndex + 1) {
    let offset = vec2f(f32(stepIndex)) * direction;
    let sampleColumn = column + i32(round(offset.x));
    let sampleRow = row + i32(round(offset.y));
    let neighbor = terrainHeightAt(sampleColumn, sampleRow);
    let occlusion = smoothstep(height + 0.06, height + 0.36, neighbor);
    let distanceFade = 1.0 - f32(stepIndex) * 0.075;
    shadow *= mix(1.0, 0.78, occlusion * max(distanceFade, 0.45));
  }
  return max(shadow, 0.74);
}

fn terrainTopNormal(column: i32, row: i32) -> vec3f {
  let slopeX = terrainHeightAt(column + 1, row) - terrainHeightAt(column - 1, row);
  let slopeZ = terrainHeightAt(column, row + 1) - terrainHeightAt(column, row - 1);
  return normalize(vec3f(-slopeX * 2.2, 1.0, -slopeZ * 2.2));
}

fn terrainGeometry(
  faceIndex: u32,
  uv: vec2f,
  footprint: f32,
  height: f32,
  topNormal: vec3f,
) -> array<vec3f, 2> {
  let halfWidth = footprint * 0.5;
  var position = vec3f(0.0);
  var normal = vec3f(0.0, 1.0, 0.0);
  if (faceIndex == 0u) {
    let summit = 1.0 - length(uv - vec2f(0.5)) * 0.2 * (1.0 - uniforms.progress);
    position = vec3f((uv.x - 0.5) * footprint, height * summit, (uv.y - 0.5) * footprint);
    normal = topNormal;
  } else if (faceIndex == 1u) {
    position = vec3f((uv.x - 0.5) * footprint, 0.0, (0.5 - uv.y) * footprint);
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (faceIndex == 2u) {
    position = vec3f((uv.x - 0.5) * footprint, uv.y * height, halfWidth);
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (faceIndex == 3u) {
    position = vec3f((0.5 - uv.x) * footprint, uv.y * height, -halfWidth);
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (faceIndex == 4u) {
    position = vec3f(halfWidth, uv.y * height, (uv.x - 0.5) * footprint);
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    position = vec3f(-halfWidth, uv.y * height, (0.5 - uv.x) * footprint);
    normal = vec3f(-1.0, 0.0, 0.0);
  }
  return array<vec3f, 2>(position, normal);
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> TerrainOutput {
  var output: TerrainOutput;
  let faceIndex = vertexIndex / 6u;
  let quadIndex = vertexIndex % 6u;
  let quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let uv = quad[quadIndex];
  let positionData = blockPositions[instanceIndex];
  let column = i32(positionData.x);
  let row = i32(positionData.y);
  let heightValue = clamp(blockHeights[instanceIndex], 0.0, 1.0);
  let blockSize = uniforms.blockSize;
  let terrainHeight = blockSize * terrainReliefProfile(heightValue);
  let flatHeight = blockSize * 0.11;
  let height = mix(terrainHeight, flatHeight, uniforms.progress);
  let footprint = blockSize * mix(0.84, 1.0, uniforms.progress);
  let topNormal = mix(terrainTopNormal(column, row), vec3f(0.0, 1.0, 0.0), uniforms.progress);
  let geometry = terrainGeometry(faceIndex, uv, footprint, height, topNormal);
  let halfGrid = uniforms.gridSize * blockSize * 0.5;
  let center = vec3f(
    (positionData.x + 0.5) * blockSize - halfGrid,
    0.0,
    (positionData.y + 0.5) * blockSize - halfGrid,
  );
  let worldPosition = center + geometry[0];
  let normal = normalize(geometry[1]);
  let lightDirection = normalize(vec3f(-0.41, 0.86, -0.3));
  let diffuse = max(dot(normal, lightDirection), 0.0);
  var shade = 0.3 + pow(diffuse, 0.62) * 0.7;
  if (normal.y > 0.45) { shade = min(1.0, shade * 1.08 + 0.06); }
  if (abs(normal.y) < 0.12) { shade *= 0.68; }
  let viewDirection = normalize(vec3f(sin(0.79), 0.58, cos(0.79)));
  let viewDot = abs(dot(normal, viewDirection));
  output.position = terrainProject(worldPosition);
  output.normal = normal;
  output.uv = uv;
  output.heightValue = heightValue;
  output.heightFraction = clamp(geometry[0].y / max(height, 0.00001), 0.0, 1.0);
  output.shade = mix(shade, 1.0, uniforms.progress);
  output.castShadow = terrainShadow(heightValue, column, row);
  output.valleyOcclusion = terrainValley(heightValue, column, row);
  output.rimLight = pow(1.0 - viewDot, 3.8);
  output.fresnel = pow(1.0 - viewDot, 2.4);
  output.blockType = blockTypes[instanceIndex];
  output.neighborMask = u32(positionData.w);
  output.faceIndex = faceIndex;
  return output;
}

fn terrainBandColor(height: f32) -> vec3f {
  let water = uniforms.terrainWater.rgb;
  let shore = uniforms.terrainShore.rgb;
  let meadow = uniforms.terrainMeadow.rgb;
  let ridge = uniforms.terrainRidge.rgb;
  let summit = uniforms.terrainSummit.rgb;
  if (height < 0.055) {
    return terrainPaper();
  }
  if (height < 0.22) {
    return water;
  }
  if (height < 0.34) {
    return mix(water, shore, smoothstep(0.22, 0.34, height));
  }
  if (height < 0.62) {
    return mix(shore, meadow, smoothstep(0.34, 0.62, height));
  }
  if (height < 0.84) {
    return mix(meadow, ridge, smoothstep(0.62, 0.84, height));
  }
  return mix(ridge, summit, smoothstep(0.84, 1.0, height));
}

fn terrainQrColor(blockType: u32, noise: f32) -> vec3f {
  var color = uniforms.themePrimary.rgb;
  if (blockType == 3u) {
    color = uniforms.themeSecondary.rgb;
  } else if (blockType == 4u) {
    color = mix(uniforms.themeThird.rgb, uniforms.themeFourth.rgb, 0.58);
  } else if (blockType == 2u || blockType == 5u) {
    color = uniforms.themeFourth.rgb;
  }
  let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let contrast = mix(color, terrainInk(), smoothstep(0.76, 0.96, luma) * 0.2);
  return contrast * (0.92 + noise * 0.08);
}

fn terrainQrMask(uv: vec2f, neighborMask: u32) -> f32 {
  let up = (neighborMask & 1u) != 0u;
  let right = (neighborMask & 2u) != 0u;
  let down = (neighborMask & 4u) != 0u;
  let left = (neighborMask & 8u) != 0u;
  let radius = 0.46;
  var mask = 1.0;
  if (!left && !up && uv.x < radius && uv.y < radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(radius)));
  }
  if (!right && !up && uv.x > 1.0 - radius && uv.y < radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(1.0 - radius, radius)));
  }
  if (!left && !down && uv.x < radius && uv.y > 1.0 - radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(radius, 1.0 - radius)));
  }
  if (!right && !down && uv.x > 1.0 - radius && uv.y > 1.0 - radius) {
    mask *= 1.0 - step(radius, distance(uv, vec2f(1.0 - radius)));
  }
  return mask;
}

fn terrainHash(position: vec2f) -> f32 {
  let scaled = fract(position * vec2f(0.1031, 0.103));
  let folded = scaled + dot(scaled, scaled.yx + 19.19);
  return fract((folded.x + folded.y) * folded.x);
}

@fragment
fn fragmentMain(input: TerrainOutput) -> @location(0) vec4f {
  let progress = uniforms.progress;
  let noise = terrainHash(input.position.xy + vec2f(uniforms.time * 0.13));
  let paper = terrainPaper();
  var terrainColor = terrainBandColor(input.heightValue);
  terrainColor *= mix(0.92, 1.06, input.shade);
  let contact = mix(0.82, 1.0, smoothstep(0.0, 0.72, input.heightFraction));
  terrainColor *= mix(contact, 1.0, progress);
  terrainColor *= mix(input.castShadow, 1.0, progress * 0.92);
  terrainColor *= 1.0 - input.valleyOcclusion * 0.18 * (1.0 - progress);
  terrainColor *= 1.0 + input.rimLight * 0.18 * (1.0 - progress);
  terrainColor *= 1.0 + input.fresnel * 0.09 * (1.0 - progress);
  let peak = smoothstep(0.62, 0.96, input.heightValue);
  let peakTint = uniforms.terrainSummit.rgb;
  terrainColor = mix(terrainColor, peakTint, peak * 0.16 * (1.0 - progress));
  let snowNoise = terrainHash(input.uv * 5.7 + vec2f(input.heightValue * 13.0));
  let topFace = select(0.0, 1.0, input.faceIndex == 0u);
  let snowCover = sceneSnow() * topFace * (1.0 - progress)
    * smoothstep(0.42 + snowNoise * 0.1, 0.72, input.heightValue);
  terrainColor = mix(terrainColor, terrainPaper(), snowCover * 0.88);
  let qrNoise = terrainHash(input.uv + vec2f(input.heightValue * 17.0));
  let qrMask = terrainQrMask(input.uv, input.neighborMask);
  let isActive = select(0.0, 1.0, input.blockType != 0u);
  var qrColor = mix(paper, terrainQrColor(input.blockType, qrNoise), isActive * qrMask);
  if (input.faceIndex != 0u) {
    qrColor = mix(qrColor, terrainInk(), 0.18);
  }
  var color = mix(terrainColor, qrColor, smoothstep(0.58, 0.98, progress));
  color += (noise - 0.5) * 0.022 * (1.0 - progress);
  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
