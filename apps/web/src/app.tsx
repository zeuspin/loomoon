import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type {
  AgentRunResult,
  AgentSession,
  CanvasNode,
  DemoProject,
  PersistentAgentMessage,
  PersistentAgentRun
} from "@loomoon/contracts";
import { displayRectToImageBbox } from "@loomoon/canvas-domain";
import { AgentSidebar } from "@loomoon/agent-ui";
import { Button, Dialog, DialogField } from "@loomoon/ui";
import { ApiError, api, type ProjectSummary } from "./api.js";
import { moveNodeOrSelection, nodesInRect, reorderNode, selectionAfterClick, zoomStageAroundPoint } from "./canvas-state.js";
import { resolveAgentUiRuntime } from "./agent-sidebar-adapter.js";
import {
  createProjectDialog,
  deleteProjectDialog,
  editTextDialog,
  renameProjectDialog,
  updateDialogValue,
  validateDialog,
  type ApplicationDialog,
} from "./dialog-state.js";
import { useTheme } from "./theme.js";

const starterPrompt = "为一款无糖青柠气泡水设计夏季社交媒体广告，面向 20—30 岁城市年轻人，画面要有高级商业摄影质感。";
const agentUiRuntime = resolveAgentUiRuntime(
  import.meta.env.VITE_AGENT_UI_RUNTIME,
);

