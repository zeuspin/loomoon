export type CanvasTool =
  | "select"
  | "hand"
  | "draw"
  | "shape"
  | "text"
  | "image-generator"
  | "video-generator";

export type ToolState = {
  active: CanvasTool;
  suspended?: CanvasTool;
};

export function activateCanvasTool(
  _current: ToolState,
  active: CanvasTool,
): ToolState {
  return { active };
}

export function canNodeReceivePointer(tool: CanvasTool): boolean {
  return tool === "select" || tool === "text";
}

export function temporaryHandDown(
  current: ToolState,
  keyboardOwnedByEditor: boolean,
): ToolState {
  if (keyboardOwnedByEditor || current.active === "hand") return current;
  return { active: "hand", suspended: current.active };
}

export function temporaryHandUp(current: ToolState): ToolState {
  return current.suspended ? { active: current.suspended } : current;
}

export function toolAfterCreation(tool: CanvasTool): CanvasTool {
  return tool === "shape" ||
      tool === "text" ||
      tool === "image-generator" ||
      tool === "video-generator"
    ? "select"
    : tool;
}

export function keyboardIsOwnedByEditor(
  target: EventTarget | null,
  isComposing = false,
): boolean {
  if (isComposing) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
}
