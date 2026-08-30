import {
  createEveryQRCodeIdentity,
  createQRSvgPath,
  type IdentityScope,
  type QRSvgPath,
} from "@every-qrcode/core";
import type { SeedSceneConfig } from "@every-qrcode/renderer-webgpu";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { nextEveryQRCodeView } from "./every-qr-code-view.js";

export type EveryQRCodeView = "model" | "qr";
export type EveryQRCodeModel = "terrain" | "tree";
export type EveryQRCodeSceneConfig = SeedSceneConfig;

export type EveryQRCodeProps = {
  readonly className?: string;
  readonly identityScope?: IdentityScope;
  readonly initialView?: EveryQRCodeView;
  readonly initialZoom?: number;
  readonly interactive?: boolean;
  readonly model?: EveryQRCodeModel;
  readonly onError?: (error: Error) => void;
  readonly onViewChange?: (view: EveryQRCodeView) => void;
  readonly scene?: EveryQRCodeSceneConfig;
  readonly style?: CSSProperties;
  readonly url: string;
};

type SeedRenderer = {
  dispose: () => void;
  resize: () => void;
  setFlat: (flat: boolean) => void;
  setScene: (scene: EveryQRCodeSceneConfig) => void;
  setZoom: (zoom: number) => void;
};

type PreparedSeed = {
  mount: (
    canvas: HTMLCanvasElement,
    scene: EveryQRCodeSceneConfig,
    onError: (error: Error) => void,
  ) => SeedRenderer;
  readonly qr: QRSvgPath;
};

const CANVAS_STYLE: CSSProperties = {
  display: "block",
  height: "100%",
  width: "100%",
};

const ERROR_STYLE: CSSProperties = {
  alignItems: "center",
  color: "#555",
  display: "flex",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.75rem",
  inset: "12%",
  justifyContent: "center",
  lineHeight: 1.5,
  position: "absolute",
  textAlign: "center",
};

const FALLBACK_STYLE: CSSProperties = {
  display: "block",
  height: "100%",
  inset: 0,
  position: "absolute",
  width: "100%",
};

const HIDDEN_STYLE: CSSProperties = {
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

const ROOT_STYLE: CSSProperties = {
  aspectRatio: "1",
  background: "transparent",
  border: 0,
  display: "block",
  padding: 0,
  position: "relative",
  width: "100%",
};

function clampZoom(zoom: number): number {
  return Math.max(0.82, Math.min(1.45, zoom));
}

function useSeedZoom(options: {
  readonly initialZoom: number;
  readonly model: EveryQRCodeModel;
  readonly rendererRef: { current: SeedRenderer | null };
  readonly url: string;
}): {
  readonly handleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly zoom: number;
  readonly zoomRef: { current: number };
} {
  const zoomRef = useRef(clampZoom(options.initialZoom));
  const [zoom, setZoom] = useState(zoomRef.current);
  useEffect(
    () => setZoom(clampZoom(options.initialZoom)),
    [options.initialZoom, options.model, options.url],
  );
  useEffect(() => {
    zoomRef.current = zoom;
    options.rendererRef.current?.setZoom(zoom);
  }, [options.rendererRef, zoom]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const positive = event.key === "+" || event.key === "=";
    const negative = event.key === "-" || event.key === "_";
    const direction = positive ? 1 : negative ? -1 : 0;
    if (direction === 0 && event.key !== "0") return;
    event.preventDefault();
    setZoom((current) => (event.key === "0" ? 1 : clampZoom(current + direction * 0.1)));
  }, []);
  return { handleKeyDown, zoom, zoomRef };
}

