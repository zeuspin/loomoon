import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import { LayersPanel } from "./layers-panel.js";

const nodes: CanvasNode[] = [
  { id: "back", type: "image", x: 0, y: 0, width: 100, height: 100, name: "背景" },
  { id: "front", type: "text", x: 10, y: 10, width: 100, height: 30, name: "标题", locked: true },
];

describe("LayersPanel", () => {
  it("renders frontmost objects first with visibility, lock and delete controls", () => {
    const markup = renderToStaticMarkup(
      <LayersPanel
        nodes={nodes}
        selection={["front"]}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onRename={vi.fn()}
        onSelect={vi.fn()}
        onToggleLock={vi.fn()}
        onToggleVisibility={vi.fn()}
      />,
    );

    expect(markup.indexOf("标题")).toBeLessThan(markup.indexOf("背景"));
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain('aria-label="隐藏 标题"');
    expect(markup).toContain('aria-label="解锁 标题"');
    expect(markup).toContain('aria-label="删除 标题"');
  });
});
