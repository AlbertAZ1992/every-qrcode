# Terrain design QA

## Evidence

- Source visual truth:
  - `/var/folders/4t/hm6fhcf91bb8q9cdtdqtwhlc0000gn/T/codex-clipboard-3a04bafb-7bb9-4f7f-aa05-bd8e3cdd2c69.png`
  - `/var/folders/4t/hm6fhcf91bb8q9cdtdqtwhlc0000gn/T/codex-clipboard-5ef9bb0b-eaf1-486b-aa97-44beac7ae1c5.png`
- Implementation: `http://127.0.0.1:5175/`, Terrain model, 3D state.
- Implementation screenshot: unavailable because this Codex session has no browser-capture runtime.
- Viewport and density: unavailable for the same reason.

## Full-view comparison evidence

The source establishes a thin, pale grid plane; separated contribution columns; a softened
mountain silhouette; stepped green height bands; and no enclosing cliff walls. The implementation
now has a dedicated instanced Terrain pipeline for those properties, but a rendered screenshot is
required before visual fidelity can be judged.

## Focused-region comparison evidence

The source's mountain edge and isolated-column views were inspected. A corresponding
implementation crop could not be captured, so edge thickness, height-band balance, and peak
lighting remain unverified.

## Findings

- [P1] Browser-rendered evidence is missing.
  - Location: Terrain 3D view.
  - Evidence: both source images are available, but no same-state implementation screenshot can be
    captured in this session.
  - Impact: visible WebGPU shader output and fidelity cannot be certified from tests or source code.
  - Fix: capture the Terrain 3D state at the user's active viewport and compare it with both source
    views before declaring the visual pass complete.

## Required fidelity surfaces

- Fonts and typography: not applicable to the terrain renderer itself; surrounding shell unchanged.
- Spacing and layout rhythm: implementation capture required.
- Colors and visual tokens: five theme colors are mapped to terrain height bands; visual balance
  requires implementation capture.
- Image quality and asset fidelity: procedural WebGPU geometry replaces no source raster asset;
  rendered sharpness requires implementation capture.
- Copy and content: the visible model label is `Terrain`; surrounding shell copy is unchanged.

## Comparison history

- Initial source review found the previous implementation's solid perimeter walls and decorative
  grass to be major mismatches.
- Fix applied: replaced the shared Tree block path with a dedicated one-draw-call instanced Terrain
  shader, thin lowland grid, separated columns, normalized height field, five height bands, terrain
  lighting, and a critically damped view transition.
- Post-fix evidence: automated tests, type checking, linting, formatting, and production build pass;
  rendered visual evidence remains unavailable.

## Implementation checklist

- Capture the 3D Terrain view from the running local app.
- Compare overall silhouette, edge thickness, height bands, and peak lighting.
- Check the flat QR state and the spring transition.
- Confirm no WebGPU compilation errors in the browser console.

final result: blocked
