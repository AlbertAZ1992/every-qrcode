import type { EveryQRCodeView } from "./every-qr-code.js";

export function nextEveryQRCodeView(view: EveryQRCodeView): EveryQRCodeView {
  return view === "model" ? "qr" : "model";
}
