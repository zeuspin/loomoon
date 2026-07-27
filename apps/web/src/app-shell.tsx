import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RiAddLine,
  RiFolder3Line,
  RiHome6Line,
  RiInformationLine,
  RiUser3Line,
  RiVipDiamondLine,
} from "@remixicon/react";
import { App as CanvasWorkspace } from "./app.js";
import { hrefForRoute, parseAppRoute, type AppRoute } from "./app-route.js";
import {
  describeProjectCreation,
  protectedClickDecision,
  resumeIntentAfterLogin,
} from "./app-shell-state.js";
import { ApiError, api, type ProjectSummary } from "./api.js";
import type {
  DeferredIntent,
  DeferredIntentState,
} from "./deferred-intent.js";
import { LoginDialog, LoomoonGlyph } from "./login-dialog.js";
import { HomePage } from "./home-page.js";
import { InspirationCaseOverlay } from "./inspiration-case.js";
import {
  ProfilePage,
  ProjectsPage,
  ShellOverlay,
} from "./library-pages.js";
import { mockContentRepository, type InspirationCase } from "./mock-content.js";
import { queueProjectLaunchIntent } from "./project-launch-intent.js";

type ShellUser = Awaited<ReturnType<typeof api.me>>;
type OverlayKind = "membership" | "notices" | "about";

