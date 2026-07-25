import { describe, expect, test } from "vitest";
import {
  createProjectDialog,
  deleteProjectDialog,
  editTextDialog,
  renameProjectDialog,
  updateDialogValue,
  validateDialog,
} from "./dialog-state.js";

describe("application dialog state", () => {
  test("creates business-specific dialog descriptors", () => {
    expect(createProjectDialog()).toEqual({
      kind: "create-project",
      value: "未命名项目",
    });
    expect(renameProjectDialog("project-1", "夏季广告")).toEqual({
      kind: "rename-project",
      projectId: "project-1",
      value: "夏季广告",
    });
    expect(deleteProjectDialog("project-1", "夏季广告")).toEqual({
      kind: "delete-project",
      projectId: "project-1",
      projectName: "夏季广告",
    });
    expect(editTextDialog("node-1", "标题")).toEqual({
      kind: "edit-text",
      nodeId: "node-1",
      value: "标题",
    });
  });

  test("validates and updates only input dialog values", () => {
    const create = updateDialogValue(createProjectDialog(), "  ");
    expect(validateDialog(create)).toBe("请输入项目名称");

    const edit = updateDialogValue(editTextDialog("node-1", "标题"), "新标题");
    expect(validateDialog(edit)).toBeUndefined();
    expect(edit).toMatchObject({ value: "新标题" });

    const deletion = deleteProjectDialog("project-1", "夏季广告");
    expect(updateDialogValue(deletion, "ignored")).toEqual(deletion);
    expect(validateDialog(deletion)).toBeUndefined();
  });
});
