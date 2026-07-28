import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { RiAddLine, RiArrowLeftLine, RiArrowRightLine, RiCheckboxBlankLine, RiChat3Line, RiCircleLine, RiCursorLine, RiGridLine, RiHand, RiImageLine, RiPencilLine, RiShapeLine, RiStackLine, RiStarLine, RiText, RiTriangleLine, RiUpload2Line, RiVideoLine, RiVideoUploadLine } from "@remixicon/react";
import type {
  AgentRunResult,
  AgentSession,
  CanvasNode,
  DemoProject,
  ImageModelCapability,
  PersistentAgentMessage,
  PersistentAgentRun
} from "@loomoon/contracts";
import { displayRectToImageBbox, normalizeCanvasNode } from "@loomoon/canvas-domain";
import { AgentSidebar } from "@loomoon/agent-ui";
import { Button, Dialog, DialogField } from "@loomoon/ui";
import { ApiError, api, type ProjectSummary } from "./api.js";
import {
  agentRunNeedsRefresh,
  refreshAgentTimelineAfterProjectEvent,
} from "./agent-event-sync.js";
import { focusNodeInViewport, moveNodeOrSelection, nodesInRect, reorderNode, selectionAfterClick } from "./canvas-state.js";
import {
  beginCanvasTouch,
  cancelCanvasTouch,
  createCameraFrameBatcher,
  endCanvasTouch,
  idleCanvasTouchGesture,
  moveCanvasTouch,
  wheelCameraChange,
  type CanvasTouchEffect,
  type CanvasTouchGesture,
  type CameraFrameBatcher,
  type GesturePoint,
} from "./canvas-gesture.js";
import { syncSelectionTransformer, transformCanvasNode } from "./canvas-transform.js";
import { resolveAgentUiRuntime } from "./agent-sidebar-adapter.js";
import {
  canvasNodesForProject,
  generatorCanvasColors,
} from "./canvas-tools.js";
import {
  activateCanvasTool,
  canNodeReceivePointer,
  keyboardIsOwnedByEditor,
  temporaryHandDown,
  temporaryHandUp,
  toolAfterCreation,
  type ToolState,
} from "./canvas-tool-state.js";
import { appendGeneratorReferences, createGeneratorNode, generationFailureMessage, generatorDisplayDimensions, isGeneratorNode, normalizeGeneratorNodesForModels, updateGeneratorConfig } from "./generator-node.js";
import { GeneratorNodePortal, GeneratorOverlay, generatorOverlayPlacement } from "./generator-overlay.js";
import { LayersPanel } from "./layers-panel.js";
import { deleteLayer, renameLayer, reorderLayer, toggleLayerLock, toggleLayerVisibility } from "./layer-state.js";
import { consumeProjectLaunchIntent } from "./project-launch-intent.js";
import { routeAfterProjectDeletion } from "./app-route.js";
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

export interface CanvasWorkspaceProps {
  projectId: string;
  onOpenProject: (projectId: string) => void;
  onLeaveCanvas: () => void;
}

