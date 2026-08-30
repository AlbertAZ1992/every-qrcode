# @every-qrcode/renderer-webgpu

The low-level WebGPU renderer for
[Every QR Code](https://github.com/AlbertAZ1992/every-qrcode). It renders deterministic Tree and
Terrain worlds and morphs them into their canonical QR matrix.

```bash
pnpm add @every-qrcode/renderer-webgpu @every-qrcode/core
```

The Tree and Terrain WGSL bundles load on demand. Most applications should install
`@every-qrcode/react` or `@every-qrcode/web-component`, which manage identity creation,
interaction, resize handling, errors, and a static QR fallback.

MIT licensed.
