import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalAssetStore } from "./asset-store.js";

describe("LocalAssetStore", () => {
  it("materializes a data URL and can load it again for image editing", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-assets-"));
    const store = new LocalAssetStore(root);
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const url = await store.materialize(`data:image/png;base64,${png}`, "user-1");

    expect(url).toMatch(/^\/assets\/user-1\/.+\.png$/);
    const bytes = await readFile(join(root, "user-1", url.split("/").at(-1)!));
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(await store.toDataUrl(url)).toBe(`data:image/png;base64,${png}`);
  });

  it("rejects content whose magic bytes do not match its declared image type", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-assets-"));
    const store = new LocalAssetStore(root);
    await expect(store.materialize("data:image/png;base64,aGVsbG8=", "user-1")).rejects.toThrow("INVALID_IMAGE_BYTES");
  });

  it("rejects a truncated image even when its magic bytes look valid", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-assets-"));
    const store = new LocalAssetStore(root);
    const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    await expect(
      store.materialize(`data:image/png;base64,${truncatedPng}`, "user-1")
    ).rejects.toThrow("IMAGE_DECODE_FAILED");
  });

  it("migrates a legacy unscoped local asset into an owner directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-assets-"));
    const store = new LocalAssetStore(root);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    await writeFile(join(root, "legacy.png"), png);
    const url = await store.materialize("/assets/legacy.png", "user-1");
    expect(url).toMatch(/^\/assets\/user-1\/.+\.png$/);
    await expect(readFile(join(root, "user-1", url.split("/").at(-1)!))).resolves.toEqual(png);
  });
});