export function App() {
  const [user, setUser] = useState<{ id: string; email: string; displayName: string }>();
  const [authReady, setAuthReady] = useState(false);
  const [project, setProject] = useState<DemoProject>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<AgentRunResult["confirmation"]>();
  const [agentSession, setAgentSession] = useState<AgentSession>();
  const [agentMessages, setAgentMessages] = useState<PersistentAgentMessage[]>([]);
  const [agentRun, setAgentRun] = useState<PersistentAgentRun>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.72);
  const [stagePosition, setStagePosition] = useState({ x: 32, y: 20 });
  const [saveState, setSaveState] = useState("已保存");
  const [panelOpen, setPanelOpen] = useState(true);
  const [history, setHistory] = useState<CanvasNode[][]>([]);
  const [future, setFuture] = useState<CanvasNode[][]>([]);
  const [regionTarget, setRegionTarget] = useState<CanvasNode>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [marquee, setMarquee] = useState<{ anchorX: number; anchorY: number; x: number; y: number; width: number; height: number }>();
  const [applicationDialog, setApplicationDialog] = useState<ApplicationDialog>();
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressCanvasClear = useRef(false);
  const initialized = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveStateRef = useRef(saveState);
  const suppressNextSave = useRef(false);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    api.me()
      .then((value) => {
        setUser(value);
        return loadProject();
      })
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
  }, []);

  async function loadProject(projectId?: string) {
    const value = projectId ? await api.getProject(projectId) : await api.bootstrap();
    setProject(value);
    suppressNextSave.current = true;
    setNodes(value.canvas.nodes);
    setPending(pendingConfirmation(value));
    initialized.current = true;
    const session = await api.createAgentSession(value.id);
    setAgentSession(session);
    setAgentMessages((await api.getAgentSession(session.id)).messages);
    setAgentRun(session.activeRunId ? await api.getAgentRun(session.activeRunId) : undefined);
    setProjects(await api.listProjects());
  }

  useEffect(() => {
    if (!project?.id) return;
    const events = new EventSource(`/api/v1/projects/${project.id}/events`);
    events.addEventListener("project", (event) => {
      const updated = JSON.parse((event as MessageEvent<string>).data) as DemoProject;
      setProject(updated);
      setPending(pendingConfirmation(updated));
      if (saveStateRef.current === "已保存") {
        suppressNextSave.current = true;
        setNodes(updated.canvas.nodes);
      }
    });
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) setSaveState("正在重新连接");
    };
    return () => events.close();
  }, [project?.id]);

  async function login(email: string, password: string) {
    setBusy("正在登录…");
    setError("");
    try {
      const session = await api.login(email, password);
      setUser(session.user);
      await loadProject();
    } catch (cause) {
      setError(messageOf(cause));
      throw cause;
    } finally {
      setBusy("");
      setAuthReady(true);
    }
  }

  async function logout() {
    await api.logout();
    setUser(undefined);
    setProject(undefined);
    setNodes([]);
    initialized.current = false;
  }

  function openCreateProjectDialog() {
    setDialogError("");
    setApplicationDialog(createProjectDialog());
  }

  function openRenameProjectDialog() {
    if (!project) return;
    setDialogError("");
    setApplicationDialog(renameProjectDialog(project.id, project.name));
  }

  function openDeleteProjectDialog() {
    if (!project) return;
    setDialogError("");
    setApplicationDialog(deleteProjectDialog(project.id, project.name));
  }

  function closeApplicationDialog() {
    if (dialogBusy) return;
    setApplicationDialog(undefined);
    setDialogError("");
  }

  async function submitApplicationDialog() {
    if (!applicationDialog || dialogBusy) return;
    const validationError = validateDialog(applicationDialog);
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    setDialogBusy(true);
    setDialogError("");
    try {
      if (applicationDialog.kind === "create-project") {
        const created = await api.createProject(applicationDialog.value.trim());
        setProject(created);
        suppressNextSave.current = true;
        setNodes(created.canvas.nodes);
        setProjects(await api.listProjects());
        setSelection([]);
        setProjectMenuOpen(false);
      } else if (applicationDialog.kind === "rename-project") {
        const updated = await api.renameProject(
          applicationDialog.projectId,
          applicationDialog.value.trim(),
        );
        setProject(updated);
        setProjects(await api.listProjects());
        setProjectMenuOpen(false);
      } else if (applicationDialog.kind === "delete-project") {
        await api.deleteProject(applicationDialog.projectId);
        const remaining = await api.listProjects();
        setProjects(remaining);
        await loadProject(remaining[0]?.id);
        setProjectMenuOpen(false);
      } else {
        replaceNodes(
          nodes.map((node) =>
            node.id === applicationDialog.nodeId
              ? { ...node, text: applicationDialog.value.trim() }
              : node,
          ),
        );
      }
      setApplicationDialog(undefined);
    } catch (cause) {
      setDialogError(messageOf(cause));
    } finally {
      setDialogBusy(false);
    }
  }

  useEffect(() => {
    if (!project || !initialized.current) return;
    if (suppressNextSave.current) {
      suppressNextSave.current = false;
      return;
    }
    let cancelled = false;
    let retryCount = 0;
    setSaveState("未同步");
    window.clearTimeout(saveTimer.current);
    const save = () => {
      api.saveCanvas(project.id, project.canvas.version, nodes)
        .then((updated) => {
          if (cancelled) return;
          setProject(updated);
          setSaveState("已保存");
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          if (cause instanceof ApiError && cause.code === "CANVAS_VERSION_CONFLICT") {
            setSaveState("正在重新同步");
            void loadProject(project.id);
            return;
          }
          retryCount += 1;
          setSaveState("未同步 · 自动重试");
          setError(messageOf(cause));
          saveTimer.current = window.setTimeout(save, Math.min(5_000, 500 * 2 ** retryCount));
        });
    };
    saveTimer.current = window.setTimeout(save, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(saveTimer.current);
    };
  }, [nodes]);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => selection.includes(node.id)),
    [nodes, selection]
  );
  const selectedImages = selectedNodes.filter((node) => node.type === "image");
  const selectedFailed = selectedNodes.filter((node) => node.status === "failed");
  const latestPlan = project?.plans.at(-1);

  const replaceNodes = useCallback((next: CanvasNode[], record = true) => {
    setNodes((current) => {
      if (record) {
        setHistory((items) => [...items.slice(-29), current]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable=true]")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selection.length > 0) {
        event.preventDefault();
        replaceNodes(nodes.filter((node) => !selection.includes(node.id) || node.locked));
        setSelection([]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selection.length > 0) {
        event.preventDefault();
        copySelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, replaceNodes, selection]);

  function addTextNode() {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: "text",
      x: 180,
      y: 180,
      width: 320,
      height: 90,
      text: "双击后续版本可编辑文字"
    };
    replaceNodes([...nodes, node]);
    setSelection([node.id]);
  }

  function addArtboard() {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: "artboard",
      x: 120,
      y: 120,
      width: 1080,
      height: 1080,
      text: "社交媒体画板 · 1080 × 1080"
    };
    replaceNodes([node, ...nodes]);
    setSelection([node.id]);
  }

  function copySelection() {
    const copiedGroups = new Map<string, string>();
    const copies = nodes
      .filter((node) => selection.includes(node.id))
      .map((node) => {
        if (node.groupId && !copiedGroups.has(node.groupId)) {
          copiedGroups.set(node.groupId, crypto.randomUUID());
        }
        return {
          ...node,
          id: crypto.randomUUID(),
          x: node.x + 32,
          y: node.y + 32,
          ...(node.groupId ? { groupId: copiedGroups.get(node.groupId)! } : {})
        };
      });
    if (!copies.length) return;
    replaceNodes([...nodes, ...copies]);
    setSelection(copies.map((node) => node.id));
  }

  function toggleLockSelection() {
    replaceNodes(nodes.map((node) => selection.includes(node.id) ? { ...node, locked: !node.locked } : node));
  }

  function groupSelection() {
    if (selection.length < 2) return;
    const groupId = crypto.randomUUID();
    replaceNodes(nodes.map((node) => selection.includes(node.id) ? { ...node, groupId } : node));
  }

  function ungroupSelection() {
    replaceNodes(nodes.map((node) => {
      if (!selection.includes(node.id)) return node;
      const { groupId: _groupId, ...ungrouped } = node;
      return ungrouped;
    }));
  }

  function resizeSelection(factor: number) {
    replaceNodes(nodes.map((node) => selection.includes(node.id) && !node.locked
      ? { ...node, width: Math.max(60, node.width * factor), height: Math.max(40, node.height * factor) }
      : node));
  }

  async function sendMessage(
    messageText = input,
    selectedNodeIds = selectedImages.map((node) => node.id),
  ) {
    if (!project || !messageText.trim() || busy) return;
    setBusy("Agent 正在理解需求…");
    setError("");
    try {
      const session = agentSession ?? await api.createAgentSession(project.id);
      setAgentSession(session);
      const result = await api.sendAgentMessage(session.id, messageText, selectedNodeIds);
      setAgentRun(result.run);
      setAgentMessages((await api.getAgentSession(session.id)).messages);
      const refreshed = await api.getProject(project.id);
      setProject(refreshed);
      setPending(pendingConfirmation(refreshed));
      suppressNextSave.current = true;
      replaceNodes(refreshed.canvas.nodes);
      const createdPlan = refreshed.plans.at(-1);
      if (createdPlan) {
        const planNodes = refreshed.canvas.nodes.filter((node) => node.planId === createdPlan.id);
        const top = planNodes.length ? Math.min(...planNodes.map((node) => node.y)) : 0;
        setScale(0.72);
        setStagePosition({ x: 32, y: 36 - top * 0.72 });
      }
      setInput("");
    } catch (cause) {
      setError(messageOf(cause));
      throw cause;
    } finally {
      setBusy("");
    }
  }

  async function confirm(id: string, directionId?: string) {
    if (!project || busy) return;
    setBusy(pending ? `正在修改 ${pending.taskCount} 张图片…` : "正在并行生成 4 张候选图，通常需要数十秒…");
    setError("");
    try {
      if (agentRun?.status === "waiting_confirmation") {
        setAgentRun(await api.confirmAgentRun(agentRun.id, id, directionId));
        const updated = await api.getProject(project.id);
        setProject(updated);
        suppressNextSave.current = true;
        replaceNodes(updated.canvas.nodes);
      } else {
        const updated = await api.confirm(project.id, id, directionId);
        setProject(updated);
        suppressNextSave.current = true;
        replaceNodes(updated.canvas.nodes);
      }
      setPending(undefined);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "CONFIRMATION_EXPIRED") {
        if (agentSession) {
          const snapshot = await api.getAgentSession(agentSession.id);
          setAgentSession(snapshot.session);
          setAgentMessages(snapshot.messages);
          setAgentRun(snapshot.session.activeRunId ? await api.getAgentRun(snapshot.session.activeRunId) : undefined);
        }
        const updated = await api.getProject(project.id);
        setProject({
          ...updated,
          plans: updated.plans.map((plan) =>
            plan.id === id ? { ...plan, status: "failed" } : plan
          ),
          confirmations: updated.confirmations.map((confirmation) =>
            confirmation.id === id ? { ...confirmation, status: "expired" } : confirmation
          )
        });
        setPending(undefined);
        setInput("请基于当前创意方案重新发起图片生成确认。");
      }
      setError(messageOf(cause));
    } finally {
      setBusy("");
    }
  }

  async function retryFailed() {
    if (!project || selectedFailed.length !== 1 || busy) return;
    setBusy("正在重试失败任务…");
    try {
      const updated = await api.retryGeneration(project.id, selectedFailed[0]!.id);
      setProject(updated);
      suppressNextSave.current = true;
      replaceNodes(updated.canvas.nodes);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy("");
    }
  }

  async function uploadReference(file?: File) {
    if (!project || !file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("仅支持 JPG、PNG 和 WebP 图片。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("单张参考图不能超过 20 MB。");
      return;
    }
    setBusy("正在保存参考图…");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = await api.uploadReference(project.id, dataUrl);
      setProject(updated);
      suppressNextSave.current = true;
      replaceNodes(updated.canvas.nodes);
      const newest = updated.canvas.nodes.at(-1);
      if (newest) setSelection([newest.id]);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function proposeRegionEdit(
    instruction: string,
    bbox: [number, number, number, number]
  ) {
    if (!project || !regionTarget) return;
    setBusy("正在准备区域修改…");
    try {
      const result = await api.proposeRegionEdit(project.id, {
        nodeId: regionTarget.id,
        instruction,
        bbox
      });
      setPending(result.confirmation);
      const refreshed = await api.getProject(project.id);
      setProject(refreshed);
      setRegionTarget(undefined);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy("");
    }
  }

  async function restoreHistory(recordId: string) {
    if (!project) return;
    const updated = await api.addHistoryToCanvas(project.id, recordId);
    setProject(updated);
    suppressNextSave.current = true;
    replaceNodes(updated.canvas.nodes);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [nodes, ...items]);
    setHistory((items) => items.slice(0, -1));
    setNodes(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, nodes]);
    setFuture((items) => items.slice(1));
    setNodes(next);
  }

  function exportCanvas() {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `${project?.name ?? "loomoon-canvas"}.png`;
    link.href = dataUrl;
    link.click();
  }

  if (!authReady) return <div className="app-loading">Loomoon 正在启动…</div>;
  if (!user) return <LoginView busy={Boolean(busy)} error={error} onLogin={login} />;

  return (
    <main className={panelOpen ? "workspace" : "workspace panel-closed"}>
      <header className="topbar">
        <div className="brand-mark">L</div>
        <div className="brand-block"><strong>Loomoon</strong><button className="project-switcher" onClick={() => setProjectMenuOpen((open) => !open)}>{project?.name ?? "正在载入…"}⌄</button>
          {projectMenuOpen && <div className="project-menu">
            <header><strong>我的项目</strong><button onClick={openCreateProjectDialog}>＋ 新建</button></header>
            {projects.map((item) => <button className={item.id === project?.id ? "active" : ""} key={item.id} onClick={() => { void loadProject(item.id); setProjectMenuOpen(false); }}>{item.coverUrl && <img src={item.coverUrl} alt="" />}<span>{item.name}</span><small>{projectStatusLabel(item.status)} · {new Date(item.updatedAt).toLocaleDateString()}</small></button>)}
            <footer><button onClick={openRenameProjectDialog}>重命名当前项目</button><button className="danger" onClick={openDeleteProjectDialog}>删除当前项目</button></footer>
          </div>}
        </div>
        <span className={`save-state ${saveState !== "已保存" ? "warning" : ""}`}><i />{saveState}</span>
        <div className="top-actions">
          <button type="button" className="icon-button" onClick={undo} disabled={!history.length}>↶</button>
          <button type="button" className="icon-button" onClick={redo} disabled={!future.length}>↷</button>
          <button type="button" className="icon-button history-trigger" onClick={() => setHistoryOpen(true)} title="生成历史">◷</button>
          <button className="local-pill" onClick={() => void logout()} title="退出登录">{user.displayName} · 退出</button>
          <Button type="button" variant="primary" onClick={exportCanvas}>导出画布</Button>
        </div>
      </header>

      <section className="workspace-body">
        <nav className="tool-rail" aria-label="画布工具">
          {[
            ["↖", "选择"], ["＋", "插入"], ["T", "文字"], ["□", "画板"], ["✎", "区域编辑"], ["◎", "适应"]
          ].map(([icon, label], index) => (
            <button type="button" className={index === 0 ? "tool active" : "tool"} key={label} title={label} onClick={() => {
              if (index === 2) addTextNode();
              if (index === 3) addArtboard();
              if (index === 5) { setScale(0.72); setStagePosition({ x: 32, y: 20 }); }
            }}>
              <span>{icon}</span><small>{label}</small>
            </button>
          ))}
        </nav>

        <section className="canvas-shell" aria-label="无限画布">
          {!nodes.length && <EmptyCanvas onStart={() => setInput(starterPrompt)} />}
          <Stage
            ref={stageRef}
            width={window.innerWidth - (panelOpen ? 436 : 56)}
            height={window.innerHeight - 58}
            scaleX={scale}
            scaleY={scale}
            x={stagePosition.x}
            y={stagePosition.y}
            draggable={!marquee}
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget || !event.evt.shiftKey) return;
              const point = stageRef.current ? canvasPointer(stageRef.current, scale) : undefined;
              if (!point) return;
              suppressCanvasClear.current = true;
              setMarquee({ anchorX: point.x, anchorY: point.y, x: point.x, y: point.y, width: 0, height: 0 });
            }}
            onMouseMove={(event) => {
              if (!marquee) return;
              const point = stageRef.current ? canvasPointer(stageRef.current, scale) : undefined;
              if (!point) return;
              setMarquee({
                ...marquee,
                x: Math.min(marquee.anchorX, point.x),
                y: Math.min(marquee.anchorY, point.y),
                width: Math.abs(point.x - marquee.anchorX),
                height: Math.abs(point.y - marquee.anchorY)
              });
            }}
            onMouseUp={() => {
              if (!marquee) return;
              setSelection(nodesInRect(nodes, marquee));
              setMarquee(undefined);
            }}
            onDragEnd={(event) => {
              if (event.target === event.currentTarget) setStagePosition({ x: event.target.x(), y: event.target.y() });
            }}
            onClick={(event) => {
              if (suppressCanvasClear.current) {
                suppressCanvasClear.current = false;
                return;
              }
              if (event.target === event.currentTarget) setSelection([]);
            }}
            onWheel={(event) => {
              event.evt.preventDefault();
              const pointer = stageRef.current?.getPointerPosition();
              if (!pointer) return;
              const direction = event.evt.deltaY > 0 ? -1 : 1;
              const next = zoomStageAroundPoint({
                scale,
                position: stagePosition,
                pointer,
                delta: direction * 0.08,
                minScale: 0.25,
                maxScale: 1.8,
              });
              setScale(next.scale);
              setStagePosition(next.position);
            }}
          >
            <Layer>
              {nodes.map((node) => (
                <CanvasObject
                  key={node.id}
                  node={node}
                  selected={selection.includes(node.id)}
                  onSelect={(additive) => setSelection((current) => selectionAfterClick(current, node.id, additive))}
                  onMove={(x, y) => replaceNodes(moveNodeOrSelection(nodes, node.id, x, y, selection))}
                  onEditText={() => {
                    setDialogError("");
                    setApplicationDialog(editTextDialog(node.id, node.text ?? ""));
                  }}
                />
              ))}
              {marquee && <Rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="#6557e822" stroke="#6557e8" strokeWidth={2 / scale} dash={[8 / scale, 6 / scale]} listening={false} />}
            </Layer>
          </Stage>
          <div className="zoom-control">
            <button onClick={() => setScale((value) => Math.max(0.25, value - 0.1))}>−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((value) => Math.min(1.8, value + 0.1))}>＋</button>
            <button onClick={() => { setScale(0.72); setStagePosition({ x: 32, y: 20 }); }}>适应</button>
          </div>
          {selectedNodes.length > 0 && (
            <div className="context-toolbar">
              <strong>已选 {selectedNodes.length} 个</strong>
              {selectedImages.length > 0 && <button onClick={() => setInput("比较这些图片并推荐最适合作为社媒主视觉的一张")}>比较</button>}
              {selectedImages.length > 0 && <button onClick={() => setInput("保留主体，把选中图片全部改成夜间音乐节风格")}>Agent 修改</button>}
              {selectedImages.length === 1 && <button onClick={() => setRegionTarget(selectedImages[0])}>区域修改</button>}
              {selectedFailed.length === 1 && <button onClick={() => void retryFailed()}>重试失败任务</button>}
              <button onClick={() => resizeSelection(1.12)}>放大</button>
              <button onClick={() => resizeSelection(0.88)}>缩小</button>
              <button onClick={copySelection}>复制</button>
              <button onClick={toggleLockSelection}>{selectedNodes.every((node) => node.locked) ? "解锁" : "锁定"}</button>
              {selection.length > 1 && <button onClick={groupSelection}>分组</button>}
              {selectedNodes.some((node) => node.groupId) && <button onClick={ungroupSelection}>取消分组</button>}
              {selection.length === 1 && <button onClick={() => replaceNodes(reorderNode(nodes, selection[0]!, "front"))}>置顶</button>}
              {selection.length === 1 && <button onClick={() => replaceNodes(reorderNode(nodes, selection[0]!, "back"))}>置底</button>}
              <button onClick={() => { replaceNodes(nodes.filter((node) => !selection.includes(node.id) || node.locked)); setSelection([]); }}>删除</button>
              {selectedImages.length === 1 && <a href={selectedImages[0]!.assetUrl} download>下载原图</a>}
            </div>
          )}
        </section>

        {panelOpen ? (
          agentUiRuntime === "assistant-ui" && project ? (
            <AgentSidebar
              agentMessages={agentMessages}
              {...(agentSession ? { agentSessionId: agentSession.id } : {})}
              error={error}
              busyLabel={busy}
              isRunning={Boolean(busy)}
              project={project}
              {...(agentRun ? { agentRun } : {})}
              selectedImages={selectedImages}
              onClearSelection={() => setSelection([])}
              onClose={() => setPanelOpen(false)}
              onConfirm={confirm}
              onRemoveSelection={(nodeId) =>
                setSelection((items) => items.filter((id) => id !== nodeId))
              }
              onRevise={setInput}
              onSend={async ({ text, nodeIds }) => {
                await sendMessage(text, nodeIds);
              }}
              onUploadReference={(file) => {
                void uploadReference(file);
              }}
            />
          ) : (
          <aside className="agent-panel">
            <div className="agent-header"><div><span className="agent-status-dot" /><strong>Design Agent</strong></div><button onClick={() => setPanelOpen(false)}>›</button></div>
            <div className="conversation">
              {project?.messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-role">{message.role === "assistant" ? "✦ Agent" : "你"}</div>
                  <p>{message.content}</p>
                  {message.selectionSnapshot.length > 0 && <small>提交时选中了 {message.selectionSnapshot.length} 张图片</small>}
                </article>
              ))}
              {latestPlan?.status === "awaiting_confirmation" && (
                <PlanCard
                  plan={latestPlan}
                  busy={Boolean(busy)}
                  onConfirm={() => confirm(latestPlan.id)}
                  onRevise={() => setInput(`请调整第 ${latestPlan.version} 版计划：`)}
                />
              )}
              {pending && (
                <div className="confirmation-card">
                  <span>需要确认</span><strong>{pending.summary}</strong><p>{pending.taskCount} 个图片任务，原图将保留</p>
                  <button disabled={Boolean(busy)} onClick={() => confirm(pending.id)}>确认执行</button>
                </div>
              )}
              {busy && <div className="progress-card"><i /><div><strong>{busy}</strong><span>画布仍可继续操作</span></div></div>}
              {error && <div className="error-card">{error}</div>}
            </div>
            <div className="composer">
              {selectedImages.length > 0 && (
                <div className="selection-strip">
                  <span>画布选择 · {selectedImages.length}</span>
                  <div>{selectedImages.map((node) => <img src={node.assetUrl} key={node.id} title="点击移除" onClick={() => setSelection((items) => items.filter((id) => id !== node.id))} />)}</div>
                  <button onClick={() => setSelection([])}>清除</button>
                </div>
              )}
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void sendMessage();
              }} placeholder={selectedImages.length ? "告诉 Agent 如何处理这些图片…" : "描述你想创作的视觉内容…"} />
              <div className="composer-footer"><button onClick={() => fileInputRef.current?.click()}>＋ 参考图</button><button onClick={() => setInput(starterPrompt)}>示例需求</button><span>⌘ Enter</span><button className="send-button" disabled={!input.trim() || Boolean(busy)} onClick={() => void sendMessage()}>↑</button></div>
              <input ref={fileInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadReference(event.target.files?.[0])} />
            </div>
          </aside>
          )
        ) : <button className="panel-opener" onClick={() => setPanelOpen(true)}>✦</button>}
      </section>
      {regionTarget?.assetUrl && (
        <RegionEditor
          node={regionTarget}
          onClose={() => setRegionTarget(undefined)}
          onSubmit={proposeRegionEdit}
        />
      )}
      {historyOpen && project && (
        <HistoryDrawer
          project={project}
          onClose={() => setHistoryOpen(false)}
          onRestore={restoreHistory}
        />
      )}
      <ApplicationDialogView
        busy={dialogBusy}
        dialog={applicationDialog}
        error={dialogError}
        inputRef={dialogInputRef}
        onCancel={closeApplicationDialog}
        onChange={(value) => {
          if (!applicationDialog) return;
          setApplicationDialog(updateDialogValue(applicationDialog, value));
          if (dialogError) setDialogError("");
        }}
        onSubmit={() => void submitApplicationDialog()}
      />
    </main>
  );
}

