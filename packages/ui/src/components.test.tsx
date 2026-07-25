import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  Badge,
  Button,
  DialogField,
  IconButton,
  Panel,
  Spinner,
} from "./index.js";

describe("shared UI components", () => {
  test("renders semantic variants through the Loomoon API", () => {
    const markup = renderToStaticMarkup(
      <Panel>
        <Badge tone="success">已保存</Badge>
        <Button variant="primary" size="md">
          确认生成
        </Button>
      </Panel>,
    );

    expect(markup).toContain("lm-panel");
    expect(markup).toContain("lm-badge--success");
    expect(markup).toContain("lm-button--primary");
  });

  test("requires an accessible name for icon-only controls", () => {
    const markup = renderToStaticMarkup(
      <IconButton label="关闭">
        <span aria-hidden="true">×</span>
      </IconButton>,
    );

    expect(markup).toContain('aria-label="关闭"');
  });

  test("exposes a polite loading status", () => {
    const markup = renderToStaticMarkup(<Spinner label="正在生成" />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain("正在生成");
  });

  test("renders dialog field validation and a dangerous action", () => {
    const markup = renderToStaticMarkup(
      <>
        <DialogField
          error="请输入项目名称"
          label="项目名称"
          name="projectName"
          value=""
          onChange={() => undefined}
        />
        <Button variant="danger">删除项目</Button>
      </>,
    );

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("请输入项目名称");
    expect(markup).toContain("lm-button--danger");
  });
});
