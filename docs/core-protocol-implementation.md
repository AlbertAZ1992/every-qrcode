# Core protocol implementation

This document records the current executable identity and QR contract in `packages/core`.
`technical-architecture.md` remains the package-level architecture contract.

## Identity pipeline

```text
raw URL
→ ParsedLink v1
→ family, site, and page digests
→ named SFC32 channels
→ canonical QR Profile v1 matrix
→ QR role map and derived fields
```

`ParsedLink` keeps four separate values:

- `payloadUrl`: the complete normalized URL encoded by the QR code;
- `familyIdentity`: the registrable domain from the Public Suffix List;
- `siteIdentity`: the complete hostname;
- `pageIdentity`: the normalized URL without fragment or tracking parameters.

The default `identityScope="site"` uses family and site channels for visible identity. Explicit
`identityScope="url"` allows bounded page detail while preserving the family and site inheritance.
The QR payload always remains the complete normalized URL.

## Deterministic DNA

Each identity layer uses a namespaced SHA-256 digest. Renderers request fresh deterministic SFC32
streams through versioned labels such as `tree/archetype` or `terrain/ridge`. Time, device data,
`Math.random()`, and GPU execution order never participate in identity generation.

The current protocol exposes:

- defensive digest copies for family, site, and page identity;
- validated channel names and stable four-word seeds;
- a frozen `sfc32-v1` transition;
- bounded family/detail mixing for inheritable traits.

## Canonical QR matrix

Core owns QR generation. It uses error correction M, automatic segmentation, versions 1 through 6,
and the encoder-selected mask. The canonical row-major matrix is created once and shared by Tree,
Terrain, React, Web Component, and the 2D-to-3D morph.

Core also derives the QR function-role map, local density, blur, light/dark distance, and edge fields.
Theme packages never invoke another QR encoder and never substitute a decorative QR endpoint.

## Browser boundary

Core has no React, DOM, Canvas, WebGPU, network, telemetry, or storage dependency. The public
`@every-qrcode/*` components consume it through the internal adapter and model layers documented in
`technical-architecture.md`.
