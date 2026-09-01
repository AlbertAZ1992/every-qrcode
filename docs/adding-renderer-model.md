# Adding a renderer model

Every QR Code treats Tree and Terrain as renderer models, not color themes and not compatibility
packages. The default model is Tree. A consumer that omits `model` loads the shared WebGPU runtime
and the Tree Shader bundle; another model is downloaded only when selected.

## What a new model needs

A model is more than one Shader file and one test. A complete addition has five parts:

1. **Identity contract** — extend `SeedForm` in `packages/renderer-webgpu/src/seed-model.ts` without
   changing the normalized URL, DNA salts, or canonical QR matrix.
2. **Deterministic geometry** — teach `createSeedBlockField` and, when needed,
   `createSeedGpuScene` how the existing seed maps to the new form.
3. **Lazy Shader bundle** — add `packages/renderer-webgpu/src/<model>-shaders.ts` and register its
   dynamic import in `SEED_SHADER_LOADERS` in `renderer.ts`.
4. **Pipeline adapter** — add the model-specific pipeline type, construction, and render-pass branch
   while continuing to use the shared buffers, transitions, QR endpoint, resize, zoom, and disposal.
5. **Public selector** — extend `EveryQRCodeModel` in React and the Web Component model attribute,
   then expose the model in Studio controls if it is a first-party model.

`SEED_SHADER_LOADERS` uses `satisfies Record<SeedForm, ...>`. TypeScript therefore fails the build
when `SeedForm` gains a value without a matching lazy loader. This is the model registry boundary.

## Required tests

- The same URL and identity scope always produce the same model.
- The selected loader returns only its own Shader bundle.
- The new form reaches the exact same QR matrix as Tree and Terrain.
- Switching models disposes the previous GPU renderer.
- The production build emits a separate lazy chunk for the model.
- Tree remains the default when `model` is omitted.

If the model changes any existing world's seed, CPU geometry, or Shader output, add a new entry to
`SUPPORTED_GENERATOR_VERSIONS` and a matching seed/Shader registry implementation. Never rewrite a
released generator version or replace its golden fingerprints.

Run the complete verification sequence:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

## When to create another npm package

Do not create a package for a palette, weather preset, or first-party renderer model. Those belong
inside `@every-qrcode/renderer-webgpu` as data or lazy model bundles. A separate npm package is only
appropriate after a public third-party model-plugin API exists and independent installation is a
real requirement.
