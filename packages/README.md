# Package architecture

Consumers install only `@every-qrcode/react` or `@every-qrcode/web-component`. Core and the WebGPU
renderer are shared implementation packages under the same scope.

The package graph follows the rendering flow rather than a product screen:

```text
@every-qrcode/core
        ↓
@every-qrcode/renderer-webgpu
        ├── @every-qrcode/react
        └── @every-qrcode/web-component
```

- `core` owns URL identity, deterministic DNA, and the canonical QR matrix.
- `renderer-webgpu` owns Tree, Terrain, the shared QR morph, GPU resources, shaders, and render loop.
  Its shared runtime dynamically loads only the selected model's Shader bundle.
- `react` owns the React component and dynamically loads the renderer.
- `web-component` owns the native `<every-qr-code>` custom element and dynamically loads the
  renderer.

Tree and Terrain deliberately share one deterministic seed model. Changing `model` changes the
upper 3D form, not the QR payload or the 2D-to-3D interaction.

Additional models belong in `renderer-webgpu` as another lazy Shader/pipeline bundle registered by
the shared loader. They do not require another compatibility or theme package.
