import { createEveryQRCodeIdentity, CURRENT_GENERATOR_VERSION } from "@every-qrcode/core";
import { describe, expect, it } from "vitest";

import * as seedModel from "./seed-model";

import {
  SEED_MATERIALS,
  SEED_QR_GROUND_SIDE,
  SEED_QR_GROUND_Y,
  SEED_QR_QUIET_ZONE,
  SEED_TOPOLOGIES,
  createSeedModel,
} from "./seed-model";

describe("createSeedModel", () => {
  it("records the generator version that owns the deterministic output", async () => {
    const identity = await createEveryQRCodeIdentity("https://example.com/versioned-world");
    const model = await createSeedModel(identity, { generatorVersion: 1 });

    expect(CURRENT_GENERATOR_VERSION).toBe(1);
    expect(model.generatorVersion).toBe(1);
    await expect(createSeedModel(identity, { generatorVersion: 2 as never })).rejects.toThrowError(
      "Unsupported generator version: 2",
    );
  });

  it("is deterministic for the same link", async () => {
    const identity = await createEveryQRCodeIdentity("https://example.com/tree?a=1");
    expect(await createSeedModel(identity)).toEqual(await createSeedModel(identity));
  });

  it("keeps site details across pages and enables explicit page imprints", async () => {
    const first = await createSeedModel(await createEveryQRCodeIdentity("https://example.com/one"));
    const second = await createSeedModel(
      await createEveryQRCodeIdentity("https://example.com/two"),
    );
    const page = await createSeedModel(
      await createEveryQRCodeIdentity("https://example.com/two", { identityScope: "url" }),
    );
    expect(second.recipeId).toBe(first.recipeId);
    expect(second.name).toBe(first.name);
    expect(second.eccentricity).toBe(first.eccentricity);
    expect(page.recipeId).toBe(first.recipeId);
    expect(page.name === first.name && page.eccentricity === first.eccentricity).toBe(false);
  });

  it("makes subdomains recognizable variants of a family while separating root domains", async () => {
    const families = await Promise.all(
      Array.from({ length: 12 }, async (_, index) => {
        const domain = `linkseed-family-${index}.com`;
        const root = await createSeedModel(await createEveryQRCodeIdentity(`https://${domain}`));
        const child = await createSeedModel(
          await createEveryQRCodeIdentity(`https://garden.${domain}`),
        );
        return { child, root };
      }),
    );
    const withinFamily = families.map(({ child, root }) =>
      Math.abs(child.morphSeed - root.morphSeed),
    );
    const acrossFamilies = families.map(({ root }, index) => {
      const next = families[(index + 1) % families.length]?.root ?? root;
      return Math.abs(next.morphSeed - root.morphSeed);
    });
    const average = (values: readonly number[]): number =>
      values.reduce((total, value) => total + value, 0) / values.length;

    expect(families.every(({ child, root }) => child.recipeId === root.recipeId)).toBe(true);
    expect(families.every(({ child, root }) => child.name === root.name)).toBe(true);
    expect(average(withinFamily)).toBeLessThan(0.12);
    expect(average(acrossFamilies)).toBeGreaterThan(average(withinFamily) * 1.8);
  });

  it("creates one finite surface and QR target for every dark module", async () => {
    const identity = await createEveryQRCodeIdentity("https://github.com/openai/codex");
    const model = await createSeedModel(identity);
    const darkModules = Array.from(identity.qr.cells).filter((cell) => cell === 1).length;
    expect(model.modules).toHaveLength(darkModules);
    for (const module of model.modules) {
      expect([...module.surface, ...module.normal, ...module.qr].every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps canonical QR targets on the horizontal ground", async () => {
    const identity = await createEveryQRCodeIdentity("https://github.com/openai/codex");
    const model = await createSeedModel(identity);
    const moduleSize = SEED_QR_GROUND_SIDE / (model.qrSize + SEED_QR_QUIET_ZONE * 2);
    const center = (model.qrSize - 1) / 2;

    for (const module of model.modules) {
      const column = module.index % model.qrSize;
      const row = Math.floor(module.index / model.qrSize);
      expect(module.qr).toEqual([
        (column - center) * moduleSize,
        SEED_QR_GROUND_Y + 0.024,
        (row - center) * moduleSize,
      ]);
    }
  });

  it("uses only registered topology and material families", async () => {
    const model = await createSeedModel(await createEveryQRCodeIdentity("https://linear.app"));
    expect(SEED_TOPOLOGIES).toContain(model.topology);
    expect(SEED_MATERIALS).toContain(model.material);
    expect(model.features.length).toBeGreaterThan(2);
    expect(model.satellites.length).toBeGreaterThan(0);
  });

  it("selects a weighted family of recognizable tree growth archetypes", async () => {
    const expectedArchetypes = [
      "round",
      "umbrella",
      "conifer",
      "banana",
      "willow",
      "windswept",
      "cloud",
      "multi-trunk",
    ] as const;
    const models = await Promise.all(
      Array.from({ length: 400 }, async (_, index) =>
        createSeedModel(await createEveryQRCodeIdentity(`https://linkseed-tree-${index}.com`)),
      ),
    );
    const archetypes = models.map((model) => Reflect.get(model, "archetype"));
    const counts = new Map(
      expectedArchetypes.map((archetype) => [
        archetype,
        archetypes.filter((candidate) => candidate === archetype).length,
      ]),
    );

    expect(Reflect.get(seedModel, "TREE_ARCHETYPES")).toEqual(expectedArchetypes);
    expect(new Set(archetypes)).toEqual(new Set(expectedArchetypes));
    expect(counts.get("round")).toBeGreaterThan(125);
    expect(counts.get("round")).toBeLessThan(185);
    expect(counts.get("cloud")).toBeGreaterThan(50);
    expect(counts.get("windswept")).toBeLessThan(24);
    for (const archetype of expectedArchetypes) {
      expect(counts.get(archetype)).toBeGreaterThan(5);
    }
  });

  it("covers the recognizable archetype families in the public gallery", async () => {
    const domains = [
      "github.com",
      "google.com",
      "youtube.com",
      "facebook.com",
      "instagram.com",
      "x.com",
      "linkedin.com",
      "wikipedia.org",
      "amazon.com",
      "apple.com",
      "microsoft.com",
      "openai.com",
      "netflix.com",
      "spotify.com",
      "tiktok.com",
      "reddit.com",
      "discord.com",
      "twitch.tv",
      "stripe.com",
      "shopify.com",
      "airbnb.com",
      "uber.com",
      "notion.so",
      "figma.com",
      "canva.com",
      "dropbox.com",
      "slack.com",
      "zoom.us",
      "cloudflare.com",
      "vercel.com",
      "supabase.com",
      "react.dev",
    ];
    const models = await Promise.all(
      domains.map(async (domain) =>
        createSeedModel(await createEveryQRCodeIdentity(`https://${domain}`)),
      ),
    );
    const archetypes = new Set(models.map((model) => model.archetype));
    const galleryByDomain = new Map(
      domains.map((domain, index) => [domain, models[index]?.archetype]),
    );

    expect(models.filter((model) => model.archetype === "round")).toHaveLength(11);
    for (const required of seedModel.TREE_ARCHETYPES) {
      expect(archetypes, required).toContain(required);
    }
    expect(galleryByDomain.get("github.com")).toBe("cloud");
    expect(galleryByDomain.get("openai.com")).toBe("round");
    expect(galleryByDomain.get("supabase.com")).toBe("multi-trunk");
    expect(galleryByDomain.get("spotify.com")).toBe("windswept");
    expect(galleryByDomain.get("microsoft.com")).toBe("banana");
  });
});
