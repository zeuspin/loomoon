import { useEffect, useMemo, useState } from "react";
import {
  RiArrowUpLine,
  RiAttachment2,
  RiBox3Line,
  RiGlobalLine,
  RiImageLine,
  RiPaletteLine,
  RiShoppingBag3Line,
  RiStarLine,
  RiVideoLine,
} from "@remixicon/react";
import type { ProjectSummary } from "./api.js";
import type { DeferredIntent } from "./deferred-intent.js";
import {
  filterInspirationCases,
  nextRotatingPrompt,
  shouldRotatePrompt,
} from "./home-state.js";
import {
  mockContentRepository,
  type InspirationCase,
} from "./mock-content.js";
import { LoomoonGlyph } from "./login-dialog.js";

const rotatingPrompts = [
  "让 Loomoon 打造引人注目的社交媒体视觉",
  "为新消费品牌设计一套克制的视觉语言",
  "制作一张高转化的电商产品主图",
  "把这个角色延展成完整的品牌 IP",
  "规划一组具有电影感的产品分镜",
];

interface HomePageProps {
  authenticated: boolean;
  busy: boolean;
  projects: ProjectSummary[];
  onCaseOpen: (caseId: string) => void;
  onCreateProject: () => Promise<void>;
  onProjectOpen: (projectId: string) => void;
  onProtected: (intent: DeferredIntent, action: () => void) => void;
  onPromptSubmit: (prompt: string, referenceCaseId?: string) => Promise<void>;
}

export function HomePage({
  authenticated,
  busy,
  onCreateProject,
  projects,
  onCaseOpen,
  onProjectOpen,
  onProtected,
  onPromptSubmit,
}: HomePageProps) {
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [categoryId, setCategoryId] = useState("all");
  const [reducedMotion, setReducedMotion] = useState(false);
  const categories = mockContentRepository.listInspirationCategories();
  const inspirationCases = useMemo(
    () =>
      filterInspirationCases(
        mockContentRepository.listInspirationCases(),
        categoryId,
      ),
    [categoryId],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!shouldRotatePrompt({ focused, prompt, reducedMotion })) return;
    const timer = window.setInterval(
      () =>
        setPromptIndex((current) =>
          nextRotatingPrompt(current, rotatingPrompts.length),
        ),
      2600,
    );
    return () => window.clearInterval(timer);
  }, [focused, prompt, reducedMotion]);

  useEffect(() => {
    const resume = (event: Event) => {
      const intent = (event as CustomEvent<DeferredIntent>).detail;
      if (intent.kind !== "submit-prompt") return;
      setPrompt(intent.prompt);
      void onPromptSubmit(intent.prompt, intent.referenceCaseId);
    };
    window.addEventListener("loomoon:resume-prompt", resume);
    return () => window.removeEventListener("loomoon:resume-prompt", resume);
  }, [onPromptSubmit]);

  function submit(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();
    if (!trimmed || busy) return;
    const intent: DeferredIntent = {
      kind: "submit-prompt",
      prompt: trimmed,
    };
    onProtected(intent, () => void onPromptSubmit(trimmed));
  }

  return (
    <section className="lm-home-page">
      <div className="lm-home-hero">
        <h1>
          <LoomoonGlyph />
          <strong>Loomoon</strong>
          <span>让设计变简单</span>
        </h1>
        <p>懂你的设计 Agent，帮你搞定一切</p>
        <div className="lm-home-composer">
          <textarea
            aria-label="输入设计需求"
            disabled={busy}
            onBlur={() => setFocused(false)}
            onChange={(event) => setPrompt(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={rotatingPrompts[promptIndex]}
            value={prompt}
          />
          <footer>
            <button
              aria-label="添加附件"
              onClick={() =>
                onProtected(
                  { kind: "open-route", href: "/" },
                  () => document.getElementById("lm-home-file")?.click(),
                )
              }
            >
              <RiAttachment2 />
            </button>
            <input hidden id="lm-home-file" type="file" />
            <div>
              <button
                aria-label="联网"
                onClick={() =>
                  onProtected(
                    { kind: "open-route", href: "/" },
                    () => undefined,
                  )
                }
              >
                <RiGlobalLine />
              </button>
              <button
                aria-label="模型偏好"
                onClick={() =>
                  onProtected(
                    { kind: "open-route", href: "/" },
                    () => undefined,
                  )
                }
              >
                <RiBox3Line />
              </button>
              <button
                aria-label="发送"
                className="lm-home-send"
                disabled={busy || !prompt.trim()}
                onClick={() => submit()}
              >
                <RiArrowUpLine />
              </button>
            </div>
          </footer>
        </div>
        <div className="lm-home-quick">
          {[
            { Icon: RiImageLine, label: "海报宣传" },
            { Icon: RiStarLine, label: "品牌设计" },
            { Icon: RiPaletteLine, label: "风格插画" },
            { Icon: RiShoppingBag3Line, label: "电商营销" },
            { Icon: RiVideoLine, label: "视频与分镜" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              onClick={() => {
                setPrompt(label);
                submit(label);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>

      {authenticated && (
        <section className="lm-home-block lm-recent-projects">
          <h2>最近项目</h2>
          <div className="lm-project-strip">
            <button
              className="lm-new-project-card"
              disabled={busy}
              onClick={() => void onCreateProject()}
            >
              <b>＋</b>
              <span>新建项目</span>
            </button>
            {projects.slice(0, 5).map((project) => (
              <button
                className="lm-project-preview-card"
                key={project.id}
                onClick={() => onProjectOpen(project.id)}
              >
                <ProjectCover project={project} />
                <strong>{project.name || "未命名"}</strong>
                <small>
                  更新于{" "}
                  {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="lm-home-block lm-inspiration">
        <h2>灵感发现</h2>
        <div className="lm-inspiration-categories">
          {categories.map((category) => (
            <button
              className={category.id === categoryId ? "is-active" : ""}
              key={category.id}
              onClick={() =>
                onProtected(
                  { kind: "open-route", href: "/" },
                  () => setCategoryId(category.id),
                )
              }
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="lm-inspiration-grid">
          {inspirationCases.map((item) => (
            <InspirationCard
              item={item}
              key={item.id}
              onClick={() =>
                onProtected(
                  { kind: "open-case", caseId: item.id },
                  () => onCaseOpen(item.id),
                )
              }
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function ProjectCover({ project }: { project: ProjectSummary }) {
  if (project.coverUrl) {
    return <img alt="" src={project.coverUrl} />;
  }
  return (
    <span className="lm-project-cover-fallback" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function InspirationCard({
  item,
  onClick,
}: {
  item: InspirationCase;
  onClick: () => void;
}) {
  return (
    <button className="lm-inspiration-card" onClick={onClick}>
      <img alt={item.title} src={item.coverUrl} />
      <strong>{item.title}</strong>
      <span>
        <img alt="" src={item.author.avatarUrl} />
        <b>{item.author.name}</b>
        <small>◉ {item.views.toLocaleString()}</small>
        <small>♥ {item.likes}</small>
      </span>
    </button>
  );
}
