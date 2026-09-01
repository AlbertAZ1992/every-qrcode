# Contributing to Every QR Code

Thanks for helping Every QR Code grow. Contributions can be code, tests, documentation, reference
images, geometry sketches, or a clearer description of how a proposed model should move.

## Choose a contribution size

- **Small** — improve documentation, add visual references, or isolate a reproducible bug.
- **Medium** — prototype one deterministic geometry function, palette, or shader detail.
- **Large** — integrate a complete lazy model while preserving the shared QR endpoint.

For a new visual model, start with the
[public model roadmap](docs/model-roadmap.md) and comment on its linked GitHub issue before writing
a large patch. A useful first contribution can be only one of these:

1. A reference board with notes about the shapes that matter.
2. A small TypeScript geometry prototype driven by an existing seed.
3. One WGSL material or motion experiment.
4. A deterministic test or golden fingerprint.
5. Documentation that makes the model easier for the next contributor to finish.

The maintainer can own the QR constraints, generator-version integration, and final package wiring.
The [renderer model guide](docs/adding-renderer-model.md) explains the complete technical path when
you are ready for it.

## Local setup

Every QR Code uses Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

Before opening a pull request, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

## Compatibility rules

- Do not change the canonical QR matrix for an existing URL.
- Do not change the output of a released generator version.
- Keep new model shaders in a separate lazy chunk.
- Keep Tree as the default unless a separate product decision changes it.
- Add tests for determinism, QR convergence, disposal, and lazy loading.

## Pull requests

Keep one pull request focused on one problem. Explain the visible behavior, how you verified it, and
whether it changes a saved world's visual identity. Screenshots or short recordings are welcome for
visual changes.
