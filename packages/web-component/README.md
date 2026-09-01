# @every-qrcode/web-component

A framework-independent 3D QR code Custom Element powered by deterministic Link DNA and WebGPU.

```bash
pnpm add @every-qrcode/web-component
```

```js
import "@every-qrcode/web-component/auto";
```

```html
<every-qr-code url="https://example.com"></every-qr-code>
```

Saved or shared worlds can pin the visual protocol with `generator-version`:

```html
<every-qr-code generator-version="1" url="https://example.com"></every-qr-code>
```

Unknown generator versions fail explicitly instead of falling forward to a different world.

Use `model="terrain"`, `initial-view="qr"`, or `identity-scope="url"` to change the default
presentation. Unsupported WebGPU devices receive a static, scannable SVG QR fallback.

See the [Every QR Code repository](https://github.com/AlbertAZ1992/every-qrcode) for the complete
API, architecture, and development guide.

MIT licensed.
