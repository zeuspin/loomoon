import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "./index.js";

describe("S3ObjectStorage", () => {
  it("builds tenant-scoped object keys and rejects path injection", () => {
    const storage = new S3ObjectStorage({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "loomoon-assets",
      accessKeyId: "test",
      secretAccessKey: "test-secret"
    });
    expect(storage.objectKey("user-1", "project-1", "asset-1", "png")).toBe(
      "users/user-1/projects/project-1/assets/asset-1.png"
    );
    expect(() => storage.objectKey("../other", "project-1", "asset-1", "png")).toThrow(
      "INVALID_OBJECT_KEY_SEGMENT"
    );
  });
});
