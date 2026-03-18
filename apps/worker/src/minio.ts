import * as Minio from "minio";
import { config } from "./config.js";

export const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

export async function downloadFile(
  bucket: string,
  key: string,
  destPath: string,
) {
  await minioClient.fGetObject(bucket, key, destPath);
}

export async function uploadFile(bucket: string, key: string, srcPath: string) {
  await minioClient.fPutObject(bucket, key, srcPath);
}
