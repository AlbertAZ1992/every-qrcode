import {
  createEveryQRCodeIdentity,
  createQRSvgPath,
  type IdentityScope,
  type QRSvgPath,
} from "@every-qrcode/core";

import { replaceRendererCanvas } from "./renderer-canvas.js";

export const EVERY_QR_CODE_TAG = "every-qr-code";

const TEMPLATE = `
  <style>
    :host { aspect-ratio: 1; display: block; width: 100%; }
    button { background: transparent; border: 0; cursor: pointer; height: 100%;
      padding: 0; width: 100%; }
    button[aria-disabled="true"] { cursor: default; }
    canvas, svg { display: block; height: 100%; width: 100%; }
    canvas[hidden], svg[hidden] { display: none; }
  </style>
  <button aria-label="Reveal the QR code" type="button">
    <canvas></canvas>
    <svg aria-hidden="true" hidden shape-rendering="crispEdges">
      <rect fill="#fff"></rect>
      <path fill="#111"></path>
    </svg>
  </button>
`;

type EveryQRCodeView = "model" | "qr";
export type EveryQRCodeModel = "terrain" | "tree";

type SeedRenderer = {
  dispose: () => void;
  resize: () => void;
  setFlat: (flat: boolean) => void;
};

type PreparedSeed = {
  mount: (canvas: HTMLCanvasElement, onError: (error: Error) => void) => SeedRenderer;
  readonly qr: QRSvgPath;
};

function readView(element: HTMLElement): EveryQRCodeView {
  return element.getAttribute("initial-view") === "qr" ? "qr" : "model";
}

function readScope(element: HTMLElement): IdentityScope {
  return element.getAttribute("identity-scope") === "url" ? "url" : "site";
}

function readModel(element: HTMLElement): EveryQRCodeModel {
  const model = element.getAttribute("model");
  if (model === "terrain") return model;
  return "tree";
}

function isInteractive(element: HTMLElement): boolean {
  return element.getAttribute("interactive") !== "false";
}

function errorFrom(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Every QR Code could not render this URL.");
}

async function prepareSeed(
  model: EveryQRCodeModel,
  identity: Awaited<ReturnType<typeof createEveryQRCodeIdentity>>,
): Promise<PreparedSeed> {
  const { createSeedModel, mountSeed } = await import("@every-qrcode/renderer-webgpu");
  const seed = await createSeedModel(identity);
  return {
    mount: (canvas, onError) => mountSeed(canvas, seed, {}, model, { onError }),
    qr: createQRSvgPath(identity.qr),
  };
}

function createElementConstructor(): CustomElementConstructor {
  return class EveryQRCodeElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ["identity-scope", "initial-view", "interactive", "model", "url"];
    }

    private readonly button: HTMLButtonElement;
    private canvas: HTMLCanvasElement;
    private readonly fallbackBackground: SVGRectElement;
    private readonly fallbackPath: SVGPathElement;
    private readonly fallbackSvg: SVGSVGElement;
    private fallbackVisible = false;
    private renderer: SeedRenderer | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private revision = 0;
    private view: EveryQRCodeView = "model";

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = TEMPLATE;
      this.button = root.querySelector("button") as HTMLButtonElement;
      this.canvas = root.querySelector("canvas") as HTMLCanvasElement;
      this.fallbackSvg = root.querySelector("svg") as SVGSVGElement;
      this.fallbackBackground = root.querySelector("rect") as SVGRectElement;
      this.fallbackPath = root.querySelector("path") as SVGPathElement;
    }

    connectedCallback(): void {
      this.button.addEventListener("click", this.toggle);
      this.syncControls();
      void this.renderSeed();
    }

    disconnectedCallback(): void {
      this.button.removeEventListener("click", this.toggle);
      this.revision += 1;
      this.disposeRenderer();
    }

    attributeChangedCallback(name: string): void {
      if (!this.isConnected) return;
      if (name === "url" || name === "identity-scope" || name === "model") {
        void this.renderSeed();
        return;
      }
      this.syncControls();
    }

    private readonly toggle = (): void => {
      if (!isInteractive(this) || this.fallbackVisible) return;
      this.view = this.view === "model" ? "qr" : "model";
      this.syncControls(false);
      this.dispatchEvent(
        new CustomEvent("every-qrcode-viewchange", {
          bubbles: true,
          composed: true,
          detail: { view: this.view },
        }),
      );
    };

    private syncControls(resetView = true): void {
      if (resetView) this.view = readView(this);
      const interactive = isInteractive(this);
      this.button.ariaDisabled = String(!interactive || this.fallbackVisible);
      this.button.ariaLabel = this.fallbackVisible
        ? "QR code fallback"
        : this.view === "model"
          ? "Reveal the QR code"
          : `Restore the ${readModel(this)}`;
      this.renderer?.setFlat(this.view === "qr");
    }

    private hideFallback(): void {
      this.fallbackVisible = false;
      this.canvas.hidden = false;
      this.fallbackSvg.setAttribute("hidden", "");
      this.syncControls(false);
    }

    private showFallback(qr: QRSvgPath, error: Error): void {
      this.fallbackVisible = true;
      this.canvas.hidden = true;
      this.fallbackSvg.removeAttribute("hidden");
      this.fallbackSvg.setAttribute("viewBox", `0 0 ${qr.size} ${qr.size}`);
      this.fallbackBackground.setAttribute("height", String(qr.size));
      this.fallbackBackground.setAttribute("width", String(qr.size));
      this.fallbackPath.setAttribute("d", qr.path);
      this.syncControls(false);
      this.dispatchEvent(new CustomEvent("every-qrcode-error", { detail: { error } }));
    }

    private async renderSeed(): Promise<void> {
      const revision = ++this.revision;
      const model = readModel(this);
      try {
        const identity = await createEveryQRCodeIdentity(this.getAttribute("url") ?? "", {
          identityScope: readScope(this),
        });
        const prepared = await prepareSeed(model, identity);
        if (revision !== this.revision || !this.isConnected) return;
        this.disposeRenderer();
        this.canvas = replaceRendererCanvas(this.canvas, model);
        this.hideFallback();
        this.renderer = prepared.mount(this.canvas, (error) => {
          if (revision !== this.revision || !this.isConnected) return;
          this.showFallback(prepared.qr, error);
        });
        this.renderer.setFlat(this.view === "qr");
        this.renderer.resize();
        if (typeof ResizeObserver !== "undefined") {
          this.resizeObserver = new ResizeObserver(this.renderer.resize);
          this.resizeObserver.observe(this.canvas);
        }
      } catch (reason: unknown) {
        if (revision !== this.revision) return;
        this.dispatchEvent(
          new CustomEvent("every-qrcode-error", {
            detail: { error: errorFrom(reason) },
          }),
        );
      }
    }

    private disposeRenderer(): void {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.renderer?.dispose();
      this.renderer = null;
    }
  };
}

export function defineEveryQRCodeElement(tagName = EVERY_QR_CODE_TAG): boolean {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined") return false;
  if (customElements.get(tagName)) return false;
  customElements.define(tagName, createElementConstructor());
  return true;
}
