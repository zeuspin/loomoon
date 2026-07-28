import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreoorApp } from "./CreoorApp";

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas-stage-host">{children}</div>,
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Circle: () => null, Rect: () => null, Text: () => null, Image: () => null, Transformer: () => null,
}));

describe("Creoor workbench", () => {
  it("renders the canvas, four work areas and local-only disclosure", () => {
    render(<CreoorApp />);
    expect(screen.getByTestId("canvas-stage-host")).toBeInTheDocument();
    expect(screen.getByText("林然的工作室")).toBeInTheDocument();
    expect(screen.getByText("仅存于此浏览器")).toBeInTheDocument();
    expect(screen.getByText("Creoor Agent")).toBeInTheDocument();
    expect(screen.getAllByText("图片生成器").length).toBeGreaterThan(0);
  });
});
