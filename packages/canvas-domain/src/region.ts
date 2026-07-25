interface Size {
  width: number;
  height: number;
}

interface Rect extends Size {
  x: number;
  y: number;
}

export type ImageBbox = [number, number, number, number];

export function displayRectToImageBbox(selection: Rect, display: Size, original: Size): ImageBbox {
  if (selection.width <= 0 || selection.height <= 0) throw new Error("EMPTY_REGION");
  if (display.width <= 0 || display.height <= 0 || original.width <= 0 || original.height <= 0) {
    throw new Error("INVALID_IMAGE_SIZE");
  }
  const x1 = clamp(selection.x, 0, display.width);
  const y1 = clamp(selection.y, 0, display.height);
  const x2 = clamp(selection.x + selection.width, 0, display.width);
  const y2 = clamp(selection.y + selection.height, 0, display.height);
  if (x2 <= x1 || y2 <= y1) throw new Error("EMPTY_REGION");
  return [
    Math.round((x1 / display.width) * original.width),
    Math.round((y1 / display.height) * original.height),
    Math.round((x2 / display.width) * original.width),
    Math.round((y2 / display.height) * original.height)
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
