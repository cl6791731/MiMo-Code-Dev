/**
 * Bun API polyfill for Node.js (Electron) environment.
 * Provides Bun.file() and Bun.write() using Node.js fs module.
 */
import fs from "fs/promises"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { createHash } from "node:crypto"

function polyfill() {
  if (typeof (globalThis as any).Bun !== "undefined") return

  const fileCache = new Map<string, { stat: () => Promise<{ size: number }> }>()

  const bunFile = (pathOrBuffer: string | Uint8Array | Buffer, options?: any) => {
    const filePath = typeof pathOrBuffer === "string" ? pathOrBuffer : ""

    if (fileCache.has(filePath)) return fileCache.get(filePath)!

    const fileObj = {
      text: async (): Promise<string> => {
        return fs.readFile(filePath, "utf-8")
      },
      json: async <T = any>(): Promise<T> => {
        const text = await fileObj.text()
        return JSON.parse(text)
      },
      arrayBuffer: async (): Promise<ArrayBuffer> => {
        const buffer = await fs.readFile(filePath)
        // Return only the file's bytes (Buffer may share a larger pool).
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      },
      exists: async (): Promise<boolean> => {
        return existsSync(filePath)
      },
      size: 0,
      stat: async () => {
        const stat = await fs.stat(filePath)
        return { size: stat.size }
      },
      writer: () => {
        let chunks: (string | Uint8Array)[] = []
        return {
          write(chunk: string | Uint8Array) {
            chunks.push(chunk)
            return this
          },
          async flush() {
            const data = chunks.length === 1
              ? (typeof chunks[0] === "string" ? chunks[0] : Buffer.from(chunks[0]))
              : Buffer.concat(chunks.map(c => typeof c === "string" ? Buffer.from(c) : Buffer.from(c)))
            await fs.writeFile(filePath, data)
          },
          end() {
            return this.flush()
          },
        }
      },
    }

    fileCache.set(filePath, fileObj as any)
    return fileObj as any
  }

  const bunWrite = async (
    dest: string | { path: string; file?: File },
    body?: string | Blob | ArrayBuffer | Uint8Array | ReadableStream,
  ): Promise<number> => {
    const filePath = typeof dest === "string" ? dest : dest.path
    let data: Buffer | string

    if (body === undefined && typeof dest === "object" && "path" in dest) {
      // Bun.write({ path, file }) form
      data = Buffer.alloc(0)
    } else if (typeof body === "string") {
      data = body
    } else if (body instanceof ArrayBuffer) {
      data = Buffer.from(body)
    } else if (body instanceof Uint8Array) {
      data = Buffer.from(body)
    } else if (body instanceof Blob) {
      data = Buffer.from(await body.arrayBuffer())
    } else if (body && typeof (body as any).getReader === "function") {
      // ReadableStream
      const reader = (body as ReadableStream).getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      data = Buffer.concat(chunks)
    } else {
      data = Buffer.alloc(0)
    }

    if (typeof data === "string") {
      await fs.writeFile(filePath, data, "utf-8")
      return Buffer.byteLength(data)
    }
    await fs.writeFile(filePath, data)
    return data.length
  }

  const bunStringWidth = (str: string): number => {
    // Simple implementation: count characters (no proper Unicode width support)
    return [...str].length
  }

  /**
   * Bun.CryptoHasher polyfill backed by node:crypto.
   * Supports the subset used by the bundled opencode server:
   *   new Bun.CryptoHasher("sha256").update(data).digest("hex")
   * update() is chainable; digest() without an encoding returns an ArrayBuffer.
   */
  class CryptoHasher {
    private hash: ReturnType<typeof createHash>
    constructor(algorithm: string) {
      const normalized = algorithm.toLowerCase().replace(/-/g, "")
      this.hash = createHash(normalized)
    }
    update(data: string | ArrayBuffer | Uint8Array) {
      this.hash.update(data as any)
      return this
    }
    digest(encoding?: "hex" | "base64" | "base64url" | "latin1") {
      if (encoding) return this.hash.digest(encoding as any)
      const buf = this.hash.digest()
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    }
  }

  const bunArgv = ["bun", ...process.argv.slice(1)]

  ;(globalThis as any).Bun = {
    file: bunFile,
    write: bunWrite,
    stringWidth: bunStringWidth,
    CryptoHasher,
    argv: bunArgv,
    version: "0.0.0-polyfill",
    $: undefined,
  }

  console.log("[bun-polyfill] Bun API polyfill loaded for Node.js environment")
}

polyfill()
