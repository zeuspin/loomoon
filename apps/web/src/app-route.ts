export type AppRoute =
  | { kind: "home" }
  | { kind: "items" }
  | { kind: "canvas"; projectId: string }
  | { kind: "profile" }
  | { kind: "case"; caseId: string };

export function parseAppRoute(url: URL): AppRoute {
  if (url.pathname === "/") return { kind: "home" };
  if (url.pathname === "/items") return { kind: "items" };
  if (url.pathname === "/profile") return { kind: "profile" };
  if (url.pathname === "/canvas") {
    const projectId = url.searchParams.get("projectId")?.trim();
    return projectId ? { kind: "canvas", projectId } : { kind: "home" };
  }
  if (url.pathname.startsWith("/case/")) {
    const encodedCaseId = url.pathname.slice("/case/".length);
    if (!encodedCaseId) return { kind: "home" };
    try {
      return { kind: "case", caseId: decodeURIComponent(encodedCaseId) };
    } catch {
      return { kind: "home" };
    }
  }
  return { kind: "home" };
}

export function hrefForRoute(route: AppRoute): string {
  if (route.kind === "home") return "/";
  if (route.kind === "items") return "/items";
  if (route.kind === "profile") return "/profile";
  if (route.kind === "case") {
    return `/case/${encodeURIComponent(route.caseId)}`;
  }
  const query = new URLSearchParams({ projectId: route.projectId });
  return `/canvas?${query.toString()}`;
}

export function routeAfterProjectDeletion(
  projects: ReadonlyArray<{ id: string }>,
): AppRoute {
  const nextProject = projects[0];
  return nextProject
    ? { kind: "canvas", projectId: nextProject.id }
    : { kind: "items" };
}
