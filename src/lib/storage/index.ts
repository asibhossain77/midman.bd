/**
 * Midman.bd — Payment-proof storage.
 *
 * Two interchangeable drivers behind one interface:
 *
 *  R2    — Cloudflare R2 (S3-compatible). Active when R2_ACCOUNT_ID +
 *          R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME are
 *          all set. This is the PRODUCTION driver.
 *  local — a private on-disk directory (.data/uploads). Used when R2 is
 *          not configured (local dev, CI). Files are served through the
 *          authenticated /api/media/payment-proof/[id] route — the
 *          directory itself is never public.
 *
 * Object keys are opaque text in the DB (`transactions.proof_key`,
 * `deals.payment_proof_key`) — never URLs, so the driver can change
 * without a migration.
 */

import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
/** 8 MB — generous for screenshots, small enough to be sane. */
export const MAX_PROOF_BYTES = 8 * 1024 * 1024;
export const PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface StorageDriver {
  readonly name: "r2" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

/* ----------------------------- R2 driver ---------------------------- */

class R2Driver implements StorageDriver {
  readonly name = "r2" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
    this.bucket = process.env.R2_BUCKET_NAME!;
    this.client = new S3Client({
      region: "auto",
      endpoint:
        process.env.R2_ENDPOINT ??
        `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: process.env.R2_FORCE_PATH_STYLE === "1",
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async get(
    key: string
  ): Promise<{ body: Buffer; contentType: string } | null> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}

/* ---------------------------- Local driver -------------------------- */

class LocalDriver implements StorageDriver {
  readonly name = "local" as const;

  private safePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.join(LOCAL_ROOT, normalized);
    if (!full.startsWith(LOCAL_ROOT)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const full = this.safePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    await fs.writeFile(`${full}.meta`, contentType, "utf8");
  }

  async get(
    key: string
  ): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const full = this.safePath(key);
      const body = await fs.readFile(full);
      let contentType = "application/octet-stream";
      try {
        contentType = (await fs.readFile(`${full}.meta`, "utf8")).trim();
      } catch {
        /* meta missing — fall back to the generic type */
      }
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const full = this.safePath(key);
      await fs.unlink(full);
      await fs.unlink(`${full}.meta`).catch(() => undefined);
    } catch {
      /* already gone */
    }
  }
}

/* --------------------------- Resolution ----------------------------- */

let driver: StorageDriver | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

export function getStorage(): StorageDriver {
  if (!driver) {
    driver = isR2Configured() ? new R2Driver() : new LocalDriver();
  }
  return driver;
}

/** Public, non-guessable proof key: proofs/<year>/<random>.<ext>. */
export function newProofKey(originalName: string): string {
  const ext = path.extname(originalName || "").toLowerCase();
  const safeExt = /^\.(jpe?g|png|webp)$/.test(ext) ? ext : "";
  const rand = crypto.randomBytes(16).toString("hex");
  const year = new Date().getUTCFullYear();
  return `proofs/${year}/${rand}${safeExt}`;
}

/** Validate an uploaded proof file (size + mime). Returns an error key or null. */
export function validateProofFile(file: {
  size: number;
  type: string;
}): "file_too_large" | "file_type" | null {
  if (file.size > MAX_PROOF_BYTES) return "file_too_large";
  if (!PROOF_MIME_TYPES.has(file.type)) return "file_type";
  return null;
}
