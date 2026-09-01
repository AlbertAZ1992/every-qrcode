# @every-qrcode/react

A scannable React QR code component that grows into a deterministic 3D Tree or Terrain world.

```bash
pnpm add @every-qrcode/react
```

```tsx
import { EveryQRCode } from "@every-qrcode/react";

export function WebsiteIdentity() {
  return <EveryQRCode url="https://example.com" />;
}
```

Persist the generator version with any saved or shared world:

```tsx
<EveryQRCode generatorVersion={1} url="https://example.com" />
```

Use `CURRENT_GENERATOR_VERSION` when creating a new record. Continue passing the stored number when
rendering it later; an unsupported version fails explicitly instead of drifting to a new output.

Choose `model="terrain"`, open with `initialView="qr"`, or use `identityScope="url"` for a
page-specific identity. Unsupported WebGPU devices receive a static, scannable SVG QR fallback.

See the [Every QR Code repository](https://github.com/AlbertAZ1992/every-qrcode) for the complete
API, architecture, and development guide.

MIT licensed.
