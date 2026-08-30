import { createEveryQRCodeIdentity, type EveryQRCodeIdentity } from "@every-qrcode/core";
import { EveryQRCode, type EveryQRCodeModel } from "@every-qrcode/react";
import { useDeferredValue, useEffect, useState } from "react";

import { CoreInspector } from "@/core-inspector";

const DEFAULT_LINK = "https://example.com";
const MODELS: readonly EveryQRCodeModel[] = ["tree", "terrain"];
const MODEL_LABELS: Readonly<Record<EveryQRCodeModel, string>> = {
  terrain: "Terrain",
  tree: "Tree",
};

export function App(): React.JSX.Element {
  const [input, setInput] = useState(DEFAULT_LINK);
  const [model, setModel] = useState<EveryQRCodeModel>("tree");
  const [identity, setIdentity] = useState<EveryQRCodeIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredInput = useDeferredValue(input);
  const resolvedInput = deferredInput.trim() || DEFAULT_LINK;

  useEffect(() => {
    let cancelled = false;
    void createEveryQRCodeIdentity(resolvedInput)
      .then((nextIdentity) => {
        if (cancelled) return;
        setIdentity(nextIdentity);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "Every QR Code could not read that link.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedInput]);

  return (
    <main className="demo-shell">
      <section className="scene-region">
        <nav aria-label="Every QR Code model" className="model-picker">
          {MODELS.map((option) => (
            <button
              aria-pressed={option === model}
              key={option}
              onClick={() => setModel(option)}
              type="button"
            >
              {MODEL_LABELS[option]}
            </button>
          ))}
        </nav>
        <EveryQRCode className="scene-button" model={model} url={resolvedInput} />
      </section>
      <div className="input-region">
        <label className="sr-only" htmlFor="qr-content">
          URL to render
        </label>
        <input
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          id="qr-content"
          inputMode="url"
          onChange={(event) => {
            setInput(event.target.value);
          }}
          placeholder="https://example.com"
          spellCheck={false}
          value={input}
        />
        <p aria-live="polite" className="input-error">
          {error}
        </p>
        {identity ? <CoreInspector identity={identity} /> : null}
      </div>
    </main>
  );
}
