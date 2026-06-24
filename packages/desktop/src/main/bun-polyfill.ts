/**
 * Bun API polyfill for Node.js (Electron) environment.
 * Provides Bun.file() and Bun.write() using Node.js fs module.
 */
import fs from "fs/promises"
import { existsSync, readFileSync } from "fs"
import path from "path"

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
        return buffer.buffer
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

  ;(globalThis as any).Bun = {
    file: bunFile,
    write: bunWrite,
    stringWidth: bunStringWidth,
    version: "0.0.0-polyfill",
    $: undefined,
  }

  console.log("[bun-polyfill] Bun API polyfill loaded for Node.js environment")
}

polyfill()