function ApplicationDialogView({
  busy,
  dialog,
  error,
  inputRef,
  onCancel,
  onChange,
  onSubmit,
}: {
  busy: boolean;
  dialog: ApplicationDialog | undefined;
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!dialog) return null;

  const inputDialog = dialog.kind !== "delete-project";
  const title =
    dialog.kind === "create-project"
      ? "新建项目"
      : dialog.kind === "rename-project"
        ? "重命名项目"
        : dialog.kind === "delete-project"
          ? "删除项目"
          : "编辑文字";
  const description =
    dialog.kind === "delete-project"
      ? `即将删除“${dialog.projectName}”。删除后无法恢复项目画布和对话记录。`
      : dialog.kind === "edit-text"
        ? "修改后的内容会随画布自动保存。"
        : "使用清晰的名称，便于在项目列表中识别。";
  const confirmLabel =
    dialog.kind === "create-project"
      ? "创建项目"
      : dialog.kind === "rename-project"
        ? "保存名称"
        : dialog.kind === "delete-project"
          ? "删除项目"
          : "保存文字";

  return (
    <Dialog
      actions={
        <>
          <Button
            disabled={busy}
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            disabled={busy}
            form="loomoon-application-dialog"
            type="submit"
            variant={dialog.kind === "delete-project" ? "danger" : "primary"}
          >
            {busy ? "正在处理…" : confirmLabel}
          </Button>
        </>
      }
      description={description}
      initialFocus={inputDialog ? inputRef : undefined}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      open
      title={title}
    >
      <form
        id="loomoon-application-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {inputDialog ? (
          <DialogField
            ref={inputRef}
            autoComplete="off"
            error={error || undefined}
            label={dialog.kind === "edit-text" ? "文字内容" : "项目名称"}
            value={dialog.value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <p className="lm-dialog-warning">
            此操作只会在你点击“删除项目”后执行。
          </p>
        )}
        {!inputDialog && error && (
          <p className="lm-dialog-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function canvasPointer(stage: Konva.Stage, scale: number) {
  const pointer = stage.getPointerPosition();
  if (!pointer) return undefined;
  return {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  };
}

function CanvasObject({ node, selected, onSelect, onMove, onEditText }: {
  node: CanvasNode;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onMove: (x: number, y: number) => void;
  onEditText: () => void;
}) {
  const image = useCanvasImage(node.assetUrl);
  const { canvasTheme } = useTheme();
  const common = {
    x: node.x, y: node.y, width: node.width, height: node.height, draggable: !node.locked,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => { event.cancelBubble = true; onSelect(event.evt.shiftKey); },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => onMove(event.target.x(), event.target.y())
  };
  if (node.type === "text") {
    return <Text
      {...common}
      text={node.text ?? ""}
      fontSize={node.text?.startsWith("CREATIVE") ? 24 : 20}
      fontStyle="bold"
      fill="#26272d"
      lineHeight={1.35}
      padding={18}
      onDblClick={() => {
        if (node.locked) return;
        onEditText();
      }}
    />;
  }
  if (node.type === "artboard") {
    return (
      <>
        <Rect {...common} fill={canvasTheme.artboardSurface} cornerRadius={canvasTheme.radius.control} stroke={selected ? canvasTheme.selection : canvasTheme.structural} strokeWidth={selected ? 5 : 1} shadowBlur={10} shadowOpacity={0.12} />
        <Text x={node.x + 18} y={node.y + 16} text={node.text ?? "画板"} fill="#8a8a90" fontSize={14} listening={false} />
      </>
    );
  }
  return (
    <>
      <Rect {...common} fill={node.type === "image" ? canvasTheme.nodeSurface : canvasTheme.placeholderSurface} cornerRadius={canvasTheme.radius.media} stroke={selected ? canvasTheme.selection : canvasTheme.artboardSurface} strokeWidth={selected ? 5 : 1} shadowBlur={selected ? 16 : 8} shadowOpacity={0.1} />
      {node.type === "image" && image && <KonvaImage {...common} image={image} cornerRadius={canvasTheme.radius.media} />}
      {node.type !== "image" && <Text x={node.x + 24} y={node.y + node.height / 2 - 12} width={node.width - 48} align="center" text={node.status === "running" ? "正在生成…" : node.status === "failed" ? `${generationErrorText(node.errorCode)} · 选中后重试` : "等待确认生成"} fill={node.status === "failed" ? "#b94f43" : "#6f65bb"} fontSize={16} />}
    </>
  );
}

function useCanvasImage(url?: string) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!url) return;
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = url;
  }, [url]);
  return image;
}

