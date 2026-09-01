# Community model roadmap

Every model must turn the same seeded URL into deterministic geometry and finish at the same
scannable QR matrix. A model is not just a palette swap, but contributors do not need to build the
whole pipeline alone.

## [Hokusai Waves](https://github.com/AlbertAZ1992/every-qrcode/issues/3)

**Direction:** a layered wave field with a curling crest and graphic foam, inspired by Japanese
woodblock print composition without copying a specific artwork.

**Practical first version:** displaced rows of blocks form the body of the wave; a controlled curl
and thresholded foam material create the crest. It does not need fluid simulation.

Useful contribution slices:

- define the wave silhouette and foam rules;
- prototype deterministic crest geometry from the existing seed;
- explore a limited indigo, paper, and foam palette;
- write the lazy shader bundle and its deterministic tests.

## [Crystalline](https://github.com/AlbertAZ1992/every-qrcode/issues/4)

**Direction:** a clustered mineral landscape with faceted spires, sharp normals, and restrained
translucent color.

**Practical first version:** reuse the block field, then extrude selected cells into deterministic
faceted spires. It can begin opaque; transmission and refraction are optional later refinements.

Useful contribution slices:

- define seeded crystal heights, angles, and cluster density;
- prototype a faceted prism mesh or shader normal treatment;
- explore mineral palettes that keep the QR transition readable;
- add golden geometry and QR convergence tests.

## [Mechanical](https://github.com/AlbertAZ1992/every-qrcode/issues/5)

**Direction:** a compact machine made from plates, rails, pistons, vents, and cables that aligns
into the QR grid.

**Practical first version:** use modular plates and piston-like motion. Fully meshed gears and a
physics simulation are intentionally outside the first milestone.

Useful contribution slices:

- design a small deterministic kit of mechanical parts;
- map seeded cells to plates, pistons, and connectors;
- prototype metal, warning-accent, and emissive materials;
- test that moving pieces settle into the exact QR endpoint.

## Shared acceptance criteria

- The same normalized identity and generator version always produce the same result.
- The model reaches the same canonical QR matrix as Tree and Terrain.
- Its shaders and model-specific code load only when the model is selected.
- Existing generator-version fingerprints remain unchanged.
- React and Web Component selectors expose the same model name.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution sizes and
[adding a renderer model](adding-renderer-model.md) for the complete implementation path.
