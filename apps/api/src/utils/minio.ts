import * as Minio from "minio";
import { MINIO_BUCKETS } from "@judge/shared";
import { config } from "../config.js";

export const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

/** Ensure required buckets exist */
export async function ensureBuckets() {
  for (const bucket of Object.values(MINIO_BUCKETS)) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`Created MinIO bucket: ${bucket}`);
    }
  }
}

/** Upload a buffer to MinIO */
export async function uploadBuffer(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType?: string,
) {
  await minioClient.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": contentType ?? "application/octet-stream",
  });
}

/** Get a presigned URL for viewing */
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiry = 3600,
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expiry);
}

/** Download file as buffer */
export async function downloadBuffer(
  bucket: string,
  key: string,
): Promise<Buffer> {
  const stream = await minioClient.getObject(bucket, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
