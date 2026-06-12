import { app } from "electron"
import { execFile, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DEFAULT_SERVER_URL_KEY, WSL_ENABLED_KEY } from "./constants"
import { getUserShell, loadShellEnv } from "./shell-env"
import { getStore } from "./store"

export type WslConfig = { enabled: boolean }

export type HealthCheck = { wait: Promise<void> }

export function getDefaultServerUrl(): string | null {
  const value = getStore().get(DEFAULT_SERVER_URL_KEY)
  return typeof value === "string" ? value : null
}

export function setDefaultServerUrl(url: string | null) {
  if (url) {
    getStore().set(DEFAULT_SERVER_URL_KEY, url)
    return
  }

  getStore().delete(DEFAULT_SERVER_URL_KEY)
}

export function getWslConfig(): WslConfig {
  const value = getStore().get(WSL_ENABLED_KEY)
  return { enabled: typeof value === "boolean" ? value : false }
}

export function setWslConfig(config: WslConfig) {
  getStore().set(WSL_ENABLED_KEY, config.enabled)
}

// Find the compiled binary
function findBinary(): string | null {
  const possiblePaths = [
    // Packaged mode: binary in app bundle Resources
    join(process.resourcesPath, "bin/mimo"),
    // Dev mode: binary built in packages/opencode/dist
    join(process.cwd(), "../opencode/dist/mimocode-darwin-arm64/bin/mimo"),
    join(process.cwd(), "../opencode/dist/mimocode-darwin-x64/bin/mimo"),
    // Absolute path fallback
    "/Users/vv/Desktop/MiMo-Code-0.1.0/packages/opencode/dist/mimocode-darwin-arm64/bin/mimo",
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      console.log("[MiMo Code] Found binary at:", p)
      return p
    }
  }
  console.log("[MiMo Code] Searched paths:", possiblePaths)
  return null
}

export async function spawnLocalServer(hostname: string, port: number, password: string) {
  prepareServerEnv(password)

  const binaryPath = findBinary()
  if (!binaryPath) {
    throw new Error("MiMo Code binary not found. Please build the opencode package first.")
  }

  console.log("[MiMo Code] Using binary:", binaryPath)

  // Spawn the binary as a sidecar process
  const child = spawn(binaryPath, ["serve", "--port", String(port), "--hostname", hostname, "--print-logs"], {
    env: {
      ...process.env,
      OPENCODE_SERVER_USERNAME: "mimocode",
      OPENCODE_SERVER_PASSWORD: password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout?.on("data", (data: Buffer) => {
    console.log("[MiMo Code Server]", data.toString().trim())
  })

  child.stderr?.on("data", (data: Buffer) => {
    console.error("[MiMo Code Server]", data.toString().trim())
  })

  child.on("error", (err) => {
    console.error("[MiMo Code] Failed to start server:", err)
  })

  child.on("exit", (code) => {
    console.log("[MiMo Code] Server exited with code:", code)
  })

  const wait = (async () => {
    const url = `http://${hostname}:${port}`

    const ready = async () => {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (await checkHealth(url, password)) return
      }
    }

    await ready()
  })()

  return {
    listener: {
      stop: () => {
        child.kill()
      },
    } as any,
    health: { wait },
  }
}

function prepareServerEnv(password: string) {
  const shell = process.platform === "win32" ? null : getUserShell()
  const shellEnv = shell ? (loadShellEnv(shell) ?? {}) : {}
  const env = {
    ...process.env,
    ...shellEnv,
    OPENCODE_EXPERIMENTAL_ICON_DISCOVERY: "true",
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
    OPENCODE_CLIENT: "desktop",
    OPENCODE_SERVER_USERNAME: "mimocode",
    OPENCODE_SERVER_PASSWORD: password,
    XDG_STATE_HOME: app.getPath("userData"),
  }
  Object.assign(process.env, env)
}

export async function checkHealth(url: string, password?: string | null): Promise<boolean> {
  let healthUrl: URL
  try {
    healthUrl = new URL("/global/health", url)
  } catch {
    return false
  }

  const headers = new Headers()
  if (password) {
    const auth = Buffer.from(`mimocode:${password}`).toString("base64")
    headers.set("authorization", `Basic ${auth}`)
  }

  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
