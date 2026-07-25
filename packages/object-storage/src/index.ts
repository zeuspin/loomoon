import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3ObjectStorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class S3ObjectStorage {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(options: S3ObjectStorageOptions) {
    this.#bucket = options.bucket;
    this.#client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle ?? true,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      }
    });
  }

  objectKey(userId: string, projectId: string, assetId: string, extension: string): string {
    for (const value of [userId, projectId, assetId, extension]) assertKeySegment(value);
    return `users/${userId}/projects/${projectId}/assets/${assetId}.${extension}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.#client.send(new PutObjectCommand({
      Bucket: this.#bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }));
  }

  async signedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.#client,
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
      { expiresIn: Math.max(30, Math.min(900, expiresInSeconds)) }
    );
  }

  async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }));
  }
}

function assertKeySegment(value: string): void {
  if (!/^[a-z0-9_-]+$/i.test(value)) throw new Error("INVALID_OBJECT_KEY_SEGMENT");
}