export function App(props: CanvasWorkspaceProps) {
  const [user, setUser] = useState<{ id: string; email: string; displayName: string }>();
  const [authReady, setAuthReady] = useState(false);
  const [project, setProject] = useState<DemoProject>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelCapability[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<AgentRunResult["confirmation"]>();
  const [agentSession, setAgentSession] = useState<AgentSession>();
  const [agentMessages, setAgentMessages] = useState<PersistentAgentMessage[]>([]);
  const [agentRun, setAgentRun] = useState<PersistentAgentRun>();
  const [initialAgentMessage, setInitialAgentMessage] = useState<{
    id: string;
    text: string;
    nodeIds: string[];
    createdAt: string;
  }>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.72);
  const [stagePosition, setStagePosition] = useState({ x: 32, y: 20 });
  const [saveState, setSaveState] = useState("已保存");
  const [panelOpen, setPanelOpen] = useState(true);
  const [history, setHistory] = useState<CanvasNode[][]>([]);
  const [future, setFuture] = useState<CanvasNode[][]>([]);
  const [regionTarget, setRegionTarget] = useState<CanvasNode>();
  const [referencePickerGeneratorId, setReferencePickerGeneratorId] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [marquee, setMarquee] = useState<{ anchorX: number; anchorY: number; x: number; y: number; width: number; height: number }>();
  const [applicationDialog, setApplicationDialog] = useState<ApplicationDialog>();
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [toolMenu, setToolMenu] = useState<"insert" | "shape">();
  const [toolState, setToolState] = useState<ToolState>({ active: "select" });
  const [pendingShapeKind, setPendingShapeKind] = useState<NonNullable<CanvasNode["shapeKind"]>>("rectangle");
  const [drawingPoints, setDrawingPoints] = useState<number[]>();
  const [shapeDraft, setShapeDraft] = useState<CanvasNode>();
  const [layersOpen, setLayersOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const stageRef = useRef<Konva.Stage>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingActive = useRef(false);
  const drawingPointsRef = useRef<number[] | undefined>(undefined);
  const shapeActive = useRef(false);
  const shapeAnchor = useRef<{ x: number; y: number } | undefined>(undefined);
  const initialized = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveStateRef = useRef(saveState);
  const suppressNextSave = useRef(false);
  const projectLoadSequence = useRef(0);
  const touchGesture = useRef<CanvasTouchGesture>(idleCanvasTouchGesture());
  const cameraFrameBatcher = useRef<CameraFrameBatcher | undefined>(undefined);
  const activeCanvasTool = toolState.active;

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    const batcher = createCameraFrameBatcher({
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
      commit: (camera) => {
        setScale(camera.scale);
        setStagePosition(camera.position);
      },
      present: (camera) => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.position(camera.position);
        stage.scale({ x: camera.scale, y: camera.scale });
        stage.batchDraw();
      },
      requestFrame: (callback) => window.requestAnimationFrame(callback),
    });
    cameraFrameBatcher.current = batcher;
    return () => {
      batcher.cancel();
      cameraFrameBatcher.current = undefined;
    };
  }, []);

  useEffect(() => {
    const cancelLostTouch = () => {
      const result = cancelCanvasTouch(touchGesture.current);
      touchGesture.current = result.gesture;
      cancelSingleStageGesture();
    };
    window.addEventListener("blur", cancelLostTouch);
    return () => {
      window.removeEventListener("blur", cancelLostTouch);
      touchGesture.current = idleCanvasTouchGesture();
      drawingActive.current = false;
      drawingPointsRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    api.me()
      .then((value) => {
        setUser(value);
      })
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    void api.getImageModels().then(setImageModels).catch((cause) => setError(messageOf(cause)));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void loadProject(props.projectId);
  }, [props.projectId, user?.id]);

  function beginProjectLoad() {
    initialized.current = false;
    window.clearTimeout(saveTimer.current);
    setProject(undefined);
    setNodes([]);
    setSelection([]);
    setInput("");
    setPending(undefined);
    setAgentSession(undefined);
    setAgentMessages([]);
    setAgentRun(undefined);
    setInitialAgentMessage(undefined);
    setBusy("正在载入项目…");
    setError("");
    setScale(0.72);
    setStagePosition({ x: 32, y: 20 });
    setSaveState("已保存");
    setHistory([]);
    setFuture([]);
    setRegionTarget(undefined);
    setHistoryOpen(false);
    setMarquee(undefined);
    setApplicationDialog(undefined);
    setDialogError("");
    setToolMenu(undefined);
    setToolState({ active: "select" });
    setDrawingPoints(undefined);
    setShapeDraft(undefined);
    setLayersOpen(false);
    drawingActive.current = false;
    shapeActive.current = false;
    shapeAnchor.current = undefined;
  }

  async function loadProject(projectId: string) {
    const sequence = ++projectLoadSequence.current;
    beginProjectLoad();
    try {
      let value = await api.getProject(projectId);
      if (sequence !== projectLoadSequence.current) return;
      const models = await api.getImageModels();
      if (sequence !== projectLoadSequence.current) return;
      setImageModels(models);
      const loadedNodes = canvasNodesForProject(value);
      const migratedNodes = normalizeGeneratorNodesForModels(loadedNodes, models);
      if (migratedNodes.some((node, index) => node !== loadedNodes[index])) {
        value = await api.saveCanvas(value.id, value.canvas.version, migratedNodes);
        if (sequence !== projectLoadSequence.current) return;
      }
      const session = await api.createAgentSession(value.id);
      if (sequence !== projectLoadSequence.current) return;
      const timeline = await api.getAgentSession(session.id);
      if (sequence !== projectLoadSequence.current) return;
      const activeRun = session.activeRunId
        ? await api.getAgentRun(session.activeRunId)
        : undefined;
      if (sequence !== projectLoadSequence.current) return;
      const projectSummaries = await api.listProjects();
      if (sequence !== projectLoadSequence.current) return;

      suppressNextSave.current = true;
      setProject(value);
      setNodes(canvasNodesForProject(value));
      setSelection([]);
      setPending(pendingConfirmation(value));
      setAgentSession(session);
      setAgentMessages(timeline.messages);
      setAgentRun(activeRun);
      const launchIntent = consumeProjectLaunchIntent(
        window.sessionStorage,
        value.id,
      );
      setInitialAgentMessage(
        launchIntent
          ? {
              id: launchIntent.id,
              text: launchIntent.prompt,
              nodeIds: [],
              createdAt: launchIntent.createdAt,
            }
          : undefined,
      );
      setProjects(projectSummaries);
      initialized.current = true;
      setBusy("");
    } catch (cause) {
      if (sequence !== projectLoadSequence.current) return;
      setBusy("");
      setError(messageOf(cause));
    }
  }

  useEffect(() => {
    if (!project?.id) return;
    const projectId = project.id;
    const loadSequence = projectLoadSequence.current;
    const events = new EventSource(`/api/v1/projects/${project.id}/events`);
    events.addEventListener("project", (event) => {
      const updated = JSON.parse((event as MessageEvent<string>).data) as DemoProject;
      setProject(updated);
      setPending(pendingConfirmation(updated));
      if (saveStateRef.current === "已保存") {
        if (!updated.canvas.nodes.length) return;
        suppressNextSave.current = true;
        setNodes(updated.canvas.nodes.map(normalizeCanvasNode));
      }
      if (agentSession) {
        void refreshAgentTimelineAfterProjectEvent(api, agentSession.id, agentRun)
          .then((timeline) => {
            if (
              loadSequence !== projectLoadSequence.current ||
              projectId !== timeline.session.projectId
            ) return;
            setAgentSession(timeline.session);
            setAgentMessages(timeline.messages);
            setAgentRun(timeline.run);
          })
          .catch(() => undefined);
      }
    });
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) setSaveState("正在重新连接");
    };
    return () => events.close();
  }, [agentRun?.id, agentRun?.status, agentSession?.id, project?.id]);

  useEffect(() => {
    if (!agentSession || !agentRunNeedsRefresh(agentRun)) return;
    const projectId = project?.id;
    const loadSequence = projectLoadSequence.current;
    const timer = window.setInterval(() => {
      void refreshAgentTimelineAfterProjectEvent(api, agentSession.id, agentRun)
        .then((timeline) => {
          if (
            loadSequence !== projectLoadSequence.current ||
            projectId !== timeline.session.projectId
          ) return;
          setAgentSession(timeline.session);
          setAgentMessages(timeline.messages);
          setAgentRun(timeline.run);
        })
        .catch(() => undefined);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [agentRun?.id, agentRun?.status, agentSession?.id, project?.id]);

  async function login(email: string, password: string) {
    setBusy("正在登录…");
    setError("");
    try {
      const session = await api.login(email, password);
      setUser(session.user);
      await loadProject(props.projectId);
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
        setProjects(await api.listProjects());
        setProjectMenuOpen(false);
        props.onOpenProject(created.id);
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
        setProjectMenuOpen(false);
        const nextRoute = routeAfterProjectDeletion(remaining);
        if (nextRoute.kind === "canvas") {
          props.onOpenProject(nextRoute.projectId);
        } else {
          props.onLeaveCanvas();
        }
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
    () => nodes.filter((node) => selection.includes(node.id) && node.visible !== false),
    [nodes, selection]
  );
  const selectedImages = selectedNodes.filter((node) => node.type === "image");
  const selectedFailed = selectedNodes.filter((node) => node.status === "failed");
  const selectedGenerator = selectedNodes.length === 1 && isGeneratorNode(selectedNodes[0]!)
    ? selectedNodes[0]
    : undefined;
  const canvasViewportWidth = viewport.width <= 760
    ? viewport.width
    : viewport.width - (panelOpen ? 410 : 0);
  const generatorOverlayPosition = selectedGenerator
    ? generatorOverlayPlacement(
        {
          height: selectedGenerator.height * scale,
          width: selectedGenerator.width * scale,
          x: selectedGenerator.x * scale + stagePosition.x,
          y: selectedGenerator.y * scale + stagePosition.y,
        },
        { height: viewport.height, width: canvasViewportWidth },
        { height: 240, width: Math.min(560, canvasViewportWidth - 24) },
      )
    : undefined;
  const latestPlan = project?.plans.at(-1);

  useEffect(() => {
    if (viewport.width <= 760 && selectedGenerator) setPanelOpen(false);
  }, [selectedGenerator?.id, viewport.width]);

  const replaceNodes = useCallback((next: CanvasNode[], record = true) => {
    setNodes((current) => {
      if (record) {
        setHistory((items) => [...items.slice(-29), current]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  const beginNodeTransform = useCallback(() => {
    setHistory((items) => [...items.slice(-29), nodes]);
    setFuture([]);
  }, [nodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyboardIsOwnedByEditor(event.target, event.isComposing || event.keyCode === 229)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) setToolState((current) => temporaryHandDown(current, false));
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection.length > 0) {
        event.preventDefault();
        replaceNodes(nodes.filter((node) => !selection.includes(node.id) || node.locked));
        setSelection((items) => items.filter((id) => nodes.find((node) => node.id === id)?.locked));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selection.length > 0) {
        event.preventDefault();
        copySelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const shortcut = event.key.toLowerCase();
      const shortcuts = {
        h: "hand",
        p: "draw",
        r: "shape",
        t: "text",
        v: "select",
      } as const;
      const tool = shortcuts[shortcut as keyof typeof shortcuts];
      if (tool) {
        setToolMenu(undefined);
        setToolState((current) => activateCanvasTool(current, tool));
      }
      if (event.key === "Escape") {
        drawingActive.current = false;
        shapeActive.current = false;
        setDrawingPoints(undefined);
        setShapeDraft(undefined);
        setMarquee(undefined);
        setToolMenu(undefined);
        setToolState({ active: "select" });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keyboardIsOwnedByEditor(event.target, event.isComposing || event.keyCode === 229)) return;
      if (event.code === "Space") setToolState((current) => temporaryHandUp(current));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [nodes, replaceNodes, selection]);

  function addTextNode(x: number, y: number) {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      type: "text",
      x,
      y,
      width: 320,
      height: 90,
      text: "双击编辑文字",
      name: "文字",
      locked: false,
      rotation: 0,
      visible: true,
    };
    replaceNodes([...nodes, node]);
    setSelection([node.id]);
    setToolState({ active: toolAfterCreation("text") });
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
    setToolMenu(undefined);
    setToolState({ active: "select" });
  }

  function openGenerator(kind: "image" | "video") {
    const canvasWidth = viewport.width - (panelOpen && viewport.width > 760 ? 410 : 0);
    let node = createGeneratorNode(kind, {
      x: (canvasWidth / 2 - stagePosition.x) / scale,
      y: (viewport.height / 2 - stagePosition.y) / scale,
    });
    if (kind === "image" && imageModels[0]) {
      node = updateGeneratorConfig(node, { modelId: imageModels[0].id });
    }
    replaceNodes([...nodes, node]);
    setSelection([node.id]);
    setToolMenu(undefined);
    setToolState({ active: toolAfterCreation(kind === "image" ? "image-generator" : "video-generator") });
    const generatorScale = 0.51;
    const generatorFormHeight = 240;
    setScale(generatorScale);
    setStagePosition({
      x: (canvasWidth - node.width * generatorScale) / 2 - node.x * generatorScale,
      y: Math.max(12, (viewport.height - node.height * generatorScale - generatorFormHeight - 8) / 2) - node.y * generatorScale,
    });
  }

  function chooseShape(kind: NonNullable<CanvasNode["shapeKind"]>) {
    setPendingShapeKind(kind);
    setToolMenu(undefined);
    setToolState({ active: "shape" });
  }

  function focusLayerNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    if (isGeneratorNode(node)) {
      const generatorScale = 0.51;
      const generatorFormHeight = 240;
      setScale(generatorScale);
      setStagePosition({
        x: (canvasViewportWidth - node.width * generatorScale) / 2 - node.x * generatorScale,
        y: Math.max(12, (viewport.height - node.height * generatorScale - generatorFormHeight - 8) / 2) - node.y * generatorScale,
      });
      return;
    }
    const mobileAgentReserve = viewport.width <= 760 && panelOpen && !isGeneratorNode(node)
      ? viewport.height * 0.55 + 72
      : 0;
    const focused = focusNodeInViewport({
      node,
      position: stagePosition,
      reserveBottom: mobileAgentReserve,
      scale,
      viewport: { height: viewport.height, width: canvasViewportWidth },
    });
    setScale(focused.scale);
    setStagePosition(focused.position);
  }

  function updateSelectedGenerator(patch: Partial<NonNullable<CanvasNode["generator"]>>) {
    if (!selectedGenerator) return;
    replaceNodes(nodes.map((node) => {
      if (node.id !== selectedGenerator.id || !node.generator) return node;
      const updated = updateGeneratorConfig(node, patch);
      if (!updated.generator || node.type !== "image-generator") return updated;
      const dimensions = generatorDisplayDimensions(updated.generator);
      return {
        ...updated,
        x: node.x + (node.width - dimensions.width) / 2,
        y: node.y + (node.height - dimensions.height) / 2,
        ...dimensions,
      };
    }), false);
  }

  async function uploadGeneratorReference(file: File) {
    if (!selectedGenerator) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("仅支持 JPG、PNG 和 WebP 图片。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("单张参考图不能超过 20 MB。");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const generatorId = selectedGenerator.id;
    setNodes((current) => current.map((node) => node.id === generatorId && node.generator
      ? updateGeneratorConfig(node, {
          referenceAssetUrls: appendGeneratorReferences(node.generator.referenceAssetUrls, [dataUrl]),
        })
      : node));
  }

  function beginCanvasReferencePicker() {
    if (!selectedGenerator) return;
    setReferencePickerGeneratorId(selectedGenerator.id);
    setSelection([]);
    setToolState({ active: "select" });
  }

  function finishCanvasReferencePicker() {
    if (!referencePickerGeneratorId) return;
    const selectedUrls = nodes
      .filter((node) => selection.includes(node.id) && node.type === "image" && node.assetUrl)
      .map((node) => node.assetUrl!);
    if (!selectedUrls.length) {
      setError("请先在画布中选择至少一张图片。");
      return;
    }
    setNodes((current) => current.map((node) => node.id === referencePickerGeneratorId && node.generator
      ? updateGeneratorConfig(node, {
          referenceAssetUrls: appendGeneratorReferences(node.generator.referenceAssetUrls, selectedUrls),
        })
      : node));
    setSelection([referencePickerGeneratorId]);
    setReferencePickerGeneratorId(undefined);
  }

  async function submitGenerator() {
    if (!selectedGenerator?.generator) return;
    if (!project) return;
    const generatorId = selectedGenerator.id;
    const config = selectedGenerator.generator;
    replaceNodes(nodes.map((node) => node.id === generatorId
      ? updateGeneratorConfig(node, { status: "submitting" })
      : node));
    try {
      const updated = await api.generateFromCanvas(project.id, generatorId, {
        prompt: config.prompt,
        modelId: config.modelId,
        quality: config.quality ?? "auto",
        sizePreset: config.sizePreset ?? "auto",
        ...(config.width ? { width: config.width } : {}),
        ...(config.height ? { height: config.height } : {}),
        aspectRatio: config.aspectRatio,
        outputCount: config.outputCount,
        referenceAssetUrls: config.referenceAssetUrls,
        seedMode: config.seedMode ?? "random",
        ...(config.seedMode === "fixed" && config.seed !== undefined ? { seed: config.seed } : {}),
      }, crypto.randomUUID());
      suppressNextSave.current = true;
      setProject(updated);
      setNodes(updated.canvas.nodes.map(normalizeCanvasNode));
    } catch (cause) {
      replaceNodes(nodes.map((node) => node.id === generatorId
        ? updateGeneratorConfig(node, { status: "failed" })
        : node));
      setError(messageOf(cause));
    }
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

  function beginSingleStageGesture(point: { x: number; y: number }, blankCanvas: boolean) {
    if (activeCanvasTool === "draw") {
      drawingActive.current = true;
      drawingPointsRef.current = [point.x, point.y];
      setDrawingPoints([point.x, point.y]);
      return;
    }
    if (activeCanvasTool === "shape" && blankCanvas) {
      shapeActive.current = true;
      shapeAnchor.current = point;
      setShapeDraft({
        height: 1,
        id: crypto.randomUUID(),
        locked: false,
        name: "形状",
        rotation: 0,
        shapeKind: pendingShapeKind,
        type: "shape",
        visible: true,
        width: 1,
        x: point.x,
        y: point.y,
      });
      return;
    }
    if (activeCanvasTool === "text" && blankCanvas) {
      addTextNode(point.x, point.y);
      return;
    }
    if (activeCanvasTool === "select" && blankCanvas) {
      setMarquee({ anchorX: point.x, anchorY: point.y, x: point.x, y: point.y, width: 0, height: 0 });
    }
  }

  function moveSingleStageGesture(point: { x: number; y: number }) {
    if (activeCanvasTool === "draw" && drawingPointsRef.current) {
      drawingPointsRef.current = [...drawingPointsRef.current, point.x, point.y];
      setDrawingPoints(drawingPointsRef.current);
      return;
    }
    if (activeCanvasTool === "shape" && shapeDraft) {
      const anchorX = shapeAnchor.current?.x ?? shapeDraft.x;
      const anchorY = shapeAnchor.current?.y ?? shapeDraft.y;
      setShapeDraft({
        ...shapeDraft,
        height: Math.max(1, Math.abs(point.y - anchorY)),
        width: Math.max(1, Math.abs(point.x - anchorX)),
        x: Math.min(anchorX, point.x),
        y: Math.min(anchorY, point.y),
      });
      return;
    }
    if (!marquee) return;
    setMarquee({
      ...marquee,
      x: Math.min(marquee.anchorX, point.x),
      y: Math.min(marquee.anchorY, point.y),
      width: Math.abs(point.x - marquee.anchorX),
      height: Math.abs(point.y - marquee.anchorY),
    });
  }

  function endSingleStageGesture() {
    if (activeCanvasTool === "draw") {
      const completedPoints = drawingPointsRef.current;
      if (!drawingActive.current || !completedPoints) return;
      drawingActive.current = false;
      drawingPointsRef.current = undefined;
      if (completedPoints.length >= 4) {
        const xs = completedPoints.filter((_, index) => index % 2 === 0);
        const ys = completedPoints.filter((_, index) => index % 2 === 1);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const node: CanvasNode = {
          height: Math.max(1, Math.max(...ys) - y),
          id: crypto.randomUUID(),
          locked: false,
          name: `画笔 ${nodes.filter((item) => item.type === "path").length + 1}`,
          points: completedPoints.map((value, index) => value - (index % 2 === 0 ? x : y)),
          rotation: 0,
          stroke: generatorCanvasColors.pencil,
          strokeWidth: 3,
          type: "path",
          visible: true,
          width: Math.max(1, Math.max(...xs) - x),
          x,
          y,
        };
        replaceNodes([...nodes, node]);
        setSelection([node.id]);
      }
      setDrawingPoints(undefined);
      return;
    }
    if (activeCanvasTool === "shape") {
      if (!shapeActive.current || !shapeDraft) return;
      shapeActive.current = false;
      const node = shapeDraft.width < 4 || shapeDraft.height < 4
        ? { ...shapeDraft, width: 120, height: 120 }
        : shapeDraft;
      replaceNodes([...nodes, node]);
      setSelection([node.id]);
      setShapeDraft(undefined);
      shapeAnchor.current = undefined;
      setToolState({ active: toolAfterCreation("shape") });
      return;
    }
    if (!marquee) return;
    setSelection(marquee.width < 3 && marquee.height < 3
      ? []
      : nodesInRect(nodes.filter((node) => node.visible !== false), marquee));
    setMarquee(undefined);
  }

  function cancelSingleStageGesture() {
    drawingActive.current = false;
    drawingPointsRef.current = undefined;
    shapeActive.current = false;
    shapeAnchor.current = undefined;
    setDrawingPoints(undefined);
    setShapeDraft(undefined);
    setMarquee(undefined);
  }

  function beginMouseStageGesture(event: Konva.KonvaEventObject<MouseEvent>) {
    const point = stageRef.current ? canvasPointer(stageRef.current, scale) : undefined;
    if (point) beginSingleStageGesture(point, event.target === event.currentTarget);
  }

  function moveMouseStageGesture() {
    const point = stageRef.current ? canvasPointer(stageRef.current, scale) : undefined;
    if (point) moveSingleStageGesture(point);
  }

  function currentCamera() {
    const stage = stageRef.current;
    return {
      position: stage ? { x: stage.x(), y: stage.y() } : stagePosition,
      scale: stage?.scaleX() ?? scale,
    };
  }

  function applyTouchEffect(effect: CanvasTouchEffect, point: GesturePoint | undefined, blankCanvas: boolean) {
    if (effect.kind === "begin-single" && point) {
      beginSingleStageGesture(screenPointToCanvas(point, currentCamera()), blankCanvas);
    } else if (effect.kind === "move-single" && point) {
      moveSingleStageGesture(screenPointToCanvas(point, currentCamera()));
    } else if (effect.kind === "finish-single") {
      endSingleStageGesture();
    } else if (effect.kind === "cancel-single") {
      cancelSingleStageGesture();
    } else if (effect.kind === "navigate") {
      stageRef.current?.stopDrag();
      cameraFrameBatcher.current?.update(effect.camera);
    }
  }

  function touchPoint(touch: Touch): GesturePoint | undefined {
    const container = stageRef.current?.container();
    if (!container) return undefined;
    const bounds = container.getBoundingClientRect();
    return {
      id: touch.identifier,
      x: touch.clientX - bounds.left,
      y: touch.clientY - bounds.top,
    };
  }

  function beginTouchStageGesture(event: Konva.KonvaEventObject<TouchEvent>) {
    event.evt.preventDefault();
    const blankCanvas = event.target === event.currentTarget;
    for (const changedTouch of Array.from(event.evt.changedTouches)) {
      const point = touchPoint(changedTouch);
      if (!point) continue;
      const previousGesture = touchGesture.current;
      const result = beginCanvasTouch(touchGesture.current, point, currentCamera());
      touchGesture.current = result.gesture;
      if (result.gesture.kind === "two-pointer-navigation") {
        stageRef.current?.stopDrag();
        event.target.stopDrag();
      }
      if (
        previousGesture.kind === "single-pointer" &&
        result.gesture.kind === "two-pointer-navigation" &&
        result.effect.kind === "finish-single"
      ) {
        if (activeCanvasTool === "draw") endSingleStageGesture();
        else cancelSingleStageGesture();
      } else {
        applyTouchEffect(result.effect, point, blankCanvas);
      }
    }
  }

  function moveTouchStageGesture(event: Konva.KonvaEventObject<TouchEvent>) {
    event.evt.preventDefault();
    for (const changedTouch of Array.from(event.evt.changedTouches)) {
      const point = touchPoint(changedTouch);
      if (!point) continue;
      const result = moveCanvasTouch(touchGesture.current, point, { minScale: 0.25, maxScale: 1.8 });
      touchGesture.current = result.gesture;
      applyTouchEffect(result.effect, point, event.target === event.currentTarget);
    }
  }

  function endTouchStageGesture(event: Konva.KonvaEventObject<TouchEvent>) {
    event.evt.preventDefault();
    for (const changedTouch of Array.from(event.evt.changedTouches)) {
      const result = endCanvasTouch(touchGesture.current, changedTouch.identifier);
      touchGesture.current = result.gesture;
      applyTouchEffect(result.effect, undefined, event.target === event.currentTarget);
    }
  }

  function cancelTouchStageGesture() {
    const result = cancelCanvasTouch(touchGesture.current);
    touchGesture.current = result.gesture;
    applyTouchEffect(result.effect, undefined, false);
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
        <div className="brand-block"><strong>Loomoon</strong><button className="project-switcher" onClick={() => setProjectMenuOpen((open) => !open)}>· {project?.name ?? "正在载入…"}</button>
          {projectMenuOpen && <div className="project-menu">
            <header><strong>我的项目</strong><button onClick={openCreateProjectDialog}>＋ 新建</button></header>
            {projects.map((item) => <button className={item.id === project?.id ? "active" : ""} key={item.id} onClick={() => { props.onOpenProject(item.id); setProjectMenuOpen(false); }}>{item.coverUrl && <img src={item.coverUrl} alt="" />}<span>{item.name}</span><small>{projectStatusLabel(item.status)} · {new Date(item.updatedAt).toLocaleDateString()}</small></button>)}
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
          <button type="button" className={`tool ${activeCanvasTool === "select" ? "active" : ""}`} title="选择 (V)" onClick={() => { setToolState({ active: "select" }); setToolMenu(undefined); }}><RiCursorLine /><small>选择</small></button>
          <button type="button" className={`tool ${activeCanvasTool === "hand" ? "active" : ""}`} title="小手拖动画布 (H / Space)" onClick={() => { setToolState({ active: "hand" }); setToolMenu(undefined); }}><RiHand /><small>小手</small></button>
          <button type="button" className={`tool ${activeCanvasTool === "draw" ? "active" : ""}`} title="画笔 (P)" onClick={() => { setToolState({ active: "draw" }); setToolMenu(undefined); }}><RiPencilLine /><small>画笔</small></button>
          <button type="button" className={`tool ${activeCanvasTool === "shape" ? "active" : ""}`} title="形状 (R)" onClick={() => { setToolState({ active: "shape" }); setToolMenu(toolMenu === "shape" ? undefined : "shape"); }}><RiShapeLine /><small>形状</small></button>
          <button type="button" className={`tool ${activeCanvasTool === "text" ? "active" : ""}`} title="文字 (T)" onClick={() => { setToolState({ active: "text" }); setToolMenu(undefined); }}><RiText /><small>文字</small></button>
          <button type="button" className="tool tool-action" title="添加" onClick={() => setToolMenu(toolMenu === "insert" ? undefined : "insert")}><RiAddLine /><small>添加</small></button>
          <button type="button" className="tool tool-generator" title="图片生成器" onClick={() => openGenerator("image")}><RiImageLine /><small>图片</small></button>
          <button type="button" className="tool" title="视频生成器" onClick={() => openGenerator("video")}><RiVideoLine /><small>视频</small></button>
          {toolMenu && (
            <div className="canvas-tool-popover">
              {toolMenu === "insert" ? (
                <>
                  <small className="canvas-popover-title">新增</small>
                  <button onClick={() => fileInputRef.current?.click()}><RiUpload2Line /><b>上传图片</b></button>
                  <button onClick={() => setError("视频上传当前为 Mock 演示。") }><RiVideoUploadLine /><b>上传视频</b></button>
                  <button onClick={addArtboard}><RiGridLine /><b>智能画板</b><kbd>F</kbd></button>
                </>
              ) : (
                <div className="canvas-shape-menu">
                  <small>形状</small>
                  <div><button onClick={() => chooseShape("rectangle")} title="矩形"><RiCheckboxBlankLine /></button><button onClick={() => chooseShape("circle")} title="圆形"><RiCircleLine /></button><button onClick={() => chooseShape("triangle")} title="三角形"><RiTriangleLine /></button><button onClick={() => chooseShape("star")} title="星形"><RiStarLine /></button></div>
                  <small>形状文本</small>
                  <div><button onClick={() => chooseShape("rectangle")} title="矩形文本"><RiCheckboxBlankLine /></button><button onClick={() => chooseShape("circle")} title="圆形文本"><RiCircleLine /></button><button onClick={() => chooseShape("speech")} title="对话框"><RiChat3Line /></button><button onClick={() => chooseShape("arrow")} title="左箭头"><RiArrowLeftLine /></button><button onClick={() => chooseShape("arrow")} title="右箭头"><RiArrowRightLine /></button></div>
                </div>
              )}
            </div>
          )}
        </nav>

        <section className={`canvas-shell canvas-shell--${activeCanvasTool}`} aria-label="无限画布">
          {referencePickerGeneratorId && <div className="canvas-reference-picker-banner">
            <span>从画布选择参考图 · 最多 9 张</span>
            <button type="button" onClick={() => { setSelection([referencePickerGeneratorId]); setReferencePickerGeneratorId(undefined); }}>取消</button>
            <button type="button" disabled={!selectedImages.length} onClick={finishCanvasReferencePicker}>添加所选图片</button>
          </div>}
          {!nodes.length && <EmptyCanvas onStart={() => setInput(starterPrompt)} />}
          <Stage
            ref={stageRef}
            width={viewport.width <= 760 ? viewport.width : viewport.width - (panelOpen ? 410 : 0)}
            height={viewport.height}
            scaleX={scale}
            scaleY={scale}
            x={stagePosition.x}
            y={stagePosition.y}
            draggable={activeCanvasTool === "hand"}
            onMouseDown={beginMouseStageGesture}
            onMouseMove={moveMouseStageGesture}
            onMouseUp={endSingleStageGesture}
            onMouseLeave={endSingleStageGesture}
            onTouchStart={beginTouchStageGesture}
            onTouchMove={moveTouchStageGesture}
            onTouchEnd={endTouchStageGesture}
            onTouchCancel={cancelTouchStageGesture}
            onDragEnd={(event) => {
              if (event.target === event.currentTarget) setStagePosition({ x: event.target.x(), y: event.target.y() });
            }}
            onWheel={(event) => {
              event.evt.preventDefault();
              const pointer = stageRef.current?.getPointerPosition();
              if (!pointer) return;
              const next = wheelCameraChange({
                camera: currentCamera(),
                ctrlKey: event.evt.ctrlKey,
                deltaMode: event.evt.deltaMode,
                deltaX: event.evt.deltaX,
                deltaY: event.evt.deltaY,
                metaKey: event.evt.metaKey,
                pointer,
                viewportHeight: viewport.height,
                minScale: 0.25,
                maxScale: 1.8,
              });
              cameraFrameBatcher.current?.update(next);
            }}
          >
            <Layer>
              {nodes.filter((node) => node.visible !== false).map((node) => (
                <CanvasObject
                  draggable={activeCanvasTool === "select"}
                  generatorPortal={node.id === selectedGenerator?.id && generatorOverlayPosition ? (
                    <GeneratorNodePortal
                      models={imageModels}
                      node={node}
                      positionSide={generatorOverlayPosition.side}
                      showForm={viewport.width > 760}
                      viewport={{ height: viewport.height, width: canvasViewportWidth }}
                      onChange={updateSelectedGenerator}
                      onRemoveReference={(url) => updateSelectedGenerator({
                        referenceAssetUrls: node.generator?.referenceAssetUrls.filter((item) => item !== url) ?? [],
                      })}
                      onSelectFromCanvas={beginCanvasReferencePicker}
                      onSubmit={submitGenerator}
                      onUploadReference={(file) => { void uploadGeneratorReference(file); }}
                    />
                  ) : null}
                  interactive={canNodeReceivePointer(activeCanvasTool)}
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
              {shapeDraft && <CanvasObject draggable={false} generatorPortal={null} interactive={false} node={shapeDraft} selected={false} onSelect={() => undefined} onMove={() => undefined} onEditText={() => undefined} />}
              {drawingPoints && <Line points={drawingPoints} stroke={generatorCanvasColors.pencil} strokeWidth={3 / scale} lineCap="round" lineJoin="round" listening={false} />}
              {marquee && <Rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="#6557e822" stroke="#6557e8" strokeWidth={2 / scale} dash={[8 / scale, 6 / scale]} listening={false} />}
              {activeCanvasTool === "select" && selectedNodes.length === 1 && !selectedNodes[0]?.locked && (
                <CanvasSelectionTransformer
                  node={selectedNodes[0]!}
                  stageRef={stageRef}
                  onBegin={beginNodeTransform}
                  onChange={(updated) => replaceNodes(
                    nodes.map((node) => node.id === updated.id ? updated : node),
                    false,
                  )}
                />
              )}
            </Layer>
          </Stage>
          <button className={`canvas-layers-trigger ${layersOpen ? "active" : ""}`} type="button" onClick={() => setLayersOpen((open) => !open)}><RiStackLine />图层</button>
          {layersOpen && (
            <LayersPanel
              nodes={nodes}
              selection={selection}
              onClose={() => setLayersOpen(false)}
              onDelete={(nodeId) => {
                replaceNodes(deleteLayer(nodes, nodeId));
                setSelection((items) => items.filter((id) => id !== nodeId));
              }}
              onMove={(nodeId, panelIndex) => replaceNodes(reorderLayer(nodes, nodeId, panelIndex))}
              onRename={(nodeId, name) => replaceNodes(renameLayer(nodes, nodeId, name))}
              onSelect={(nodeId, additive) => {
                setSelection((current) => selectionAfterClick(current, nodeId, additive));
                focusLayerNode(nodeId);
                if (viewport.width <= 760) setLayersOpen(false);
              }}
              onToggleLock={(nodeId) => replaceNodes(toggleLayerLock(nodes, nodeId))}
              onToggleVisibility={(nodeId) => {
                replaceNodes(toggleLayerVisibility(nodes, nodeId));
                if (nodes.find((node) => node.id === nodeId)?.visible !== false) {
                  setSelection((items) => items.filter((id) => id !== nodeId));
                }
              }}
            />
          )}
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
              {selectedFailed.length === 1 && <span className="generation-failure-detail">{generationFailureMessage(selectedFailed[0]!)}</span>}
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
          {viewport.width <= 760 && selectedGenerator && generatorOverlayPosition && (
            <GeneratorOverlay
              models={imageModels}
              node={selectedGenerator}
              position={generatorOverlayPosition}
              onChange={updateSelectedGenerator}
              onRemoveReference={(url) => updateSelectedGenerator({
                referenceAssetUrls: selectedGenerator.generator?.referenceAssetUrls.filter((item) => item !== url) ?? [],
              })}
              onSelectFromCanvas={beginCanvasReferencePicker}
              onSubmit={submitGenerator}
              onUploadReference={(file) => { void uploadGeneratorReference(file); }}
            />
          )}
        </section>

        {panelOpen ? (
          agentUiRuntime === "assistant-ui" && project ? (
            <AgentSidebar
              key={agentSession?.id ?? project.id}
              agentMessages={agentMessages}
              {...(agentSession ? { agentSessionId: agentSession.id } : {})}
              {...(initialAgentMessage ? { initialMessage: initialAgentMessage } : {})}
              error={error}
              busyLabel={busy}
              isRunning={Boolean(busy)}
              project={{
                ...project,
                canvas: { ...project.canvas, nodes },
              }}
              {...(agentRun ? { agentRun } : {})}
              selectedImages={selectedImages}
              onClearSelection={() => setSelection([])}
              onClose={() => setPanelOpen(false)}
              onInitialMessageStarted={(messageId) =>
                setInitialAgentMessage((current) =>
                  current?.id === messageId ? undefined : current,
                )
              }
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

function screenPointToCanvas(
  point: { x: number; y: number },
  camera: { position: { x: number; y: number }; scale: number },
) {
  return {
    x: (point.x - camera.position.x) / camera.scale,
    y: (point.y - camera.position.y) / camera.scale,
  };
}

function CanvasObject({ draggable, generatorPortal, interactive, node, selected, onSelect, onMove, onEditText }: {
  draggable: boolean;
  generatorPortal: ReactNode;
  interactive: boolean;
  node: CanvasNode;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onMove: (x: number, y: number) => void;
  onEditText: () => void;
}) {
  const image = useCanvasImage(node.assetUrl);
  const { canvasTheme } = useTheme();
  const selectNode = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.evt.type.startsWith("mouse")) event.cancelBubble = true;
    if ("touches" in event.evt && event.evt.touches.length > 1) return;
    onSelect("shiftKey" in event.evt && event.evt.shiftKey);
  };
  const groupProps = {
    draggable: draggable && !node.locked,
    id: `canvas-node-${node.id}`,
    listening: interactive,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => onMove(event.currentTarget.x(), event.currentTarget.y()),
    onMouseDown: selectNode,
    onTouchStart: selectNode,
    rotation: node.rotation ?? 0,
    x: node.x,
    y: node.y,
  };
  if (node.type === "text") {
    return <Group {...groupProps}>
      <Text
        fill={canvasTheme.editorText}
        fontSize={node.text?.startsWith("CREATIVE") ? 24 : 20}
        fontStyle="bold"
        height={node.height}
        lineHeight={1.35}
        padding={18}
        text={node.text ?? ""}
        width={node.width}
        onDblClick={() => {
          if (node.locked) return;
          onEditText();
        }}
      />
      {selected && <Rect width={node.width} height={node.height} stroke={canvasTheme.selection} strokeWidth={2} dash={[7, 5]} listening={false} />}
    </Group>;
  }
  if (node.type === "artboard" || isGeneratorNode(node)) {
    const isGenerator = isGeneratorNode(node);
    return (
      <Group {...groupProps}>
        <Rect width={node.width} height={node.height} fill={isGenerator ? generatorCanvasColors.fill : canvasTheme.artboardSurface} cornerRadius={isGenerator ? 0 : canvasTheme.radius.control} stroke={selected ? (isGenerator ? generatorCanvasColors.selection : canvasTheme.selection) : canvasTheme.structural} strokeWidth={selected ? (isGenerator ? 4 : 5) : 1} shadowBlur={isGenerator ? 0 : 10} shadowOpacity={0.12} />
        {isGenerator ? (
          <>
            <Text y={-42} text={node.name ?? "图片生成器"} fill={canvasTheme.editorText} fontSize={28} listening={false} />
            <Text x={node.width - 240} y={-40} width={240} align="right" text={`${Math.round(node.width)} × ${Math.round(node.height)}`} fill={canvasTheme.mutedText} fontSize={24} listening={false} />
            {generatorPortal}
          </>
        ) : (
          <Text x={18} y={16} text={node.name ?? node.text ?? "画板"} fill={canvasTheme.mutedText} fontSize={14} listening={false} />
        )}
      </Group>
    );
  }
  if (node.type === "path") {
    return <Group {...groupProps}>
      <Line points={node.points ?? []} stroke={node.stroke ?? generatorCanvasColors.pencil} strokeWidth={node.strokeWidth ?? 3} hitStrokeWidth={18} lineCap="round" lineJoin="round" />
      {selected && <Rect width={Math.max(1, node.width)} height={Math.max(1, node.height)} stroke={canvasTheme.selection} strokeWidth={2} dash={[7, 5]} listening={false} />}
    </Group>;
  }
  if (node.type === "shape") {
    const fill = canvasTheme.artboardSurface;
    const stroke = selected ? canvasTheme.selection : canvasTheme.editorText;
    const shape = node.shapeKind === "circle"
      ? <Ellipse x={node.width / 2} y={node.height / 2} radiusX={node.width / 2} radiusY={node.height / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
      : node.shapeKind === "triangle"
        ? <RegularPolygon x={node.width / 2} y={node.height / 2} sides={3} radius={Math.min(node.width, node.height) / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        : node.shapeKind === "star"
          ? <Star x={node.width / 2} y={node.height / 2} numPoints={5} innerRadius={Math.min(node.width, node.height) * 0.22} outerRadius={Math.min(node.width, node.height) * 0.48} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
          : node.shapeKind === "arrow"
            ? <Line points={[0, node.height / 2, node.width * 0.72, node.height / 2, node.width * 0.55, node.height * 0.25, node.width, node.height / 2, node.width * 0.55, node.height * 0.75, node.width * 0.72, node.height / 2]} fill={stroke} closed stroke={stroke} strokeWidth={2} />
            : <Rect width={node.width} height={node.height} cornerRadius={node.shapeKind === "speech" ? 20 : 2} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />;
    return <Group {...groupProps}>
      {shape}
      {node.shapeKind === "speech" && <Text align="center" fontSize={18} height={node.height} padding={18} text="双击编辑" verticalAlign="middle" width={node.width} listening={false} />}
    </Group>;
  }
  return (
    <Group {...groupProps}>
      <Rect fill={node.type === "image" ? canvasTheme.nodeSurface : canvasTheme.placeholderSurface} cornerRadius={canvasTheme.radius.media} height={node.height} width={node.width} stroke={selected ? canvasTheme.selection : canvasTheme.artboardSurface} strokeWidth={selected ? 5 : 1} shadowBlur={selected ? 16 : 8} shadowOpacity={0.1} />
      {node.type === "image" && image && <KonvaImage image={image} width={node.width} height={node.height} cornerRadius={canvasTheme.radius.media} />}
      {node.type === "image" && selected && <Rect width={node.width} height={node.height} stroke={canvasTheme.selection} strokeWidth={2} dash={[7, 5]} listening={false} />}
      {node.type !== "image" && <Text x={24} y={node.height / 2 - 28} height={56} width={node.width - 48} align="center" verticalAlign="middle" text={node.status === "running" ? "正在生成…" : node.status === "failed" ? `${generationFailureMessage(node)}\n单击此图片后点击“重试失败任务”` : node.status === "succeeded" ? "Mock 视频结果" : "等待确认生成"} fill={node.status === "failed" ? generatorCanvasColors.error : generatorCanvasColors.placeholder} fontSize={16} />}
    </Group>
  );
}

function CanvasSelectionTransformer({ node, onBegin, onChange, stageRef }: {
  node: CanvasNode;
  onBegin: () => void;
  onChange: (node: CanvasNode) => void;
  stageRef: RefObject<Konva.Stage | null>;
}) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useLayoutEffect(() => {
    const transformer = transformerRef.current;
    const target = stageRef.current?.findOne(`#canvas-node-${node.id}`);
    if (!transformer || !target) return;
    syncSelectionTransformer(transformer, target);
  }, [node.height, node.id, node.rotation, node.width, stageRef]);

  function commitTransform() {
    const target = transformerRef.current?.nodes()[0];
    if (!target) return;
    const scaleX = target.scaleX();
    const scaleY = target.scaleY();
    target.scaleX(1);
    target.scaleY(1);
    onChange(transformCanvasNode(node, {
      height: node.height * scaleY,
      rotation: target.rotation(),
      width: node.width * scaleX,
      x: target.x(),
      y: target.y(),
    }));
  }

  return (
    <Transformer
      ref={transformerRef}
      anchorCornerRadius={10}
      anchorFill="#ffffff"
      anchorSize={12}
      anchorStroke="#6557e8"
      anchorStrokeWidth={2}
      borderStroke="#6557e8"
      borderStrokeWidth={2}
      enabledAnchors={[
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ]}
      flipEnabled={false}
      keepRatio={node.type === "image" || isGeneratorNode(node)}
      rotateAnchorOffset={28}
      rotationSnaps={[0, 90, 180, 270]}
      rotationSnapTolerance={5}
      boundBoxFunc={(oldBox, nextBox) =>
        Math.abs(nextBox.width) < 20 || Math.abs(nextBox.height) < 20
          ? oldBox
          : nextBox
      }
      onTransformStart={onBegin}
      onTransformEnd={commitTransform}
    />
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