function EmptyCanvas({ onStart }: { onStart: () => void }) {
  return <div className="empty-canvas"><div className="empty-icon">✦</div><h1>从一个创意开始</h1><p>告诉 Agent 你要做什么，它会提出两个视觉方向，并在确认后生成四张候选图。</p><button onClick={onStart}>试试青柠气泡水广告</button></div>;
}

function PlanCard({ plan, busy, onConfirm, onRevise }: { plan: NonNullable<DemoProject["plans"][number]>; busy: boolean; onConfirm: () => void; onRevise: () => void }) {
  return <div className="plan-card"><div className="plan-kicker">创作计划 v{plan.version} · 等待确认</div><h3>{plan.summary}</h3><p>目标：{plan.audience}</p>{plan.directions.map((direction, index) => <div className="direction" key={direction.id}><b>0{index + 1}</b><div><strong>{direction.title}</strong><span>{direction.style} · {direction.composition}</span><em>{direction.palette}</em></div></div>)}<div className="cost-note">确认后将调用百炼创建 4 个图片任务</div><button disabled={busy} onClick={onConfirm}>确认并生成 4 张候选图</button><button className="secondary-plan-action" disabled={busy} onClick={onRevise}>要求调整计划</button></div>;
}

function messageOf(cause: unknown) {
  return cause instanceof Error ? cause.message : "发生未知错误";
}

