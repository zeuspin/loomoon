import type { ProjectSummary } from "./api.js";

export function sortProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function filterProjects(
  projects: ProjectSummary[],
  query: string,
): ProjectSummary[] {
  const normalized = query.trim().toLocaleLowerCase();
  const sorted = sortProjects(projects);
  if (!normalized) return sorted;
  return sorted.filter((project) =>
    project.name.toLocaleLowerCase().includes(normalized),
  );
}

export function summarizeProfileCases<T extends { id: string }>(
  cases: T[],
  publishedIds: string[],
  likedIds: string[],
): { published: T[]; liked: T[] } {
  const published = new Set(publishedIds);
  const liked = new Set(likedIds);
  return {
    published: cases.filter((item) => published.has(item.id)),
    liked: cases.filter((item) => liked.has(item.id)),
  };
}
