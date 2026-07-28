import { useMemo, useState } from "react";
import type { ProjectSummary } from "./api.js";
import { filterProjects, summarizeProfileCases } from "./library-state.js";
import {
  mockContentRepository,
  type InspirationCase,
  type MembershipPlan,
  type MockNotice,
} from "./mock-content.js";

export function ProjectsPage({
  projects,
  busy = false,
  onCreate,
  onOpen,
}: {
  projects: ProjectSummary[];
  busy?: boolean;
  onCreate: () => void;
  onOpen: (projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterProjects(projects, query),
    [projects, query],
  );
  return (
    <section className="lm-library-page">
      <header>
        <div>
          <p>WORKSPACE</p>
          <h1>项目</h1>
        </div>
        <button className="lm-primary-button" disabled={busy} onClick={onCreate}>
          ＋ 新建项目
        </button>
      </header>
      <label className="lm-library-search">
        <span>⌕</span>
        <input
          aria-label="搜索项目"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索项目"
          value={query}
        />
      </label>
      {filtered.length ? (
        <div className="lm-library-grid">
          {filtered.map((project) => (
            <button key={project.id} onClick={() => onOpen(project.id)}>
              <ProjectArtwork project={project} />
              <span>
                <strong>{project.name || "未命名"}</strong>
                <small>
                  {new Date(project.updatedAt).toLocaleDateString("zh-CN")} ·{" "}
                  {statusLabel(project.status)}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="lm-library-empty">
          <b>□</b>
          <h2>{query ? "没有找到相关项目" : "从一个想法开始"}</h2>
          <p>{query ? "换个关键词试试。" : "向 Agent 描述你的设计需求。"}</p>
        </div>
      )}
    </section>
  );
}

export function ProfilePage({
  displayName,
  email,
  onCaseOpen,
}: {
  displayName: string;
  email: string;
  onCaseOpen: (caseId: string) => void;
}) {
  const profile = mockContentRepository.getProfile();
  const summary = summarizeProfileCases(
    mockContentRepository.listInspirationCases(),
    profile.publishedCaseIds,
    profile.likedCaseIds,
  );
  const [tab, setTab] = useState<"published" | "liked">("published");
  const items = summary[tab];
  return (
    <section className="lm-profile-page">
      <header>
        <img alt="" src={profile.avatarUrl} />
        <div>
          <h1>{displayName}</h1>
          <p>{email}</p>
          <span>创作者 · 公开主页内容为演示数据</span>
        </div>
        <button>编辑资料</button>
      </header>
      <nav aria-label="作品分类">
        <button
          className={tab === "published" ? "is-active" : ""}
          onClick={() => setTab("published")}
        >
          发布作品 {summary.published.length}
        </button>
        <button
          className={tab === "liked" ? "is-active" : ""}
          onClick={() => setTab("liked")}
        >
          喜欢 {summary.liked.length}
        </button>
      </nav>
      <div className="lm-profile-grid">
        {items.map((item) => (
          <button key={item.id} onClick={() => onCaseOpen(item.id)}>
            <img alt={item.title} src={item.coverUrl} />
            <strong>{item.title}</strong>
            <small>♡ {item.likes.toLocaleString("zh-CN")}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ShellOverlay({
  kind,
  onClose,
}: {
  kind: "membership" | "notices" | "about";
  onClose: () => void;
}) {
  return (
    <div className="lm-detail-overlay" role="dialog" aria-modal="true">
      <button aria-label="关闭" className="lm-overlay-backdrop" onClick={onClose} />
      <section>
        <button aria-label="关闭" className="lm-overlay-close" onClick={onClose}>
          ×
        </button>
        {kind === "membership" ? (
          <MembershipContent plans={mockContentRepository.listMembershipPlans()} />
        ) : kind === "notices" ? (
          <NoticeContent notices={mockContentRepository.listNotices()} />
        ) : (
          <AboutContent />
        )}
      </section>
    </div>
  );
}

function ProjectArtwork({ project }: { project: ProjectSummary }) {
  if (project.coverUrl) return <img alt="" src={project.coverUrl} />;
  return (
    <span className={`lm-library-cover is-${project.status}`}>
      <i />
      <i />
      <i />
      <em>LOOMOON</em>
    </span>
  );
}

function statusLabel(status: ProjectSummary["status"]) {
  return {
    empty: "空白",
    planning: "规划中",
    generating: "生成中",
    ready: "已完成",
    attention: "需处理",
  }[status];
}

function MembershipContent({ plans }: { plans: MembershipPlan[] }) {
  return (
    <>
      <p className="lm-overlay-kicker">MEMBERSHIP</p>
      <h2>选择适合你的创作额度</h2>
      <p>方案与支付暂为 Mock，项目和 Agent 数据使用真实服务。</p>
      <div className="lm-plan-grid">
        {plans.map((plan) => (
          <article key={plan.id}>
            <h3>{plan.name}</h3>
            <b>¥{plan.monthlyPrice}<small>/月</small></b>
            <ul>
              <li>{plan.monthlyCredits.toLocaleString()} 创作点数</li>
              <li>{plan.concurrency} 个并发任务</li>
              <li>{plan.commercialUse ? "支持" : "不含"}商业使用</li>
            </ul>
            <button>选择方案</button>
          </article>
        ))}
      </div>
    </>
  );
}

function NoticeContent({ notices }: { notices: MockNotice[] }) {
  return (
    <>
      <p className="lm-overlay-kicker">INBOX</p>
      <h2>通知</h2>
      <div className="lm-notice-list">
        {notices.map((notice) => (
          <article className={notice.read ? "" : "is-unread"} key={notice.id}>
            <i />
            <div>
              <strong>{notice.title}</strong>
              <p>{notice.body}</p>
              <small>{new Date(notice.createdAt).toLocaleDateString("zh-CN")}</small>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function AboutContent() {
  return (
    <>
      <p className="lm-overlay-kicker">ABOUT</p>
      <h2>Loomoon 设计 Agent</h2>
      <p>从需求理解、方案规划到画布创作，让设计过程集中在同一个空间。</p>
      <dl>
        <div><dt>图像生成</dt><dd>真实能力</dd></div>
        <div><dt>视频生成</dt><dd>Mock 演示</dd></div>
        <div><dt>公开分享</dt><dd>Mock 演示</dd></div>
      </dl>
    </>
  );
}
