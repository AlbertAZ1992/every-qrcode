import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EveryQRCode } from "./index";
import { nextEveryQRCodeView } from "./every-qr-code-view";

describe("EveryQRCode", () => {
  it("exports the public component name", () => {
    const markup = renderToStaticMarkup(
      <EveryQRCode initialView="qr" interactive={false} url="https://example.com" />,
    );
    expect(markup).toContain('data-every-qrcode-view="qr"');
  });

  it("renders a stable server-safe canvas shell", () => {
    const markup = renderToStaticMarkup(
      <EveryQRCode initialView="qr" interactive={false} url="https://example.com" />,
    );

    expect(markup).toContain('data-every-qrcode-view="qr"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("<canvas");
  });

  it("accepts a presentation-only scene without changing its URL identity", () => {
    const markup = renderToStaticMarkup(
      <EveryQRCode
        scene={{ background: [0.2, 0.3, 0.4], effect: "rain" }}
        url="https://example.com"
      />,
    );

    expect(markup).toContain('data-every-qrcode-view="model"');
  });

  it("selects a model through a lightweight public prop", () => {
    const terrain = renderToStaticMarkup(
      <EveryQRCode model="terrain" url="https://example.com/terrain" />,
    );

    expect(terrain).toContain('data-every-qrcode-model="terrain"');
  });

  it("binds each rendering backend to a model-specific canvas", () => {
    const tree = renderToStaticMarkup(<EveryQRCode model="tree" url="https://example.com" />);
    const terrain = renderToStaticMarkup(<EveryQRCode model="terrain" url="https://example.com" />);

    expect(tree).toContain('data-every-qrcode-canvas="tree"');
    expect(terrain).toContain('data-every-qrcode-canvas="terrain"');
  });

  it("exposes the initial interactive zoom without changing URL identity", () => {
    const markup = renderToStaticMarkup(
      <EveryQRCode initialZoom={1.2} url="https://example.com/zoomable-tree" />,
    );

    expect(markup).toContain('data-every-qrcode-zoom="1.20"');
  });

  it("toggles between the only two public views", () => {
    expect(nextEveryQRCodeView("model")).toBe("qr");
    expect(nextEveryQRCodeView("qr")).toBe("model");
  });
});
