export type InputApplicationDialog =
  | { kind: "create-project"; value: string }
  | { kind: "rename-project"; projectId: string; value: string }
  | { kind: "edit-text"; nodeId: string; value: string };

export type ApplicationDialog =
  | InputApplicationDialog
  | { kind: "delete-project"; projectId: string; projectName: string };

export function createProjectDialog(): ApplicationDialog {
  return { kind: "create-project", value: "未命名项目" };
}

export function renameProjectDialog(
  projectId: string,
  value: string,
): ApplicationDialog {
  return { kind: "rename-project", projectId, value };
}

export function deleteProjectDialog(
  projectId: string,
  projectName: string,
): ApplicationDialog {
  return { kind: "delete-project", projectId, projectName };
}

export function editTextDialog(
  nodeId: string,
  value: string,
): ApplicationDialog {
  return { kind: "edit-text", nodeId, value };
}

export function updateDialogValue(
  dialog: ApplicationDialog,
  value: string,
): ApplicationDialog {
  return dialog.kind === "delete-project" ? dialog : { ...dialog, value };
}

export function validateDialog(
  dialog: ApplicationDialog,
): string | undefined {
  if (dialog.kind === "delete-project") return undefined;
  if (dialog.value.trim()) return undefined;
  return dialog.kind === "edit-text"
    ? "请输入文字内容"
    : "请输入项目名称";
}
