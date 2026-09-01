# Every QR Code technical architecture

This document describes the architecture implemented by the repository. Abandoned model and
renderer experiments are removed rather than kept as competing package contracts.

## 1. Product invariant

Every QR Code turns one normalized URL into one deterministic seed and one canonical QR matrix.
Tree and Terrain are two render forms of that same seed:

```text
normalized URL + pinned generator version
    ↓
Link DNA + canonical QR matrix
    ↓
versioned deterministic seed model
    ├── lazy Tree renderer bundle
    └── lazy Terrain renderer bundle
    ↓
same canvas: 3D form ⇄ canonical QR
```

Changing the model must not change the QR payload, QR matrix, identity scope, or click-to-reveal
interaction. A model changes only the upper 3D form.

## 2. Package graph

```text
@every-qrcode/core
        ↓
@every-qrcode/renderer-webgpu
        ├── @every-qrcode/react
        └── @every-qrcode/web-component
```

The source folders match the package names. React and Web Component are the supported consumer
entry points; Core and Renderer are published transitive implementation layers.

| Source                     | Published package               | Responsibility                                    |
| -------------------------- | ------------------------------- | ------------------------------------------------- |
| `packages/core`            | `@every-qrcode/core`            | URL identity, DNA, QR matrix, derived fields      |
| `packages/renderer-webgpu` | `@every-qrcode/renderer-webgpu` | Tree, Terrain, QR morph, shaders, and render loop |
| `packages/react`           | `@every-qrcode/react`           | React component and renderer lifecycle            |
| `packages/web-component`   | `@every-qrcode/web-component`   | Native `<every-qr-code>` custom element           |

Tree and Terrain are the complete model set in the current architecture.

## 3. Ownership boundaries

### Core

Core is deterministic and renderer-independent. It owns:

- URL validation and canonicalization;
- site-level or URL-level identity scope;
- versioned Link DNA channels;
- the canonical scannable QR matrix;
- QR-derived density, edge, and distance fields.

Core does not import React, DOM, Canvas, WebGPU, Tree, or Terrain code.

### Shared WebGPU renderer

The shared renderer owns behavior that must stay identical between models:

- one canvas and one GPU lifecycle;
- the canonical QR endpoint;
- 2D-to-3D and 3D-to-2D transition state;
- resize, zoom, disposal, scene palette, rain, and snow plumbing;
- GPU buffers and shader compilation.

Its public boundary uses neutral `Seed*` names. Tree and Terrain are renderer forms selected by the
framework adapter; they are not separate publishable packages. The shared runtime imports only the
selected form's Shader bundle and creates only that form's pipelines. Adding another model means
adding another lazy bundle to this registry, not another npm package.

### Framework adapters

React and the custom element expose the stable product model union:

```ts
type EveryQRCodeModel = "tree" | "terrain";
```

They dynamically import the shared renderer and mount the selected form. There is no compatibility
facade or legacy package layer.

## 4. Render flow

For React and Web Component consumers, the runtime flow is:

1. Normalize the URL and build `EveryQRCodeIdentity`.
2. Resolve `generatorVersion`, defaulting to `CURRENT_GENERATOR_VERSION`.
3. Read `model` and import the shared renderer.
4. Import only the selected version's Tree or Terrain Shader bundle.
5. Build that version's deterministic seed model and selected model pipelines.
6. Mount the selected form into the shared WebGPU canvas.
7. Toggle the renderer between the 3D form and canonical QR using `setFlat`.
8. Dispose GPU resources when the component unmounts or its identity changes.

The adapters replace the canvas when the selected model changes so a previous GPU context cannot
leak into the next model.

## 5. Compatibility rules

- `model="tree" | "terrain"` is the only public model contract.
- `generatorVersion` is independent of npm package versions. Package patches may preserve the
  current generator; visual algorithm changes must add a supported generator version.
- A recorded world must persist `generatorVersion`. Existing unversioned worlds resolve to version
  1; unknown versions fail instead of silently rendering with the latest algorithm.
- Version 1 seed, Tree/Terrain geometry buffers, and Shader bundles have golden fingerprints. Do
  not update those fingerprints for a visual change; add a new versioned implementation.
- The QR matrix is the source of truth and is identical across both models.
- DNA channel labels are versioned protocol inputs. Four historic `linkseed:` hash salts remain
  unchanged solely to preserve every existing URL's deterministic identity; they are not package
  names or compatibility layers.
- Safe variable, test, folder, and package names must use current Tree, Terrain, or neutral Seed
  terminology.
- A new model must be a renderer form and reuse the shared QR interaction rather than introducing a
  new publishable compatibility package.

## 6. Build and verification order

Packages build in dependency order:

```text
core
→ renderer-webgpu
→ react + web-component
→ demo app
```

Before integration, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Rendered verification must cover Tree, Terrain, the QR reveal transition, and restoration to 3D.