function useMountedRenderer(options: {
  readonly canvasRef: { current: HTMLCanvasElement | null };
  readonly onRendererError: (error: Error) => void;
  readonly prepared: PreparedSeed | null;
  readonly rendererRef: { current: SeedRenderer | null };
  readonly sceneRef: { current: EveryQRCodeSceneConfig | undefined };
  readonly view: EveryQRCodeView;
  readonly zoomRef: { current: number };
}): void {
  useEffect(() => {
    const canvas = options.canvasRef.current;
    if (!canvas || !options.prepared) return;
    const renderer = options.prepared.mount(
      canvas,
      options.sceneRef.current ?? {},
      options.onRendererError,
    );
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(renderer.resize);
    options.rendererRef.current = renderer;
    renderer.setFlat(options.view === "qr");
    renderer.setZoom(options.zoomRef.current);
    renderer.resize();
    observer?.observe(canvas);
    return () => {
      observer?.disconnect();
      renderer.dispose();
      if (options.rendererRef.current === renderer) options.rendererRef.current = null;
    };
  }, [
    options.canvasRef,
    options.onRendererError,
    options.prepared,
    options.rendererRef,
    options.sceneRef,
  ]);
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
    mount: (canvas, scene, onError) => mountSeed(canvas, seed, scene, model, { onError }),
    qr: createQRSvgPath(identity.qr),
  };
}

export function EveryQRCode({
  className,
  identityScope = "site",
  initialView = "model",
  initialZoom = 1,
  interactive = true,
  model = "tree",
  onError,
  onViewChange,
  scene,
  style,
  url,
}: EveryQRCodeProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onErrorRef = useRef(onError);
  const rendererRef = useRef<SeedRenderer | null>(null);
  const sceneRef = useRef(scene);
  const [error, setError] = useState<Error | null>(null);
  const [prepared, setPrepared] = useState<PreparedSeed | null>(null);
  const [view, setView] = useState<EveryQRCodeView>(initialView);
  const { handleKeyDown, zoom, zoomRef } = useSeedZoom({
    initialZoom,
    model,
    rendererRef,
    url,
  });
  const handleRendererError = useCallback((reason: Error) => {
    const nextError = errorFrom(reason);
    setError(nextError);
    onErrorRef.current?.(nextError);
  }, []);
  useMountedRenderer({
    canvasRef,
    onRendererError: handleRendererError,
    prepared,
    rendererRef,
    sceneRef,
    view,
    zoomRef,
  });

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => setView(initialView), [initialView, model, url]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPrepared(null);
    void createEveryQRCodeIdentity(url, { identityScope })
      .then((identity) => prepareSeed(model, identity))
      .then((nextPrepared) => {
        if (cancelled) return;
        setError(null);
        setPrepared(nextPrepared);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const nextError = errorFrom(reason);
        setError(nextError);
        onErrorRef.current?.(nextError);
      });
    return () => {
      cancelled = true;
    };
  }, [identityScope, model, url]);

  useEffect(() => {
    sceneRef.current = scene;
    rendererRef.current?.setScene(scene ?? {});
  }, [scene]);

  useEffect(() => rendererRef.current?.setFlat(view === "qr"), [view]);

  const toggle = useCallback(() => {
    if (!interactive || error) return;
    const next = nextEveryQRCodeView(view);
    setView(next);
    onViewChange?.(next);
  }, [error, interactive, onViewChange, view]);

  const fallback = error && prepared ? prepared.qr : null;

  return (
    <button
      aria-busy={!prepared && !error}
      aria-disabled={!interactive || Boolean(error)}
      aria-keyshortcuts="+ - 0"
      aria-label={
        fallback
          ? "QR code fallback"
          : view === "model"
            ? "Reveal the QR code"
            : `Restore the ${model}`
      }
      className={className}
      data-every-qrcode-fallback={fallback ? "qr" : undefined}
      data-every-qrcode-model={model}
      data-every-qrcode-view={view}
      data-every-qrcode-zoom={zoom.toFixed(2)}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      style={{ ...ROOT_STYLE, ...style }}
      type="button"
    >
      <canvas
        data-every-qrcode-canvas={model}
        hidden={Boolean(fallback)}
        key={model}
        ref={canvasRef}
        style={CANVAS_STYLE}
      />
      {fallback ? (
        <svg
          aria-hidden="true"
          shapeRendering="crispEdges"
          style={FALLBACK_STYLE}
          viewBox={`0 0 ${fallback.size} ${fallback.size}`}
        >
          <rect fill="#fff" height={fallback.size} width={fallback.size} />
          <path d={fallback.path} fill="#111" />
        </svg>
      ) : null}
      {error && !fallback ? <span style={ERROR_STYLE}>{error.message}</span> : null}
      <span aria-live="polite" style={HIDDEN_STYLE}>
        {error?.message ?? (view === "model" ? `${model} view` : "QR code view")}
      </span>
    </button>
  );
}