export function AppShell() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseAppRoute(new URL(window.location.href)),
  );
  const [user, setUser] = useState<ShellUser>();
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [deferredIntent, setDeferredIntent] =
    useState<DeferredIntentState>();
  const [overlay, setOverlay] = useState<OverlayKind>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [promptBusy, setPromptBusy] = useState(false);
  const [projectCreationError, setProjectCreationError] = useState("");
  const projectCreationActive = useRef(false);

  const navigate = useCallback((next: AppRoute, replace = false) => {
    const href = hrefForRoute(next);
    window.history[replace ? "replaceState" : "pushState"]({}, "", href);
    setRoute(next);
    setMobileMenuOpen(false);
  }, []);

  const createProject = useCallback(
    async (prompt?: string, referenceCaseId?: string) => {
      if (projectCreationActive.current) return;
      projectCreationActive.current = true;
      setPromptBusy(true);
      setProjectCreationError("");
      try {
        const reference = referenceCaseId
          ? mockContentRepository.getInspirationCase(referenceCaseId)
          : undefined;
        const descriptor = describeProjectCreation(prompt, reference?.title);
        const created = await api.createProject(descriptor.name);
        if (descriptor.initialPrompt) {
          queueProjectLaunchIntent(window.sessionStorage, {
            id: crypto.randomUUID(),
            projectId: created.id,
            prompt: descriptor.initialPrompt,
            createdAt: new Date().toISOString(),
          });
        }
        navigate({ kind: "canvas", projectId: created.id });
        void api.listProjects().then(setProjects).catch(() => undefined);
      } catch (cause) {
        setProjectCreationError(
          cause instanceof ApiError
            ? cause.message
            : "创建项目失败，请稍后重试。",
        );
      } finally {
        projectCreationActive.current = false;
        setPromptBusy(false);
      }
    },
    [navigate],
  );

  const executeIntent = useCallback(
    (intent: DeferredIntent) => {
      if (intent.kind === "open-route") {
        navigate(parseAppRoute(new URL(intent.href, window.location.origin)));
      } else if (
        intent.kind === "open-case" ||
        intent.kind === "remix-case"
      ) {
        navigate({ kind: "case", caseId: intent.caseId });
      } else if (intent.kind === "open-overlay") {
        setOverlay(intent.overlay);
      } else if (intent.kind === "create-project") {
        void createProject();
      } else {
        navigate({ kind: "home" });
        window.dispatchEvent(
          new CustomEvent("loomoon:resume-prompt", {
            detail: intent,
          }),
        );
      }
    },
    [createProject, navigate],
  );

  const runProtected = useCallback(
    (intent: DeferredIntent, action: () => void) => {
      const decision = protectedClickDecision(Boolean(user), "click", intent);
      if (decision.kind === "allow") {
        action();
        return;
      }
      setDeferredIntent(decision.intent);
      setLoginError("");
      setLoginOpen(true);
    },
    [user],
  );

  useEffect(() => {
    const onPopState = () =>
      setRoute(parseAppRoute(new URL(window.location.href)));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, [user]);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (authReady && !user && route.kind !== "home") {
      setDeferredIntent({
        id: crypto.randomUUID(),
        queuedAt: new Date().toISOString(),
        intent: { kind: "open-route", href: hrefForRoute(route) },
      });
      setLoginOpen(true);
      navigate({ kind: "home" }, true);
    }
  }, [authReady, navigate, route, user]);

  async function login(email: string, password: string) {
    setLoginBusy(true);
    setLoginError("");
    try {
      const result = await api.login(email, password);
      setUser(result.user);
      setLoginOpen(false);
      const resumed = resumeIntentAfterLogin(deferredIntent, true);
      setDeferredIntent(resumed.state);
      if (resumed.intent) executeIntent(resumed.intent);
    } catch (cause) {
      setLoginError(
        cause instanceof Error ? cause.message : "登录失败，请稍后重试。",
      );
      const retained = resumeIntentAfterLogin(deferredIntent, false);
      setDeferredIntent(retained.state);
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    await api.logout();
    setUser(undefined);
    navigate({ kind: "home" });
  }

  const submitPrompt = useCallback(
    async (prompt: string, referenceCaseId?: string) => {
      await createProject(prompt, referenceCaseId);
    },
    [createProject],
  );

  const shellContent = useMemo(() => {
    if (route.kind === "canvas" && user) {
      return (
        <CanvasWorkspace
          projectId={route.projectId}
          onLeaveCanvas={() => navigate({ kind: "items" })}
          onOpenProject={(projectId) =>
            navigate({ kind: "canvas", projectId })
          }
        />
      );
    }
    if (route.kind === "home" || route.kind === "case") {
      const selectedCase =
        route.kind === "case"
          ? mockContentRepository.getInspirationCase(route.caseId)
          : undefined;
      return (
        <>
          <HomePage
            authenticated={Boolean(user)}
            busy={promptBusy}
            onCaseOpen={(caseId) => navigate({ kind: "case", caseId })}
            onCreateProject={() => createProject()}
            onProjectOpen={(projectId) =>
              navigate({ kind: "canvas", projectId })
            }
            onPromptSubmit={submitPrompt}
            onProtected={runProtected}
            projects={projects}
          />
          {selectedCase && (
            <InspirationCaseOverlay
              item={selectedCase}
              onClose={() => navigate({ kind: "home" })}
              onProtected={runProtected}
              onRemix={(item: InspirationCase) => {
                navigate({ kind: "home" });
                void submitPrompt(item.prompt, item.id);
              }}
            />
          )}
        </>
      );
    }
    if (route.kind === "items" && user) {
      return (
        <ProjectsPage
          busy={promptBusy}
          projects={projects}
          onCreate={() => void createProject()}
          onOpen={(projectId) => navigate({ kind: "canvas", projectId })}
        />
      );
    }
    if (route.kind === "profile" && user) {
      return (
        <ProfilePage
          displayName={user.displayName}
          email={user.email}
          onCaseOpen={(caseId) => navigate({ kind: "case", caseId })}
        />
      );
    }
    return (
      <ShellPlaceholderPage
        authenticated={Boolean(user)}
        route={route}
        onProtected={runProtected}
      />
    );
  }, [
    navigate,
    projects,
    promptBusy,
    route,
    runProtected,
    submitPrompt,
    user,
  ]);

  if (!authReady) {
    return <div className="lm-shell-loading">Loomoon 正在启动…</div>;
  }

  if (route.kind === "canvas" && user) {
    return shellContent;
  }

  return (
    <div className="lm-app-shell">
      <header className="lm-mobile-header">
        <button
          aria-label="打开导航"
          onClick={() =>
            runProtected(
              { kind: "open-route", href: hrefForRoute(route) },
              () => setMobileMenuOpen((current) => !current),
            )
          }
        >
          ☰
        </button>
        <Brand />
        <button
          aria-label={user ? "个人主页" : "登录"}
          className="lm-mobile-avatar"
          onClick={() => {
            if (user) {
              navigate({ kind: "profile" });
            } else {
              setLoginError("");
              setLoginOpen(true);
            }
          }}
        >
          {user ? user.displayName.slice(0, 1) : "登录"}
        </button>
      </header>
      <header className="lm-desktop-header">
        <Brand />
        <div className="lm-header-actions">
          {!user && <button>回到星流Beta</button>}
          <button
            onClick={() =>
              runProtected(
                { kind: "open-overlay", overlay: "membership" },
                () => setOverlay("membership"),
              )
            }
          >
            <RiVipDiamondLine /> 会员中心
          </button>
          {user ? (
            <>
              <button
                aria-label="通知"
                onClick={() => setOverlay("notices")}
              >
                ◉
              </button>
              <button onClick={() => setOverlay("membership")}>
                升级　✦ 30
              </button>
              <button onClick={() => navigate({ kind: "profile" })}>
                {user.displayName}
              </button>
              <button onClick={() => void logout()}>退出</button>
            </>
          ) : (
            <button
              className="lm-login-trigger"
              onClick={() => {
                setLoginError("");
                setLoginOpen(true);
              }}
            >
              注册/登录
            </button>
          )}
        </div>
      </header>
      <ShellRail
        authenticated={Boolean(user)}
        busy={promptBusy}
        mobileOpen={mobileMenuOpen}
        onAbout={() =>
          runProtected(
            { kind: "open-overlay", overlay: "about" },
            () => setOverlay("about"),
          )
        }
        onNavigate={(next) =>
          runProtected(
            { kind: "open-route", href: hrefForRoute(next) },
            () => navigate(next),
          )
        }
        onCreate={() =>
          runProtected(
            { kind: "create-project" },
            () => void createProject(),
          )
        }
      />
      <main className="lm-shell-main">{shellContent}</main>
      {projectCreationError && (
        <div className="lm-shell-status-toast" role="status" aria-live="polite">
          {projectCreationError}
        </div>
      )}
      <LoginDialog
        busy={loginBusy}
        error={loginError}
        onClose={() => setLoginOpen(false)}
        onLogin={login}
        open={loginOpen}
      />
      {overlay && (
        <ShellOverlay kind={overlay} onClose={() => setOverlay(undefined)} />
      )}
    </div>
  );
}

