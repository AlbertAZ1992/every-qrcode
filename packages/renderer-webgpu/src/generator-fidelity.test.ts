import { createHash } from "node:crypto";

import { createEveryQRCodeIdentity } from "@every-qrcode/core";
import { describe, expect, it } from "vitest";

import { createSeedGpuScene, type SeedGpuScene } from "./gpu-scene";
import { loadSeedShaderSources } from "./renderer";
import { createSeedBlockField, createSeedModel, type SeedForm } from "./seed-model";

type FingerprintPart = Float32Array | string | Uint32Array;

function fingerprint(parts: readonly FingerprintPart[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    if (typeof part === "string") hash.update(part);
    else hash.update(new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sceneFingerprint(scene: SeedGpuScene): string {
  const metadata = {
    appearance: scene.appearance,
    blossomCount: scene.blossomCount,
    butterflyCount: scene.butterflyCount,
    fallingPetalCount: scene.fallingPetalCount,
    flowerCount: scene.flowerCount,
    fruitCount: scene.fruitCount,
    grassCount: scene.grassCount,
    groundPetalCount: scene.groundPetalCount,
    leafCount: scene.leafCount,
    rainCount: scene.rainCount,
    segmentCount: scene.segmentCount,
  };
  return fingerprint([
    JSON.stringify(metadata),
    scene.butterflies,
    scene.fallingPetals,
    scene.flowers,
    scene.grass,
    scene.groundPetals,
    scene.rain,
    scene.segments,
  ]);
}

describe("generator v1 fidelity", () => {
  const url = "https://example.com/versioned-world";

  it("freezes the complete deterministic seed model", async () => {
    const identity = await createEveryQRCodeIdentity(url, { identityScope: "url" });
    const model = await createSeedModel(identity, { generatorVersion: 1 });
    const { generatorVersion, ...legacyModel } = model;

    expect(generatorVersion).toBe(1);
    expect(fingerprint([JSON.stringify(legacyModel)])).toBe(
      "40d4c015f8b27b49aaf876c20b8ea35faa8e66e38aca9f087bc2c9d667128d3e",
    );
  });

  it.each([
    [
      "tree",
      "0d1455a2e9a804fea9b4c432b65e74e5aaf78ec1097448f5d4db8f50171fe3fb",
      "23cccca5832bde29db620d76d252cddbf7b320a7bfa34d72f3d83504ec51341c",
    ],
    [
      "terrain",
      "c77c6950aefe8c995fae96cb13f4caf2669632a207c159a17cff111e0f8abbac",
      "6217131e9277d2da19805fea410ffdd6da5b795419de734021060cdf0c85908a",
    ],
  ] as const)("freezes the %s geometry buffers", async (form, fieldHash, sceneHash) => {
    const identity = await createEveryQRCodeIdentity(url, { identityScope: "url" });
    const model = await createSeedModel(identity, { generatorVersion: 1 });
    const field = createSeedBlockField(model, form);
    const fieldMetadata = {
      blockSize: field.blockSize,
      blocks: field.blocks,
      qrSize: field.qrSize,
    };

    expect(
      fingerprint([
        JSON.stringify(fieldMetadata),
        field.baseY,
        field.heights,
        field.positions,
        field.types,
      ]),
    ).toBe(fieldHash);
    expect(sceneFingerprint(createSeedGpuScene(model, form))).toBe(sceneHash);
  });

  it.each([
    ["tree", "d909ef6e1c769ebf95fdd494382c45dcee7dc89f548ef3896bb0fade22ba231c"],
    ["terrain", "bf8ae12b6f88e2bff69c6d8147876bfc0b5594096a97f567195d7679821ed57f"],
  ] as const)("freezes the %s shader bundle", async (form: SeedForm, expected) => {
    const sources = await loadSeedShaderSources(form, 1);
    const parts = Object.entries(sources)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, value]) => [key, value]);

    expect(fingerprint(parts)).toBe(expected);
  });
});