function generationErrorText(code?: string): string {
  const messages: Record<string, string> = {
    BAILIAN_AUTH_ERROR: "模型服务配置异常",
    BAILIAN_RATE_LIMITED: "模型服务繁忙",
    BAILIAN_TIMEOUT: "生成超时",
    BAILIAN_INVALID_RESPONSE: "模型返回异常",
    BAILIAN_UNAVAILABLE: "模型服务暂不可用"
  };
  return code ? messages[code] ?? "生成失败" : "生成失败";
}

function projectStatusLabel(status: ProjectSummary["status"]): string {
  return {
    empty: "空白",
    planning: "待确认",
    generating: "生成中",
    ready: "可继续编辑",
    attention: "需处理"
  }[status];
}

function pendingConfirmation(project: DemoProject): AgentRunResult["confirmation"] | undefined {
  const grant = project.confirmations.findLast((item) => item.status === "pending" && item.action !== "generate_candidates");
  if (!grant) return undefined;
  return {
    id: grant.id,
    action: grant.action,
    summary: grant.summary,
    targetNodeIds: [...grant.targetNodeIds],
    taskCount: grant.taskCount,
    ...(grant.bbox ? { bbox: grant.bbox } : {})
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取参考图片。"));
    reader.readAsDataURL(file);
  });
}