function Brand() {
  return (
    <span className="lm-shell-brand">
      <LoomoonGlyph />
      <strong>Loomoon</strong>
    </span>
  );
}

function ShellRail({
  authenticated,
  busy,
  mobileOpen,
  onAbout,
  onCreate,
  onNavigate,
}: {
  authenticated: boolean;
  busy: boolean;
  mobileOpen: boolean;
  onAbout: () => void;
  onCreate: () => void;
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <nav
      aria-label="主导航"
      className={`lm-shell-rail${mobileOpen ? " is-open" : ""}`}
    >
      <button
        aria-label="新建项目"
        className="lm-rail-create"
        disabled={busy}
        onClick={onCreate}
      >
        <RiAddLine />
      </button>
      <div>
        <button aria-label="首页" onClick={() => onNavigate({ kind: "home" })}>
          <RiHome6Line />
        </button>
        <button
          aria-label="项目"
          onClick={() => onNavigate({ kind: "items" })}
        >
          <RiFolder3Line />
        </button>
        <button
          aria-label="个人主页"
          onClick={() => onNavigate({ kind: "profile" })}
        >
          <RiUser3Line />
        </button>
        <button aria-label="关于" onClick={onAbout}>
          <RiInformationLine />
        </button>
      </div>
    </nav>
  );
}

function ShellPlaceholderPage({
  authenticated,
  route,
  onProtected,
}: {
  authenticated: boolean;
  route: AppRoute;
  onProtected: (intent: DeferredIntent, action: () => void) => void;
}) {
  if (route.kind === "canvas") {
    return <div className="lm-shell-loading">正在打开画布…</div>;
  }
  if (route.kind !== "home") {
    return (
      <section className="lm-route-placeholder">
        <LoomoonGlyph />
        <h1>
          {route.kind === "items"
            ? "项目"
            : route.kind === "profile"
              ? "个人主页"
              : "灵感详情"}
        </h1>
        <p>页面结构正在接入，真实数据能力保持可用。</p>
      </section>
    );
  }
  return (
    <section className="lm-shell-home-placeholder">
      <div className="lm-shell-hero">
        <h1>
          <LoomoonGlyph />
          Loomoon <span>让设计变简单</span>
        </h1>
        <p>懂你的设计 Agent，帮你搞定一切</p>
        <div className="lm-shell-composer">
          <textarea
            aria-label="描述设计需求"
            placeholder="让 Loomoon 打造引人注目的社交媒体视觉"
          />
          <footer>
            <button
              aria-label="添加附件"
              onClick={() =>
                onProtected(
                  { kind: "open-route", href: "/" },
                  () => undefined,
                )
              }
            >
              ⌕
            </button>
            <button
              onClick={() =>
                onProtected(
                  {
                    kind: "submit-prompt",
                    prompt: "打造引人注目的社交媒体视觉",
                  },
                  () => undefined,
                )
              }
            >
              ↑
            </button>
          </footer>
        </div>
        <div className="lm-quick-prompts">
          {["海报宣传", "品牌设计", "风格插画", "电商营销", "视频与分镜"].map(
            (label) => (
              <button
                key={label}
                onClick={() =>
                  onProtected(
                    { kind: "submit-prompt", prompt: label },
                    () => undefined,
                  )
                }
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>
      {authenticated && (
        <section className="lm-home-section">
          <h2>最近项目</h2>
          <div className="lm-placeholder-row" />
        </section>
      )}
      <section className="lm-home-section">
        <h2>灵感发现</h2>
        <div className="lm-placeholder-grid" />
      </section>
    </section>
  );
}
