import { describe, expect, it } from "vitest";
import {
  hrefForRoute,
  parseAppRoute,
  routeAfterProjectDeletion,
} from "./app-route.js";

describe("app routes", () => {
  it("parses supported routes", () => {
    expect(parseAppRoute(new URL("https://loomoon.local/"))).toEqual({
      kind: "home",
    });
    expect(parseAppRoute(new URL("https://loomoon.local/items"))).toEqual({
      kind: "items",
    });
    expect(parseAppRoute(new URL("https://loomoon.local/case/new-year"))).toEqual({
      kind: "case",
      caseId: "new-year",
    });
    expect(
      parseAppRoute(new URL("https://loomoon.local/canvas?projectId=p1")),
    ).toEqual({
      kind: "canvas",
      projectId: "p1",
    });
    expect(parseAppRoute(new URL("https://loomoon.local/profile"))).toEqual({
      kind: "profile",
    });
  });

  it("falls back to home for invalid routes and incomplete canvas URLs", () => {
    expect(parseAppRoute(new URL("https://loomoon.local/unknown"))).toEqual({
      kind: "home",
    });
    expect(
      parseAppRoute(new URL("https://loomoon.local/canvas")),
    ).toEqual({
      kind: "home",
    });
  });

  it("creates stable hrefs for every route", () => {
    expect(hrefForRoute({ kind: "home" })).toBe("/");
    expect(hrefForRoute({ kind: "items" })).toBe("/items");
    expect(hrefForRoute({ kind: "profile" })).toBe("/profile");
    expect(hrefForRoute({ kind: "case", caseId: "a/b" })).toBe("/case/a%2Fb");
    expect(hrefForRoute({ kind: "canvas", projectId: "project 1" })).toBe(
      "/canvas?projectId=project+1",
    );
  });

  it("opens another project after deletion and leaves Canvas when none remain", () => {
    expect(routeAfterProjectDeletion([{ id: "project-2" }])).toEqual({
      kind: "canvas",
      projectId: "project-2",
    });
    expect(routeAfterProjectDeletion([])).toEqual({ kind: "items" });
  });
});