function LoginView({ busy, error, onLogin }: {
  busy: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("demo@loomoon.local");
  const [password, setPassword] = useState("loomoon-demo");
  return <main className="login-page">
    <section className="login-brand">
      <div className="login-logo">L</div>
      <span>LOOMOON CREATIVE OS</span>
      <h1>从想法，到完整视觉方向。</h1>
      <p>Agent 与无限画布协同完成规划、生成、比较和图片修改。</p>
      <div className="login-visual"><i /><i /><i /><strong>✦</strong></div>
    </section>
    <form className="login-card" onSubmit={(event) => { event.preventDefault(); void onLogin(email, password); }}>
      <div><small>WELCOME BACK</small><h2>登录 Loomoon</h2><p>使用演示账号进入本地创作空间</p></div>
      <label>账号<input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {error && <div className="login-error">{error}</div>}
      <button type="submit" disabled={busy}>{busy ? "登录中…" : "进入创作空间"}</button>
      <aside><b>演示账号</b><span>demo@loomoon.local / loomoon-demo</span><span>reviewer@loomoon.local / loomoon-review</span></aside>
    </form>
  </main>;
}

function RegionEditor({ node, onClose, onSubmit }: {
  node: CanvasNode;
  onClose: () => void;
  onSubmit: (instruction: string, bbox: [number, number, number, number]) => Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number }>();
  const [instruction, setInstruction] = useState("把框选区域中的物体替换为冰块，保持光线与背景自然融合");

  function point(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return <div className="region-backdrop">
    <section className="region-dialog">
      <header><div><small>WAN 2.7 INTERACTIVE EDIT</small><h2>框选要修改的区域</h2></div><button onClick={onClose}>×</button></header>
      <div
        className="region-image"
        onPointerDown={(event) => {
          const current = point(event);
          start.current = current;
          event.currentTarget.setPointerCapture(event.pointerId);
          setSelection({ ...current, width: 0, height: 0 });
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const current = point(event);
          setSelection({
            x: Math.min(start.current.x, current.x),
            y: Math.min(start.current.y, current.y),
            width: Math.abs(current.x - start.current.x),
            height: Math.abs(current.y - start.current.y)
          });
        }}
        onPointerUp={() => { start.current = undefined; }}
      >
        <img ref={imageRef} src={node.assetUrl} draggable={false} />
        {selection && <i style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}
      </div>
      <p>拖拽框选一个区域。系统会换算为原图绝对像素坐标；当前模型按边界框编辑。</p>
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      <footer><button onClick={onClose}>取消</button><button disabled={!selection || selection.width < 4 || selection.height < 4 || !instruction.trim()} onClick={() => {
        const image = imageRef.current;
        if (!image || !selection) return;
        const bbox = displayRectToImageBbox(
          selection,
          { width: image.clientWidth, height: image.clientHeight },
          { width: image.naturalWidth, height: image.naturalHeight }
        );
        void onSubmit(instruction, bbox);
      }}>预览并确认修改</button></footer>
    </section>
  </div>;
}

function HistoryDrawer({ project, onClose, onRestore }: {
  project: DemoProject;
  onClose: () => void;
  onRestore: (recordId: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "succeeded" | "failed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "text_to_image" | "image_edit" | "region_edit">("all");
  const records = [...project.generationHistory]
    .filter((record) => statusFilter === "all" || record.status === statusFilter)
    .filter((record) => typeFilter === "all" || record.type === typeFilter)
    .reverse();
  return <div className="history-backdrop" onClick={onClose}>
    <aside className="history-drawer" onClick={(event) => event.stopPropagation()}>
      <header><div><small>PROJECT ARCHIVE</small><h2>生成历史</h2></div><button onClick={onClose}>×</button></header>
      <p>删除画布节点不会删除历史资产。</p>
      <div className="history-filters">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="all">全部状态</option><option value="succeeded">已完成</option><option value="failed">失败</option>
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="all">全部类型</option><option value="text_to_image">候选图</option><option value="image_edit">图片修改</option><option value="region_edit">区域修改</option>
        </select>
      </div>
      <div className="history-list">
        {records.map((record) => (
          <article key={record.id}>
            <div className="history-thumb">
              {record.assetUrl ? <img src={record.assetUrl} /> : <span>失败</span>}
            </div>
            <div><strong>{record.type === "text_to_image" ? "候选图生成" : record.type === "region_edit" ? "区域修改" : "图片修改"}</strong><span>{record.status === "succeeded" ? "已完成" : "失败"} · {new Date(record.createdAt).toLocaleTimeString()}</span><p>{record.prompt}</p></div>
            {record.status === "succeeded" && <button onClick={() => void onRestore(record.id)}>加入画布</button>}
          </article>
        ))}
        {!records.length && <div className="history-empty">没有符合筛选条件的生成记录。</div>}
      </div>
    </aside>
  </div>;
}
