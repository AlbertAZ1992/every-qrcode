# @every-qrcode/core

Deterministic URL identity, Link DNA, canonical QR matrices, and SVG QR paths for
[Every QR Code](https://github.com/AlbertAZ1992/every-qrcode).

```bash
pnpm add @every-qrcode/core
```

```ts
import { createEveryQRCodeIdentity, createQRSvgPath } from "@every-qrcode/core";

const identity = await createEveryQRCodeIdentity("https://example.com");
const svg = createQRSvgPath(identity.qr);
```

Most applications should install `@every-qrcode/react` or
`@every-qrcode/web-component` instead. This package contains the platform-independent identity
protocol shared by both adapters.

MIT licensed.
