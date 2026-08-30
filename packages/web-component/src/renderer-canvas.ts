export function replaceRendererCanvas(canvas: HTMLCanvasElement, model: string): HTMLCanvasElement {
  const replacement = canvas.cloneNode(false) as HTMLCanvasElement;
  replacement.dataset["everyQrcodeCanvas"] = model;
  canvas.replaceWith(replacement);
  return replacement;
}
