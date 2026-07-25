import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imageSize } from "image-size";

const maxAssetBytes = 20 * 1024 * 1024;

export class LocalAssetStore {
  constructor(private readonly root: string) {}

  async materialize(source: string, ownerId: string): Promise<string> {
    assertSafeSegment(ownerId);
    const { bytes, mime } = source.startsWith("data:")
      ? decodeDataUrl(source)
      : /^\/assets\/[^/]+$/.test(source)
        ? await readLegacyImage(this.root, source)
        : await downloadImage(source);
    if (bytes.byteLength > maxAssetBytes) throw new Error("IMAGE_TOO_LARGE");
    if (!matchesMagicBytes(bytes, mime)) throw new Error("INVALID_IMAGE_BYTES");
    try {
      const dimensions = imageSize(bytes);
      if (!dimensions.width || !dimensions.height) throw new Error("missing dimensions");
    } catch {
      throw new Error("IMAGE_DECODE_FAILED");
    }
    const extension = extensionFor(mime);
    const filename = `${crypto.randomUUID()}.${extension}`;
    await mkdir(join(this.root, ownerId), { recursive: true });
    await writeFile(join(this.root, ownerId, filename), bytes);
    return `/assets/${ownerId}/${filename}`;
  }

  async toDataUrl(assetUrl: string): Promise<string> {
    if (assetUrl.startsWith("data:")) return assetUrl;
    if (!assetUrl.startsWith("/assets/")) return assetUrl;
    const [ownerId, filename, extra] = assetUrl.slice("/assets/".length).split("/");
    if (!ownerId || !filename || extra) throw new Error("INVALID_ASSET_URL");
    assertSafeSegment(ownerId);
    assertSafeSegment(filename);
    const bytes = await readFile(join(this.root, ownerId, filename));
    const extension = filename.split(".").at(-1)?.toLowerCase() ?? "png";
    const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
}

async function readLegacyImage(root: string, source: string): Promise<{ bytes: Buffer; mime: string }> {
  const filename = source.slice("/assets/".length);
  assertSafeSegment(filename);
  const extension = filename.split(".").at(-1)?.toLowerCase();
  const mime =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : "image/png";
  return { bytes: await readFile(join(root, filename)), mime };
}

function assertSafeSegment(value: string): void {
  if (!/^[a-z0-9._-]+$/i.test(value) || value === "." || value === "..") {
    throw new Error("INVALID_ASSET_PATH");
  }
}

function decodeDataUrl(source: string): { bytes: Buffer; mime: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(source);
  if (!match?.[1] || !match[2]) throw new Error("INVALID_IMAGE_DATA_URL");
  return { bytes: Buffer.from(match[2], "base64"), mime: match[1].toLowerCase() };
}

async function downloadImage(source: string): Promise<{ bytes: Buffer; mime: string }> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`IMAGE_DOWNLOAD_FAILED_${response.status}`);
  const mime = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new Error("INVALID_IMAGE_MIME");
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mime };
}

function extensionFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function matchesMagicBytes(bytes: Buffer, mime: string): boolean {
  if (mime === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}
